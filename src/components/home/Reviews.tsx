import { Star } from "lucide-react";
import { REVIEWS } from "@/config/reviews";
import { Container, SectionHeading } from "@/components/ui/Container";
import { DemoBadge } from "@/components/ui/Placeholder";

export function Reviews() {
  const anyDemo = REVIEWS.some((r) => r.isDemo);
  return (
    <section className="bg-sand-50 py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Customer reviews" title="What our customers say" />
        {anyDemo && (
          <div className="mx-auto mt-6 max-w-2xl text-center">
            <DemoBadge>Demonstration content</DemoBadge>
            <p className="mt-3 text-sm text-navy-600">
              These are placeholders showing where genuine customer reviews will appear. They are not real reviews.
            </p>
          </div>
        )}
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((review, i) => (
            <li key={i} className={`flex flex-col rounded-xl bg-white p-7 shadow-sm ${review.isDemo ? "border-2 border-dashed border-amber-300" : "ring-1 ring-navy-900/6"}`}>
              <div className="flex gap-0.5" aria-label={review.isDemo ? "Placeholder rating" : `${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className={`size-4 ${review.isDemo ? "text-navy-100" : s < review.rating ? "fill-gold-400 text-gold-400" : "text-navy-100"}`} aria-hidden />
                ))}
              </div>
              <blockquote className={`mt-4 flex-1 text-[15px] leading-relaxed ${review.isDemo ? "italic text-navy-600" : "text-navy-800"}`}>&ldquo;{review.text}&rdquo;</blockquote>
              <div className="mt-5 border-t border-navy-900/8 pt-4 text-sm">
                <p className="font-semibold text-navy-950">{review.name}</p>
                <p className="text-navy-600">
                  {review.service} · {review.area}
                </p>
                {review.isDemo && <DemoBadge className="mt-3">Placeholder</DemoBadge>}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
