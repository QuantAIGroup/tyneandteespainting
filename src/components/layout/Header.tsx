import Link from "next/link";
import { Phone } from "lucide-react";
import { getBusinessSettings } from "@/lib/settings";
import { isPlaceholder } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { MobileNav } from "./MobileNav";
import { Logo } from "./Logo";

export const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/quote", label: "Prices" },
  { href: "/gallery", label: "Our work" },
  { href: "/areas", label: "Areas" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const business = await getBusinessSettings();
  const phoneSet = !isPlaceholder(business.phone);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-900/8 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Logo name={business.name} logoUrl={business.logoUrl} />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-[15px] font-medium text-navy-800 transition-colors hover:bg-sand-50 hover:text-navy-950">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {phoneSet && (
            <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-[15px] font-medium text-navy-800 hover:text-navy-950">
              <Phone className="size-4 text-gold-600" aria-hidden />
              {business.phone}
            </a>
          )}
          <ButtonLink href="/quote" size="sm" className="h-10 px-4">
            Get your price
          </ButtonLink>
        </div>

        <MobileNav links={NAV_LINKS} phone={phoneSet ? business.phone : null} />
      </Container>
    </header>
  );
}
