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
  name: "[Your Business Name]",
  phone: "[Your Phone Number]",
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

export const SITE = {
  /** Set NEXT_PUBLIC_SITE_URL in your environment once you have a domain. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  city: "Newcastle upon Tyne",
  region: "Tyne and Wear",
  promise: "Straightforward room-by-room prices. No hourly rates. No hidden labour fees.",
  serviceAreas: ["Newcastle upon Tyne", "Gosforth", "Jesmond", "Heaton", "Fenham", "Wallsend", "Gateshead", "Benton", "Kenton", "Byker", "Walker", "Denton Burn", "Low Fell", "Whickham"],
} as const;

/** Placeholder images. Replace the files in /public/images with your own photographs (same file names), or edit these paths. */
export const IMAGES = {
  hero: { src: "/images/hero-bedroom.svg", alt: "Freshly painted modern bedroom with soft neutral walls and crisp white skirting boards" },
  bedroom: { src: "/images/service-bedroom.svg", alt: "Bedroom with newly painted walls in a calm neutral tone" },
  livingRoom: { src: "/images/service-living-room.svg", alt: "Living room with freshly painted walls and a smooth white ceiling" },
  skirting: { src: "/images/service-skirting.svg", alt: "Close-up of freshly glossed white skirting board against a painted wall" },
  ceiling: { src: "/images/service-ceiling.svg", alt: "Smooth freshly painted white ceiling" },
} as const;
