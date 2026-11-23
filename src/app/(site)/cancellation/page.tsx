import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { Container } from "@/components/ui/Container";
import { BusinessContact } from "@/components/BusinessContact";
import { CancellationPolicy } from "@/components/CancellationPolicy";
import { COOLING_OFF_DAYS, MODEL_FORM_LINES } from "@/config/cancellation";

export const metadata: Metadata = {
  title: "Cancellations, Refunds and Cancellation Form | Tyne & Tees Painting",
  description: "Your right to cancel, our refund policy, and the cancellation form.",
  alternates: { canonical: "/cancellation" },
};

export default async function CancellationPage() {
  const business = await getBusinessSettings();
  return (
    <Container className="max-w-3xl py-14 sm:py-20">
      <h1 className="text-4xl">Cancellations and refunds</h1>
      <p className="mt-3 text-ink-600">Here is exactly what happens if you need to cancel – including when you get a full refund.</p>

      <div className="mt-8 space-y-4 text-[16px] leading-relaxed text-ink-800 [&_h2]:mt-10 [&_h2]:text-2xl">
        <CancellationPolicy />

        <h2>How to cancel</h2>
        <p>
          Tell us clearly that you want to cancel – by phone, by email or by post. You can use the form below, but you don&rsquo;t have to. To cancel within the{" "}
          {COOLING_OFF_DAYS}-day cooling-off period, you only need to send your message before the period ends.
        </p>
        <BusinessContact business={business} />

        <h2 id="form">Cancellation form</h2>
        <p className="text-sm text-ink-600">Complete and return this form only if you wish to cancel the contract. You can copy it into an email, or print this page.</p>
        <div className="rounded-2xl p-6 ring-1 ring-ink-950/15 print:ring-0">
          <p>
            To: {business.name}
            {business.address.trim() ? `, ${business.address}` : ", Newcastle upon Tyne"}
          </p>
          <ul className="mt-3 space-y-3">
            {MODEL_FORM_LINES.map((line) => (
              <li key={line} className="border-b border-dashed border-ink-950/20 pb-3">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-600">[*] Delete as appropriate.</p>
        </div>
      </div>
    </Container>
  );
}
