import { Phone } from "lucide-react";
import { telHref } from "@/config/site";
import { Container } from "@/components/ui/Container";

/** Friendly "give us a call" strip. */
export function FriendlyCall({ phone, title = "Not sure what your room needs?", text = "Give us a call – we're happy to answer your questions and help you arrange a convenient booking." }: { phone: string; title?: string; text?: string }) {
  return (
    <section className="bg-white py-6 sm:py-10">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-brand-600 px-7 py-10 text-white sm:px-12 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl text-white sm:text-3xl">{title}</h2>
          <p className="mt-2 text-lg text-white/85">{text}</p>
        </div>
        <a href={telHref(phone)} className="inline-flex h-14 shrink-0 items-center gap-2.5 rounded-full bg-white px-7 text-lg font-extrabold text-brand-600 shadow-md transition-all hover:-translate-y-0.5 hover:bg-brand-50">
          <Phone className="size-5" aria-hidden />
          Call us – {phone}
        </a>
        </div>
      </Container>
    </section>
  );
}
