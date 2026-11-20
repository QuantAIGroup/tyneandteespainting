import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Phone, XCircle } from "lucide-react";
import { getBookingByToken } from "@/lib/payments/booking-server";
import { getBusinessSettings } from "@/lib/settings";
import { telHref } from "@/config/site";

/** Shown when a customer leaves Stripe Checkout without paying. Nothing has been charged. */
export default function CancelledPage({ params }: PageProps<"/pay/[token]/cancelled">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-black/60">Loading…</p>}>
      <Cancelled params={params} />
    </Suspense>
  );
}

async function Cancelled({ params }: Pick<PageProps<"/pay/[token]/cancelled">, "params">) {
  await connection();
  const [{ token }, business] = await Promise.all([params, getBusinessSettings()]);
  const booking = await getBookingByToken(token);
  const canRetry = booking && booking.status === "deposit_requested" && !booking.depositPaidAt;
  return (
    <div className="mx-auto max-w-xl px-5 py-16 text-center">
      <XCircle className="mx-auto size-14 text-black/30" aria-hidden />
      <h1 className="mt-5 font-sans text-3xl font-extrabold tracking-tight">Payment cancelled</h1>
      <p className="mt-3 text-lg text-black/70">No payment was taken and you have not been charged. Your booking is not confirmed until payment is received.</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {canRetry && (
          <Link href={`/pay/${token}`} className="inline-flex h-12 items-center rounded-lg bg-brand-600 px-6 font-bold text-white hover:bg-brand-700">
            Try again
          </Link>
        )}
        <a href={telHref(business.phone)} className="inline-flex h-12 items-center gap-2 rounded-lg border-2 border-brand-600 px-6 font-bold text-brand-600 hover:bg-brand-50">
          <Phone className="size-4" aria-hidden /> CALL US – {business.phone}
        </a>
      </div>
    </div>
  );
}
