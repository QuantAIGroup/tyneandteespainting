#!/usr/bin/env bash
# CONCURRENCY TESTS – two real database sessions at the same time.
#
# Each test opens session A, makes a change WITHOUT committing, then starts
# session B. It checks that B is made to WAIT for A (seen in pg_stat_activity
# as a lock wait) and that, once A commits, B gives the safe result.
#
# LOCAL OR STAGING ONLY. Every run has a unique TEST RUN ID. Every test booking
# it creates carries that ID in three places:
#   reference    CT-<run id>-<nn>
#   email        concurrency-test+<run id>@example.invalid
#   admin notes  "Concurrency test run <run id>: <test name>"
# It never deletes anything. Paid test bookings can't be removed afterwards
# (by design – the paid-booking protections are not relaxed for tests).
#
# Run the tests (both confirmations are required):
#   CONFIRM_NOT_PRODUCTION=yes CONFIRM_DATABASE="<PGHOST>/<PGDATABASE>" \
#   PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=… [PGPASSWORD=…] \
#   supabase/tests/concurrency-tests.sh
#
# List the bookings a run created (read-only), or all runs:
#   … supabase/tests/concurrency-tests.sh --list <run id>
#   … supabase/tests/concurrency-tests.sh --list-runs
#
# Exit code: 0 all passed, 1 a test failed, 2 refused to run / setup problem.
set -uo pipefail

# Production project(s) this script must never touch, whatever else is set
PRODUCTION_PROJECT_REFS="dttbrxbkqrgxalhsxhml ${EXTRA_PRODUCTION_REFS:-}"
HOLD=4          # seconds session A keeps its change uncommitted
WAIT_TRIES=60   # x 0.1 s to see session A start / session B start waiting

refuse() { echo "REFUSED  $*" >&2; exit 2; }

# ---------------------------------------------------------------- safety checks (before connecting)
[ -n "${PGHOST:-}" ] && [ -n "${PGDATABASE:-}" ] || refuse "set PGHOST and PGDATABASE explicitly (no defaults are used)."
for ref in $PRODUCTION_PROJECT_REFS; do
  case "$PGHOST $PGDATABASE ${PGUSER:-}" in *"$ref"*) refuse "this is the PRODUCTION project ($ref). Use staging or a local database." ;; esac
done
MODE=run
case "${1:-}" in
  --list) MODE=list; LIST_RUN=${2:-}; [ -n "$LIST_RUN" ] || refuse "usage: --list <run id>" ;;
  --list-runs) MODE=list-runs ;;
  "") ;;
  *) refuse "unknown option $1" ;;
esac
if [ "$MODE" = run ]; then
  [ "${CONFIRM_NOT_PRODUCTION:-}" = yes ] || refuse "set CONFIRM_NOT_PRODUCTION=yes – and only for a local or staging database."
  [ "${CONFIRM_DATABASE:-}" = "$PGHOST/$PGDATABASE" ] || refuse "set CONFIRM_DATABASE=\"$PGHOST/$PGDATABASE\" to confirm this exact database is local or staging."
fi

P=(psql -X -q -v ON_ERROR_STOP=1)
q() { "${P[@]}" -tAc "$1" 2>&1; }   # output (or error text); exit status from psql

"${P[@]}" -tAc "select 1" >/dev/null 2>&1 || refuse "cannot connect to $PGHOST/$PGDATABASE."

if [ "$MODE" = list ]; then
  [[ "$LIST_RUN" =~ ^[A-Za-z0-9]{6,40}$ ]] || refuse "a test run ID is 6–40 letters/digits."
  echo "Bookings created by concurrency test run $LIST_RUN:"
  # (psql only fills in :'run' when the SQL comes on standard input)
  "${P[@]}" -v run="$LIST_RUN" <<<"select reference, status, deposit_paid_at is not null as paid, created_at, admin_notes
    from public.enquiries where email = 'concurrency-test+' || :'run' || '@example.invalid' order by reference;"
  exit $?
fi
if [ "$MODE" = list-runs ]; then
  "${P[@]}" -c "select split_part(split_part(email, '+', 2), '@', 1) as test_run_id, count(*) as bookings,
                       count(*) filter (where deposit_paid_at is not null) as paid, min(created_at) as started
                from public.enquiries where email like 'concurrency-test+%@example.invalid' group by 1 order by started"
  exit $?
fi

