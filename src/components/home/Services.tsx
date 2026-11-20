import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { SERVICES, type ServiceInfo } from "@/config/services";
import { formatPounds } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/types";
import { buttonClasses } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";

/** "From" prices come from the minimum charges in /admin/settings. */
export function startingPrice(service: ServiceInfo, pricing: PricingSettings): { from: string; detail: string } {
  switch (service.calculatorItem) {
    case "bedroom":
      return { from: formatPounds(pricing.bedroom.minimumCharge), detail: `per bedroom · ${formatPounds(pricing.bedroom.ratePerSqm)} per m² of wall` };
    case "living_room":
      return { from: formatPounds(pricing.livingRoom.minimumCharge), detail: `per living room · ${formatPounds(pricing.livingRoom.ratePerSqm)} per m² of wall` };
    case "skirting":
      return { from: formatPounds(pricing.skirting.minimumCharge), detail: `${formatPounds(pricing.skirting.ratePerMetre)} per linear metre` };
    case "ceiling":
      return { from: formatPounds(pricing.ceiling.minimumCharge), detail: `${formatPounds(pricing.ceiling.ratePerSqm)} per m² of ceiling` };
  }
}

export function Services({ pricing, headingLevel = "h2" }: { pricing: PricingSettings; headingLevel?: "h1" | "h2" }) {
  const core = SERVICES.filter((s) => !s.optional);
  const ceiling = startingPrice(SERVICES.find((s) => s.optional)!, pricing);

  return (
    <section id="services" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <Container>
        <SectionHeading as={headingLevel} eyebrow="Our services" title="What we can paint for you" intro="Bedrooms, living rooms and skirting boards across Newcastle – with clear starting prices for labour, never by the hour." />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {core.map((service) => {
            const price = startingPrice(service, pricing);
            const Heading = headingLevel === "h1" ? "h2" : "h3";
            return (
              <article key={service.slug} className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink-950/8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <Link href={`/services/${service.slug}`} className="relative block aspect-[16/11] overflow-hidden" tabIndex={-1} aria-hidden>
                  <Image src={service.image.src} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </Link>
                <div className="flex flex-1 flex-col p-6">
                  <Heading className="text-xl">
                    <Link href={`/services/${service.slug}`} className="hover:text-brand-600">
                      {service.name}
                    </Link>
                  </Heading>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-700">{service.summary}</p>
                  <div className="mt-5">
                    <p className="text-sm text-ink-600">Starting labour price</p>
                    <p className="text-3xl font-extrabold text-brand-600">{price.from}</p>
                  </div>
                  <Link href={`/quote?add=${service.calculatorItem}`} className={buttonClasses("primary", "md", "mt-5 w-full font-bold")}>
                    Get a Quote <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <p className="flex items-start gap-3 rounded-2xl bg-grey-50 p-5 text-[15px] text-ink-800">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <span>
              <strong>Paint and materials are not included.</strong> Our prices are for labour only, so you choose your own paint with no mark-up.
            </span>
          </p>
          <p className="flex items-start gap-3 rounded-2xl bg-grey-50 p-5 text-[15px] text-ink-800">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
            <span>
              <strong>Ceiling painting</strong> can be added to any room in the quote calculator – from {ceiling.from}.
            </span>
          </p>
        </div>
      </Container>
    </section>
  );
}
