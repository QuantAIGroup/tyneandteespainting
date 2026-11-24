#!/usr/bin/env bash
# CONCURRENCY TESTS – two real database sessions at the same time.
#
# Each test opens session A, makes a change WITHOUT committing, then starts
# session B. It checks that B is made to WAIT for A (seen in pg_stat_activity
# as a lock wait) and that, once A commits, B gives the safe result.
#
# Safe for a local or STAGING database only. It creates its own test bookings
# (reference CT-…, email concurrency-test@example.invalid) and never deletes
# anything. Paid test bookings can't be removed afterwards (by design).
#
#   CONFIRM_NOT_PRODUCTION=yes PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=… supabase/tests/concurrency-tests.sh
#
# Needs: psql, the migrations applied, roles service_role and authenticated.
set -euo pipefail

if [ "${CONFIRM_NOT_PRODUCTION:-}" != "yes" ]; then
  echo "Refusing to run: set CONFIRM_NOT_PRODUCTION=yes, and only point this at a local or staging database."
  exit 2
fi

P="psql -X -q -v ON_ERROR_STOP=1"
OUT=$(mktemp -d)
HOLD=4          # seconds session A keeps its change uncommitted
FAILED=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; FAILED=1; }
q() { $P -tAc "$1"; }
uuid() { q "select gen_random_uuid()"; }

wait_for() { # sql returning t/f, tries (0.1 s each)
  for _ in $(seq 1 "${2:-60}"); do [ "$(q "$1")" = t ] && return 0; sleep 0.1; done
  return 1
}

# A booking awaiting payment, with consent, one room and one photo. Echoes its id.
make_booking() {
  local id cid; id=$(uuid); cid=$(uuid)
  $P -v id="$id" -v cid="$cid" >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence)
values (:'id', 'CT-' || left(:'id', 8), 'Concurrency Test', 'concurrency-test@example.invalid', '0', 'NE1 1AA', 'phone', '[]', '{}', '{}', 20000);
insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence)
values (:'id', 0, 'bedroom', 'Test room', 2, '{}', 20000);
insert into public.enquiry_photos (enquiry_id, storage_path) values (:'id', 'concurrency-test/' || :'id' || '.jpg');
update public.enquiries set agreed_service = 'Test', agreed_price_pence = 20000, deposit_pence = 20000,
  consultation_confirmed_at = now(), price_agreed_at = now(), status = 'price_agreed' where id = :'id';
update public.enquiries set status = 'deposit_requested', payment_token = 'tok-' || :'id', stripe_checkout_session_id = 'cs-' || :'id' where id = :'id';
insert into public.booking_consents (id, enquiry_id, terms_version, terms_sha256, statements, accepted_terms,
  early_start_requested, early_start_ack_pay_for_work, early_start_ack_loses_right, amount_pence)
values (:'cid', :'id', '2026-11-23', repeat('ab', 32), '{"acceptTerms":"concurrency test"}', true, false, false, false, 20000);
update public.enquiries set consent_id = :'cid', cancellation_terms_accepted_at = now(), cancellation_terms_version = '2026-11-23' where id = :'id';
commit;
SQL
  echo "$id"
}

# The webhook's "payment verified" update, as the website server, held open for $HOLD seconds
pay_sql() { cat <<SQL
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.enquiries set status = 'booking_confirmed', booking_confirmed_at = now(), deposit_paid_at = now(),
  deposit_paid_pence = 20000, stripe_payment_intent_id = 'pi-$1' where id = '$1' and deposit_paid_at is null;
select pg_sleep($HOLD);
commit;
SQL
}

as_server() { cat <<SQL
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
$1
commit;
SQL
}

