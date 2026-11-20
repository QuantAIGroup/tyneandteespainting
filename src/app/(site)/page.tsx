import type { Metadata } from "next";
import { BadgeCheck, Clock, PaintRoller, Sparkles } from "lucide-react";
import { getBusinessSettings, getPricingSettings } from "@/lib/settings";
import { GALLERY_CATEGORIES, getGallery } from "@/lib/gallery";
import { Hero } from "@/components/home/Hero";
import { Services } from "@/components/home/Services";
import { FriendlyCall } from "@/components/home/FriendlyCall";
import { ContactSection } from "@/components/home/ContactSection";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { Container, SectionHeading } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";
import { PHOTO_PAIRS } from "@/config/gallery";

export const metadata: Metadata = {
  title: "Tyne & Tees Painting | Bedroom & Living Room Painters in Newcastle",
  description:
    "Fancy giving your home a fresh new look? Friendly bedroom, living room and skirting board painting across Newcastle upon Tyne. Clear room-by-room labour prices – get a free instant quote or call 07444 359371.",
  alternates: { canonical: "/" },
};

const PROMISES = [
  { icon: BadgeCheck, title: "Fair, upfront prices", text: "Room-by-room labour prices. No hourly charges, no surprises." },
  { icon: PaintRoller, title: "Proper preparation", text: "Holes filled, surfaces sanded, edges cut in neatly." },
  { icon: Sparkles, title: "Left clean and tidy", text: "Floors and furniture protected, rooms tidied every day." },
  { icon: Clock, title: "Free instant quotes", text: "Get a price in minutes – no waiting in for a visit." },
];

export default async function HomePage() {
  const [pricing, business, gallery] = await Promise.all([getPricingSettings(), getBusinessSettings(), getGallery()]);
  const featured = gallery.filter((g) => g.featured).slice(0, 4);
  const heroBefore = PHOTO_PAIRS.find((p) => p.id === "bedroom-2")?.before;

  return (
    <>
      <LocalBusinessJsonLd business={business} pricing={pricing} />
      <Hero phone={business.phone} beforeImage={heroBefore} />

      <section className="bg-grey-50 py-16 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Before & after" title="See the difference a fresh coat makes" intro="Drag the slider on each photo to compare before and after." />
          <div className="mt-12">
            <GalleryBrowser items={featured.length ? featured : gallery.slice(0, 4)} categories={GALLERY_CATEGORIES} showTabs={false} />
          </div>
          <div className="mt-12 text-center">
            <ButtonLink href="/gallery" variant="outline" size="lg" className="font-bold">
              See all our work
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Services pricing={pricing} />

      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Why Tyne & Tees" title="Quality service, fair price" />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-3xl bg-grey-50 p-6 transition-transform duration-300 hover:-translate-y-1">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{text}</p>
              </li>
            ))}
          </ul>
          {business.verifiedClaims.length > 0 && (
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {business.verifiedClaims.map((c) => (
                <li key={c} className="rounded-full bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      <FriendlyCall phone={business.phone} />
      <ContactSection business={business} />
    </>
  );
}
