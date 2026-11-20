import { Calculator, Clock, Mail, MapPin, Phone } from "lucide-react";
import type { BusinessSettings } from "@/config/site";
import { isPlaceholder, telHref } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "./ContactForm";

export function ContactSection({ business, headingLevel = "h2" }: { business: BusinessSettings; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    <section id="contact" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Contact us</p>
          <Heading className="text-3xl leading-tight sm:text-4xl">Have a question about your painting project?</Heading>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">Looking to refresh your bedroom or living room? Get in touch to discuss your requirements.</p>

          <a
            href={telHref(business.phone)}
            className="mt-7 flex items-center gap-4 rounded-2xl bg-brand-600 p-5 text-white shadow-md transition-colors hover:bg-brand-700"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15">
              <Phone className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold uppercase tracking-wide text-white/80">Call us</span>
              <span className="block text-2xl font-extrabold">{business.phone}</span>
            </span>
          </a>

          <ul className="mt-7 space-y-4 text-[15px]">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 text-brand-600" aria-hidden />
              <span>Newcastle upon Tyne and surrounding areas.</span>
            </li>
            {!isPlaceholder(business.email) && (
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 text-brand-600" aria-hidden />
                <a href={`mailto:${business.email}`} className="break-all text-brand-600 underline-offset-4 hover:underline">
                  {business.email}
                </a>
              </li>
            )}
            {business.openingHours && (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 text-brand-600" aria-hidden />
                <span>{business.openingHours}</span>
              </li>
            )}
          </ul>

          <div className="mt-8 rounded-2xl bg-grey-50 p-6">
            <p className="text-lg font-bold">Want a price first?</p>
            <p className="mt-1 text-[15px] text-ink-700">Enter your room measurements for a free, instant labour estimate.</p>
            <ButtonLink href="/quote" className="mt-4 font-bold">
              <Calculator className="size-4" aria-hidden /> Get my free quote
            </ButtonLink>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-950/10 sm:p-8">
          <h3 className="mb-6 text-xl">Request a booking</h3>
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
