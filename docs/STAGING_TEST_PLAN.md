# Staging test plan – full payment, consent, refunds and concurrency (migration revision 10)

Run everything here on a **staging** copy. Never on production. Use **Stripe test mode only** (keys starting `sk_test_` / `pk_test_`), Stripe's test card numbers, and no real customers.

Every expected result below matches the current code: `src/app/api/pay/[token]/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts`, `src/app/admin/payment-actions.ts` and the migration `supabase/migrations/20261123170000_price_revision_full_payment.sql`.

## 0. Before you start

- Run the local suites and check they pass:
  `PGHOST=/tmp PGPORT=<port> PGUSER=postgres supabase/tests/run-migration-tests.sh` (ends `== All migration checks passed`; it includes the concurrency tests),
  then `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build`.
- You need: a separate Supabase project (or Supabase branch) for staging, a Vercel **preview** deployment, the Stripe CLI logged in to your **test** account, and `psql`.

## 1. Set up staging

| # | Do this | Expected |
|---|---|---|
| 1.1 | Create the staging Supabase project/branch. Never point staging at production. | – |
| 1.2 | Apply the migrations in repository order: the five `20261119…`/`20261120…` files, `20261123120000_quote_rooms`, `20261123130000_api_grants`, then `20261123170000_price_revision_full_payment` | The last one finishes with a `Prices updated: …` notice and an informational notice listing roles able to TRUNCATE. Any `Stopped:` or `Verification failed:` message means it rolled back and nothing changed – read it and stop |
| 1.3 | Change one price in the admin settings, then **run the last migration again** | Succeeds again; your changed price is kept |
| 1.4 | Run the TRUNCATE check below in the staging SQL editor | **No rows.** Only each table's owner and superusers may TRUNCATE; the migration enforces the same rule and would have stopped otherwise |
| 1.5 | Vercel preview: staging Supabase URL/keys, Stripe **test** keys | – |
| 1.6 | Stripe (test mode) → Developers → Webhooks: endpoint `https://<preview>/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`, `refund.failed`; put its signing secret in `STRIPE_WEBHOOK_SECRET` | – |
| 1.7 | Add your admin login to `admin_users` on staging | – |

TRUNCATE check (1.4) – it lists every role, whatever it is called, that could empty a protected table without being its owner or a superuser:

```sql
select r.rolname, c.relname
from pg_roles r
cross join pg_class c
where c.oid in ('public.enquiries'::regclass, 'public.quote_rooms'::regclass, 'public.enquiry_photos'::regclass,
                'public.payments'::regclass, 'public.refunds'::regclass, 'public.booking_consents'::regclass)
  and has_table_privilege(r.oid, c.oid, 'TRUNCATE')
  and r.oid <> c.relowner
  and not r.rolsuper;
```

## 2. Quotes and photos

| # | Do this | Expected |
|---|---|---|
| 2.1 | Submit a quote with two rooms, an extra and two photos | The enquiry, room records and photo records appear in the admin area; the photos open |
| 2.2 | Compare the calculator total with the itemised breakdown | Exact pence, no rounding |

## 3. Agreeing the price and the payment page

| # | Do this | Expected |
|---|---|---|
| 3.1 | Agree a final price (e.g. £375.50) and send the payment link | Status "Payment requested"; the customer email contains the link |
| 3.2 | Open the link and press Pay **without** ticking the terms box | The browser won't submit (the box is required). The server refuses such a request too – covered by automated tests |
| 3.3 | Tick the terms and "start within 14 days", but **not** the two acknowledgements, and press Pay | Back on the page with: "To ask us to start within 14 days, please also tick both boxes…"; no Stripe page; no consent record |
| 3.4 | Tick the terms only and press Pay | Stripe page shows **exactly £375.50**, in **GBP**, as one item |
| 3.5 | In staging, look at the newest `booking_consents` row | `terms_version` = current version, a 64-character `terms_sha256`, `statements` containing **only** the terms box wording, exactly as shown on the page, `amount_pence` 37550, `early_start_requested` false; the booking's `consent_id` points to it |

## 4. Payments that must NOT confirm a booking

| # | Do this | Expected |
|---|---|---|
| 4.1 | Pay with the declined test card `4000 0000 0000 0002` | Stripe declines; booking stays "Payment requested"; nothing in the payment log |
| 4.2 | Pay with `4000 0027 6000 3184` (always asks for 3-D Secure) and **fail** the authentication | Booking stays "Payment requested" |
| 4.3 | Open the Stripe page, then expire it: `stripe checkout sessions expire <cs_test_…>` | Nothing confirmed. Opening the link and pressing Pay again creates a **new** Stripe page |
| 4.4 | With a link sent, change the agreed price in the admin area | The old link shows "This payment link isn't active"; the old Stripe page is closed; the booking is back at "Price agreed" – send a new link to continue |
| 4.5 | `curl -X POST https://<preview>/api/stripe/webhook -H "stripe-signature: t=1,v1=bad" -d '{}'` | HTTP 400 "Invalid signature"; nothing changes |

## 5. A successful payment

