import type { BusinessSettings } from "@/config/site";
import { SITE, isPlaceholder } from "@/config/site";
import { SERVICES } from "@/config/services";
import type { PricingSettings } from "@/lib/pricing/types";

/**
 * LocalBusiness structured data (schema.org "HousePainter") for Google.
 * Only includes details you have actually supplied – no placeholder phone,
 * email or address is ever published here.
 */
export function LocalBusinessJsonLd({ business, pricing }: { business: BusinessSettings; pricing: PricingSettings }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HousePainter",
    "@id": `${SITE.url}/#business`,
    url: SITE.url,
    description: "Interior painting in Newcastle upon Tyne specialising in bedrooms, living rooms and skirting boards, with labour-only room-by-room prices.",
    areaServed: SITE.serviceAreas.map((name) => ({ "@type": "Place", name })),
    priceRange: "££",
    makesOffer: SERVICES.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name, url: `${SITE.url}/services/${s.slug}` },
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "GBP",
        minPrice:
          s.calculatorItem === "bedroom"
            ? pricing.bedroom.minimumCharge
            : s.calculatorItem === "living_room"
              ? pricing.livingRoom.minimumCharge
              : s.calculatorItem === "skirting"
                ? pricing.skirting.minimumCharge || pricing.skirting.ratePerMetre
                : pricing.ceiling.minimumCharge,
      },
    })),
  };
  if (!isPlaceholder(business.name)) data.name = business.name;
  if (!isPlaceholder(business.phone)) data.telephone = business.phone;
  if (!isPlaceholder(business.email)) data.email = business.email;
  if (business.logoUrl) data.logo = business.logoUrl;
  if (business.address.trim()) {
    data.address = { "@type": "PostalAddress", streetAddress: business.address, addressLocality: SITE.city, addressRegion: SITE.region, addressCountry: "GB" };
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
