import Link from "next/link";
import { isPlaceholder } from "@/config/site";

/** Shows your logo image if set in /admin/settings, otherwise your business name in a smart wordmark. */
export function Logo({ name, logoUrl, light = false }: { name: string; logoUrl: string; light?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={`${name} – home`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo URL is user-supplied and may be any host
        <img src={logoUrl} alt={name} className="h-10 w-auto" />
      ) : (
        <>
          <span aria-hidden className={`grid size-10 place-items-center rounded-md ${light ? "bg-white/10" : "bg-navy-900"}`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none">
              <rect x="4" y="3" width="13" height="7" rx="1.5" fill="#c4a46b" />
              <path d="M17 6.5h2.5v5H11v3" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="9.5" y="14.5" width="3" height="6.5" rx="1" fill="#ffffff" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className={`block font-serif text-[17px] font-bold ${isPlaceholder(name) ? "rounded bg-amber-100 px-1 text-amber-900" : light ? "text-white" : "text-navy-950"}`}>
              {name}
            </span>
            <span className={`block text-[11px] font-medium uppercase tracking-[0.16em] ${light ? "text-gold-300" : "text-gold-600"}`}>Interior Painting · Newcastle</span>
          </span>
        </>
      )}
    </Link>
  );
}
