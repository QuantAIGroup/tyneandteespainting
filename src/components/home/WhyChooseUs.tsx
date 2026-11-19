import { BadgeCheck, CheckCircle2 } from "lucide-react";
import { Container, SectionHeading } from "@/components/ui/Container";

const REASONS = [
  { title: "Transparent room-by-room pricing", text: "Prices are calculated from your room's measurements, so you can see exactly how your estimate was worked out." },
  { title: "No hourly labour charges", text: "You won't be watching the clock. The price is for the room, however long it takes us to do it properly." },
  { title: "No hidden labour fees", text: "What you see in the breakdown is what you pay for labour. Any change is explained and agreed with you first." },
  { title: "Professional preparation", text: "Small holes filled, surfaces sanded and dusted, edges cut in neatly. Good preparation is what makes paint last." },
  { title: "Clean and tidy working", text: "Floors and furniture protected, rooms left tidy at the end of every day. We work inside your home with respect." },
  { title: "You choose the paint", text: "You supply your own paint and materials, so you pick the exact brand, colour and finish – and pay no mark-up." },
  { title: "Free initial online estimates", text: "Get an estimate in a few minutes from your phone. No need to wait in for a visit just to find out a price." },
];

export function WhyChooseUs({ verifiedClaims }: { verifiedClaims: string[] }) {
  return (
    <section className="py-20 sm:py-24">
      <Container className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="Why choose us"
            title="Straightforward prices. Careful work."
            intro="Booking a painter to work inside your home is about trust. We earn it by being clear about prices from the very start, and by treating your home with care."
          />
          {verifiedClaims.length > 0 && (
            <ul className="mt-8 space-y-3">
              {verifiedClaims.map((claim) => (
                <li key={claim} className="flex items-start gap-3 rounded-lg bg-sand-50 p-4 text-[15px] font-medium text-navy-900 ring-1 ring-sand-200">
                  <BadgeCheck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                  {claim}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {REASONS.map((r) => (
            <li key={r.title}>
              <CheckCircle2 className="size-6 text-gold-600" aria-hidden />
              <h3 className="mt-3 font-sans text-[17px] font-semibold text-navy-950">{r.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-navy-700">{r.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
