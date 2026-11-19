import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { SERVICES } from "@/config/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/quote", "/gallery", "/areas", "/contact", "/privacy"];
  return [
    ...pages.map((p) => ({ url: `${SITE.url}${p}`, changeFrequency: "monthly" as const, priority: p === "" ? 1 : p === "/quote" ? 0.9 : 0.6 })),
    ...SERVICES.map((s) => ({ url: `${SITE.url}/services/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
