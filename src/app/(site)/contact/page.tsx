import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { ContactSection } from "@/components/home/ContactSection";

export const metadata: Metadata = {
  title: "Contact | Painters in Newcastle upon Tyne",
  description: "Contact us about bedroom painting, living room painting or skirting boards in Newcastle. Or use the online calculator for an instant labour estimate.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const business = await getBusinessSettings();
  return (
    <div className="bg-grey-50">
      <ContactSection business={business} headingLevel="h1" />
    </div>
  );
}