# run_pair NAME A_SQL B_SQL : A starts and holds; B must be seen waiting on a lock.
run_pair() {
  local name=$1
  rm -f "$OUT/a" "$OUT/b"
  PGAPPNAME=ct_a $P -c "select 1" >/dev/null
  (PGAPPNAME=ct_a $P <<<"$2" >"$OUT/a" 2>&1; echo "exit=$?" >>"$OUT/a") &
  local pa=$!
  if ! wait_for "select exists (select 1 from pg_stat_activity where application_name = 'ct_a' and query like '%pg_sleep%' and state = 'active')"; then
    fail "$name: session A did not start"; wait $pa || true; return 1
  fi
  (PGAPPNAME=ct_b $P <<<"$3" >"$OUT/b" 2>&1; echo "exit=$?" >>"$OUT/b") &
  local pb=$!
  if wait_for "select exists (select 1 from pg_stat_activity where application_name = 'ct_b' and wait_event_type = 'Lock')" 30; then
    BLOCKED=yes
  else
    BLOCKED=no
  fi
  wait $pa || true; wait $pb || true
}

echo "== Concurrency tests on $(q "select current_database() || ' (PostgreSQL ' || current_setting('server_version') || ')'")"

# ---- 1. Payment vs changes to the booking's room and photo records
for case in \
  "a room record deleted|delete from public.quote_rooms where enquiry_id = 'ID';|Room records of a paid booking|select count(*) = 1 from public.quote_rooms where enquiry_id = 'ID'" \
  "a room price changed|update public.quote_rooms set estimated_labour_pence = 1 where enquiry_id = 'ID';|Room records of a paid booking|select estimated_labour_pence = 20000 from public.quote_rooms where enquiry_id = 'ID'" \
  "a room record added|insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence) values ('ID', 1, 'bedroom', 'Extra', 2, '{}', 100);|cannot be added to a paid booking|select count(*) = 1 from public.quote_rooms where enquiry_id = 'ID'" \
  "a photo record deleted|delete from public.enquiry_photos where enquiry_id = 'ID';|Photo records of a paid booking|select count(*) = 1 from public.enquiry_photos where enquiry_id = 'ID'" \
  "a photo record added|insert into public.enquiry_photos (enquiry_id, storage_path) values ('ID', 'concurrency-test/extra.jpg');|cannot be added to a paid booking|select count(*) = 1 from public.enquiry_photos where enquiry_id = 'ID'"
