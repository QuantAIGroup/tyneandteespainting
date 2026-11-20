/**
 * SITE CONFIGURATION
 *
 * Business details shown on the website. These defaults are PLACEHOLDERS –
 * anything in [square brackets] is a placeholder and is clearly highlighted
 * on the site until you replace it. You can edit these from /admin/settings
 * (recommended) without touching code.
 */

export interface BusinessSettings {
  name: string;
  phone: string;
  email: string;
  /** Leave blank until you have a business address you're happy to publish. */
  address: string;
  /** e.g. "Monday–Friday 8am–6pm, Saturday 9am–1pm". Leave blank to hide. */
  openingHours: string;
  /** Public URL of your logo image. Leave blank to show the business name as text. */
  logoUrl: string;
  /**
   * Verified claims ONLY – e.g. "Fully insured with £2m public liability cover".
   * Only add something once you can prove it. Each line appears in "Why choose us".
   */
  verifiedClaims: string[];
}

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: "Tyne & Tees Painting",
  phone: "07444 359371",
  email: "[your@email.co.uk]",
  address: "",
  openingHours: "",
  logoUrl: "",
  verifiedClaims: [],
};

/** True when a value is still a [placeholder]. */
export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  return v === "" || (v.startsWith("[") && v.endsWith("]"));
}

/** Turns "07444 359371" into "tel:+447444359371" for click-to-call links. */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("44")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+44${digits.slice(1)}`;
  return `tel:${digits}`;
}

export const SITE = {
  /** Set NEXT_PUBLIC_SITE_URL in your environment once you have a domain. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  tagline: "QUALITY SERVICE, FAIR PRICE",
  city: "Newcastle upon Tyne",
  region: "Tyne and Wear",
  promise: "Quality service, fair prices. Straightforward room-by-room painting prices with no hourly labour charges.",
  /** Official logo file. Save your logo here: public/brand-logo.png */
  logoPath: "/brand-logo.png",
  hasBrandLogo: process.env.NEXT_PUBLIC_HAS_BRAND_LOGO === "1",
  serviceAreas: ["Newcastle upon Tyne", "Gosforth", "Jesmond", "Heaton", "Fenham", "Wallsend", "Gateshead", "Benton", "Kenton", "Byker", "Walker", "Denton Burn", "Low Fell", "Whickham"],
} as const;

/** Photos used on the homepage and service pages (files in /public/gallery). */
export const IMAGES = {
  hero: { src: "/gallery/bedroom-2-after.jpg", alt: "Freshly painted bedroom in a calm grey with crisp white skirting, painted by Tyne & Tees Painting" },
  bedroom: { src: "/gallery/bedroom-1-after.jpg", alt: "Bedroom walls freshly painted in soft grey after full preparation" },
  livingRoom: { src: "/gallery/living-room-1-after.jpg", alt: "Living room repainted in charcoal grey with white ceiling and skirting" },
  skirting: { src: "/gallery/skirting-1-after.jpg", alt: "Skirting board restored and finished in smooth white gloss" },
  ceiling: { src: "/gallery/bedroom-2-after.jpg", alt: "Bedroom with a freshly painted white ceiling and soft grey walls" },
} as const;