# ---------------------------------------------------------------- the database must have the migration
check=$(q "select to_regclass('public.booking_consents') is not null and to_regprocedure('public.protect_paid_booking_records()') is not null
                  and exists (select 1 from pg_roles where rolname = 'service_role')")
[ "$check" = t ] || refuse "the full-payment migration (booking_consents, protect_paid_booking_records, role service_role) is not present here: $check"

RUN_ID=${TEST_RUN_ID:-$(date -u +%Y%m%d%H%M%S)$(od -An -N2 -tx1 /dev/urandom | tr -d ' \n')}
[[ "$RUN_ID" =~ ^[A-Za-z0-9]{6,40}$ ]] || refuse "TEST_RUN_ID must be 6–40 letters/digits."
EMAIL="concurrency-test+$RUN_ID@example.invalid"
OUT=$(mktemp -d)
PIDS=()
SEQ=0
PASSED=0
FAILED_TESTS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
  rm -rf "$OUT"
}
trap cleanup EXIT
trap 'echo "Interrupted."; exit 1' INT TERM

pass() { PASSED=$((PASSED + 1)); echo "PASS  $1"; }
fail() { FAILED_TESTS+=("$1"); echo "FAIL  $1"; echo "      why: $2"; }
join_reasons() { local out="" r; for r in "$@"; do out+="${out:+ | }$r"; done; echo "$out"; }
last_lines() { grep -v '^\s*$' "$1" 2>/dev/null | grep -v '^exit=' | tail -3 | tr '\n' ' ' | cut -c1-400; }

wait_for() { # sql returning t/f, tries
  local i
  for ((i = 0; i < ${2:-$WAIT_TRIES}; i++)); do [ "$(q "$1")" = t ] && return 0; sleep 0.1; done
  return 1
}

# A booking awaiting payment, with consent, one room and one photo. Sets BOOKING (id) or returns 1 with ERROR set.
make_booking() {
  local name=$1 id cid out
  SEQ=$((SEQ + 1))
  id=$(q "select gen_random_uuid()") && cid=$(q "select gen_random_uuid()") || { ERROR="could not generate ids: $id"; return 1; }
  out=$("${P[@]}" -v id="$id" -v cid="$cid" -v ref="CT-$RUN_ID-$(printf %02d $SEQ)" -v email="$EMAIL" \
        -v note="Concurrency test run $RUN_ID: $name" 2>&1 <<'SQL'
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence, admin_notes)
values (:'id', :'ref', 'Concurrency Test', :'email', '0', 'NE1 1AA', 'phone', '[]', '{}', '{}', 20000, :'note');
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
  ) || { ERROR="could not create the test booking: $(echo "$out" | tail -2 | tr '\n' ' ')"; return 1; }
  BOOKING=$id
}

server_txn() { # statements → a transaction run as the website server
  printf "begin;\nset local role service_role;\nselect set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true);\n%s\ncommit;\n" "$1"
}
pay_stmt() { echo "update public.enquiries set status = 'booking_confirmed', booking_confirmed_at = now(), deposit_paid_at = now(), deposit_paid_pence = 20000, stripe_payment_intent_id = 'pi-$1' where id = '$1' and deposit_paid_at is null;"; }

# run_pair A_SQL B_SQL – A starts and holds (its SQL must end in pg_sleep before commit); B starts.
# Sets: A_RC, B_RC (psql exit codes), BLOCKED=yes|no, A_STARTED=yes|no; outputs in $OUT/a, $OUT/b.
run_pair() {
  local app_a="ct_a_$RUN_ID" app_b="ct_b_$RUN_ID" pa pb
  : >"$OUT/a"; : >"$OUT/b"; BLOCKED=no; A_STARTED=no; A_RC=; B_RC=
  PGAPPNAME=$app_a "${P[@]}" <<<"$1" >"$OUT/a" 2>&1 &
  pa=$!; PIDS+=("$pa")
  if wait_for "select exists (select 1 from pg_stat_activity where application_name = '$app_a' and query like '%pg_sleep%' and state = 'active')"; then
    A_STARTED=yes
    PGAPPNAME=$app_b "${P[@]}" <<<"$2" >"$OUT/b" 2>&1 &
    pb=$!; PIDS+=("$pb")
    wait_for "select exists (select 1 from pg_stat_activity where application_name = '$app_b' and wait_event_type = 'Lock')" && BLOCKED=yes
    wait "$pb"; B_RC=$?
  fi
  wait "$pa"; A_RC=$?
  PIDS=()
}

