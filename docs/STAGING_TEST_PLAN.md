# Staging test plan – full payment, consent and refunds (migration revision 9)

Run this on a **staging** copy before anything touches production. Use **Stripe test mode only** (keys starting `sk_test_` / `pk_test_`). No real card numbers, no real customers.

## 1. Set up staging

1. Create a separate Supabase project (or a Supabase branch) for staging. Never point staging at the production project.
2. Apply the migrations in order, exactly as in the repository:
   `20261119…_initial_schema`, `…_deposit_payments`, `…_payment_options_and_redesign`, `…_gallery_wall_preparation`, `20261123120000_quote_rooms`, `20261123130000_api_grants`, then `20261123170000_price_revision_full_payment`.
3. The last one must finish with the notices `Prices updated: …` and `Roles able to TRUNCATE booking tables …: postgres, supabase_admin`. Any `Stopped:` or `Verification failed:` message means nothing was changed – read the message and stop.
4. **Run the last migration a second time.** It must succeed again without changing prices you edited in between.
5. Create a Vercel **preview** deployment with the staging Supabase URL/keys and Stripe **test** keys.
6. In Stripe (test mode) → Developers → Webhooks, add an endpoint for the preview URL `/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`, `refund.failed`. Put its signing secret in the preview's `STRIPE_WEBHOOK_SECRET`.
7. Add your admin login to `admin_users` on staging.

## 2. Quotes and photos

| # | Do this | Expected |
|---|---|---|
| 2.1 | Submit a quote with 2 rooms, extras and 2 photos | Enquiry, room records and photo records appear in the admin area; photos open |
| 2.2 | Check the calculator total against the itemised breakdown | Exact pence, no rounding |

## 3. Agreeing the price and the payment page

| # | Do this | Expected |
|---|---|---|
| 3.1 | Agree a final price (e.g. £375.50) and send the payment link | Status "Payment requested"; email with link |
| 3.2 | Open the link, press Pay **without** ticking the terms box | Refused with the "please tick" message; no Stripe page |
| 3.3 | Tick terms + early start only (not the two acknowledgements) | Refused with the early-start message; no Stripe page |
| 3.4 | Tick terms only and pay | Stripe page shows **exactly £375.50 GBP** |
| 3.5 | In staging Supabase, look at `booking_consents` | One record: terms version, 64-character fingerprint, the exact wording of the box ticked, amount 37550, no early start |

## 4. Payments that must NOT confirm a booking

| # | Do this | Expected |
|---|---|---|
| 4.1 | Pay with the declined test card `4000 0000 0000 0002` | Stripe declines; booking stays "Payment requested" |
| 4.2 | Use `4000 0027 6000 3184` (always asks for 3-D Secure) and **fail** the authentication | Booking stays "Payment requested" |
| 4.3 | Open the Stripe page, then expire it (Stripe dashboard → the Checkout session → Expire) | Nothing confirmed; opening the link again creates a new page |
| 4.4 | Send the link, then change the agreed price | The old Stripe page no longer works; the new link shows the new price |
| 4.5 | Send a webhook with a wrong signature (e.g. `curl -X POST …/api/stripe/webhook -H "stripe-signature: t=1,v1=bad" -d '{}'`) | HTTP 400, nothing changes |

## 5. A successful payment

| # | Do this | Expected |
|---|---|---|
| 5.1 | Pay with `4242 4242 4242 4242` (tick terms, early start and both acknowledgements) | Status "Booking confirmed"; payment log entry "deposit_recorded" for 37550 GBP |
| 5.2 | Customer email | Shows the amount, terms version, the early-start request with both acknowledgements, and the link to the cancellation page and form |
| 5.3 | Stripe dashboard → the payment → metadata | Contains the booking id, `consent_id` and `terms_version` matching staging |
| 5.4 | Stripe dashboard → Webhooks → **Resend** the same event | No change, no second email, no refund |

## 6. Duplicates

| # | Do this | Expected |
|---|---|---|
| 6.1 | Before paying, open the payment link in two tabs, press Pay in both, then pay in both | The first payment confirms the booking; the second is refunded automatically; a refund record "duplicate_payment"; you get an alert email |

## 7. Refunds and cancellation

| # | Do this | Expected |
|---|---|---|
| 7.1 | Admin → booking → Refund £100 with a reason | Stripe shows a £100 refund; refund record "admin"; payment log entry unchanged |
| 7.2 | Try to refund more than the remaining £275.50 | Refused; Stripe not called |
| 7.3 | Refund £50 directly in the Stripe dashboard | A refund record "stripe_dashboard" appears automatically; you get an email |
| 7.4 | Refund the rest from the admin area and tick "Also mark the booking as cancelled" | Fully refunded; status "Cancelled"; the status menu offers nothing else |
| 7.5 | On a new booking, pay with `4000 0000 0000 5126`, then refund it | Stripe first reports the refund as succeeded, then a few minutes later as failed: the refund record becomes "failed" and you get an alert email |
| 7.6 | On a new booking, pay with `4000 0000 0000 7726`, then refund it | Refund record starts "pending", then becomes "succeeded" |

## 8. Things that must be refused (SQL editor on **staging**)

Run each in the staging SQL editor; each must fail with the message shown.

| Statement | Expected message |
|---|---|
| `delete from enquiries where deposit_paid_at is not null;` | A paid booking cannot be deleted |
| `delete from enquiry_photos where enquiry_id = '<paid booking id>';` | Photo records of a paid booking cannot be changed or removed |
| `update quote_rooms set estimated_labour_pence = 1 where enquiry_id = '<paid booking id>';` | Room records of a paid booking … |
| `update enquiries set agreed_price_pence = 1 where id = '<paid booking id>';` | …cannot change after payment… |
| `update enquiries set status = 'booking_confirmed' where id = '<cancelled paid booking id>';` | Booking status cannot change… |
| `delete from payments;` / `delete from refunds;` / `delete from booking_consents;` | …cannot be deleted |
| `truncate payments cascade;` | The payment log cannot be truncated |

## 9. Go / no-go for production

Production can be considered only when **all** of the following are true:

- Every row above behaved as expected on staging.
- The migration ran twice on staging without errors.
- Your business address and email are on the cancellation page and form.
- The cancellation, early-start and terms wording has been checked by a suitably qualified adviser.
- The production Supabase project has been backed up immediately before the migration.
- You approve the production migration and deployment separately.
