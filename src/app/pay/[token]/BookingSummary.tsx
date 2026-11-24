import Link from "next/link";
import { telHref } from "@/config/site";
import { CheckCircle2, CreditCard, Lock, ShieldCheck } from "lucide-react";
import type { PaymentBooking } from "@/lib/payments/booking-server";
import { formatPence } from "@/lib/pricing/engine";
import { paymentLabel } from "@/lib/payments/deposit";
import { CancellationSummary } from "@/components/CancellationPolicy";
import { CANCELLATION_TERMS_VERSION, CONSENT_STATEMENTS, COOLING_OFF_DAYS } from "@/config/cancellation";

/** The booking/payment summary (separate so it's easy to restyle). */
export function BookingSummary({
  booking,
  token,
  phone,
  error,
  cancelled,
  stripeReady,
  walletsEnabled = false,
}: {
  booking: PaymentBooking;
  token: string;
  phone: string;
  error?: string;
  cancelled: boolean;
  stripeReady: boolean;
  /** Only true once you've switched on Apple Pay / Google Pay in Stripe and set STRIPE_WALLETS_ENABLED=true */
  walletsEnabled?: boolean;
}) {
  const tel = telHref(phone);
  const business = { phone };
  const balancePence = booking.agreedPricePence - booking.depositPence;
  const alreadyPaid = Boolean(booking.depositPaidAt);
  const label = paymentLabel(booking.paymentType, booking.depositPercent);
  const isDeposit = booking.paymentType === "deposit";
  const isFull = booking.paymentType === "full";

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">Booking {booking.reference}</p>
      <h1 className="mt-2 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">YOUR PAINTING BOOKING</h1>
      <p className="mt-3 text-lg text-black/70">Hi {booking.fullName.split(" ")[0]}, thank you for speaking with us. Here are the details we agreed.</p>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink">
        <dl className="divide-y divide-black/10">
          <Row label="Customer" value={booking.fullName} />
          <Row label="Agreed painting service" value={booking.agreedService} />
          <Row label="Agreed job price" value={formatPence(booking.agreedPricePence)} strong />
          <Row label={label} value={formatPence(booking.depositPence)} strong note={isFull ? "100% of the agreed price. Paying this confirms your booking." : undefined} />
          {balancePence > 0 && <Row label="Remaining balance" value={formatPence(balancePence)} note="Paid separately, as agreed with you. It is never taken automatically." />}
        </dl>
        <div className="flex items-center justify-between gap-4 bg-brand-600 px-5 py-5 text-white sm:px-6">
          <span className="text-sm font-bold uppercase tracking-wider">{alreadyPaid ? "Paid" : "Payment due today"}</span>
          <span className="text-3xl font-extrabold">{alreadyPaid ? formatPence(booking.depositPaidPence ?? booking.depositPence) : formatPence(booking.depositPence)}</span>
        </div>
      </div>

      {alreadyPaid ? (
        <div className="mt-8 flex gap-3 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-600" aria-hidden />
          <div>
            <p className="font-bold">Your payment has already been received – thank you.</p>
            <p className="mt-1 text-black/70">Your booking is {isFull ? "confirmed" : "secured"}. There&rsquo;s nothing more to pay online.</p>
          </div>
        </div>
      ) : (
        <>
          {cancelled && <p className="mt-6 rounded-lg bg-black/[0.04] p-4 text-sm">Payment wasn&rsquo;t completed and you haven&rsquo;t been charged. You can try again whenever you&rsquo;re ready.</p>}
          {error && (
            <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
              {error}
            </p>
          )}
          {stripeReady ? (
            <form action={`/api/pay/${token}/checkout`} method="post" className="mt-8 space-y-4">
              <div className="rounded-2xl border border-black/10 p-5 text-sm leading-relaxed text-black/75">
                <p className="font-bold text-ink">Cancellations and refunds</p>
                <div className="mt-2">
                  <CancellationSummary />
                </div>
                <p className="mt-3">
                  Read the full <Link href="/cancellation" className="font-semibold underline">cancellation policy and cancellation form</Link> and the{" "}
                  <Link href="/terms" className="font-semibold underline">terms and conditions</Link> (version {CANCELLATION_TERMS_VERSION}).
                </p>
                <label className="mt-4 flex items-start gap-3 text-[15px] text-ink">
                  <input type="checkbox" name="acceptTerms" required className="mt-1 size-4 shrink-0 accent-brand-600" />
                  <span>{CONSENT_STATEMENTS.acceptTerms}</span>
                </label>
                <fieldset className="mt-4 rounded-xl bg-black/[0.03] p-4">
                  <legend className="px-1 text-[15px] font-bold text-ink">Optional: starting within {COOLING_OFF_DAYS} days</legend>
                  <p className="text-sm">Only tick these if you want us to start before your {COOLING_OFF_DAYS}-day cancellation period ends. If you ask for an early start, all three boxes are needed.</p>
                  <label className="mt-3 flex items-start gap-3 text-[15px] text-ink">
                    <input type="checkbox" name="earlyStart" className="mt-1 size-4 shrink-0 accent-brand-600" />
                    <span>{CONSENT_STATEMENTS.earlyStart}</span>
                  </label>
                  <label className="mt-2 flex items-start gap-3 text-[15px] text-ink">
                    <input type="checkbox" name="ackPayForWork" className="mt-1 size-4 shrink-0 accent-brand-600" />
                    <span>{CONSENT_STATEMENTS.ackPayForWork}</span>
                  </label>
                  <label className="mt-2 flex items-start gap-3 text-[15px] text-ink">
                    <input type="checkbox" name="ackLosesRight" className="mt-1 size-4 shrink-0 accent-brand-600" />
                    <span>{CONSENT_STATEMENTS.ackLosesRight}</span>
                  </label>
                </fieldset>
              </div>
              <button type="submit" className="flex h-16 w-full items-center justify-center gap-3 rounded-lg bg-ink text-lg font-extrabold uppercase tracking-wide text-white shadow-lg transition hover:bg-brand-700 focus-visible:outline-4 focus-visible:outline-brand-500">
                <Lock className="size-5" aria-hidden /> Pay {formatPence(booking.depositPence)}{isDeposit ? " deposit" : ""} and confirm booking
              </button>
            </form>
          ) : (
            <p className="mt-8 rounded-lg bg-red-50 p-4 text-red-900">Online payment isn&apos;t available right now. Please call us and we&apos;ll help you pay.</p>
          )}
          <ul className="mt-5 grid gap-2 text-sm text-black/70 sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <CreditCard className="size-4 text-brand-600" aria-hidden /> Debit &amp; credit cards
            </li>
            {walletsEnabled && (
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-600" aria-hidden /> Apple Pay &amp; Google Pay on supported devices
              </li>
            )}
            <li className="flex items-center gap-2">
              <Lock className="size-4 text-brand-600" aria-hidden /> Secured by Stripe
            </li>
          </ul>
        </>
      )}

      <div className="mt-10 rounded-2xl border border-black/10 p-5 text-sm leading-relaxed text-black/70">
        <p>
          <strong className="text-ink">What you&rsquo;re paying for:</strong> {isDeposit ? `a ${booking.depositPercent ?? 50}% deposit to secure your booking` : booking.paymentType === "full" ? "the full labour price for your booking" : "a payment towards your booking"} for the labour price we agreed with you. Paint and
          materials are not included. If anything about the job changes, we&rsquo;ll explain why and agree it with you before going ahead.
        </p>
        <p className="mt-3">
          Questions? Call <a href={tel} className="font-semibold text-brand-700 underline">{business.phone}</a>.{" "}
          <Link href="/privacy" className="underline">
            Privacy notice
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <dt className="text-sm font-semibold uppercase tracking-wide text-black/60">{label}</dt>
      <dd className="sm:max-w-[60%] sm:text-right">
        <span className={strong ? "text-xl font-extrabold" : "font-medium"}>{value}</span>
        {note && <span className="mt-1 block text-xs text-black/60">{note}</span>}
      </dd>
    </div>
  );
}
