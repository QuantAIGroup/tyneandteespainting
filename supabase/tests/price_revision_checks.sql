-- Checks for 20261123170000_price_revision_full_payment.sql
-- Run by supabase/tests/run-migration-tests.sh on a LOCAL throwaway database only.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned

-- Runs the statement AS the real database role named in the claims (service_role,
-- authenticated or anon), exactly as Supabase does. Empty claims = the database owner.
create or replace function pg_temp.become(claims text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', claims, true);
  if claims <> '' and (claims::jsonb ->> 'role') in ('service_role', 'authenticated', 'anon') then
    execute format('set local role %I', claims::jsonb ->> 'role');
  end if;
end $$;

create or replace function pg_temp.expect_reject(label text, stmt text, claims text default '{"role":"service_role"}') returns text language plpgsql as $$
begin
  begin
    perform pg_temp.become(claims);
    execute stmt;
  exception when check_violation or not_null_violation or unique_violation or raise_exception or insufficient_privilege then
    return 'PASS  rejected: ' || label || '  [' || sqlerrm || ']';
  end;
  raise exception 'FAIL  accepted but should be rejected: %', label;
end $$;

create or replace function pg_temp.expect_ok(label text, stmt text, claims text default '{"role":"service_role"}') returns text language plpgsql as $$
begin
  perform pg_temp.become(claims);
  execute stmt;
  reset role;
  return 'PASS  accepted: ' || label;
end $$;

-- ---------------------------------------------------------------- existing data
select case when
  not exists (select * from public._before except select * from public._after_view)
  and not exists (select * from public._after_view except select * from public._before)
then 'PASS  existing customer records identical after the migration and after re-running it'
else 'FAIL  existing customer records changed' end;
select 'PASS  row counts unchanged: ' || (select count(*) from public.enquiries) || ' enquiries, ' || (select count(*) from public.quote_rooms) || ' room records, ' || (select count(*) from public.enquiry_photos) || ' photos';

-- ---------------------------------------------------------------- prices
select case when value->'bedroom' = '{"ratePerSqm":5.5,"minimumCharge":185}'::jsonb and value->'livingRoom' = '{"ratePerSqm":5.5,"minimumCharge":225}'::jsonb and value->'standardCoats' = '2'
  then 'PASS  bedroom, living room and standard coats unchanged' else 'FAIL  ' || value::text end from public.settings where key = 'pricing';
select case when value->'ceiling' = '{"ratePerSqm":6,"minimumCharge":55}'::jsonb
  and value->'extras' = '{"door_frame":30,"window_frame":30,"radiator_standard":30,"radiator_large":45,"feature_wall":55,"interior_door":65}'::jsonb
  and value->'roundToNearest' = '0'
  then 'PASS  ceiling £6/m² (£55 min), all six extras and exact totals match the approved list' else 'FAIL  prices: ' || value::text end from public.settings where key = 'pricing';
select case when value->'skirting'->>'ratePerMetre' = '6.25'
  then 'PASS  re-running did NOT overwrite a price changed in the admin area afterwards (skirting kept at £6.25)'
  else 'FAIL  re-run overwrote an admin price: ' || (value->'skirting')::text end from public.settings where key = 'pricing';

-- ---------------------------------------------------------------- rules exist once, exactly as written
select case when count(*) = 7 then 'PASS  each of the 7 rules exists exactly once after two runs' else 'FAIL  rule count ' || count(*) end
from pg_constraint where conname in ('enquiries_full_payment_only', 'enquiries_full_payment_amount', 'enquiries_paid_in_full', 'enquiries_payment_needs_consent', 'enquiries_early_start_needs_terms', 'quote_rooms_item_type_check', 'quote_rooms_extra_shape_check');
select case when count(*) = 3 then 'PASS  triggers attached exactly as intended: payment lock BEFORE UPDATE FOR EACH ROW, delete guard BEFORE DELETE FOR EACH ROW, truncate guard BEFORE TRUNCATE FOR EACH STATEMENT – all enabled'
  else 'FAIL  trigger configuration' end
from pg_trigger t where t.tgrelid = 'public.enquiries'::regclass and t.tgenabled = 'O' and (
     (t.tgname = 'enquiries_protect_payment' and t.tgtype = 19 and t.tgfoid = 'public.protect_payment_fields()'::regprocedure)
  or (t.tgname = 'enquiries_prevent_paid_delete' and t.tgtype = 11 and t.tgfoid = 'public.prevent_paid_enquiry_delete()'::regprocedure)
  or (t.tgname = 'enquiries_prevent_paid_truncate' and t.tgtype = 34 and t.tgfoid = 'public.prevent_paid_enquiry_truncate()'::regprocedure));
select case when (select count(*) from pg_trigger where tgrelid = 'public.enquiries'::regclass and not tgisinternal) = 4
  then 'PASS  no duplicate or stray triggers on enquiries (3 protective + the existing updated_at trigger)' else 'FAIL  unexpected triggers' end;
select case when count(*) = 2 then 'PASS  delete and truncate guard functions: SECURITY INVOKER, owner postgres, search_path "", owner-only execute'
  else 'FAIL  guard function properties' end
from pg_proc p where p.oid in ('public.prevent_paid_enquiry_delete()'::regprocedure, 'public.prevent_paid_enquiry_truncate()'::regprocedure)
  and not p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres' and p.proconfig = array['search_path=""'] and p.proacl::text = '{postgres=X/postgres}';

-- ---------------------------------------------------------------- security preserved
select case when not p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres' and p.proconfig = array['search_path=""'] and p.proacl::text = '{postgres=X/postgres}'
  then 'PASS  protect_payment_fields: SECURITY INVOKER, owner postgres, search_path "", owner-only execute (unchanged)'
  else 'FAIL  function properties changed' end
from pg_proc p where p.oid = 'public.protect_payment_fields()'::regprocedure;
select case when count(*) = 1 then 'PASS  payment-protection trigger still attached to enquiries' else 'FAIL  trigger missing' end
from pg_trigger where tgrelid = 'public.enquiries'::regclass and tgname = 'enquiries_protect_payment' and tgfoid = 'public.protect_payment_fields()'::regprocedure;
select case when not has_table_privilege('anon', 'public.enquiries', 'SELECT') and not has_table_privilege('anon', 'public.quote_rooms', 'SELECT')
  and not has_table_privilege('anon', 'public.enquiries', 'TRUNCATE') and has_table_privilege('anon', 'public.settings', 'SELECT')
  and not has_column_privilege('anon', 'public.quote_rooms', 'extra_kind', 'SELECT') and not has_column_privilege('anon', 'public.enquiries', 'early_start_requested_at', 'SELECT')
  and has_table_privilege('service_role', 'public.quote_rooms', 'INSERT') and not has_table_privilege('service_role', 'public.enquiries', 'TRUNCATE')
  then 'PASS  table permissions unchanged (visitors: prices only; new columns not readable by visitors; server: no TRUNCATE)'
  else 'FAIL  permissions changed' end;

-- ---------------------------------------------------------------- extras: valid
select pg_temp.expect_ok('fixed extra: 3 door frames × £30 = £90', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 10, 'extra', 'Door frames', 'door_frame', 3, 3000, 9000, false)$q$);
select pg_temp.expect_ok('inspection extra: 1 sash window, no price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 11, 'extra', 'Sash', 'sash_window', 1, true)$q$);
select pg_temp.expect_ok('measured room (no extra fields)', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 12, 'bedroom', 'Bedroom 2', 2, '{}', 18500)$q$);

