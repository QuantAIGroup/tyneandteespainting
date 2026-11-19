import { Calculator, Camera, ClipboardCheck, Ruler } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

const STEPS = [
  { icon: Ruler, title: "Measure your room", text: "Length, width and wall height with a tape measure. We show you exactly where to measure." },
  { icon: ClipboardCheck, title: "Tell us the condition", text: "A few quick questions about cracks, holes and colour changes." },
  { icon: Camera, title: "Add a few photos", text: "Up to six photos help us check the condition of the walls." },
  { icon: Calculator, title: "See your price", text: "An instant labour estimate. We review your photos and confirm a fixed quotation." },
];

export function HowItWorks() {
  return (
    <section className="bg-navy-950 py-20 text-white sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">How it works</p>
          <h2 className="text-3xl leading-tight text-white sm:text-4xl">Your price in about five minutes</h2>
          <p className="mt-4 text-lg leading-relaxed text-navy-100/80">No waiting in for a visit just to find out what it costs.</p>
        </div>
        <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-xl bg-white/[0.04] p-6 ring-1 ring-white/10">
              <span className="absolute right-5 top-4 font-serif text-4xl text-white/10">{i + 1}</span>
              <Icon className="size-7 text-gold-400" aria-hidden />
              <h3 className="mt-4 font-sans text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-navy-100/75">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 text-center">
          <ButtonLink href="/quote" variant="secondary" size="lg">
            Calculate Your Painting Price
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

