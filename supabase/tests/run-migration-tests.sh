#!/usr/bin/env bash
# Tests the price-revision migration on a LOCAL throwaway Postgres database.
# Usage: PGHOST=/tmp PGPORT=5499 PGUSER=postgres supabase/tests/run-migration-tests.sh
# (Never point this at the live Supabase database.)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q -X"
REAL_M=supabase/migrations/20261123170000_price_revision_full_payment.sql
PGVER=$($P -d postgres -tAc "show server_version_num")
echo "== Testing on PostgreSQL $($P -d postgres -tAc "show server_version")"
M="$REAL_M"   # the migration file exactly as it will run, on every version (version-dependent SQL is conditional inside it)
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; exit 1; }
q() { $P -d "$1" -tAc "$2"; }

fresh() {
  $P -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null 2>&1
  $P -d "$1" -f supabase/tests/supabase_stub.sql >/dev/null
  for f in supabase/migrations/2026111*.sql supabase/migrations/20261120*.sql supabase/migrations/20261123120000_quote_rooms.sql; do $P -d "$1" -f "$f" >/dev/null 2>&1; done
  # PG16 (local) has no MAINTAIN privilege keyword; Supabase runs PG17
  if [ "$PGVER" -ge 170000 ]; then $P -d "$1" -f supabase/migrations/20261123130000_api_grants.sql >/dev/null
  else sed 's/, maintain on tables/ on tables/' supabase/migrations/20261123130000_api_grants.sql | $P -d "$1" >/dev/null; fi
}

seed_customers() {
  $P -d "$1" >/dev/null <<'SQL'
insert into auth.users values ('00000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'admin@example.invalid');
insert into public.admin_users values ('00000000-0000-4000-a000-000000000001');
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence, payment_type)
values ('11111111-1111-4111-a111-111111111111', 'PRE-1', 'Existing Customer', 'e@example.invalid', '07000000000', 'NE1 1AA', 'phone', '[{"x":1}]', '{"y":2}', '{"z":3}', 34000, 'full'),
       ('22222222-2222-4222-a222-222222222222', 'PRE-2', 'Second Customer', 'f@example.invalid', '07000000001', 'NE2 2AA', 'email', '[]', '{}', '{}', 22500, 'full');
insert into public.quote_rooms (enquiry_id, position, item_type, label, measurement_mode, length_m, width_m, height_m, coats, condition, wall_area_sqm, estimated_labour_pence)
values ('11111111-1111-4111-a111-111111111111', 0, 'bedroom', 'Bedroom 1', 'simple', 4, 3.5, 2.4, 2, '{"surface":"good"}', 36, 19800),
       ('11111111-1111-4111-a111-111111111111', 1, 'skirting', 'Skirting', null, null, null, null, 2, '"good"', null, 7500),
       ('11111111-1111-4111-a111-111111111111', 2, 'ceiling', 'Ceiling', null, 2, 2, null, 2, '{"surface":"good"}', null, 6500),
       ('22222222-2222-4222-a222-222222222222', 0, 'living_room', 'Lounge', 'walls', null, null, null, 3, '{"surface":"good"}', 40, 22500);
insert into public.enquiry_photos (enquiry_id, storage_path) values ('11111111-1111-4111-a111-111111111111', 'pending/x/a.jpg');
-- A customer whose price has already been agreed, with measured walls, photos and a payment-log entry
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence,
    payment_type, status, agreed_service, agreed_price_pence, deposit_pence, consultation_confirmed_at, price_agreed_at, comments)
values ('33333333-3333-4333-a333-333333333333', 'PRE-3', 'Agreed Customer', 'g@example.invalid', '07000000002', 'NE3 3AA', 'phone',
    '[{"type":"living_room"}]', '{"totalPence":39000}', '{"bedroom":{"ratePerSqm":5.5}}', 39000,
    'full', 'price_agreed', 'Lounge walls and ceiling', 41000, 41000, '2026-11-20T10:00:00Z', '2026-11-20T10:05:00Z', 'Dog in the house');
insert into public.quote_rooms (enquiry_id, position, item_type, label, measurement_mode, walls, height_m, include_ceiling, length_m, width_m, coats, condition, wall_area_sqm, ceiling_area_sqm, estimated_labour_pence, requires_manual_quote)
values ('33333333-3333-4333-a333-333333333333', 0, 'living_room', 'Lounge', 'walls', '[{"width":4.2},{"width":3.6},{"width":4.2},{"width":3.6}]', 2.45, true, 4.2, 3.6, 2, '{"surface":"fair","stainBlock":true}', 38.22, 15.12, 39000, false),
       ('33333333-3333-4333-a333-333333333333', 1, 'bedroom', 'Damaged bedroom', 'simple', null, 2.4, false, 3.1, 3.0, 2, '{"surface":"poor","wallpaperToRemove":true}', 29.28, null, null, true);
