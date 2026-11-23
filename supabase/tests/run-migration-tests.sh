#!/usr/bin/env bash
# Tests the price-revision migration on a LOCAL throwaway Postgres database.
# Usage: PGHOST=/tmp PGPORT=5499 PGUSER=postgres supabase/tests/run-migration-tests.sh
# (Never point this at the live Supabase database.)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q -X"
M=supabase/migrations/20261123170000_price_revision_full_payment.sql
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; exit 1; }
q() { $P -d "$1" -tAc "$2"; }

fresh() {
  $P -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null 2>&1
  $P -d "$1" -f supabase/tests/supabase_stub.sql >/dev/null
  for f in supabase/migrations/2026111*.sql supabase/migrations/20261120*.sql supabase/migrations/20261123120000_quote_rooms.sql; do $P -d "$1" -f "$f" >/dev/null 2>&1; done
  # PG16 (local) has no MAINTAIN privilege keyword; Supabase runs PG17
  sed 's/, maintain on tables/ on tables/' supabase/migrations/20261123130000_api_grants.sql | $P -d "$1" >/dev/null
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
create table public._before as
  select 'e' k, to_jsonb(e) j from public.enquiries e union all
  select 'r', to_jsonb(r) from public.quote_rooms r union all
  select 'p', to_jsonb(p) from public.enquiry_photos p;
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
  select 'e' k, to_jsonb(e) - 'cancellation_terms_accepted_at' - 'early_start_requested_at' j from public.enquiries e union all
  select 'r', to_jsonb(r) - 'extra_kind' - 'quantity' - 'unit_price_pence' from public.quote_rooms r union all
  select 'p', to_jsonb(p) from public.enquiry_photos p;
SQL
$P -d mig_a -f supabase/tests/price_revision_checks.sql

echo "== 2. Price list that already has an extras object (with an admin-changed door-frame price)"
fresh mig_b
$P -d mig_b -c "update public.settings set value = value || '{\"extras\": {\"door_frame\": 35}}' where key = 'pricing'" >/dev/null
$P -d mig_b -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  /'
[ "$(q mig_b "select value->'skirting' = '{\"ratePerMetre\":5.5,\"minimumCharge\":0}'::jsonb and value->'ceiling' = '{\"ratePerSqm\":6,\"minimumCharge\":55}'::jsonb from public.settings where key='pricing'")" = t ] && pass "skirting and ceiling still updated even though extras already existed"
[ "$(q mig_b "select value->'extras'->>'door_frame' || '/' || (value->'extras'->>'radiator_large') from public.settings where key='pricing'")" = "35/45" ] && pass "admin door-frame price kept (£35); missing extras added (large radiator £45)"

echo "== 3. Admin had already changed the ceiling price before the migration"
fresh mig_c
$P -d mig_c -c "update public.settings set value = jsonb_set(value, '{ceiling}', '{\"ratePerSqm\": 7, \"minimumCharge\": 60}') where key = 'pricing'" >/dev/null
$P -d mig_c -f "$M" 2>&1 | grep -o 'NOTICE:  Prices.*' | sed 's/^NOTICE:  /INFO  /'
[ "$(q mig_c "select value->'ceiling'->>'ratePerSqm' || '/' || (value->'skirting'->>'ratePerMetre') from public.settings where key='pricing'")" = "7/5.5" ] && pass "admin ceiling price (£7) kept; skirting (still at launch price) updated"

echo "== 4. All-or-nothing: a failure at the very last step changes nothing"
fresh mig_d; seed_customers mig_d
before=$(state mig_d)
sed 's/^end$/  raise exception '\''simulated failure at the last step'\'';\nend/' "$M" > /tmp/mig_fail.sql
grep -q "simulated failure" /tmp/mig_fail.sql || fail "could not inject failure"
if $P -d mig_d -f /tmp/mig_fail.sql >/dev/null 2>&1; then fail "injected failure did not fail"; fi
[ "$(state mig_d)" = "$before" ] && pass "after a failure in the final step, prices, columns, rules and the function are exactly as before"

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
[ "$(q mig_r "select count(*) from information_schema.columns where table_name='enquiries' and column_name='cancellation_terms_accepted_at'")" = 0 ] && pass "the new columns added before that check were rolled back too"

echo "== 7. Payment trigger missing or misconfigured beforehand -> re-attached correctly"
fresh mig_s; $P -d mig_s -c "drop trigger enquiries_protect_payment on public.enquiries" >/dev/null
$P -d mig_s -f "$M" >/dev/null 2>&1
[ "$(q mig_s "select count(*) from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment' and tgtype=19 and tgenabled='O'")" = 1 ] && pass "missing payment trigger re-created as BEFORE UPDATE FOR EACH ROW"
fresh mig_t; $P -d mig_t -c "drop trigger enquiries_protect_payment on public.enquiries" -c "create trigger enquiries_protect_payment after update on public.enquiries for each statement execute function public.protect_payment_fields()" >/dev/null
$P -d mig_t -f "$M" >/dev/null 2>&1
[ "$(q mig_t "select count(*) from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment' and tgtype=19")" = 1 ] && pass "wrongly configured (AFTER / FOR EACH STATEMENT) trigger replaced with BEFORE UPDATE FOR EACH ROW"
fresh mig_u; $P -d mig_u -c "alter table public.enquiries disable trigger enquiries_protect_payment" >/dev/null
$P -d mig_u -f "$M" >/dev/null 2>&1
[ "$(q mig_u "select tgenabled from pg_trigger where tgrelid='public.enquiries'::regclass and tgname='enquiries_protect_payment'")" = O ] && pass "a disabled payment trigger is re-enabled"

echo "== 8. Column problems stop the migration"
fresh mig_v; $P -d mig_v -c "alter table public.quote_rooms add column quantity text" >/dev/null
expect_stop mig_v "column quote_rooms.quantity has type text" "a pre-existing 'quantity' column of the wrong type"
fresh mig_w; $P -d mig_w -c "alter table public.quote_rooms alter column estimated_labour_pence type numeric" >/dev/null
expect_stop mig_w "column quote_rooms.estimated_labour_pence has type numeric" "estimated_labour_pence not an integer"

echo "== All migration checks passed"
