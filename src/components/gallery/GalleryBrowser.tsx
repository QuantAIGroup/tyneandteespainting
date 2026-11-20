"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryCategory, GalleryEntry } from "@/lib/gallery-types";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

/** Before & after pairs with filter tabs. Drag the slider on each photo to compare. */
export function GalleryBrowser({ items, categories, showTabs = true }: { items: GalleryEntry[]; categories: { id: GalleryCategory; label: string }[]; showTabs?: boolean }) {
  const [active, setActive] = useState<GalleryCategory | "all">("all");
  const filtered = active === "all" ? items : items.filter((i) => i.categories.includes(active));
  const tabs = [{ id: "all" as const, label: "All" }, ...categories.filter((c) => items.some((i) => i.categories.includes(c.id)))];

  return (
    <div>
      {showTabs && (
        <div role="tablist" aria-label="Filter photos" className="flex flex-wrap justify-center gap-2">
          {tabs.map((c) => (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={active === c.id}
              onClick={() => setActive(c.id)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                active === c.id ? "bg-brand-600 text-white shadow-md shadow-brand-600/25" : "bg-white text-ink-900 ring-1 ring-ink-950/10 hover:-translate-y-0.5 hover:ring-brand-600"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div role={showTabs ? "tabpanel" : undefined} className={`grid gap-8 md:grid-cols-2 ${showTabs ? "mt-10" : ""}`}>
        {filtered.map((item) => (
          <figure key={item.id} className="group animate-fade-up overflow-hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink-950/6 transition-shadow duration-300 hover:shadow-xl">
            {item.beforeUrl ? (
              <BeforeAfterSlider before={item.beforeUrl} after={item.afterUrl} alt={item.title} />
            ) : (
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-grey-100">
                <Image src={item.afterUrl} alt={item.title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              </div>
            )}
            <figcaption className="px-2 pt-4 pb-2">
              <p className="text-lg font-bold text-ink-950">{item.title}</p>
              {item.description && <p className="mt-1 text-[15px] text-ink-700">{item.description}</p>}
              {item.location && <p className="mt-1 text-sm text-ink-600">{item.location}</p>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
