-- Checks for 20261123170000_price_revision_full_payment.sql
-- Run by supabase/tests/run-migration-tests.sh on a LOCAL throwaway database.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.expect_reject(label text, stmt text) returns text language plpgsql as $$
begin
  begin
    execute stmt;
  exception when check_violation or not_null_violation then
    return 'PASS  rejected: ' || label;
  end;
  raise exception 'FAIL  accepted but should be rejected: %', label;
end $$;

create or replace function pg_temp.expect_ok(label text, stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return 'PASS  accepted: ' || label;
end $$;

-- Existing customer data is identical (ignoring the new, empty columns)
select case when
  not exists (select * from public._before except select * from public._after_view)
  and not exists (select * from public._after_view except select * from public._before)
then 'PASS  existing customer records identical after migration (and after re-running it)'
else 'FAIL  existing customer records changed' end;

select 'PASS  row counts: ' || (select count(*) from public.enquiries) || ' enquiries, ' || (select count(*) from public.quote_rooms) || ' room records, ' || (select count(*) from public.enquiry_photos) || ' photos';

-- Prices
select case when value->'bedroom' = '{"ratePerSqm":5.5,"minimumCharge":185}'::jsonb and value->'livingRoom' = '{"ratePerSqm":5.5,"minimumCharge":225}'::jsonb and value->'standardCoats' = '2'
  then 'PASS  bedroom and living room prices unchanged' else 'FAIL  room prices changed: ' || value::text end from public.settings where key = 'pricing';
select case when value->'ceiling' = '{"ratePerSqm":6,"minimumCharge":55}'::jsonb
  and value->'extras' = '{"door_frame":30,"window_frame":30,"radiator_standard":30,"radiator_large":45,"feature_wall":55,"interior_door":65}'::jsonb
  and value->'roundToNearest' = '0'
  then 'PASS  ceiling, extras and rounding match the approved list' else 'FAIL  prices: ' || value::text end from public.settings where key = 'pricing';
select case when value->'skirting'->>'ratePerMetre' = '6.25'
  then 'PASS  re-running did NOT overwrite a price changed in the admin area afterwards (skirting kept at £6.25)'
  else 'FAIL  re-run overwrote admin price: ' || (value->'skirting')::text end from public.settings where key = 'pricing';

-- Constraints exist exactly once
select case when count(*) = 6 then 'PASS  each new rule exists exactly once after two runs' else 'FAIL  constraint count ' || count(*) end
from pg_constraint where conname in ('enquiries_full_payment_only', 'quote_rooms_item_type_check', 'quote_rooms_extra_kind_check', 'quote_rooms_quantity_check', 'quote_rooms_unit_price_check', 'quote_rooms_extra_shape_check');

-- Function security properties unchanged
select case when not p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres' and p.proconfig = array['search_path=""'] and p.proacl::text = '{postgres=X/postgres}'
  then 'PASS  protect_payment_fields: SECURITY INVOKER, owner postgres, search_path "", owner-only execute (same as before)'
  else 'FAIL  function properties: ' || p.prosecdef || ' ' || coalesce(p.proacl::text, 'default') end
from pg_proc p where p.oid = 'public.protect_payment_fields()'::regprocedure;

-- Extras: valid rows accepted
select pg_temp.expect_ok('fixed extra: 3 door frames × £30 = £90', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 10, 'extra', 'Door frames', 'door_frame', 3, 3000, 9000, false)$q$);
select pg_temp.expect_ok('inspection extra: 1 sash window, no price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 11, 'extra', 'Sash', 'sash_window', 1, true)$q$);
-- Extras: invalid rows rejected
select pg_temp.expect_reject('extra with no kind', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 20, 'extra', 'X', 1, 3000, 3000)$q$);
select pg_temp.expect_reject('unknown extra kind', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 21, 'extra', 'X', 'hot_tub', 1, 3000, 3000)$q$);
select pg_temp.expect_reject('extra with no quantity', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 22, 'extra', 'X', 'door_frame', 3000, 3000)$q$);
select pg_temp.expect_reject('quantity 0', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 23, 'extra', 'X', 'door_frame', 0, 3000, 0)$q$);
select pg_temp.expect_reject('quantity 51', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 24, 'extra', 'X', 'door_frame', 51, 3000, 153000)$q$);
select pg_temp.expect_reject('fixed extra with no unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 25, 'extra', 'X', 'door_frame', 2, 6000)$q$);
select pg_temp.expect_reject('fixed extra whose total isn''t quantity × unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 26, 'extra', 'X', 'door_frame', 3, 3000, 3000)$q$);
select pg_temp.expect_reject('negative unit price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence) values ('11111111-1111-4111-a111-111111111111', 27, 'extra', 'X', 'door_frame', 1, -5, -5)$q$);
select pg_temp.expect_reject('inspection extra given a price', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, extra_kind, quantity, unit_price_pence, estimated_labour_pence, requires_manual_quote) values ('11111111-1111-4111-a111-111111111111', 28, 'extra', 'X', 'sash_window', 1, 3000, 3000, false)$q$);
select pg_temp.expect_reject('measured room carrying extra fields', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, extra_kind, quantity) values ('11111111-1111-4111-a111-111111111111', 29, 'bedroom', 'X', 2, '{}', 'door_frame', 1)$q$);
select pg_temp.expect_reject('measured room with no coats', $q$insert into public.quote_rooms (enquiry_id, position, item_type, label, condition) values ('11111111-1111-4111-a111-111111111111', 30, 'bedroom', 'X', '{}')$q$);

-- Payments: only 100% of the agreed price (acting as the website server, as the real site does)
select set_config('request.jwt.claims', '{"role":"service_role"}', false) is not null as _;
select pg_temp.expect_ok('agreed price with 100% payment', $q$update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 37550, deposit_pence = 37550, payment_type = 'full', deposit_percent = null where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('50% deposit request', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'deposit', deposit_percent = 50 where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('part-payment labelled as full', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'full' where reference = 'PRE-1'$q$);
select pg_temp.expect_reject('custom amount', $q$update public.enquiries set agreed_price_pence = 40000, deposit_pence = 34000, payment_type = 'custom' where reference = 'PRE-1'$q$);
select case when column_default = '''full''::text' then 'PASS  new payment requests default to full' else 'FAIL  default ' || column_default end
from information_schema.columns where table_name = 'enquiries' and column_name = 'payment_type';

select set_config('request.jwt.claims', '', false) is not null as _;

-- Consent fields: server only
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-a000-000000000001"}', true);
  set local role authenticated;
  update public.enquiries set early_start_requested_at = now();
  raise exception 'FAIL  admin changed the consent fields';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;
select 'PASS  admin login cannot change the cancellation confirmation';