insert into public.enquiry_photos (enquiry_id, storage_path) values ('33333333-3333-4333-a333-333333333333', 'enquiries/33333333/lounge-1.jpg'), ('33333333-3333-4333-a333-333333333333', 'enquiries/33333333/lounge-2.jpg');
insert into public.payments (enquiry_id, kind, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id, notes)
values ('33333333-3333-4333-a333-333333333333', 'full', 'needs_review', 41000, 'gbp', 'cs_pre3', 'pi_pre3_early', 'evt_pre3', 'Paid before the link was re-sent – check in Stripe');
create table public._before as
  select 'e' k, to_jsonb(e) j from public.enquiries e union all
  select 'r', to_jsonb(r) from public.quote_rooms r union all
  select 'p', to_jsonb(p) from public.enquiry_photos p union all
  select 'pay', to_jsonb(x) from public.payments x;
SQL
}

state() { # fingerprint of everything the migration could change
  q "$1" "select md5(coalesce((select value::text from public.settings where key='pricing'),'') || (select string_agg(column_name||is_nullable||coalesce(column_default,''), ',' order by table_name, column_name) from information_schema.columns where table_schema='public' and table_name in ('enquiries','quote_rooms')) || (select string_agg(conname||pg_get_constraintdef(oid), ',' order by conname) from pg_constraint where conrelid in ('public.enquiries'::regclass,'public.quote_rooms'::regclass)) || pg_get_functiondef('public.protect_payment_fields()'::regprocedure))"
}
expect_stop() { # db, message-fragment, description
  local before; before=$(state "$1")
  if $P -d "$1" -f "$M" >/dev/null 2>/tmp/mig.err; then fail "$3: migration should have stopped"; fi
  grep -q "$2" /tmp/mig.err || { cat /tmp/mig.err; fail "$3: wrong error"; }
  [ "$(state "$1")" = "$before" ] || fail "$3: something changed"
  pass "$3 -> stopped ($(grep -o 'Stopped:[^.]*' /tmp/mig.err | head -1 | cut -c10-)), nothing changed"
}

echo "== 1. Existing customer records; run twice with an admin price change in between"
fresh mig_a; seed_customers mig_a
$P -d mig_a -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  first run – /'
$P -d mig_a -c "update public.settings set value = jsonb_set(value, '{skirting,ratePerMetre}', '6.25') where key = 'pricing'" >/dev/null
$P -d mig_a -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  second run – /'
pass "migration re-ran without errors"
$P -d mig_a >/dev/null <<'SQL'
create view public._after_view as
  select 'e' k, to_jsonb(e) - 'cancellation_terms_accepted_at' - 'early_start_requested_at' - 'consent_id' - 'cancellation_terms_version' j from public.enquiries e union all
  select 'r', to_jsonb(r) - 'extra_kind' - 'quantity' - 'unit_price_pence' from public.quote_rooms r union all
  select 'p', to_jsonb(p) from public.enquiry_photos p union all
  select 'pay', to_jsonb(x) from public.payments x;
SQL
$P -d mig_a -f supabase/tests/price_revision_checks.sql 2>&1 | tee /tmp/checks.out | grep -v 'NOTICE:'
# Any FAIL line from the database checks fails the whole run
if grep -q '^FAIL' /tmp/checks.out; then echo "FAIL  database checks reported failures"; exit 1; fi

