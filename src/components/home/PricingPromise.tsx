import { Ban, Brush, Clock, Hammer, PaintBucket, PhoneCall, Receipt, Layers } from "lucide-react";
import { Container } from "@/components/ui/Container";

/** The pricing rules customers must understand – shown prominently on the homepage, service pages and calculator. */
export const PRICING_RULES = [
  { icon: Receipt, title: "Labour-only prices", text: "Our prices cover our work. Nothing else is added." },
  { icon: PaintBucket, title: "You supply the paint", text: "Customers supply their own paint and decorating materials." },
  { icon: Layers, title: "Two coats included", text: "Two coats are included in the standard wall price." },
  { icon: Brush, title: "Minor prep included", text: "Filling small nail holes and hairline cracks is included." },
  { icon: Hammer, title: "Major repairs quoted separately", text: "Larger plaster repairs are always quoted and agreed first." },
  { icon: Clock, title: "No hourly charges", text: "You pay for the room, not the time on the clock." },
  { icon: Ban, title: "No undisclosed extras", text: "If the job changes, we explain why and get your approval first." },
  { icon: PhoneCall, title: "Free estimates, deposit only once agreed", text: "No payment for an estimate. A 50% deposit secures your booking only after we've spoken and agreed your price." },
];

export function PricingPromise({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="pricing-promise" className={compact ? "" : "border-y border-ink-900/6 bg-white py-14"}>
      <Container className={compact ? "px-0 sm:px-0" : ""}>
        <h2 id="pricing-promise" className={compact ? "sr-only" : "text-center text-2xl sm:text-3xl"}>
          Exactly what you&rsquo;re paying for
        </h2>
        <ul className={`grid gap-x-8 gap-y-6 sm:grid-cols-2 ${compact ? "" : "mt-10 lg:grid-cols-4"}`}>
          {PRICING_RULES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-grey-100 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-ink-950">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