-- ---------------------------------------------------------------- extras: invalid (including every NULL combination)
select pg_temp.expect_reject('extra with NULL kind', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 20, 'extra', 'X', 1, 3000, 3000)$q$);
select pg_temp.expect_reject('unknown extra kind', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 21, 'extra', 'X', 'hot_tub', 1, 3000, 3000)$q$);
select pg_temp.expect_reject('fixed extra with NULL quantity', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 22, 'extra', 'X', 'door_frame', 3000, 3000)$q$);
select pg_temp.expect_reject('quantity 0', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 23, 'extra', 'X', 'door_frame', 0, 3000, 0)$q$);
select pg_temp.expect_reject('quantity 51', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 24, 'extra', 'X', 'door_frame', 51, 3000, 153000)$q$);
select pg_temp.expect_reject('fixed extra with NULL unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 25, 'extra', 'X', 'door_frame', 2, 6000)$q$);
select pg_temp.expect_reject('fixed extra with NULL estimated total', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence) values ('11111111-1111-4111-a111-111111111111', 26, 'extra', 'X', 'door_frame', 2, 3000)$q$);
select pg_temp.expect_reject('fixed extra total ≠ quantity × unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 27, 'extra', 'X', 'door_frame', 3, 3000, 3000)$q$);
select pg_temp.expect_reject('negative unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 28, 'extra', 'X', 'door_frame', 1, -5, -5)$q$);
select pg_temp.expect_reject('fixed extra marked for manual quote', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 29, 'extra', 'X', 'door_frame', 1, 3000, 3000, true)$q$);
select pg_temp.expect_reject('inspection extra given a unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 30, 'extra', 'X', 'sash_window', 1, 3000, true)$q$);
select pg_temp.expect_reject('inspection extra given an estimated total', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 31, 'extra', 'X', 'sash_window', 1, 3000, true)$q$);
select pg_temp.expect_reject('inspection extra not marked for manual quote', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 32, 'extra', 'X', 'sash_window', 1, false)$q$);
select pg_temp.expect_reject('inspection extra with NULL quantity', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 33, 'extra', 'X', 'sash_window', true)$q$);
select pg_temp.expect_reject('measured room carrying extra fields', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, extra_kind, quantity) values ('11111111-1111-4111-a111-111111111111', 34, 'bedroom', 'X', 2, '{}', 'door_frame', 1)$q$);
select pg_temp.expect_reject('measured room with NULL coats', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, condition) values ('11111111-1111-4111-a111-111111111111', 35, 'bedroom', 'X', '{}')$q$);
select pg_temp.expect_reject('measured room with NULL condition', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats) values ('11111111-1111-4111-a111-111111111111', 36, 'bedroom', 'X', 2)$q$);
select pg_temp.expect_reject('fixed extra with coats', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, coats) values ('11111111-1111-4111-a111-111111111111', 40, 'extra', 'X', 'door_frame', 1, 3000, 3000, 2)$q$);
select pg_temp.expect_reject('fixed extra with a condition', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, condition) values ('11111111-1111-4111-a111-111111111111', 41, 'extra', 'X', 'door_frame', 1, 3000, 3000, '{}')$q$);
select pg_temp.expect_reject('inspection extra with coats and condition', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, requires_manual_quote, coats, condition) values ('11111111-1111-4111-a111-111111111111', 42, 'extra', 'X', 'sash_window', 1, true, 2, '{}')$q$);
select pg_temp.expect_reject('fixed extra with room measurements', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, length_m, width_m) values ('11111111-1111-4111-a111-111111111111', 43, 'extra', 'X', 'door_frame', 1, 3000, 3000, 4, 3)$q$);
select pg_temp.expect_reject('inspection extra with a wall area', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, requires_manual_quote, wall_area_sqm) values ('11111111-1111-4111-a111-111111111111', 44, 'extra', 'X', 'sash_window', 1, true, 20)$q$);
select pg_temp.expect_reject('extra with include_ceiling', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, include_ceiling) values ('11111111-1111-4111-a111-111111111111', 45, 'extra', 'X', 'door_frame', 1, 3000, 3000, true)$q$);
select pg_temp.expect_reject('measured room with a unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, unit_price_pence) values ('11111111-1111-4111-a111-111111111111', 46, 'ceiling', 'X', 2, '{}', 600)$q$);
select pg_temp.expect_reject('measured room with coats out of range', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition) values ('11111111-1111-4111-a111-111111111111', 47, 'bedroom', 'X', 9, '{}')$q$);
select pg_temp.expect_reject('unit price over £10,000', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 48, 'extra', 'X', 'door_frame', 1, 1000001, 1000001)$q$);
select pg_temp.expect_ok('largest allowed extra: 50 × £10,000 = £500,000 (BIGINT maths)', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 49, 'extra', 'X', 'door_frame', 50, 1000000, 50000000)$q$);
select pg_temp.expect_reject('a total that would overflow a normal integer', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 50, 'extra', 'X', 'door_frame', 50, 2147483647, 2147483647)$q$);
select pg_temp.expect_reject('room estimate over £1,000,000', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 51, 'bedroom', 'X', 2, '{}', 100000001)$q$);
select pg_temp.expect_ok('measured room needing a manual quote (e.g. wallpaper): flag on, no price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 52, 'living_room', 'Wallpapered lounge', 2, '{"wallpaperToRemove":true}', true)$q$);
select pg_temp.expect_reject('priced measured room flagged as needing a manual quote', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 53, 'bedroom', 'X', 2, '{}', 19800, true)$q$);
select pg_temp.expect_reject('measured room with no price but not flagged for a manual quote', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 54, 'bedroom', 'X', 2, '{}', false)$q$);
select pg_temp.expect_reject('NULL item type', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition) values ('11111111-1111-4111-a111-111111111111', 37, null, 'X', 2, '{}')$q$);

