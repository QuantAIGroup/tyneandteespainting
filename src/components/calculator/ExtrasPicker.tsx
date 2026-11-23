"use client";

import { Minus, Plus, Search } from "lucide-react";
import { EXTRAS, EXTRA_QUANTITY, FIXED_EXTRAS, INSPECTION_EXTRAS } from "@/lib/pricing/extras";
import type { ExtraKind, PricingSettings } from "@/lib/pricing/types";
import type { ExtraDraft } from "./draft";
import { extraUnitPrice, extraWorking } from "./prices";

/** − 3 + buttons. Going below 1 removes the option (deselects it). */
export function QuantityStepper({
  id,
  label,
  value,
  onChange,
  onRemove,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  onRemove: () => void;
}) {
  const current = value ?? 0;
  const btn =
    "grid size-10 place-items-center rounded-full bg-white text-ink-950 ring-1 ring-ink-900/15 transition hover:ring-brand-600 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => (current <= EXTRA_QUANTITY.min ? onRemove() : onChange(current - 1))} aria-label={`Fewer ${label}`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <label htmlFor={id} className="sr-only">
        Number of {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
          onChange(digits === "" ? null : Number(digits));
        }}
        className="h-10 w-14 rounded-lg border border-ink-900/15 text-center text-base font-semibold text-ink-950 focus:border-brand-600 focus:outline-none"
      />
      <button type="button" className={btn} onClick={() => onChange(Math.min(current + 1, EXTRA_QUANTITY.max))} disabled={current >= EXTRA_QUANTITY.max} aria-label={`More ${label}`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function ExtraRow({
  kind,
  selected,
  pricing,
  onAdd,
  onChange,
  onRemove,
  error,
}: {
  kind: ExtraKind;
  selected: ExtraDraft | undefined;
  pricing: PricingSettings;
  onAdd: () => void;
  onChange: (n: number | null) => void;
  onRemove: () => void;
  error?: string;
}) {
  const def = EXTRAS[kind];
  return (
    <li className={`rounded-2xl p-4 ring-1 transition ${selected ? "bg-brand-50/50 ring-brand-600" : "bg-white ring-ink-900/12"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950">{def.name}</p>
          <p className="text-sm text-ink-600">{def.note}</p>
          <p className={`mt-1 text-sm font-semibold ${def.inspection ? "text-ink-800" : "text-brand-600"}`}>
            {def.inspection && <Search className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />}
            {extraUnitPrice(kind, pricing)}
          </p>
        </div>
        {selected ? (
          <QuantityStepper id={`qty-${kind}`} label={def.unit[1]} value={selected.quantity} onChange={onChange} onRemove={onRemove} />
        ) : (
          <button type="button" onClick={onAdd} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink-950 ring-1 ring-ink-900/15 hover:ring-brand-600">
            + Add
          </button>
        )}
      </div>
      {selected && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-950/8 pt-3 text-[15px]">
          <span aria-live="polite" className={error ? "text-red-700" : def.inspection ? "text-ink-800" : "font-semibold text-ink-950"}>
            {error ?? (selected.quantity !== null ? extraWorking(kind, selected.quantity, pricing) : "Please enter a quantity")}
          </span>
          <button type="button" onClick={onRemove} className="text-sm font-medium text-ink-600 underline underline-offset-2 hover:text-red-700">
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

/** The extras list with quantity controls. Each extra can be selected once; the quantity covers multiples. */
export function ExtrasPicker({
  items,
  pricing,
  errors,
  onAdd,
  onChange,
  onRemove,
}: {
  items: ExtraDraft[];
  pricing: PricingSettings;
  errors: Record<string, string | undefined>;
  onAdd: (kind: ExtraKind) => void;
  onChange: (kind: ExtraKind, n: number | null) => void;
  onRemove: (kind: ExtraKind) => void;
}) {
  const row = (kind: ExtraKind) => {
    const selected = items.find((i) => i.extra === kind);
    return (
      <ExtraRow
        key={kind}
        kind={kind}
        selected={selected}
        pricing={pricing}
        onAdd={() => onAdd(kind)}
        onChange={(n) => onChange(kind, n)}
        onRemove={() => onRemove(kind)}
        error={selected ? errors[selected.id] : undefined}
      />
    );
  };
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 md:grid-cols-2">{FIXED_EXTRAS.map(row)}</ul>
      <div>
        <h4 className="font-sans text-base font-semibold text-ink-950">Needs an inspection first</h4>
        <p className="mt-1 text-sm text-ink-600">These can vary a lot, so we price them separately after seeing your photos or visiting. They aren&rsquo;t included in the online total.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">{INSPECTION_EXTRAS.map(row)}</ul>
      </div>
    </div>
  );
}
