"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryCategory, GalleryEntry } from "@/lib/gallery";
import { DemoBadge } from "@/components/ui/Placeholder";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export function GalleryBrowser({
  items,
  categories,
  limitPerCategory,
}: {
  items: GalleryEntry[];
  categories: { id: GalleryCategory; label: string }[];
  limitPerCategory?: number;
}) {
  const [active, setActive] = useState<GalleryCategory>(categories[0].id);
  const filtered = items.filter((i) => i.category === active).slice(0, limitPerCategory ?? Infinity);
  const anyDemo = items.some((i) => i.isDemo);

  return (
    <div>
      <div role="tablist" aria-label="Gallery categories" className="flex flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            role="tab"
            type="button"
            aria-selected={active === c.id}
            onClick={() => setActive(c.id)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              active === c.id ? "bg-navy-900 text-white" : "bg-white text-navy-800 ring-1 ring-navy-900/12 hover:bg-sand-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {anyDemo && (
        <p className="mx-auto mt-5 max-w-xl text-center text-sm text-navy-600">
          <DemoBadge className="mr-2 align-middle">Illustration</DemoBadge>
          These are illustrations to show how the gallery works – not photographs of completed jobs. Genuine before-and-after photos will appear here.
        </p>
      )}

      <div role="tabpanel" className={`mt-8 grid gap-8 ${filtered.length > 1 ? "md:grid-cols-2" : "mx-auto max-w-3xl"}`}>
        {filtered.length === 0 && <p className="text-center text-navy-600">Photos coming soon.</p>}
        {filtered.map((item) => (
          <figure key={item.id} className="animate-fade-up">
            {item.beforeUrl ? (
              <BeforeAfterSlider before={item.beforeUrl} after={item.afterUrl} alt={item.title} />
            ) : (
              <div className="relative aspect-[16/11] overflow-hidden rounded-lg bg-sand-100">
                <Image src={item.afterUrl} alt={item.title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" unoptimized={item.afterUrl.endsWith(".svg")} />
              </div>
            )}
            <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-sm text-navy-700">
              <span className="font-medium text-navy-950">{item.title}</span>
              {item.location && <span>· {item.location}</span>}
              {item.isDemo && <DemoBadge>Illustration – not a real job</DemoBadge>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