echo "== 2. Price list that already has an extras object (with an admin-changed door-frame price)"
fresh mig_b
$P -d mig_b -c "update public.settings set value = value || '{\"extras\": {\"door_frame\": 35}}' where key = 'pricing'" >/dev/null
$P -d mig_b -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  /'
if [ "$(q mig_b "select value->'skirting' = '{\"ratePerMetre\":5.5,\"minimumCharge\":0}'::jsonb and value->'ceiling' = '{\"ratePerSqm\":6,\"minimumCharge\":55}'::jsonb from public.settings where key='pricing'")" = t ]; then pass "skirting and ceiling still updated even though extras already existed"; else fail "skirting and ceiling still updated even though extras already existed"; fi
if [ "$(q mig_b "select value->'extras'->>'door_frame' || '/' || (value->'extras'->>'radiator_large') from public.settings where key='pricing'")" = "35/45" ]; then pass "admin door-frame price kept (£35); missing extras added (large radiator £45)"; else fail "admin door-frame price kept (£35); missing extras added (large radiator £45)"; fi
echo "== 3. Admin had already changed the ceiling price before the migration"
fresh mig_c
$P -d mig_c -c "update public.settings set value = jsonb_set(value, '{ceiling}', '{\"ratePerSqm\": 7, \"minimumCharge\": 60}') where key = 'pricing'" >/dev/null
$P -d mig_c -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  /'
if [ "$(q mig_c "select value->'ceiling'->>'ratePerSqm' || '/' || (value->'skirting'->>'ratePerMetre') from public.settings where key='pricing'")" = "7/5.5" ]; then pass "admin ceiling price (£7) kept; skirting (still at launch price) updated"; else fail "admin ceiling price (£7) kept; skirting (still at launch price) updated"; fi
echo "== 4. All-or-nothing: a failure at the very last step changes nothing"
fresh mig_d; seed_customers mig_d
before=$(state mig_d)
sed 's/^end$/  raise exception '\''simulated failure at the last step'\'';\nend/' "$M" > /tmp/mig_fail.sql
grep -q "simulated failure" /tmp/mig_fail.sql || fail "could not inject failure"
if $P -d mig_d -f /tmp/mig_fail.sql >/dev/null 2>&1; then fail "injected failure did not fail"; fi
if [ "$(state mig_d)" = "$before" ]; then pass "after a failure in the final step, prices, columns, rules and the function are exactly as before"; else fail "after a failure in the final step, prices, columns, rules and the function are exactly as before"; fi
echo "== 5. Pre-flight checks stop everything"
fresh mig_e; $P -d mig_e -c "delete from public.settings where key = 'pricing'" >/dev/null
expect_stop mig_e "pricing settings record is missing" "pricing record missing"
fresh mig_f; $P -d mig_f -c "update public.settings set value = value - 'bedroom' where key = 'pricing'" >/dev/null
expect_stop mig_f "bedroom price" "bedroom price missing"
fresh mig_g; $P -d mig_g -c "update public.settings set value = jsonb_set(value, '{livingRoom,ratePerSqm}', '\"abc\"') where key = 'pricing'" >/dev/null
expect_stop mig_g "livingRoom ratePerSqm" "living room price not a number"
fresh mig_h; $P -d mig_h -c "update public.settings set value = value || '{\"extras\": {\"door_frame\": -1}}' where key = 'pricing'" >/dev/null
expect_stop mig_h "extras prices are invalid" "negative saved extra price"
fresh mig_i; seed_customers mig_i
$P -d mig_i -c "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)" -c "update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'deposit', deposit_percent = 50 where reference = 'PRE-1'" >/dev/null
expect_stop mig_i "payment type other than full" "existing 50% deposit request"
fresh mig_j; seed_customers mig_j
$P -d mig_j -c "update public.enquiries set payment_type = 'full' where true" -c "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)" -c "update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 40000, deposit_pence = null where reference = 'PRE-1'" >/dev/null
expect_stop mig_j "not exactly 100% of a valid agreed price" "agreed price with a missing payment amount (old NULL loophole)"
fresh mig_k
$P -d mig_k -c "insert into public.enquiries (reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence) values ('OLD-1','A','a@x','0','N','phone','[]','{}','{}',0)" >/dev/null
expect_stop mig_k "payment type other than full" "older enquiry still on the old 'deposit' default"

fresh mig_l; $P -d mig_l -c "update public.settings set value = jsonb_set(value, '{skirting}', '\"cheap\"') where key = 'pricing'" >/dev/null
expect_stop mig_l "skirting price is missing or not a valid object" "skirting price is not an object"
fresh mig_m; $P -d mig_m -c "update public.settings set value = jsonb_set(value, '{ceiling,minimumCharge}', '-5') where key = 'pricing'" >/dev/null
expect_stop mig_m "ceiling minimumCharge" "negative ceiling minimum"
fresh mig_n; $P -d mig_n -c "update public.settings set value = jsonb_set(value, '{skirting}', '{\"ratePerMetre\": 5}') where key = 'pricing'" >/dev/null
expect_stop mig_n "skirting minimumCharge" "skirting minimum missing"
fresh mig_o; $P -d mig_o -c "update public.settings set value = jsonb_set(value, '{ceiling,colour}', '\"white\"') where key = 'pricing'" >/dev/null
expect_stop mig_o "unexpected fields" "ceiling object with an unexpected field"
fresh mig_p; $P -d mig_p -c "update public.settings set value = jsonb_set(value, '{bedroom,ratePerSqm}', '\"5.50\"') where key = 'pricing'" >/dev/null
expect_stop mig_p "bedroom ratePerSqm" "bedroom rate stored as text"
fresh mig_q; $P -d mig_q -c "update public.settings set value = value || '{\"extras\": {\"door_frame\": 20000}}' where key = 'pricing'" >/dev/null
expect_stop mig_q "extras prices are invalid" "extra price over £10,000"

