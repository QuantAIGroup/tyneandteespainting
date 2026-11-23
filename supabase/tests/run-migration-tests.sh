#!/usr/bin/env bash
# Tests the price-revision migration on a LOCAL throwaway Postgres database.
# Usage: PGHOST=/tmp PGPORT=5499 PGUSER=postgres supabase/tests/run-migration-tests.sh
# (Never point this at the live Supabase database.)
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q -X"
M=supabase/migrations/20261123170000_price_revision_full_payment.sql

fresh() {
  $P -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null
  $P -d "$1" -f supabase/tests/supabase_stub.sql >/dev/null
  for f in supabase/migrations/2026111*.sql supabase/migrations/20261120*.sql supabase/migrations/20261123120000_quote_rooms.sql; do $P -d "$1" -f "$f" >/dev/null 2>&1; done
  # PG16 (local) has no MAINTAIN privilege keyword; Supabase runs PG17
  sed 's/, maintain on tables/ on tables/' supabase/migrations/20261123130000_api_grants.sql | $P -d "$1" >/dev/null
}

seed_customers() {
  $P -d "$1" >/dev/null <<'SQL'
insert into auth.users values ('00000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'admin@example.invalid');
insert into public.admin_users values ('00000000-0000-4000-a000-000000000001');
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence)
values ('11111111-1111-4111-a111-111111111111', 'PRE-1', 'Existing Customer', 'e@example.invalid', '07000000000', 'NE1 1AA', 'phone', '[{"x":1}]', '{"y":2}', '{"z":3}', 34000),
       ('22222222-2222-4222-a222-222222222222', 'PRE-2', 'Second Customer', 'f@example.invalid', '07000000001', 'NE2 2AA', 'email', '[]', '{}', '{}', 22500);
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

echo "== 1. Existing customer records, run twice, admin price change in between"
fresh mig_a
seed_customers mig_a
$P -d mig_a -f "$M" >/dev/null
$P -d mig_a -c "update public.settings set value = jsonb_set(value, '{skirting,ratePerMetre}', '6.25') where key = 'pricing'" >/dev/null
$P -d mig_a -f "$M" >/dev/null && echo "PASS  migration re-ran without errors"
$P -d mig_a >/dev/null <<'SQL'
create view public._after_view as
  select 'e' k, to_jsonb(e) - 'cancellation_terms_accepted_at' - 'early_start_requested_at' j from public.enquiries e union all
  select 'r', to_jsonb(r) - 'extra_kind' - 'quantity' - 'unit_price_pence' from public.quote_rooms r union all
  select 'p', to_jsonb(p) from public.enquiry_photos p;
SQL
$P -d mig_a -f supabase/tests/price_revision_checks.sql

echo "== 2. Pre-flight: pricing record missing -> stops, nothing changed"
fresh mig_b
$P -d mig_b -c "delete from public.settings where key = 'pricing'" >/dev/null
if $P -d mig_b -f "$M" >/dev/null 2>/tmp/mig_b.err; then echo "FAIL  migration ran without a pricing record"; exit 1; fi
grep -q "pricing settings record is missing" /tmp/mig_b.err && echo "PASS  stopped with: $(grep -o 'Stopped:[^.]*' /tmp/mig_b.err | head -1)"
[ "$($P -d mig_b -tAc "select column_default from information_schema.columns where table_name='enquiries' and column_name='payment_type'")" = "'deposit'::text" ] && echo "PASS  nothing was changed"

echo "== 3. Pre-flight: an existing 50% deposit request -> stops, nothing changed"
fresh mig_c
seed_customers mig_c
$P -d mig_c -c "select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', false)" -c "update public.enquiries set consultation_confirmed_at = now(), agreed_price_pence = 40000, deposit_pence = 20000, payment_type = 'deposit', deposit_percent = 50 where reference = 'PRE-1'" >/dev/null
if $P -d mig_c -f "$M" >/dev/null 2>/tmp/mig_c.err; then echo "FAIL  migration ran over a deposit request"; exit 1; fi
grep -q "not 100% of the agreed price" /tmp/mig_c.err && echo "PASS  stopped with: $(grep -o 'Stopped:[^.]*' /tmp/mig_c.err | head -1)"
[ "$($P -d mig_c -tAc "select value->'skirting'->>'ratePerMetre' from public.settings where key='pricing'")" = "5" ] && echo "PASS  prices untouched"

echo "== All migration checks passed"
