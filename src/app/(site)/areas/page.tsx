import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { SITE } from "@/config/site";
import { SERVICES } from "@/config/services";
import { ButtonLink } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";

export const metadata: Metadata = {
  title: "Areas We Cover | Interior Painters Newcastle, Gosforth, Jesmond & Gateshead",
  description:
    "Interior painters covering Newcastle upon Tyne, Gosforth, Jesmond, Heaton, Fenham, Wallsend, Gateshead and surrounding areas. Affordable room-by-room labour prices.",
  alternates: { canonical: "/areas" },
};

export default function AreasPage() {
  return (
    <>
      <section className="bg-grey-50 py-16 sm:py-20">
        <Container>
          <SectionHeading
            as="h1"
            eyebrow="Service area"
            title="Interior painters across Newcastle and surrounding areas"
            intro="We paint bedrooms, living rooms and skirting boards for homeowners and tenants across Newcastle upon Tyne, north and south of the river."
          />
          <ul className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SITE.serviceAreas.map((area) => (
              <li key={area} className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 ring-1 ring-ink-900/8">
                <MapPin className="size-5 text-brand-600" aria-hidden />
                <span className="font-medium text-ink-950">{area}</span>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-2xl text-center text-ink-700">
            Not on the list? If you&rsquo;re near Newcastle, put your postcode into the calculator and we&rsquo;ll let you know if we can help.
          </p>
        </Container>
      </section>
      <section className="py-16">
        <Container className="grid gap-6 md:grid-cols-2">
          {SERVICES.map((s) => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="rounded-2xl p-6 ring-1 ring-ink-900/8 transition hover:bg-grey-50">
              <h2 className="text-xl">{s.name} in Newcastle</h2>
              <p className="mt-2 text-[15px] text-ink-700">{s.summary}</p>
            </Link>
          ))}
        </Container>
        <Container className="mt-12 text-center">
          <ButtonLink href="/quote" size="lg">
            Calculate your painting price
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}
