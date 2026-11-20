import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, Check, X } from "lucide-react";
import { SERVICES, getService } from "@/config/services";
import { SITE } from "@/config/site";
import { getPricingSettings } from "@/lib/settings";
import { formatPounds } from "@/lib/pricing/engine";
import type { PricingSettings } from "@/lib/pricing/types";
import { startingPrice } from "@/components/home/Services";
import { PricingPromise } from "@/components/home/PricingPromise";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { JsonLd } from "@/components/seo/JsonLd";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return {
    title: service.seoTitle,
    description: service.seoDescription,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: { title: service.seoTitle, description: service.seoDescription, images: [] },
  };
}

function exampleRows(calculatorItem: string, pricing: PricingSettings) {
  const wall = (l: number, w: number, h: number) => 2 * (l + w) * h;
  if (calculatorItem === "bedroom" || calculatorItem === "living_room") {
    const r = calculatorItem === "bedroom" ? pricing.bedroom : pricing.livingRoom;
    const sizes =
      calculatorItem === "bedroom"
        ? [
            { name: "Small bedroom", l: 2.7, w: 2.4, h: 2.4 },
            { name: "Double bedroom", l: 3.8, w: 3.4, h: 2.4 },
            { name: "Large bedroom", l: 4.5, w: 4, h: 2.5 },
          ]
        : [
            { name: "Compact living room", l: 3.6, w: 3.2, h: 2.4 },
            { name: "Average living room", l: 4.8, w: 3.8, h: 2.4 },
            { name: "Large living room", l: 6, w: 4.5, h: 2.5 },
          ];
    return sizes.map((s) => {
      const area = Math.round(wall(s.l, s.w, s.h) * 100) / 100;
      const raw = area * r.ratePerSqm;
      const price = Math.max(raw, r.minimumCharge);
      return { name: s.name, measure: `${s.l} m × ${s.w} m, ${s.h} m high`, qty: `${area.toFixed(1)} m² of wall`, price, min: raw < r.minimumCharge };
    });
  }
  if (calculatorItem === "skirting") {
    return [8, 14, 20].map((m) => {
      const raw = m * pricing.skirting.ratePerMetre;
      return { name: `${m} metres of skirting`, measure: m === 14 ? "a typical double bedroom" : m === 8 ? "a small room" : "a large living room", qty: `${m} m`, price: Math.max(raw, pricing.skirting.minimumCharge), min: raw < pricing.skirting.minimumCharge };
    });
  }
  return [
    { l: 2.4, w: 2.4 },
    { l: 3.8, w: 3.4 },
    { l: 4.8, w: 3.8 },
  ].map(({ l, w }) => {
    const area = Math.round(l * w * 100) / 100;
    const raw = area * pricing.ceiling.ratePerSqm;
    return { name: `${l} m × ${w} m ceiling`, measure: "", qty: `${area.toFixed(1)} m²`, price: Math.max(raw, pricing.ceiling.minimumCharge), min: raw < pricing.ceiling.minimumCharge };
  });
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  const pricing = await getPricingSettings();
  const price = startingPrice(service, pricing);
  const rows = exampleRows(service.calculatorItem, pricing);
  const roundNote = pricing.roundToNearest > 0 ? ` Final totals are rounded to the nearest ${formatPounds(pricing.roundToNearest)}.` : "";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `${service.name} in Newcastle upon Tyne`,
          serviceType: service.name,
          provider: { "@id": `${SITE.url}/#business` },
          areaServed: SITE.serviceAreas.map((name) => ({ "@type": "Place", name })),
          url: `${SITE.url}/services/${service.slug}`,
        }}
      />
      <section className="bg-grey-50">
        <Container className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-600">
              <Link href="/" className="hover:text-ink-900">
                Home
              </Link>{" "}
              / <span className="text-ink-900">{service.name}</span>
            </nav>
            <h1 className="text-4xl leading-tight sm:text-5xl">{service.name} in Newcastle</h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-700">{service.intro}</p>
            <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-sm text-ink-600">Labour from</p>
                <p className="font-bold tracking-tight text-3xl text-ink-950">{price.from}</p>
                <p className="text-sm text-ink-600">{price.detail}</p>
              </div>
              <ButtonLink href={`/quote?add=${service.calculatorItem}`} size="lg">
                <Calculator className="size-5" aria-hidden /> Calculate your price
              </ButtonLink>
            </div>
          </div>
          <div className="relative aspect-[16/11] overflow-hidden rounded-2xl shadow-lg">
            <Image src={service.image.src} alt={service.image.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" unoptimized={service.image.src.endsWith(".svg")} />
          </div>
        </Container>
      </section>

      <section id="prices" className="scroll-mt-20 py-16 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="text-3xl">How {service.shortName.toLowerCase()} are priced</h2>
            <p className="mt-4 text-lg text-ink-700">{service.howPriced}{roundNote}</p>
            <div className="mt-8 overflow-hidden rounded-2xl ring-1 ring-ink-900/10">
              <table className="w-full text-left text-[15px]">
                <caption className="sr-only">Example labour prices</caption>
                <thead className="bg-grey-50 text-sm text-ink-700">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Example</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Size</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Labour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-900/8">
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td className="px-5 py-4">
                        <span className="font-medium text-ink-950">{r.name}</span>
                        {r.measure && <span className="block text-sm text-ink-600">{r.measure}</span>}
                      </td>
                      <td className="px-5 py-4 text-ink-700">{r.qty}</td>
                      <td className="px-5 py-4 text-right font-semibold text-ink-950">
                        {formatPounds(Math.round(r.price * 100) / 100)}
                        {r.min && <span className="block text-xs font-normal text-ink-600">minimum charge</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-ink-600">Examples only, before rounding. Use the calculator for your own room&rsquo;s measurements.</p>
          </div>
          <div className="space-y-8">
            <div>
              <h3 className="font-sans text-lg font-semibold">What&rsquo;s included</h3>
              <ul className="mt-3 space-y-2.5">
                {service.included.map((i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] text-ink-800">
                    <Check className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-sans text-lg font-semibold">Not included</h3>
              <ul className="mt-3 space-y-2.5">
                {service.notIncluded.map((i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] text-ink-700">
                    <X className="mt-0.5 size-5 shrink-0 text-ink-600/60" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-grey-50 py-14">
        <Container>
          <PricingPromise compact />
        </Container>
      </section>

      <section className="py-16">
        <Container className="text-center">
          <h2 className="text-3xl">{service.name} across Newcastle and nearby</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-700">We cover {SITE.serviceAreas.slice(0, -1).join(", ")} and {SITE.serviceAreas.at(-1)}.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/quote?add=${service.calculatorItem}`} size="lg">
              Get your instant estimate
            </ButtonLink>
            <ButtonLink href="/gallery" size="lg" variant="outline">
              View our work
            </ButtonLink>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {SERVICES.filter((s) => s.slug !== service.slug).map((s) => (
              <Link key={s.slug} href={`/services/${s.slug}`} className="text-brand-700 hover:text-brand-600">
                {s.name} →
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
