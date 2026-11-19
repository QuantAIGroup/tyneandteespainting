import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { SERVICES, type ServiceInfo } from "@/config/services";
import { formatPounds } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/types";
import { buttonClasses } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";

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

export function Services({ pricing }: { pricing: PricingSettings }) {
  const core = SERVICES.filter((s) => !s.optional);
  const ceiling = SERVICES.find((s) => s.optional)!;
  const ceilingPrice = startingPrice(ceiling, pricing);

  return (
    <section id="services" className="scroll-mt-20 bg-cream py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="What we do"
          title="Three services, done properly"
          intro="We concentrate on the rooms we know best. Every price below is labour only and is worked out from the size of your room – never by the hour."
        />

        <div className="mt-14 grid gap-7 md:grid-cols-3">
          {core.map((service) => {
            const price = startingPrice(service, pricing);
            return (
              <article key={service.slug} className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-navy-900/6 transition-shadow hover:shadow-md">
                <div className="relative aspect-[16/11] overflow-hidden">
                  <Image
                    src={service.image.src}
                    alt={service.image.alt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    unoptimized={service.image.src.endsWith(".svg")}
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-xl">{service.name}</h3>
                  <p className="mt-2.5 flex-1 text-[15px] leading-relaxed text-navy-700">{service.summary}</p>
                  <div className="mt-5 border-t border-navy-900/8 pt-4">
                    <p className="text-sm text-navy-600">Labour from</p>
                    <p className="font-serif text-2xl text-navy-950">{price.from}</p>
                    <p className="text-sm text-navy-600">{price.detail}</p>
                  </div>
                  <Link href={`/services/${service.slug}#prices`} className={buttonClasses("outline", "md", "mt-5 w-full")}>
                    View Prices <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 rounded-xl bg-white p-6 ring-1 ring-gold-400/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-500 text-white">
              <Plus className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-navy-950">Optional extra: Ceiling painting</p>
              <p className="text-[15px] text-navy-700">
                Add a ceiling to any room from {ceilingPrice.from} ({ceilingPrice.detail}).
              </p>
            </div>
          </div>
          <Link href="/services/ceiling-painting" className="shrink-0 text-[15px] font-medium text-gold-700 hover:text-gold-600">
            About ceiling painting →
          </Link>
        </div>
      </Container>
    </section>
  );
}
