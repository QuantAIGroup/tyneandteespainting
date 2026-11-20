import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { getBusinessSettings } from "@/lib/settings";
import { isPlaceholder, telHref } from "@/config/site";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/quote", label: "Prices" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms and Conditions" },
];

export async function Footer() {
  "use cache";
  const business = await getBusinessSettings();
  return (
    <footer className="border-t border-ink-950/8 bg-white">
      <Container className="grid gap-10 py-14 md:grid-cols-3">
        <div>
          <BrandLogo name={business.name} logoUrl={business.logoUrl} />
        </div>
        <div className="space-y-3 text-[15px] text-ink-800">
          <p className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            Newcastle upon Tyne and surrounding areas.
          </p>
          <p className="flex items-start gap-2.5">
            <Phone className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span>
              Telephone:{" "}
              <a href={telHref(business.phone)} className="font-bold text-brand-600 underline-offset-4 hover:underline">
                {business.phone}
              </a>
            </span>
          </p>
          {!isPlaceholder(business.email) && (
            <p>
              <a href={`mailto:${business.email}`} className="text-brand-600 hover:underline">
                {business.email}
              </a>
            </p>
          )}
          <p className="pt-2 text-sm text-ink-600">Prices are labour only. Paint and materials are not included.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[15px]">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-800 hover:text-brand-600">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-ink-950/8">
        <Container className="py-6 text-xs text-ink-600">
          © {new Date().getFullYear()} {business.name}. All prices shown online are estimates until confirmed by us.
        </Container>
      </div>
    </footer>
  );
}