| # | Do this | Expected |
|---|---|---|
| 5.1 | Pay with `4242 4242 4242 4242`, ticking the terms, "start within 14 days" **and** both acknowledgements | Status "Booking confirmed"; payment log entry with outcome **`payment_recorded`**, 37550, `gbp` |
| 5.2 | Customer confirmation email | Shows the amount, the terms version, the early-start request with both acknowledgements, and the link to the cancellation page and model form |
| 5.3 | Stripe dashboard → the payment → Metadata | `enquiry_id`, `consent_id` and `terms_version` match staging |
| 5.4 | Stripe dashboard → Webhooks → **Resend** the same `checkout.session.completed` event | No change, no second email, no refund |

## 6. A genuine duplicate payment

Two browser tabs share the same Stripe page, so they can't produce a second payment. Use the Stripe CLI to make a real second test payment that names the already-paid booking:

| # | Do this | Expected |
|---|---|---|
| 6.1 | `stripe trigger checkout.session.completed --add checkout_session:metadata.kind=full --add checkout_session:metadata.enquiry_id=<paid booking id>` | The booking is unchanged; a payment-log entry `duplicate_refunded` for the CLI payment; a refund record with source `duplicate_payment`; Stripe shows the CLI payment refunded; you get an alert email |

## 7. Refunds and cancellation

Use the booking paid in 5.1 (£375.50) unless stated.

| # | Do this | Expected |
|---|---|---|
| 7.1 | Admin → booking → "Refund through Stripe": £100, with a reason | Stripe shows a £100 refund to the original card; refund record with source `admin`; the payment-log entry and the booking's payment details are unchanged |
| 7.2 | Try to refund £300 (more than the remaining £275.50) | Refused with "You can refund at most…"; Stripe isn't called |
| 7.3 | Refund £50 directly in the Stripe dashboard | A refund record with source `stripe_dashboard` appears; you get a "Refund recorded" email |
| 7.4 | Refund the remaining £225.50 from the admin area with "Also mark the booking as cancelled" ticked | Fully refunded; status "Cancelled"; the status menu offers no other status |
| 7.5 | New booking: pay with `4000 0000 0000 5126`, then refund it from the admin area | The refund first shows "succeeded"; a few minutes later Stripe reports it failed: the record becomes `failed` and you get a "REFUND FAILED" email |
| 7.6 | New booking: pay with `4000 0000 0000 7726`, then refund it | The record starts `pending`, then becomes `succeeded` |

## 8. Two things at the same moment (concurrency)

Run the concurrency script against **staging** from your computer. It creates its own test bookings (reference `CT-…`, email `concurrency-test@example.invalid`), never deletes anything, and its paid test bookings stay in staging by design. Use the staging database's **direct** connection (Supabase → Connect → Direct connection), as `postgres`:

```bash
CONFIRM_NOT_PRODUCTION=yes PGHOST=<staging host> PGPORT=5432 PGUSER=postgres PGDATABASE=postgres PGPASSWORD=<staging password> \
  supabase/tests/concurrency-tests.sh
```

Each test holds one change open for 4 seconds in session A, starts session B, checks that B is made to **wait**, and then checks the result:

| Session A (open) | Session B | Expected |
|---|---|---|
| Payment being recorded | Delete / change / add a room record | B waits, then is refused; booking paid, its room record unchanged |
| Payment being recorded | Delete / add a photo record | B waits, then is refused; photo records unchanged |
| Room record being deleted | Payment recorded | The payment waits, then succeeds (one clear order) |
| Payment request being withdrawn | Consent recorded | Consent waits, then is refused ("awaiting payment") |
| Price being changed | Consent recorded for the old price | Consent waits, then is refused |
| £150 refund of a £200 payment | Another £150 refund | The second waits, then is refused ("exceed the original payment"); total £150 |
| Payment being recorded | TRUNCATE of room / photo records | TRUNCATE waits, then is refused; records intact |

Expected last line: `== All concurrency tests passed`.

## 9. Things that must be refused (staging SQL editor)

The SQL editor runs as `postgres`, the table owner. Each statement must fail with the message shown. Run them after sections 5–7, so the tables have rows (row rules only act on rows that exist).

| Statement | Expected message (starts with) |
|---|---|
| `delete from enquiries where deposit_paid_at is not null;` | A paid booking cannot be deleted |
| `delete from enquiry_photos where enquiry_id = '<paid booking id>';` | Photo records of a paid booking cannot be changed or removed |
| `update quote_rooms set estimated_labour_pence = 1 where enquiry_id = '<paid booking id>';` | Room records of a paid booking cannot be changed or removed |
| `update enquiries set agreed_price_pence = 1 where id = '<paid booking id>';` | Payment fields can only be changed by the website server |
| `update enquiries set status = 'booking_confirmed' where id = '<cancelled paid booking id>';` | Booking status cannot change from cancelled to booking_confirmed |
| `delete from payments;` | Payment log entries cannot be deleted |
| `delete from refunds;` | Refund records cannot be deleted |
| `delete from booking_consents;` | Consent records cannot be changed or deleted |
| `truncate payments cascade;` | …cannot be truncated |

## 10. Go / no-go for production

Production can be considered only when **all** of these are true:

- Every row in sections 1–9 behaved as expected on staging, including `== All concurrency tests passed`.
- The TRUNCATE check (1.4) returned no rows.
- The migration ran twice on staging without errors.
- Your business address and email are on the cancellation page and form.
- The cancellation, early-start and terms wording has been checked by a suitably qualified adviser.
- Production is backed up immediately before the migration.
- You approve the production migration and the deployment separately.
