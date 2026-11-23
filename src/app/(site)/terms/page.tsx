import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { telHref } from "@/config/site";
import { Container } from "@/components/ui/Container";
import { BusinessContact } from "@/components/BusinessContact";
import { CancellationPolicy } from "@/components/CancellationPolicy";

export const metadata: Metadata = {
  title: "Terms and Conditions | Tyne & Tees Painting",
  description: "How our estimates, quotations, bookings, payments, cancellations and refunds work.",
  alternates: { canonical: "/terms" },
};

/**
 * PLAIN-ENGLISH TERMS – please review them (ideally with an adviser)
 * before relying on them.
 */
export default async function TermsPage() {
  const business = await getBusinessSettings();
  return (
    <Container className="max-w-3xl py-14 sm:py-20">
      <h1 className="text-4xl">Terms and Conditions</h1>
      <p className="mt-3 text-ink-600">These terms explain how estimates, quotations, bookings, payments, cancellations and refunds work with {business.name}.</p>
      <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-800 [&_h2]:mt-10 [&_h2]:text-2xl">
        <h2>1. Online estimates</h2>
        <p>
          Estimates from our online calculator are free and are based on the measurements and information you give us. They cover labour only. An estimate is not a booking and
          no payment is taken for it. Some items (for example sash windows, decorative radiators, complex woodwork or wallpapering) need an inspection and a separate quotation.
        </p>
        <h2>2. Your confirmed price</h2>
        <p>
          We will review your details and photographs, speak with you, and then confirm a fixed labour price for the agreed work. If the work turns out to be different from what
          was described (for example, more repairs are needed), we will explain why and agree any change with you before carrying it out.
        </p>
        <h2>3. Paint and materials</h2>
        <p>Our prices are for labour only. You supply the paint and decorating materials unless we agree otherwise in writing.</p>
        <h2>4. Payment and booking confirmation</h2>
        <p>
          We never take payment for an online estimate, and we never ask for payment before we have spoken with you and agreed the final price. Once the price is agreed, we
          send you a secure payment link for <strong>100% of the agreed price</strong>. Your booking is confirmed when that payment has been received. Online payments are processed
          securely by Stripe – we never see or store your card details. You are never charged automatically.
        </p>
        <h2>5. Cancellations and refunds</h2>
        <CancellationPolicy />
        <p>
          <strong>How to cancel:</strong> tell us clearly that you want to cancel – by phone, email, post, or using the{" "}
          <Link href="/cancellation" className="font-semibold text-brand-600 underline">
            cancellation form
          </Link>{" "}
          (you don&rsquo;t have to use the form). To cancel within the cooling-off period, you only need to send your message before the period ends. Your statutory rights as a
          consumer are not affected.
        </p>
        <h2>6. Changes to your booking</h2>
        <p>
          If you need to change your booking, please call us on{" "}
          <a href={telHref(business.phone)} className="font-semibold text-brand-600">
            {business.phone}
          </a>{" "}
          as early as possible and we&rsquo;ll talk through your options with you.
        </p>
        <h2>7. Access and preparation</h2>
        <p>Please give us access to the rooms at the agreed times and let us know about anything we should be aware of, such as fragile items or pets.</p>
        <h2>8. Contact</h2>
        <BusinessContact business={business} />
      </div>
    </Container>
  );
}
