import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { Container } from "@/components/ui/Container";
import { PlaceholderValue } from "@/components/ui/Placeholder";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How we use the details and photographs you send us.",
  alternates: { canonical: "/privacy" },
};

/**
 * A plain-English starting point. Have it checked against your own
 * circumstances (and register with the ICO if required) before launch.
 */
export default async function PrivacyPage() {
  const business = await getBusinessSettings();
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <h1 className="text-4xl">Privacy notice</h1>
      <div className="mt-8 space-y-5 text-[16px] leading-relaxed text-navy-800 [&_h2]:mt-10 [&_h2]:text-2xl">
        <p>
          This notice explains how <PlaceholderValue value={business.name} /> uses the information you give us through this website.
        </p>
        <h2>What we collect</h2>
        <p>
          When you request an estimate we collect your name, email address, telephone number, postcode, preferred start date, any comments, your room measurements and answers, and
          any photographs you choose to upload. If you use the contact form we collect your name, email, phone (optional) and message.
        </p>
        <h2>Why we use it</h2>
        <p>
          Only to respond to your enquiry, prepare and confirm your quotation, arrange and carry out the work you ask for, and keep basic business records. We do not sell your
          information or use it for unrelated marketing.
        </p>
        <h2>Your photographs</h2>
        <p>
          Photographs are stored privately and are only viewed by us to assess the condition of your room. They are never published. We will only use a photo of your home in our
          gallery if we ask you first and you agree.
        </p>
        <h2>How long we keep it</h2>
        <p>We keep enquiry details for as long as needed to deal with your enquiry and any work, and for our legal and accounting obligations. You can ask us to delete your details at any time.</p>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct or delete the information we hold about you. Contact us at <PlaceholderValue value={business.email} />. You can also complain to the
          Information Commissioner&rsquo;s Office (ico.org.uk).
        </p>
      </div>
    </Container>
  );
}
