import type { Metadata } from "next";
import { getBusinessSettings, getPaymentSettings } from "@/lib/settings";
import { telHref } from "@/config/site";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Terms and Conditions | Tyne & Tees Painting",
  description: "How our estimates, quotations, bookings and payments work.",
  alternates: { canonical: "/terms" },
};

/**
 * PLAIN-ENGLISH STARTING POINT – please review it (ideally with an adviser)
 * and adjust it to your own policies before relying on it.
 */
export default async function TermsPage() {
  const [business, payments] = await Promise.all([getBusinessSettings(), getPaymentSettings()]);
  return (
    <Container className="max-w-3xl py-14 sm:py-20">
      <h1 className="text-4xl">Terms and Conditions</h1>
      <p className="mt-3 text-ink-600">These terms explain how estimates, quotations, bookings and payments work with {business.name}.</p>
      <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-800 [&_h2]:mt-10 [&_h2]:text-2xl">
        <h2>1. Online estimates</h2>
        <p>
          Estimates from our online calculator are free and are based on the measurements and information you give us. They cover labour only. An estimate is not a booking and
          no payment is taken for it.
        </p>
        <h2>2. Your confirmed price</h2>
        <p>
          We will review your details and photographs, speak with you, and then confirm a fixed labour price for the agreed work. If the work turns out to be different from what
          was described (for example, more repairs are needed), we will explain why and agree any change with you before carrying it out.
        </p>
        <h2>3. Paint and materials</h2>
        <p>Our prices are for labour only. You supply the paint and decorating materials unless we agree otherwise in writing.</p>
        <h2>4. Bookings and payments</h2>
        <p>
          A booking is only confirmed once we have agreed the price with you and, where we ask for one, your payment has been received. We normally ask for a{" "}
          {payments.defaultDepositPercent}% booking deposit; for some jobs we may ask for a different amount or full payment, which we will always agree with you first. Online
          payments are processed securely by Stripe – we never see or store your card details. Any remaining balance is paid as agreed with you and is never taken
          automatically.
        </p>
        <h2>5. Changes and cancellations</h2>
        <p>
          If you need to change or cancel your booking, please call us on{" "}
          <a href={telHref(business.phone)} className="font-semibold text-brand-600">
            {business.phone}
          </a>{" "}
          as early as possible and we&rsquo;ll talk through your options with you. Your statutory rights as a consumer are not
          affected.
        </p>
        <h2>6. Access and preparation</h2>
        <p>Please give us access to the rooms at the agreed times and let us know about anything we should be aware of, such as fragile items or pets.</p>
        <h2>7. Contact</h2>
        <p>
          {business.name}, Newcastle upon Tyne. Telephone{" "}
          <a href={telHref(business.phone)} className="font-semibold text-brand-600">
            {business.phone}
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