echo "== 6. A paid booking from before the migration with no recorded consent"
fresh mig_r; seed_customers mig_r
$P -d mig_r -c "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)" -c "update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 37550, deposit_pence = 37550, payment_token = 't', status = 'booking_confirmed', deposit_paid_at = now(), deposit_paid_pence = 37550, stripe_payment_intent_id = 'pi_old' where reference = 'PRE-1'" >/dev/null
expect_stop mig_r "no recorded cancellation-policy confirmation" "paid booking without consent"
if [ "$(q mig_r "select count(*) from information_schema.columns where table_name='enquiries' and column_name='cancellation_terms_accepted_at'")" = 0 ]; then pass "the new columns added before that check were rolled back too"; else fail "the new columns added before that check were rolled back too"; fi
echo "== 7. Payment trigger missing or misconfigured beforehand -> re-attached correctly"
fresh mig_s; $P -d mig_s -c "drop trigger enquiries_protect_payment on public.enquiries" >/dev/null
$P -d mig_s -f "$M" >/dev/null 2>&1
if [ "$(q mig_s "select count(*) from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment' and tgtype=23 and tgenabled='O'")" = 1 ]; then pass "missing payment trigger re-created as BEFORE INSERT OR UPDATE FOR EACH ROW"; else fail "missing payment trigger re-created as BEFORE INSERT OR UPDATE FOR EACH ROW"; fi
fresh mig_t; $P -d mig_t -c "drop trigger enquiries_protect_payment on public.enquiries" -c "create trigger enquiries_protect_payment after update on public.enquiries for each statement execute function public.protect_payment_fields()" >/dev/null
$P -d mig_t -f "$M" >/dev/null 2>&1
if [ "$(q mig_t "select count(*) from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment' and tgtype=23")" = 1 ]; then pass "wrongly configured (AFTER / FOR EACH STATEMENT) trigger replaced with BEFORE INSERT OR UPDATE FOR EACH ROW"; else fail "wrongly configured (AFTER / FOR EACH STATEMENT) trigger replaced with BEFORE INSERT OR UPDATE FOR EACH ROW"; fi
fresh mig_u; $P -d mig_u -c "alter table public.enquiries disable trigger enquiries_protect_payment" >/dev/null
$P -d mig_u -f "$M" >/dev/null 2>&1
if [ "$(q mig_u "select tgenabled from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment'")" = O ]; then pass "a disabled payment trigger is re-enabled"; else fail "a disabled payment trigger is re-enabled"; fi
echo "== 8. Column problems stop the migration"
fresh mig_v; $P -d mig_v -c "alter table public.quote_rooms add column quantity text" >/dev/null
expect_stop mig_v "column quote_rooms.quantity has type text" "a pre-existing 'quantity' column of the wrong type"
fresh mig_w; $P -d mig_w -c "alter table public.quote_rooms alter column estimated_labour_pence type numeric" >/dev/null
expect_stop mig_w "column quote_rooms.estimated_labour_pence has type numeric" "estimated_labour_pence not an integer"

echo "== 9. Guards only block when there is something to protect"
fresh mig_x; $P -d mig_x -f "$M" >/dev/null 2>&1
$P -d mig_x -c "insert into public.enquiries (reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence) values ('U-1','U','u@example.invalid','0','NE1','phone','[]','{}','{}',0)" >/dev/null
if $P -d mig_x -c "truncate public.enquiries cascade" >/dev/null 2>&1; then pass "owner can TRUNCATE unpaid enquiries when the payment and refund records are empty"; else fail "truncate guard blocked an unpaid table"; fi
if [ "$(q mig_x "select count(*) from public.enquiries")" = 0 ]; then pass "tables emptied as requested"; else fail "truncate did not run"; fi
fresh mig_x2; seed_customers mig_x2; $P -d mig_x2 -f "$M" >/dev/null 2>&1
if $P -d mig_x2 -c "truncate public.enquiries cascade" >/dev/null 2>&1; then fail "truncate wiped a payment-log entry"; else pass "TRUNCATE refused while the payment log has entries (even with no paid bookings)"; fi
if [ "$(q mig_x2 "select count(*) from public.payments")" = 1 ]; then pass "payment-log entry still there"; else fail "payment log changed"; fi

echo "== 10. Existing records with unexpected statuses stop the migration (records are not changed)"
fresh mig_y; seed_customers mig_y
$P -d mig_y -c "alter table public.enquiries drop constraint enquiries_status_check; update public.enquiries set status = 'quote_sent' where reference = 'PRE-2'" >/dev/null
expect_stop mig_y "unexpected statuses: 'quote_sent' (1) – references: PRE-2" "an enquiry with the old status 'quote_sent'"
if [ "$(q mig_y "select status from public.enquiries where reference = 'PRE-2'")" = quote_sent ]; then pass "the unexpected status was left exactly as it was"; else fail "record changed"; fi
$P -d mig_y -c "update public.enquiries set status = null where reference = 'PRE-2'" >/dev/null 2>&1 || $P -d mig_y -c "alter table public.enquiries alter column status drop not null; update public.enquiries set status = null where reference = 'PRE-2'" >/dev/null
expect_stop mig_y "unexpected statuses: NULL (1)" "an enquiry with no status"
fresh mig_z; seed_customers mig_z
$P -d mig_z -c "set request.jwt.claims = '{\"role\":\"service_role\"}'" -c "update public.enquiries set deposit_paid_at = now(), stripe_payment_intent_id = 'pi_x', deposit_paid_pence = 1 where reference = 'PRE-2'" >/dev/null
expect_stop mig_z "paid bookings have an unpaid status: PRE-2 (awaiting_consultation)" "a paid booking still marked awaiting consultation"

echo "== 11. Unexpected permissions stop the migration (permissions are verified, not silently changed)"
PERM_CASES=("grant truncate on public.payments to authenticated" "grant insert on public.payments to anon" "grant trigger on public.enquiries to service_role" "grant select on public.quote_rooms to public"
  "grant update (notes) on public.payments to anon" "grant insert (enquiry_id) on public.quote_rooms to authenticated"
  "create role tt_custom; grant update on public.enquiries to tt_custom" "create role tt_writer; grant pg_write_all_data to tt_writer"
  "create role tt_member; grant service_role to tt_member; grant delete on public.payments to tt_member"
  "alter table public.payments disable row level security")
[ "$PGVER" -ge 170000 ] && PERM_CASES+=("grant maintain on public.enquiries to authenticated")
for g in "${PERM_CASES[@]}"; do
  for r in tt_custom tt_writer tt_member; do $P -d postgres -c "drop database if exists mig_p2" -c "drop role if exists $r" >/dev/null 2>&1 || true; done
  fresh mig_p2; seed_customers mig_p2; $P -d mig_p2 -c "$g" >/dev/null
  if $P -d mig_p2 -f "$M" >/dev/null 2>/tmp/mig.err; then fail "migration accepted: $g"; fi
  grep -q "Verification failed" /tmp/mig.err || { cat /tmp/mig.err; fail "wrong error for: $g"; }
  if [ "$(q mig_p2 "select count(*) from pg_constraint where conname = 'enquiries_full_payment_only'")" = 0 ]; then pass "'$g' -> stopped and rolled back ($(grep -o 'Verification failed:.*' /tmp/mig.err | cut -c22- | head -1))"; else fail "not rolled back"; fi
done
$P -d postgres -c "drop database if exists mig_p2" >/dev/null; for r in tt_custom tt_writer tt_member; do $P -d postgres -c "drop role if exists $r" >/dev/null; done
fresh mig_p3; seed_customers mig_p3; $P -d mig_p3 -c "create role tt_reader; grant select on public.enquiries to tt_reader" >/dev/null 2>&1 || $P -d mig_p3 -c "grant select on public.enquiries to tt_reader" >/dev/null
if $P -d mig_p3 -f "$M" >/dev/null 2>&1; then pass "a read-only extra role (like Supabase's read-only and ETL users) does not stop the migration"; else fail "read-only role wrongly stopped the migration"; fi
$P -d postgres -c "drop database if exists mig_p3" -c "drop role if exists tt_reader" >/dev/null

echo "== 12. Old deposit-era statuses stop the migration (records are not changed)"
fresh mig_l; seed_customers mig_l
$P -d mig_l -c "set session_replication_role = replica" -c "update public.enquiries set status = 'deposit_paid', agreed_price_pence = 22500, deposit_pence = 22500, consultation_confirmed_at = now(), payment_token = 'tok_l', deposit_paid_at = now(), deposit_paid_pence = 22500, stripe_payment_intent_id = 'pi_legacy' where reference = 'PRE-2'" >/dev/null
expect_stop mig_l "old deposit-era statuses: PRE-2 (deposit_paid)" "a booking in the old 'payment received' (deposit_paid) status"
if [ "$(q mig_l "select status from public.enquiries where reference = 'PRE-2'")" = deposit_paid ]; then pass "the legacy status was left exactly as it was"; else fail "record changed"; fi

echo "== 13. Refund / consent tables that already exist must match exactly"
stop_on() { # db, sql-before, expected message fragment, description
  fresh "$1"; seed_customers "$1"; [ -n "$2" ] && $P -d "$1" -c "$2" >/dev/null
  if $P -d "$1" -f "$M" >/dev/null 2>/tmp/mig.err; then fail "$4: migration should have stopped"; fi
  grep -q "$3" /tmp/mig.err || { cat /tmp/mig.err; fail "$4: wrong error"; }
  if [ "$(q "$1" "select count(*) from pg_constraint where conname = 'enquiries_full_payment_only'")" = 0 ]; then
    pass "$4 -> stopped and rolled back ($(grep -oE '(Stopped|Verification failed): .{0,140}' /tmp/mig.err | head -1))"
  else fail "$4: not rolled back"; fi
}
stop_on mig_t1 "create table public.refunds (id uuid primary key, enquiry_id uuid, stripe_refund_id text, stripe_payment_intent_id text, amount_pence integer, currency text, status text, stripe_reason text, source text, note text, created_at timestamptz, updated_at timestamptz)" \
  "refunds / booking_consents tables are not exactly as required" "an existing refunds table with no constraints and nullable columns"
stop_on mig_t2 "create table public.booking_consents (id uuid primary key, enquiry_id uuid not null references public.enquiries(id), terms_version text not null, terms_sha256 text not null, statements jsonb not null, accepted_terms boolean not null, early_start_requested boolean not null, early_start_ack_pay_for_work boolean not null, early_start_ack_loses_right boolean not null, amount_pence integer not null, user_agent text, created_at timestamptz not null default now(), customer_ip text)" \
  "refunds / booking_consents tables are not exactly as required" "an existing consent table with an extra column and missing rules"
# Re-runs: tables created by an earlier run, then weakened by hand
fresh mig_t3; seed_customers mig_t3; $P -d mig_t3 -f "$M" >/dev/null
$P -d mig_t3 -c "alter table public.refunds drop constraint refunds_amount" >/dev/null
if $P -d mig_t3 -f "$M" >/dev/null 2>/tmp/mig.err; then fail "re-run accepted a refunds table without its amount rule"; fi
if grep -q "missing constraint refunds_amount" /tmp/mig.err; then pass "re-run stops when a refund rule was removed by hand (missing constraint refunds_amount), nothing changed"; else cat /tmp/mig.err; fail "wrong error"; fi
fresh mig_t4; seed_customers mig_t4; $P -d mig_t4 -f "$M" >/dev/null
$P -d mig_t4 -c "create policy \"Anyone can read refunds\" on public.refunds for select to anon using (true)" >/dev/null
if $P -d mig_t4 -f "$M" >/dev/null 2>/tmp/mig.err; then fail "re-run accepted an extra policy"; fi
if grep -q "unexpected policy refunds: Anyone can read refunds" /tmp/mig.err; then pass "re-run stops when an extra row-level security policy appears (visitors reading refunds), nothing changed"; else cat /tmp/mig.err; fail "wrong error"; fi
fresh mig_t5; seed_customers mig_t5; $P -d mig_t5 -f "$M" >/dev/null
$P -d mig_t5 -c "alter table public.refunds alter column currency drop not null" >/dev/null
if $P -d mig_t5 -f "$M" >/dev/null 2>/tmp/mig.err; then fail "re-run accepted a nullable currency"; fi
if grep -q "refunds.currency" /tmp/mig.err; then pass "re-run stops when a refund column is made optional (currency), nothing changed"; else cat /tmp/mig.err; fail "wrong error"; fi
for d in mig_t1 mig_t2 mig_t3 mig_t4 mig_t5 mig_l; do $P -d postgres -c "drop database if exists $d" >/dev/null; done

echo "== All migration checks passed"
