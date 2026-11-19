import { Calculator, Clock, Mail, MapPin, Phone } from "lucide-react";
import type { BusinessSettings } from "@/config/site";
import { SITE, isPlaceholder } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Container, SectionHeading } from "@/components/ui/Container";
import { PlaceholderValue } from "@/components/ui/Placeholder";
import { ContactForm } from "./ContactForm";

export function ContactSection({ business, headingLevel = "h2" }: { business: BusinessSettings; headingLevel?: "h1" | "h2" }) {
  return (
    <section id="contact" className="scroll-mt-20 py-20 sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionHeading
            as={headingLevel}
            align="left"
            eyebrow="Contact"
            title="Get in touch"
            intro="The quickest way to a price is the online calculator. For anything else, call, email or send a message."
          />
          <ul className="mt-8 space-y-5 text-[15px]">
            <li className="flex items-start gap-3.5">
              <Phone className="mt-0.5 size-5 text-gold-600" aria-hidden />
              <div>
                <p className="font-semibold text-navy-950">Telephone</p>
                {isPlaceholder(business.phone) ? (
                  <PlaceholderValue value={business.phone} />
                ) : (
                  <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="text-navy-800 underline-offset-4 hover:underline">
                    {business.phone}
                  </a>
                )}
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <Mail className="mt-0.5 size-5 text-gold-600" aria-hidden />
              <div>
                <p className="font-semibold text-navy-950">Email</p>
                {isPlaceholder(business.email) ? (
                  <PlaceholderValue value={business.email} />
                ) : (
                  <a href={`mailto:${business.email}`} className="break-all text-navy-800 underline-offset-4 hover:underline">
                    {business.email}
                  </a>
                )}
              </div>
            </li>
            <li className="flex items-start gap-3.5">
              <MapPin className="mt-0.5 size-5 text-gold-600" aria-hidden />
              <div>
                <p className="font-semibold text-navy-950">Service area</p>
                <p className="text-navy-700">{SITE.serviceAreas.slice(0, 7).join(", ")} and surrounding areas.</p>
              </div>
            </li>
            {business.openingHours && (
              <li className="flex items-start gap-3.5">
                <Clock className="mt-0.5 size-5 text-gold-600" aria-hidden />
                <div>
                  <p className="font-semibold text-navy-950">Hours</p>
                  <p className="text-navy-700">{business.openingHours}</p>
                </div>
              </li>
            )}
          </ul>
          <div className="mt-8 rounded-xl bg-sand-50 p-6 ring-1 ring-sand-200">
            <p className="font-serif text-lg text-navy-950">Want a price first?</p>
            <p className="mt-1 text-[15px] text-navy-700">Measure your room and get an instant labour estimate.</p>
            <ButtonLink href="/quote" className="mt-4">
              <Calculator className="size-4" aria-hidden /> Request a quote
            </ButtonLink>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-navy-900/8 sm:p-8">
          <h3 className="mb-6 font-serif text-xl">Send us a message</h3>
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
