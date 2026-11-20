"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";

/** Drag (or use arrow keys) to compare the before and after photos. */
export function BeforeAfterSlider({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [position, setPosition] = useState(50);
  const id = useId();

  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-grey-100">
      <Image src={after} alt={`After: ${alt}`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized={after.endsWith(".svg")} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image src={before} alt={`Before: ${alt}`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" unoptimized={before.endsWith(".svg")} />
      </div>

      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-950/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Before</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">After</span>

      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" style={{ left: `${position}%` }}>
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg ring-2 ring-brand-600">
          <ChevronsLeftRight className="size-5" aria-hidden />
        </span>
      </div>

      <label htmlFor={id} className="sr-only">
        Compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="ba-range absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        aria-valuetext={`${position}% before`}
      />
    </div>
  );
}