-- ---------------------------------------------------------------- payments: only exactly 100%
select pg_temp.expect_ok('agreed price with exactly 100% payment', $q$update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 37550, deposit_pence = 37550, payment_type = 'full', deposit_percent = null where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('50% deposit request', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'deposit', deposit_percent = 50 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('part-payment labelled as full', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'full' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('custom amount', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 34000, payment_type = 'custom' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('agreed price with NULL payment amount', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = null where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('payment amount without an agreed price', $q$update public.enquiries set agreed_price_pence = null, deposit_pence = 40000 where reference = 'PRE-2'$q$);
select pg_temp.expect_reject('NULL payment type', $q$update public.enquiries set payment_type = null where reference = 'PRE-2'$q$);
select pg_temp.expect_reject('full payment with a deposit percentage set (even 100%)', $q$update public.enquiries set agreed_price_pence = 37550, deposit_pence = 37550, payment_type = 'full', deposit_percent = 100 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('agreed price over £50,000', $q$update public.enquiries set agreed_price_pence = 5000001, deposit_pence = 5000001 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('payment recorded without the cancellation policy confirmed', $q$update public.enquiries set deposit_paid_at = now(), deposit_paid_pence = 37550, stripe_payment_intent_id = 'pi_noconsent', status = 'booking_confirmed', payment_token = 'tok_1' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('early-start request without the cancellation policy confirmed', $q$update public.enquiries set early_start_requested_at = now() where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('website server records the cancellation confirmation only (no early start)', $q$update public.enquiries set cancellation_terms_accepted_at = now() where reference = 'PRE-1'$q$);
select case when early_start_requested_at is null then 'PASS  accepting the terms did not set an early-start request' else 'FAIL  early start set automatically' end from public.enquiries where reference = 'PRE-1';
select pg_temp.expect_reject('paid amount different from the agreed price', $q$update public.enquiries set deposit_paid_at = now(), deposit_paid_pence = 18775, stripe_payment_intent_id = 'pi_half', status = 'booking_confirmed' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('paid date with NULL paid amount', $q$update public.enquiries set deposit_paid_at = now(), deposit_paid_pence = null, stripe_payment_intent_id = 'pi_null', status = 'booking_confirmed' where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('payment of exactly the agreed price confirms the booking', $q$update public.enquiries set deposit_paid_at = now(), deposit_paid_pence = 37550, stripe_payment_intent_id = 'pi_full', status = 'booking_confirmed', payment_token = 'tok_1' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('a second payment recorded on a paid booking', $q$update public.enquiries set deposit_paid_at = now(), stripe_payment_intent_id = 'pi_second' where reference = 'PRE-1'$q$);
-- After payment the record is locked even for the website server
select pg_temp.expect_reject('server changing the paid amount', $q$update public.enquiries set deposit_paid_pence = 1 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server changing the agreed price after payment', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 40000, deposit_paid_pence = 40000 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server changing the Stripe payment reference', $q$update public.enquiries set stripe_payment_intent_id = 'pi_other' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server changing the Stripe checkout reference', $q$update public.enquiries set stripe_checkout_session_id = 'cs_other' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server changing the payment link token', $q$update public.enquiries set payment_token = null where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server changing the cancellation confirmation after payment', $q$update public.enquiries set cancellation_terms_accepted_at = now() + interval '1 day' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server setting an early-start request after payment', $q$update public.enquiries set early_start_requested_at = now() where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('paid booking moved back to "payment requested"', $q$update public.enquiries set status = 'deposit_requested' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('paid booking moved back to "price agreed"', $q$update public.enquiries set status = 'price_agreed' where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('Stripe receipt link filled in once (was empty)', $q$update public.enquiries set stripe_receipt_url = 'https://pay.stripe.com/receipts/r1', stripe_customer_id = 'cus_1' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('Stripe receipt link changed once set', $q$update public.enquiries set stripe_receipt_url = 'https://evil.example' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('Stripe customer changed once set', $q$update public.enquiries set stripe_customer_id = 'cus_2' where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('paid booking moved forward to work completed', $q$update public.enquiries set status = 'work_completed' where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('paid booking cancelled (refund made in Stripe)', $q$update public.enquiries set status = 'cancelled' where reference = 'PRE-1'$q$);
select pg_temp.expect_ok('admin can add notes to a paid booking', $q$update public.enquiries set admin_notes = 'Refunded in Stripe 24 Nov' where reference = 'PRE-1'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_reject('admin deleting a paid booking', $q$delete from public.enquiries where reference = 'PRE-1'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_reject('server deleting a paid booking', $q$delete from public.enquiries where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('server TRUNCATE (no privilege)', $q$truncate public.enquiries cascade$q$);
select pg_temp.expect_reject('admin login TRUNCATE (no privilege)', $q$truncate public.enquiries cascade$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_reject('database owner TRUNCATE while a paid booking exists (e.g. SQL editor)', $q$truncate public.enquiries cascade$q$, '');
select pg_temp.expect_ok('payment log entry', $q$insert into public.payments (enquiry_id, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id, kind) values ('11111111-1111-4111-a111-111111111111', 'deposit_recorded', 37550, 'gbp', 'cs_1', 'pi_full', 'evt_1', 'full')$q$);
select pg_temp.expect_reject('the same Stripe payment logged twice', $q$insert into public.payments (enquiry_id, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id, kind) values ('11111111-1111-4111-a111-111111111111', 'deposit_recorded', 37550, 'gbp', 'cs_1', 'pi_full', 'evt_2', 'full')$q$);
select pg_temp.expect_reject('the same Stripe payment on a second booking', $q$update public.enquiries set stripe_payment_intent_id = 'pi_full' where reference = 'PRE-2'$q$);
select case when column_default = '''full''::text' then 'PASS  new payment requests default to full' else 'FAIL  default ' || column_default end
from information_schema.columns where table_name = 'enquiries' and column_name = 'payment_type';

-- ---------------------------------------------------------------- trigger behaviour preserved
select pg_temp.expect_ok('admin can still add notes (triggers run normally)', $q$update public.enquiries set admin_notes = 'Called customer' where reference = 'PRE-2'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_reject('admin login changing the cancellation confirmation', $q$update public.enquiries set early_start_requested_at = now() where reference = 'PRE-2'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_reject('admin login changing an agreed price', $q$update public.enquiries set agreed_price_pence = 1 where reference = 'PRE-1'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
select pg_temp.expect_ok('website server recording the cancellation confirmation', $q$update public.enquiries set cancellation_terms_accepted_at = now() where reference = 'PRE-2'$q$);
select pg_temp.expect_ok('admin can still delete an unpaid enquiry', $q$delete from public.enquiries where reference = 'PRE-2'$q$, '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}');
