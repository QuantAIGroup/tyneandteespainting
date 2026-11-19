import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { getBusinessSettings } from "@/lib/settings";
import { SITE } from "@/config/site";
import { SERVICES } from "@/config/services";
import { Container } from "@/components/ui/Container";
import { PlaceholderValue } from "@/components/ui/Placeholder";
import { Logo } from "./Logo";

export async function Footer() {
  "use cache";
  const business = await getBusinessSettings();

  return (
    <footer className="bg-navy-950 text-navy-100">
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Logo name={business.name} logoUrl={business.logoUrl} light />
          <p className="mt-5 text-sm leading-relaxed text-navy-100/75">{SITE.promise}</p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">Services</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="text-navy-100/85 hover:text-white">
                  {s.name}
                  {s.optional && <span className="text-navy-100/50"> (optional extra)</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/quote" className="text-navy-100/85 hover:text-white">
                Instant price calculator
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">Areas covered</h2>
          <p className="mt-4 text-sm leading-relaxed text-navy-100/85">{SITE.serviceAreas.slice(0, 8).join(", ")} and surrounding areas.</p>
          <Link href="/areas" className="mt-3 inline-block text-sm text-gold-300 hover:text-gold-400">
            See all areas →
          </Link>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">Contact</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <Phone className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden />
              <PlaceholderValue value={business.phone} />
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden />
              <PlaceholderValue value={business.email} className="break-all" />
            </li>
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden />
              <span>{business.address || "Serving Newcastle upon Tyne and surrounding areas"}</span>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-6 text-xs text-navy-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {business.name}. Prices shown are labour-only estimates.
          </p>
          <p>Customers supply their own paint and materials.</p>
        </Container>
      </div>
    </footer>
  );
}
