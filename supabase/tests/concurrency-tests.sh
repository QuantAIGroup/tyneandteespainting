#!/usr/bin/env bash
# CONCURRENCY AND REFUND-LIMIT TESTS – real database sessions at the same time.
#
# Each concurrency test opens session A, makes a change WITHOUT committing, then
# starts session B (and sometimes C). It checks whether B/C were made to WAIT for
# A (seen in pg_stat_activity as a lock wait), how each session ended, and the
# final state once all have finished. The refund tests also check, step by step,
# that pending refunds reserve the refundable amount, failed and cancelled ones
# release it, succeeded ones keep counting, and simultaneous refunds can never
# exceed the original payment.
#
# LOCAL OR STAGING ONLY. Every run has a unique TEST RUN ID. Every test booking
# it creates carries that ID in three places:
#   reference    CT-<run id>-<nn>
#   email        concurrency-test+<run id>@example.invalid
#   admin notes  "Concurrency test run <run id>: <test name>"
# It never deletes anything. Paid test bookings can't be removed afterwards (by
# design – the paid-booking protections are not relaxed for tests).
#
# Run the tests (BOTH confirmations are required):
#   CONFIRM_NOT_PRODUCTION=yes CONFIRM_DATABASE="<PGHOST>/<PGDATABASE>" \
#   PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=… [PGPASSWORD=…] \
#   supabase/tests/concurrency-tests.sh
#
# List the bookings a run created (read-only), or all runs:
#   … supabase/tests/concurrency-tests.sh --list <run id>
#   … supabase/tests/concurrency-tests.sh --list-runs
#
# Exit code: 0 all passed · 1 a test failed · 2 refused to run / could not set up.
set -uo pipefail

# Production project(s) this script must never touch, whatever else is set
PRODUCTION_PROJECT_REFS="dttbrxbkqrgxalhsxhml ${EXTRA_PRODUCTION_REFS:-}"
HOLD=4          # seconds session A keeps its change uncommitted
WAIT_TRIES=60   # × 0.1 s to see session A start / the other sessions start waiting

refuse() { echo "REFUSED  $*" >&2; exit 2; }

# ---------------------------------------------------------------- safety checks (before connecting)
[ -n "${PGHOST:-}" ] && [ -n "${PGDATABASE:-}" ] || refuse "set PGHOST and PGDATABASE explicitly (no defaults are used)."
# These would make psql connect somewhere other than the PGHOST/PGDATABASE being confirmed
for v in PGSERVICE PGSERVICEFILE PGHOSTADDR; do
  [ -z "${!v:-}" ] || refuse "$v is set; it can redirect the connection away from PGHOST/PGDATABASE. Unset it."
done
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
q() { "${P[@]}" -tAc "$1" 2>&1; }   # output (or the error text); exit status from psql

