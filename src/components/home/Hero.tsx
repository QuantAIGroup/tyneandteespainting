import Image from "next/image";
import { Calculator, Check } from "lucide-react";
import { IMAGES } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        <div className="animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-700 ring-1 ring-gold-400/40">
            Interior painting · Newcastle upon Tyne
          </p>
          <h1 className="text-4xl leading-[1.12] sm:text-5xl lg:text-[3.4rem]">
            Professional Room Painting. <span className="text-gold-600">Honest Prices.</span> Beautiful Results.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-700">
            Specialising in bedroom painting, living room painting and skirting boards across Newcastle and surrounding areas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/quote" size="lg">
              <Calculator className="size-5" aria-hidden />
              Calculate Your Painting Price
            </ButtonLink>
            <ButtonLink href="/gallery" size="lg" variant="outline">
              View Our Work
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-2.5 text-[15px] text-navy-800 sm:grid-cols-2">
            {["Room-by-room labour prices", "No hourly rates", "No hidden labour fees", "Free instant online estimate"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-gold-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-3 -z-0 translate-x-4 translate-y-4 rounded-xl bg-sand-200/70" aria-hidden />
          <div className="relative aspect-[16/11] overflow-hidden rounded-xl shadow-xl ring-1 ring-navy-900/5">
            <Image src={IMAGES.hero.src} alt={IMAGES.hero.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" unoptimized={IMAGES.hero.src.endsWith(".svg")} />
          </div>
        </div>
      </Container>
    </section>
  );
}
