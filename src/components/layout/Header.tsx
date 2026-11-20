import Link from "next/link";
import { Phone } from "lucide-react";
import { getBusinessSettings } from "@/lib/settings";
import { telHref } from "@/config/site";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Our Services" },
  { href: "/quote", label: "Prices" },
  { href: "/gallery", label: "Our Work" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const business = await getBusinessSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-950/8 bg-white">
      <Container className="flex h-20 items-center justify-between gap-6 sm:h-24">
        <Link href="/" aria-label={`${business.name} – home`} className="shrink-0">
          <BrandLogo name={business.name} logoUrl={business.logoUrl} />
        </Link>
        <NavLinks links={NAV_LINKS} />
        <a
          href={telHref(business.phone)}
          className="hidden h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-[15px] font-bold text-white shadow-md shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:bg-brand-700 lg:inline-flex"
        >
          <Phone className="size-4" aria-hidden />
          CALL US: {business.phone}
        </a>
        <MobileNav links={NAV_LINKS} />
      </Container>
    </header>
  );
}