conn_err=$("${P[@]}" -tAc "select 1" 2>&1) || refuse "cannot connect to $PGHOST/$PGDATABASE: $(echo "$conn_err" | head -1)"

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
check=$(q "select to_regclass('public.booking_consents') is not null and to_regclass('public.refunds') is not null
                  and to_regprocedure('public.protect_paid_booking_records()') is not null
                  and to_regprocedure('public.protect_refund_log()') is not null
                  and exists (select 1 from pg_roles where rolname = 'service_role')")
[ "$check" = t ] || refuse "the full-payment migration (booking_consents, refunds, their guards, role service_role) is not present here: $check"

RUN_ID=${TEST_RUN_ID:-$(date -u +%Y%m%d%H%M%S)$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')}
[[ "$RUN_ID" =~ ^[A-Za-z0-9]{6,40}$ ]] || refuse "TEST_RUN_ID must be 6–40 letters/digits."
EMAIL="concurrency-test+$RUN_ID@example.invalid"
used=$(q "select count(*) from public.enquiries where email = '$EMAIL'")
[ "$used" = 0 ] || refuse "test run ID $RUN_ID has already been used here ($used bookings). Choose another, or leave TEST_RUN_ID unset."
OUT=$(mktemp -d 2>/dev/null) || refuse "could not create a temporary directory."
PIDS=()
SEQ=0
PASSED=0
FAILED_TESTS=()

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
  wait 2>/dev/null
  rm -rf "$OUT"
}
trap cleanup EXIT
trap 'echo "Interrupted – any open test change is rolled back by the database."; exit 1' INT TERM

pass() { PASSED=$((PASSED + 1)); echo "PASS  $1"; }
fail() { FAILED_TESTS+=("$1"); echo "FAIL  $1"; echo "      why: $2"; }
join_reasons() { local out="" r; for r in "$@"; do out+="${out:+ | }$r"; done; echo "$out"; }
last_lines() { grep -v '^\s*$' "$1" 2>/dev/null | tail -3 | tr '\n' ' ' | cut -c1-400; }
report() { # name, reasons... → PASS if there are no reasons
  local name=$1; shift
  if [ $# -eq 0 ]; then pass "$name"; else fail "$name" "$(join_reasons "$@")"; fi
}

wait_for() { # sql returning t/f, tries
  local i
  for ((i = 0; i < ${2:-$WAIT_TRIES}; i++)); do [ "$(q "$1")" = t ] && return 0; sleep 0.1; done
  return 1
}

now_ms() { # milliseconds on the local clock – works with bash 5 and with macOS's bash 3.2 (via perl)
  if [ -n "${EPOCHREALTIME:-}" ]; then local t=${EPOCHREALTIME/[.,]/}; echo "${t:0:${#t}-3}"
  else perl -MTime::HiRes=time -e 'printf "%d\n", time * 1000'; fi
}

server_txn() { # statements → one transaction run as the website server
  printf "begin;\nset local role service_role;\nselect set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true);\n%s\ncommit;\n" "$1"
}
run_sql() { # sql → output in $OUT/s, exit code returned
  "${P[@]}" <<<"$1" >"$OUT/s" 2>&1
}

# A booking awaiting payment (price in pence, default £200.00), with consent, one room and one photo.
# Sets BOOKING (id), or returns 1 with ERROR set.
make_booking() {
  local name=$1 price=${2:-20000} id cid out
  SEQ=$((SEQ + 1))
  id=$(q "select gen_random_uuid()") && cid=$(q "select gen_random_uuid()") || { ERROR="could not reach the database to create ids: $id"; return 1; }
  out=$("${P[@]}" -v id="$id" -v cid="$cid" -v price="$price" -v ref="CT-$RUN_ID-$(printf %02d $SEQ)" -v email="$EMAIL" \
        -v note="Concurrency test run $RUN_ID: $name" 2>&1 <<'SQL'
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.enquiries (id, reference, full_name, email, phone, postcode, preferred_contact, items, breakdown, pricing_snapshot, estimated_total_pence, admin_notes)
values (:'id', :'ref', 'Concurrency Test', :'email', '0', 'NE1 1AA', 'phone', '[]', '{}', '{}', :price, :'note');
insert into public.quote_rooms (enquiry_id, position, item_type, label, coats, condition, estimated_labour_pence)
values (:'id', 0, 'bedroom', 'Test room', 2, '{}', :price);
insert into public.enquiry_photos (enquiry_id, storage_path) values (:'id', 'concurrency-test/' || :'id' || '.jpg');
update public.enquiries set agreed_service = 'Test', agreed_price_pence = :price, deposit_pence = :price,
  consultation_confirmed_at = now(), price_agreed_at = now(), status = 'price_agreed' where id = :'id';
update public.enquiries set status = 'deposit_requested', payment_token = 'tok-' || :'id', stripe_checkout_session_id = 'cs-' || :'id' where id = :'id';
insert into public.booking_consents (id, enquiry_id, terms_version, terms_sha256, statements, accepted_terms,
  early_start_requested, early_start_ack_pay_for_work, early_start_ack_loses_right, amount_pence)
values (:'cid', :'id', '2026-11-23', repeat('ab', 32), '{"acceptTerms":"concurrency test"}', true, false, false, false, :price);
update public.enquiries set consent_id = :'cid', cancellation_terms_accepted_at = now(), cancellation_terms_version = '2026-11-23' where id = :'id';
commit;
SQL
  ) || { ERROR="could not create the test booking: $(echo "$out" | tail -2 | tr '\n' ' ')"; return 1; }
  BOOKING=$id
}

pay_stmt() { # booking id, price
  echo "update public.enquiries set status = 'booking_confirmed', booking_confirmed_at = now(), deposit_paid_at = now(), deposit_paid_pence = ${2:-20000}, stripe_payment_intent_id = 'pi-$1' where id = '$1' and deposit_paid_at is null;"
}

# A PAID booking with its GBP payment-log entry (price in pence). Sets BOOKING, or returns 1 with ERROR.
make_paid_booking() {
  local name=$1 price=$2
  make_booking "$name" "$price" || return 1
  if ! run_sql "$(server_txn "$(pay_stmt "$BOOKING" "$price")
insert into public.payments (enquiry_id, kind, outcome, amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id, stripe_event_id, notes)
values ('$BOOKING', 'full', 'payment_recorded', $price, 'gbp', 'cs-$BOOKING', 'pi-$BOOKING', 'evt-$BOOKING', 'Concurrency test run $RUN_ID');")"; then
    ERROR="could not record the test payment: $(last_lines "$OUT/s")"; return 1
  fi
}

refund_stmt() { # booking id, refund tag, amount (pence), status
  echo "insert into public.refunds (enquiry_id, stripe_refund_id, stripe_payment_intent_id, amount_pence, currency, status, source, note) values ('$1', 're-$2-$1', 'pi-$1', $3, 'gbp', '${4:-pending}', 'admin', 'Concurrency test run $RUN_ID');"
}
refund_status_stmt() { echo "update public.refunds set status = '$3', updated_at = now() where stripe_refund_id = 're-$2-$1';"; }
reserved() { q "select coalesce(sum(amount_pence), 0) from public.refunds where stripe_payment_intent_id = 'pi-$1' and status in ('pending', 'requires_action', 'succeeded')"; }

# run_sessions A_SQL FOLLOWER_SQL... – A starts and holds (its SQL must run pg_sleep before commit);
# then every follower starts. Sets A_STARTED, A_RC, and for follower i: F_RC[i], F_WAITED[i] (yes|no)
# and F_AHEAD_MS[i] – how many milliseconds before session A finished (A commits as its last step)
# follower i had already finished (negative if after). Outputs in $OUT/a and $OUT/f<i>.
# Waits for every session it started.
run_sessions() {
  local a_sql=$1; shift
  local app="ct_${RUN_ID}" pa i n=$# f
  local -a fpids=()
  A_STARTED=no; A_RC=; F_RC=(); F_WAITED=(); F_AHEAD_MS=()
  rm -f "$OUT"/*.end
  : >"$OUT/a"
  # each session records (local clock, milliseconds) when it finished
  ( PGAPPNAME="${app}_a" "${P[@]}" <<<"$a_sql" >"$OUT/a" 2>&1; rc=$?; now_ms >"$OUT/a.end"; exit $rc ) &
  pa=$!; PIDS+=("$pa")
  if wait_for "select exists (select 1 from pg_stat_activity where application_name = '${app}_a' and query like '%pg_sleep%' and state = 'active')"; then
    A_STARTED=yes
    i=0
    for f in "$@"; do
      : >"$OUT/f$i"
      ( PGAPPNAME="${app}_f$i" "${P[@]}" <<<"$f" >"$OUT/f$i" 2>&1; rc=$?; now_ms >"$OUT/f$i.end"; exit $rc ) &
      fpids[$i]=$!; PIDS+=("${fpids[$i]}")
      i=$((i + 1))
    done
    for ((i = 0; i < n; i++)); do
      F_WAITED[$i]=no
      wait_for "select exists (select 1 from pg_stat_activity where application_name = '${app}_f$i' and wait_event_type = 'Lock')" 30 && F_WAITED[$i]=yes
    done
    for ((i = 0; i < n; i++)); do wait "${fpids[$i]}"; F_RC[$i]=$?; done
  fi
  wait "$pa"; A_RC=$?
  if [ "$A_STARTED" = yes ]; then
    for ((i = 0; i < n; i++)); do
      F_AHEAD_MS[$i]=$(( $(cat "$OUT/a.end" 2>/dev/null || echo 0) - $(cat "$OUT/f$i.end" 2>/dev/null || echo 0) ))
    done
  fi
  PIDS=()
}
# Single-follower form: sets BLOCKED, B_RC and $OUT/b
run_pair() { run_sessions "$1" "$2"; BLOCKED=${F_WAITED[0]:-no}; B_RC=${F_RC[0]:-}; B_AHEAD_MS=${F_AHEAD_MS[0]:-0}; cp "$OUT/f0" "$OUT/b" 2>/dev/null || : >"$OUT/b"; }

a_reasons() { # reasons about session A, appended to array WHY
  [ "$A_STARTED" = yes ] || { WHY+=("session A never started its change: $(last_lines "$OUT/a")"); return; }
  [ "$A_RC" = 0 ] || WHY+=("session A failed (exit $A_RC): $(last_lines "$OUT/a")")
}

# expect_refused NAME EXPECTED_ERROR CHECK_SQL – B must have waited, failed with EXPECTED_ERROR,
# A must have committed, and CHECK_SQL must return t.
expect_refused() {
  local name=$1 expect=$2 check=$3 c
  WHY=()
  a_reasons
  if [ "$A_STARTED" = yes ]; then
    [ "$BLOCKED" = yes ] || WHY+=("session B did NOT wait for session A – no lock protection")
    if [ "$B_RC" = 0 ]; then WHY+=("session B SUCCEEDED but should have been refused")
    elif ! grep -q "$expect" "$OUT/b"; then WHY+=("session B failed for a different reason (expected \"$expect\"): $(last_lines "$OUT/b")"); fi
  fi
  c=$(q "$check"); [ "$c" = t ] || WHY+=("final state check failed (got: $c)")
  report "$name" "${WHY[@]}"
}

# step NAME SQL EXPECT – one statement on its own: EXPECT is "ok" or an error fragment it must fail with.
# On a mismatch returns 1 and sets STEP_WHY.
step() {
  local name=$1 sql=$2 expect=$3
  if run_sql "$(server_txn "$sql")"; then
    [ "$expect" = ok ] && return 0
    STEP_WHY="$name: SUCCEEDED but should have been refused (\"$expect\")"; return 1
  fi
  if [ "$expect" != ok ] && grep -q "$expect" "$OUT/s"; then return 0; fi
  if [ "$expect" = ok ]; then STEP_WHY="$name: failed: $(last_lines "$OUT/s")"
  else STEP_WHY="$name: failed for a different reason (expected \"$expect\"): $(last_lines "$OUT/s")"; fi
  return 1
}

echo "== Concurrency and refund-limit tests on $(q "select current_database() || ' (PostgreSQL ' || current_setting('server_version') || ')'")"
echo "== Test run ID: $RUN_ID   (bookings: email $EMAIL, references CT-$RUN_ID-nn)"

# ================================================================ A. Payment vs changes to rooms and photos
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

# The other order: a room change in progress, then the payment (must wait, then succeed)
name="room change in progress, then payment"
if make_booking "$name"; then
  id=$BOOKING
  run_pair "$(server_txn "delete from public.quote_rooms where enquiry_id = '$id'; select pg_sleep($HOLD);")" "$(server_txn "$(pay_stmt "$id")")"
  WHY=(); a_reasons
  if [ "$A_STARTED" = yes ]; then
    [ "$BLOCKED" = yes ] || WHY+=("the payment did NOT wait for the room change")
    [ "$B_RC" = 0 ] || WHY+=("the payment failed (exit $B_RC): $(last_lines "$OUT/b")")
  fi
  c=$(q "select exists (select 1 from public.enquiries where id = '$id' and deposit_paid_at is not null) and not exists (select 1 from public.quote_rooms where enquiry_id = '$id')")
  [ "$c" = t ] || WHY+=("final state check failed: expected a paid booking without the deleted room (got: $c)")
  report "$name: the payment waits for the room change, then succeeds (one clear order)" "${WHY[@]}"
else fail "$name" "$ERROR"; fi

# ================================================================ B. Consent recorded while the booking is changing
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

# ================================================================ C. Refund limits (each on a paid £375.50 booking unless stated)
# C1. Pending refunds reserve the amount
name="pending refunds reserve the refundable amount (£375.50 payment)"
if make_paid_booking "$name" 37550; then
  id=$BOOKING; WHY=()
  step "£300.00 pending" "$(refund_stmt "$id" p1 30000 pending)" ok || WHY+=("$STEP_WHY")
  step "£100.00 more while £300.00 is pending (would be £400.00)" "$(refund_stmt "$id" p2 10000 pending)" "exceed the original payment" || WHY+=("$STEP_WHY")
  step "£75.50 more (exactly the remaining amount)" "$(refund_stmt "$id" p3 7550 pending)" ok || WHY+=("$STEP_WHY")
  step "1p more" "$(refund_stmt "$id" p4 1 pending)" "exceed the original payment" || WHY+=("$STEP_WHY")
  r=$(reserved "$id"); [ "$r" = 37550 ] || WHY+=("expected £375.50 reserved, got ${r}p")
  report "$name: £300 pending → £100 refused → £75.50 accepted → 1p refused; £375.50 reserved" "${WHY[@]}"
else fail "$name" "$ERROR"; fi

# C2./C3. Failed and cancelled refunds release the amount
for outcome in failed canceled; do
  name="a $outcome refund releases its amount (£375.50 payment)"
  if make_paid_booking "$name" 37550; then
    id=$BOOKING; WHY=()
    step "£300.00 pending" "$(refund_stmt "$id" x1 30000 pending)" ok || WHY+=("$STEP_WHY")
    step "£375.50 while £300.00 is pending" "$(refund_stmt "$id" x2 37550 pending)" "exceed the original payment" || WHY+=("$STEP_WHY")
    step "Stripe reports the £300.00 refund $outcome" "$(refund_status_stmt "$id" x1 "$outcome")" ok || WHY+=("$STEP_WHY")
    step "£375.50 now (the full payment is available again)" "$(refund_stmt "$id" x3 37550 pending)" ok || WHY+=("$STEP_WHY")
    step "$outcome is final: back to pending" "$(refund_status_stmt "$id" x1 pending)" "Refund status cannot change" || WHY+=("$STEP_WHY")
    r=$(reserved "$id"); [ "$r" = 37550 ] || WHY+=("expected £375.50 reserved, got ${r}p")
    c=$(q "select count(*) from public.refunds where stripe_payment_intent_id = 'pi-$id' and status = '$outcome'"); [ "$c" = 1 ] || WHY+=("the $outcome refund record should be kept (got $c)")
    report "$name: £300 pending → £375.50 refused → £300 $outcome → £375.50 accepted; the $outcome record is kept" "${WHY[@]}"
  else fail "$name" "$ERROR"; fi
done

# C4. Succeeded refunds keep counting – until Stripe reports them failed
name="succeeded refunds keep counting (£375.50 payment)"
if make_paid_booking "$name" 37550; then
  id=$BOOKING; WHY=()
  step "£300.00 succeeded" "$(refund_stmt "$id" s1 30000 succeeded)" ok || WHY+=("$STEP_WHY")
  step "£100.00 more after £300.00 succeeded" "$(refund_stmt "$id" s2 10000 pending)" "exceed the original payment" || WHY+=("$STEP_WHY")
  step "£75.50 more" "$(refund_stmt "$id" s3 7550 succeeded)" ok || WHY+=("$STEP_WHY")
  step "a succeeded refund can't go back to pending" "$(refund_status_stmt "$id" s1 pending)" "Refund status cannot change" || WHY+=("$STEP_WHY")
  step "Stripe later reports the £300.00 refund failed" "$(refund_status_stmt "$id" s1 failed)" ok || WHY+=("$STEP_WHY")
  step "£300.00 can be refunded again" "$(refund_stmt "$id" s4 30000 pending)" ok || WHY+=("$STEP_WHY")
  r=$(reserved "$id"); [ "$r" = 37550 ] || WHY+=("expected £375.50 counted, got ${r}p")
  report "$name: £300 succeeded → £100 refused → £75.50 accepted; £300 later failed → £300 accepted again" "${WHY[@]}"
else fail "$name" "$ERROR"; fi

# C5. Three £150 refunds of a £375.50 payment at the same moment: exactly two can succeed
name="three £150 refunds of a £375.50 payment at once"
if make_paid_booking "$name" 37550; then
  id=$BOOKING
  run_sessions "$(server_txn "$(refund_stmt "$id" t1 15000) select pg_sleep($HOLD);")" \
               "$(server_txn "$(refund_stmt "$id" t2 15000)")" "$(server_txn "$(refund_stmt "$id" t3 15000)")"
  WHY=(); a_reasons
  if [ "$A_STARTED" = yes ]; then
    ok=0; refused=0
    for i in 0 1; do
      [ "${F_WAITED[$i]:-no}" = yes ] || WHY+=("refund $((i + 2)) did NOT wait for the first")
      if [ "${F_RC[$i]:-x}" = 0 ]; then ok=$((ok + 1))
      elif grep -q "exceed the original payment" "$OUT/f$i"; then refused=$((refused + 1))
      else WHY+=("refund $((i + 2)) failed for a different reason: $(last_lines "$OUT/f$i")"); fi
    done
    if [ "$ok" != 1 ] || [ "$refused" != 1 ]; then WHY+=("of the two waiting refunds, expected 1 accepted and 1 refused; got $ok accepted, $refused refused"); fi
  fi
  r=$(reserved "$id"); [ "$r" = 30000 ] || WHY+=("expected £300.00 refunded in total, got ${r}p")
  report "$name: refunds 2 and 3 both wait; one is accepted, one refused; total £300 (never above £375.50)" "${WHY[@]}"
else fail "$name" "$ERROR"; fi

# C6. A release that isn't committed yet still counts.
# Changing a refund's status takes no lock on the original payment (protect_refund_log only locks the
# payment row FOR UPDATE when a refund is ADDED), and a status change can only keep or release an
# amount, never add to it. So a new refund made at that moment does NOT wait: it reads the last
# committed state, in which the £300 is still reserved, and is refused at once – while session A is
# still open. That is the safe side: it can never over-refund. Once the release is committed, the
# same £200 is accepted.
name="a refund being marked failed still counts until committed (£375.50 payment)"
if make_paid_booking "$name" 37550; then
  id=$BOOKING; WHY=()
  step "£300.00 pending" "$(refund_stmt "$id" r1 30000 pending)" ok || WHY+=("$STEP_WHY")
  run_pair "$(server_txn "$(refund_status_stmt "$id" r1 failed) select pg_sleep($HOLD);")" "$(server_txn "$(refund_stmt "$id" r2 20000)")"
  a_reasons
  if [ "$A_STARTED" = yes ]; then
    [ "$BLOCKED" = no ] || WHY+=("the £200 refund WAITED for the status change – expected an immediate decision")
    # A holds its change for $HOLD seconds and commits as its last step; finishing at least a second
    # before A did means the £200 was decided while the status change was still uncommitted.
    [ "$B_AHEAD_MS" -ge 1000 ] || WHY+=("the £200 refund finished only ${B_AHEAD_MS} ms before session A ended – expected it to be decided while A was still open")
    if [ "$B_RC" = 0 ]; then WHY+=("£200 was accepted while the £300 was still reserved – could over-refund")
    elif ! grep -q "exceed the original payment" "$OUT/b"; then WHY+=("£200 failed for a different reason: $(last_lines "$OUT/b")"); fi
  fi
  c=$(q "select status from public.refunds where stripe_refund_id = 're-r1-$id'"); [ "$c" = failed ] || WHY+=("the £300 refund should be failed after session A committed (got: $c)")
  step "£200.00 once the failure is committed" "$(refund_stmt "$id" r3 20000)" ok || WHY+=("$STEP_WHY")
  r=$(reserved "$id"); [ "$r" = 20000 ] || WHY+=("expected £200.00 reserved at the end, got ${r}p")
  report "$name: while £300 is being marked failed, £200 is refused at once without waiting (A still open); after the commit, £200 is accepted; £200 reserved" "${WHY[@]}"
else fail "$name" "$ERROR"; fi

# C7. Two refunds of a smaller payment at once
name="two £150 refunds of a £200 payment at once"
if make_paid_booking "$name" 20000; then
  id=$BOOKING
  run_pair "$(server_txn "$(refund_stmt "$id" a 15000) select pg_sleep($HOLD);")" "$(server_txn "$(refund_stmt "$id" b 15000)")"
  expect_refused "$name: the second waits, then refused; total £150" "exceed the original payment" \
    "select coalesce(sum(amount_pence), 0) = 15000 from public.refunds where stripe_payment_intent_id = 'pi-$id'"
else fail "$name" "$ERROR"; fi

# ================================================================ D. TRUNCATE while a payment is in progress
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
total=$((PASSED + ${#FAILED_TESTS[@]}))
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo "== All concurrency tests passed ($PASSED of $total) – test run $RUN_ID"
  exit 0
fi
echo "== Concurrency tests FAILED: ${#FAILED_TESTS[@]} of $total failed – test run $RUN_ID"
for t in "${FAILED_TESTS[@]}"; do echo "   - $t"; done
exit 1
