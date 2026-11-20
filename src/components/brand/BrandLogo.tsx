import { SITE } from "@/config/site";

/**
 * The official Tyne & Tees Painting logo (public/brand-logo.png), shown at its
 * original proportions, with the business name in clear type beside it so it's
 * easy to read at small sizes.
 * A logo web address saved in /admin/settings takes priority.
 */
export function BrandLogo({ logoUrl, name, showName = true, size = "md" }: { logoUrl?: string; name: string; showName?: boolean; size?: "md" | "lg" }) {
  const src = logoUrl || (SITE.hasBrandLogo ? SITE.logoPath : "");
  const height = size === "lg" ? "h-24" : "h-14 sm:h-16";
  return (
    <span className="flex items-center gap-3">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- keeps the logo's original proportions whatever its size
        <img src={src} alt={`${name} logo`} className={`${height} w-auto shrink-0`} />
      )}
      {(showName || !src) && (
        <span className="block leading-none">
          <span className="block text-lg font-extrabold tracking-tight text-ink-950 sm:text-xl">{name}</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600 sm:text-[11px]">{SITE.tagline}</span>
        </span>
      )}
    </span>
  );
}