# expect_refused NAME DESCRIPTION EXPECTED_ERROR CHECK_SQL – B must have waited, failed with EXPECTED_ERROR,
# A must have committed, and CHECK_SQL must return t.
expect_refused() {
  local name=$1 expect=$2 check=$3 why=() c
  [ "$A_STARTED" = yes ] || why+=("session A never started its change: $(last_lines "$OUT/a")")
  [ "$A_STARTED" = yes ] && [ "$A_RC" != 0 ] && why+=("session A failed (exit $A_RC): $(last_lines "$OUT/a")")
  [ "$A_STARTED" = yes ] && [ "$BLOCKED" != yes ] && why+=("session B did NOT wait for session A – no lock protection")
  [ "$A_STARTED" = yes ] && [ "$B_RC" = 0 ] && why+=("session B SUCCEEDED but should have been refused")
  [ "$A_STARTED" = yes ] && [ "$B_RC" != 0 ] && ! grep -q "$expect" "$OUT/b" && why+=("session B failed for a different reason (expected \"$expect\"): $(last_lines "$OUT/b")")
  c=$(q "$check"); [ "$c" = t ] || why+=("final state check failed (got: $c)")
  if [ ${#why[@]} -eq 0 ]; then pass "$name"; else fail "$name" "$(join_reasons "${why[@]}")"; fi
}

echo "== Concurrency tests on $(q "select current_database() || ' (PostgreSQL ' || current_setting('server_version') || ')'")"
echo "== Test run ID: $RUN_ID   (bookings: email $EMAIL, references CT-$RUN_ID-nn)"

# ---- 1. Payment in progress vs changes to the booking's room and photo records
while IFS='|' read -r label stmt expect check; do
  name="payment in progress vs $label"
  if ! make_booking "$name"; then fail "$name" "$ERROR"; continue; fi
  id=$BOOKING
  run_pair "$(server_txn "$(pay_stmt "$id") select pg_sleep($HOLD);")" "$(server_txn "${stmt//ID/$id}")"
  expect_refused "$name: waits for the payment, then refused; paid booking intact" "$expect" \
    "select (${check//ID/$id}) and exists (select 1 from public.enquiries where id = '$id' and deposit_paid_at is not null)"
done <<'CASES'
a room record deleted|delete from public.quote_rooms where enquiry_id = 'ID';|Room records of a paid booking|select count(*) = 1 from public.quote_rooms where enquiry_id = 'ID'
a room price changed|update public.quote_rooms set estimated_labour_pence = 1 where enquiry_id = 'ID';|Room records of a paid booking|select bool_and(estimated_labour_pence = 20000) from public.quote_rooms where enquiry_id = 'ID'
a room record added|insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence) values ('ID', 1, 'bedroom', 'Extra', 2, '{}', 100);|cannot be added to a paid booking|select count(*) = 1 from public.quote_rooms where enquiry_id = 'ID'
a photo record deleted|delete from public.enquiry_photos where enquiry_id = 'ID';|Photo records of a paid booking|select count(*) = 1 from public.enquiry_photos where enquiry_id = 'ID'
a photo record added|insert into public.enquiry_photos (enquiry_id, storage_path) values ('ID', 'concurrency-test/extra.jpg');|cannot be added to a paid booking|select count(*) = 1 from public.enquiry_photos where enquiry_id = 'ID'
CASES

# ---- 2. The other order: a room change in progress, then the payment (must wait, then succeed)
name="room change in progress, then payment"
if make_booking "$name"; then
  id=$BOOKING
  run_pair "$(server_txn "delete from public.quote_rooms where enquiry_id = '$id'; select pg_sleep($HOLD);")" "$(server_txn "$(pay_stmt "$id")")"
  why=()
  [ "$A_STARTED" = yes ] || why+=("session A never started: $(last_lines "$OUT/a")")
  [ "${A_RC:-x}" = 0 ] || why+=("session A failed (exit ${A_RC:-none}): $(last_lines "$OUT/a")")
  [ "$BLOCKED" = yes ] || why+=("the payment did NOT wait for the room change")
  [ "${B_RC:-x}" = 0 ] || why+=("the payment failed (exit ${B_RC:-none}): $(last_lines "$OUT/b")")
  c=$(q "select exists (select 1 from public.enquiries where id = '$id' and deposit_paid_at is not null) and not exists (select 1 from public.quote_rooms where enquiry_id = '$id')")
  [ "$c" = t ] || why+=("final state check failed (got: $c)")
  if [ ${#why[@]} -eq 0 ]; then pass "$name: the payment waits for the room change, then succeeds (one clear order)"; else fail "$name" "$(join_reasons "${why[@]}")"; fi
else fail "$name" "$ERROR"; fi

# ---- 3./4. Consent recorded while the booking is changing
consent_stmt() { echo "insert into public.booking_consents (enquiry_id, terms_version, terms_sha256, statements, accepted_terms, early_start_requested, early_start_ack_pay_for_work, early_start_ack_loses_right, amount_pence) values ('$1', '2026-11-23', repeat('ab', 32), '{}', true, false, false, false, 20000);"; }
while IFS='|' read -r label stmt; do
  name="consent while $label"
  if ! make_booking "$name"; then fail "$name" "$ERROR"; continue; fi
  id=$BOOKING
  run_pair "$(server_txn "${stmt//ID/$id} select pg_sleep($HOLD);")" "$(server_txn "$(consent_stmt "$id")")"
  expect_refused "$name: consent waits, then refused" "awaiting payment" \
    "select count(*) = 1 from public.booking_consents where enquiry_id = '$id'"
done <<'CASES'
the payment request is being withdrawn|update public.enquiries set status = 'price_agreed' where id = 'ID';
the price is being changed|update public.enquiries set status = 'price_agreed', agreed_price_pence = 25000, deposit_pence = 25000, stripe_checkout_session_id = null, payment_token = null where id = 'ID';
CASES

# ---- 5. Two refunds of the same payment at the same moment
name="two refunds of the same payment at once"
if make_booking "$name"; then
  id=$BOOKING
  if out=$("${P[@]}" 2>&1 <<<"$(server_txn "$(pay_stmt "$id")
insert into public.payments (enquiry_id, kind, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id, notes)
values ('$id', 'full', 'payment_recorded', 20000, 'gbp', 'cs-$id', 'pi-$id', 'evt-$id', 'Concurrency test run $RUN_ID');")"); then
    refund() { echo "insert into public.refunds (enquiry_id, stripe_refund_id, stripe_payment_intent_id, amount_pence, currency, status, source, note) values ('$id', 're-$1-$id', 'pi-$id', 15000, 'gbp', 'pending', 'admin', 'Concurrency test run $RUN_ID');"; }
    run_pair "$(server_txn "$(refund a) select pg_sleep($HOLD);")" "$(server_txn "$(refund b)")"
    expect_refused "$name: £150 + £150 of a £200 payment – the second waits, then refused; total £150" "exceed the original payment" \
      "select coalesce(sum(amount_pence), 0) = 15000 from public.refunds where stripe_payment_intent_id = 'pi-$id'"
  else fail "$name" "could not record the test payment: $(echo "$out" | tail -2 | tr '\n' ' ')"; fi
else fail "$name" "$ERROR"; fi

# ---- 6. TRUNCATE of room/photo records while a payment is in progress
for t in quote_rooms enquiry_photos; do
  name="TRUNCATE $t while a payment is in progress"
  if ! make_booking "$name"; then fail "$name" "$ERROR"; continue; fi
  id=$BOOKING
  run_pair "$(server_txn "$(pay_stmt "$id") select pg_sleep($HOLD);")" "truncate public.$t;"
  expect_refused "$name: waits, then refused; records intact" "cannot be truncated" \
    "select count(*) > 0 from public.$t where enquiry_id = '$id'"
done

# ---------------------------------------------------------------- summary
echo "== Bookings created by this run:"
"${P[@]}" -v email="$EMAIL" <<<"select reference, status, deposit_paid_at is not null as paid, admin_notes from public.enquiries where email = :'email' order by reference;" 2>&1
echo "== List them again later with: supabase/tests/concurrency-tests.sh --list $RUN_ID"
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo "== All concurrency tests passed ($PASSED) – test run $RUN_ID"
  exit 0
fi
echo "== Concurrency tests FAILED: ${#FAILED_TESTS[@]} failed, $PASSED passed – test run $RUN_ID"
for t in "${FAILED_TESTS[@]}"; do echo "   - $t"; done
exit 1
