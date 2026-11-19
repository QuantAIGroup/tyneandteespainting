import type { Metadata } from "next";
import { getBusinessSettings, getPricingSettings } from "@/lib/settings";
import { GALLERY_CATEGORIES, getGallery } from "@/lib/gallery";
import { Hero } from "@/components/home/Hero";
import { PricingPromise } from "@/components/home/PricingPromise";
import { Services } from "@/components/home/Services";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Reviews } from "@/components/home/Reviews";
import { ContactSection } from "@/components/home/ContactSection";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { Container, SectionHeading } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Bedroom & Living Room Painters Newcastle | Honest Room-by-Room Prices",
  description:
    "Interior painters in Newcastle upon Tyne for bedrooms, living rooms and skirting boards. Labour-only prices calculated from your room size – no hourly rates, no hidden labour fees. Instant online estimate.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [pricing, business, gallery] = await Promise.all([getPricingSettings(), getBusinessSettings(), getGallery()]);

  return (
    <>
      <LocalBusinessJsonLd business={business} pricing={pricing} />
      <Hero />
      <PricingPromise />
      <Services pricing={pricing} />
      <WhyChooseUs verifiedClaims={business.verifiedClaims} />
      <HowItWorks />

      <section className="py-20 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Before & after" title="Our work" intro="Drag the slider to compare before and after." />
          <div className="mt-10">
            <GalleryBrowser items={gallery} categories={GALLERY_CATEGORIES} limitPerCategory={2} />
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/gallery" variant="outline">
              View the full gallery
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Reviews />
      <ContactSection business={business} />
    </>
  );
}
