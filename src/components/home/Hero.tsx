import Image from "next/image";
import { ArrowRight, Phone, Sparkles } from "lucide-react";
import { IMAGES, telHref } from "@/config/site";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Hero({ phone, beforeImage }: { phone: string; beforeImage?: string }) {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-24">
        <div className="animate-fade-up">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-semibold text-brand-700">
            <Sparkles className="size-4" aria-hidden />
            Friendly room painters in Newcastle
          </p>
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl">
            Fancy giving your home a{" "}
            <span className="relative inline-block whitespace-nowrap text-brand-600">
              fresh new look?
              <svg aria-hidden viewBox="0 0 300 16" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-brand-600/30">
                <path d="M3 11 C 70 3, 150 3, 297 9" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink-700 sm:text-xl">
            From tired bedrooms to beautiful living rooms, we give your home a fresh new feel without the hefty price tag.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/quote" size="lg" className="group whitespace-nowrap font-bold">
              Get my free quote
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/gallery" size="lg" variant="outline" className="whitespace-nowrap font-bold">
              See our work
            </ButtonLink>
          </div>
          <p className="mt-7 text-[15px] text-ink-700">
            Prefer a chat?{" "}
            <a href={telHref(phone)} className="inline-flex items-center gap-1.5 font-bold text-brand-600 underline-offset-4 hover:underline">
              <Phone className="size-4" aria-hidden /> {phone}
            </a>
          </p>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div aria-hidden className="absolute -right-6 -top-6 size-40 rounded-full bg-brand-50 sm:size-56" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl shadow-ink-950/10">
            <Image src={IMAGES.hero.src} alt={IMAGES.hero.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          {beforeImage && (
            <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-white p-2.5 pr-5 shadow-xl ring-1 ring-ink-950/5 sm:-left-6">
              <div className="relative size-16 overflow-hidden rounded-2xl">
                <Image src={beforeImage} alt="The same bedroom before painting" fill sizes="64px" className="object-cover" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-600">Before</p>
                <p className="text-sm font-bold text-ink-950">Same room, fresh new look</p>
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
