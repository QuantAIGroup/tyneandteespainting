import type { Metadata } from "next";
import { GALLERY_CATEGORIES, getGallery } from "@/lib/gallery";
import { GalleryBrowser } from "@/components/gallery/GalleryBrowser";
import { ButtonLink } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Our Work | Bedroom, Living Room & Skirting Painting in Newcastle",
  description: "Before-and-after photos of bedroom painting, living room painting and skirting boards across Newcastle upon Tyne.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <section className="bg-grey-50 py-16 sm:py-20">
      <Container>
        <SectionHeading as="h1" eyebrow="Before & after" title="Our work" intro="Drag the slider on each picture to compare before and after." />
        <div className="mt-10">
          <GalleryBrowser items={items} categories={GALLERY_CATEGORIES} />
        </div>
        <div className="mt-14 text-center">
          <ButtonLink href="/quote" size="lg">
            Calculate your painting price
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