do
  IFS='|' read -r label stmt expect check <<<"$case"
  id=$(make_booking)
  run_pair "payment vs $label" "$(pay_sql "$id")" "$(as_server "${stmt//ID/$id}")"
  if [ "$BLOCKED" = yes ] && grep -q "$expect" "$OUT/b" && [ "$(q "${check//ID/$id}")" = t ] && [ "$(q "select deposit_paid_at is not null from public.enquiries where id = '$id'")" = t ]; then
    pass "payment in progress vs $label: the change WAITED for the payment, then was refused; the paid booking is intact"
  else
    fail "payment in progress vs $label (waited: $BLOCKED; B said: $(grep -v '^$' "$OUT/b" | tail -2 | tr '\n' ' '))"
  fi
done

# ---- 2. The other order: a room change in progress, then the payment
id=$(make_booking)
run_pair "room change then payment" "$(as_server "delete from public.quote_rooms where enquiry_id = '$id'; select pg_sleep($HOLD);")" \
  "$(as_server "update public.enquiries set status = 'booking_confirmed', booking_confirmed_at = now(), deposit_paid_at = now(), deposit_paid_pence = 20000, stripe_payment_intent_id = 'pi-$id' where id = '$id';")"
if [ "$BLOCKED" = yes ] && grep -q "exit=0" "$OUT/b" && [ "$(q "select deposit_paid_at is not null from public.enquiries where id = '$id'")" = t ]; then
  pass "room change in progress, then payment: the payment WAITED for the room change to finish, then succeeded (one clear order)"
else
  fail "room change then payment (waited: $BLOCKED; payment said: $(tail -2 "$OUT/b" | tr '\n' ' '))"
fi

# ---- 3. Consent recorded while the payment request is being withdrawn
id=$(make_booking)
run_pair "consent vs withdrawn request" \
  "$(as_server "update public.enquiries set status = 'price_agreed' where id = '$id'; select pg_sleep($HOLD);")" \
  "$(as_server "insert into public.booking_consents (enquiry_id, terms_version, terms_sha256, statements, accepted_terms, early_start_requested, early_start_ack_pay_for_work, early_start_ack_loses_right, amount_pence) values ('$id', '2026-11-23', repeat('ab', 32), '{}', true, false, false, false, 20000);")"
if [ "$BLOCKED" = yes ] && grep -q "awaiting payment" "$OUT/b" && [ "$(q "select count(*) from public.booking_consents where enquiry_id = '$id'")" = 1 ]; then
  pass "consent while the payment request is being withdrawn: consent WAITED, then was refused (booking no longer awaiting payment)"
else
  fail "consent vs withdrawn request (waited: $BLOCKED; B said: $(tail -2 "$OUT/b" | tr '\n' ' '))"
fi

# ---- 4. Consent recorded while the price is being changed
id=$(make_booking)
run_pair "consent vs price change" \
  "$(as_server "update public.enquiries set status = 'price_agreed', agreed_price_pence = 25000, deposit_pence = 25000, stripe_checkout_session_id = null, payment_token = null where id = '$id'; select pg_sleep($HOLD);")" \
  "$(as_server "insert into public.booking_consents (enquiry_id, terms_version, terms_sha256, statements, accepted_terms, early_start_requested, early_start_ack_pay_for_work, early_start_ack_loses_right, amount_pence) values ('$id', '2026-11-23', repeat('ab', 32), '{}', true, false, false, false, 20000);")"
if [ "$BLOCKED" = yes ] && grep -q "awaiting payment" "$OUT/b"; then
  pass "consent for the old price while the price is being changed: consent WAITED, then was refused"
else
  fail "consent vs price change (waited: $BLOCKED; B said: $(tail -2 "$OUT/b" | tr '\n' ' '))"
fi

# ---- 5. Two refunds of the same payment at the same moment
id=$(make_booking)
$P >/dev/null <<<"$(as_server "update public.enquiries set status = 'booking_confirmed', deposit_paid_at = now(), deposit_paid_pence = 20000, stripe_payment_intent_id = 'pi-$id' where id = '$id';
insert into public.payments (enquiry_id, kind, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id) values ('$id', 'full', 'payment_recorded', 20000, 'gbp', 'cs-$id', 'pi-$id', 'evt-$id');")"
refund() { echo "insert into public.refunds (enquiry_id, stripe_refund_id, stripe_payment_intent_id, amount_pence, currency, status, source, note) values ('$id', 're-$1-$id', 'pi-$id', 15000, 'gbp', 'pending', 'admin', 'concurrency test');"; }
run_pair "two refunds" "$(as_server "$(refund a) select pg_sleep($HOLD);")" "$(as_server "$(refund b)")"
if [ "$BLOCKED" = yes ] && grep -q "exceed the original payment" "$OUT/b" && [ "$(q "select coalesce(sum(amount_pence), 0) from public.refunds where stripe_payment_intent_id = 'pi-$id'")" = 15000 ]; then
  pass "two £150 refunds of a £200 payment at once: the second WAITED, then was refused; total refunded £150"
else
  fail "two refunds at once (waited: $BLOCKED; B said: $(tail -2 "$OUT/b" | tr '\n' ' '))"
fi

# ---- 6. TRUNCATE of room/photo records while a payment is in progress
for t in quote_rooms enquiry_photos; do
  id=$(make_booking)
  run_pair "payment vs truncate $t" "$(pay_sql "$id")" "truncate public.$t;"
  if [ "$BLOCKED" = yes ] && grep -q "cannot be truncated" "$OUT/b" && [ "$(q "select count(*) > 0 from public.$t where enquiry_id = '$id'")" = t ]; then
    pass "TRUNCATE $t while a payment is in progress: WAITED, then refused; records intact"
  else
    fail "payment vs TRUNCATE $t (waited: $BLOCKED; B said: $(tail -2 "$OUT/b" | tr '\n' ' '))"
  fi
done

rm -rf "$OUT"
if [ "$FAILED" = 0 ]; then echo "== All concurrency tests passed"; else echo "== Concurrency tests FAILED"; exit 1; fi
