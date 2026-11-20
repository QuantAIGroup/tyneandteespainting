import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings, getPricingSettings } from "@/lib/settings";
import { SITE } from "@/config/site";
import { Services } from "@/components/home/Services";
import { FriendlyCall } from "@/components/home/FriendlyCall";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Interior Painting Services Newcastle | Bedrooms, Living Rooms & Skirting",
  description:
    "Bedroom painting, living room painting and skirting board painting across Newcastle upon Tyne, with optional ceiling painting. Clear labour prices from £65 – no hourly charges.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const [pricing, business] = await Promise.all([getPricingSettings(), getBusinessSettings()]);
  return (
    <>
      <Services pricing={pricing} headingLevel="h1" />
      <section className="bg-white py-14">
        <Container className="max-w-3xl text-center">
          <h2 className="text-2xl">Where we work</h2>
          <p className="mt-3 text-lg text-ink-700">
            We paint homes across {SITE.serviceAreas.slice(0, 7).join(", ")} and surrounding areas.{" "}
            <Link href="/areas" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              See all areas we cover
            </Link>
            .
          </p>
          <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px]">
            <Link href="/services/bedroom-painting" className="font-semibold text-brand-600 hover:underline">
              Bedroom painting in Newcastle
            </Link>
            <Link href="/services/living-room-painting" className="font-semibold text-brand-600 hover:underline">
              Living room painting in Newcastle
            </Link>
            <Link href="/services/skirting-board-painting" className="font-semibold text-brand-600 hover:underline">
              Skirting board painting
            </Link>
            <Link href="/services/ceiling-painting" className="font-semibold text-brand-600 hover:underline">
              Ceiling painting
            </Link>
          </p>
        </Container>
      </section>
      <FriendlyCall phone={business.phone} title="Looking to refresh your bedroom or living room?" text="Get in touch to discuss your requirements." />
    </>
  );
}
