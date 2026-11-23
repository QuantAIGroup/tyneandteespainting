import { connection } from "next/server";
import { Suspense } from "react";
import { getBookingByToken } from "@/lib/payments/booking-server";
import { BookingSummary } from "./BookingSummary";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { getBusinessSettings } from "@/lib/settings";
import { telHref } from "@/config/site";
import { Phone } from "lucide-react";

export default function PayPage({ params, searchParams }: PageProps<"/pay/[token]">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-black/60">Loading your booking…</p>}>
      <PaymentDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const ERRORS: Record<string, string> = {
  unavailable: "Online payment isn't available right now. Please call us and we'll help you pay.",
  stripe: "We couldn't open the secure payment page. Please try again in a moment, or call us.",
  busy: "Your payment page was just being prepared. Please press the button again.",
  terms: "Please tick the box to confirm you've read the cancellation and refund policy.",
};

async function PaymentDetails({ params, searchParams }: Pick<PageProps<"/pay/[token]">, "params" | "searchParams">) {
  await connection(); // always read the latest payment status
  const [{ token }, query, business] = await Promise.all([params, searchParams, getBusinessSettings()]);
  const booking = await getBookingByToken(token);
  const tel = telHref(business.phone);

  if (!booking || (booking.status !== "deposit_requested" && !booking.depositPaidAt)) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="font-sans text-2xl font-bold">This payment link isn&rsquo;t active</h1>
        <p className="mt-3 text-black/70">It may have been replaced with a new link, or withdrawn. Please give us a call and we&rsquo;ll sort it out.</p>
        <a href={tel} className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700">
          <Phone className="size-4" aria-hidden /> Call us – {business.phone}
        </a>
      </div>
    );
  }

  const error = typeof query.error === "string" ? ERRORS[query.error] : undefined;
  return <BookingSummary booking={booking} token={token} phone={business.phone} error={error} cancelled={query.cancelled === "1"} stripeReady={isStripeConfigured()} walletsEnabled={process.env.STRIPE_WALLETS_ENABLED === "true"} />;
}
