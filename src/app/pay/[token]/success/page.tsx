import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckCircle2, Loader2, Phone } from "lucide-react";
import { getBookingByToken } from "@/lib/payments/booking-server";
import { formatPence } from "@/lib/pricing/engine";
import { paidHeadline } from "@/lib/payments/deposit";
import { telHref } from "@/config/site";
import { getBusinessSettings } from "@/lib/settings";
import { AutoRefresh } from "./AutoRefresh";

/**
 * Shown after Stripe checkout. The thank-you message ONLY appears once our
 * database says the payment is received – which only the verified webhook can set.
 * Until then we show "confirming…" and check again every few seconds.
 */
export default function SuccessPage({ params }: PageProps<"/pay/[token]/success">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-black/60">Checking your payment…</p>}>
      <SuccessDetails params={params} />
    </Suspense>
  );
}

async function SuccessDetails({ params }: Pick<PageProps<"/pay/[token]/success">, "params">) {
  await connection(); // always read the latest payment status
  const [{ token }, business] = await Promise.all([params, getBusinessSettings()]);
  const booking = await getBookingByToken(token);
  const tel = telHref(business.phone);

  if (booking?.depositPaidAt) {
    const balance = booking.agreedPricePence - (booking.depositPaidPence ?? booking.depositPence);
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand-600">
          <CheckCircle2 className="size-11 text-white" aria-hidden />
        </span>
        <h1 className="mt-6 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">{paidHeadline(booking.paymentType, booking.depositPercent)}</h1>
        <p className="mt-5 text-lg text-black/75">
          Your painting booking is now {booking.paymentType === "full" ? "confirmed" : "secured"}. {business.name} will contact you to confirm the arrangements for your job.
        </p>
        <p className="mt-3 text-lg font-semibold">Thank you for choosing {business.name}.</p>

        <dl className="mx-auto mt-10 max-w-md divide-y divide-black/10 rounded-2xl border-2 border-ink text-left">
          <div className="flex justify-between px-5 py-3">
            <dt className="text-black/60">Booking reference</dt>
            <dd className="font-mono font-bold">{booking.reference}</dd>
          </div>
          <div className="flex justify-between px-5 py-3">
            <dt className="text-black/60">Agreed job price</dt>
            <dd className="font-semibold">{formatPence(booking.agreedPricePence)}</dd>
          </div>
          <div className="flex justify-between px-5 py-3">
            <dt className="text-black/60">Paid today</dt>
            <dd className="font-semibold text-brand-700">{formatPence(booking.depositPaidPence ?? booking.depositPence)}</dd>
          </div>
          {balance > 0 && (
            <div className="flex justify-between px-5 py-3">
              <dt className="text-black/60">Remaining balance</dt>
              <dd className="font-semibold">{formatPence(balance)}</dd>
            </div>
          )}
          {booking.stripePaymentIntentId && (
            <div className="flex justify-between gap-4 px-5 py-3">
              <dt className="text-black/60">Payment reference</dt>
              <dd className="break-all text-right font-mono text-xs">{booking.stripePaymentIntentId}</dd>
            </div>
          )}
        </dl>
        {booking.stripeReceiptUrl && (
          <p className="mt-4">
            <a href={booking.stripeReceiptUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">
              View your payment receipt
            </a>
          </p>
        )}
        {balance > 0 && <p className="mt-4 text-sm text-black/60">The remaining balance is paid separately as agreed – it will not be taken automatically.</p>}
        <p className="mt-6 text-sm text-black/60">
          Need to cancel? See our{" "}
          <Link href="/cancellation" className="font-semibold underline">
            cancellations and refunds
          </Link>{" "}
          page, including your 14-day cooling-off rights and the cancellation form.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <Loader2 className="mx-auto size-10 animate-spin text-brand-600" aria-hidden />
      <h1 className="mt-6 font-sans text-2xl font-bold">Confirming your payment…</h1>
      <p className="mt-3 text-black/70" role="status">
        We&rsquo;re waiting for confirmation from our payment provider. This usually takes a few seconds – please keep this page open.
      </p>
      <AutoRefresh />
      <p className="mt-8 text-sm text-black/60">
        Taking a while? Don&rsquo;t pay again. If your payment went through you&rsquo;ll receive a confirmation, or call us on{" "}
        <a href={tel} className="inline-flex items-center gap-1 font-semibold text-brand-700 underline">
          <Phone className="size-3.5" aria-hidden /> {business.phone}
        </a>
        .
      </p>
    </div>
  );
}
