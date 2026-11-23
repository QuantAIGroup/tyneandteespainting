"use client";

import type { CeilingDraft, MeasuredDraft, RoomDraft, SkirtingDraft } from "./draft";

/**
 * Quick condition questions. They decide whether an item can be priced
 * automatically or needs a manual quotation (see the pricing engine).
 * The standard price includes two coats.
 */

function Choice<T extends string>({ name, legend, value, options, onChange }: { name: string; legend: string; value: T; options: { value: T; label: string; note?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-950">{legend}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-lg px-3.5 py-3 ring-1 transition ${value === o.value ? "bg-brand-50 ring-brand-600" : "ring-ink-950/12 hover:bg-grey-50"}`}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 accent-brand-600" />
            <span>
              <span className="block text-[15px] text-ink-950">{o.label}</span>
              {o.note && <span className="block text-sm text-ink-600">{o.note}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Tick({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink-900">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-brand-600" />
      {label}
    </label>
  );
}

const SURFACE = [
  { value: "good" as const, label: "Good condition", note: "Ready to paint" },
  { value: "minor_defects" as const, label: "Small nail holes or minor cracks", note: "Included in the price" },
  { value: "major_damage" as const, label: "Larger cracks or damaged plaster", note: "We'll need to see this – manual quotation" },
];

function RoomCondition({ item, update }: { item: RoomDraft; update: (p: Partial<RoomDraft>) => void }) {
  const c = item.condition;
  const set = (patch: Partial<RoomDraft["condition"]>) => update({ condition: { ...c, ...patch } });
  return (
    <div className="space-y-5">
      <Choice name={`${item.id}-surface`} legend="What condition are the walls in?" value={c.surface} onChange={(v) => set({ surface: v })} options={SURFACE} />
      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-sm font-medium text-ink-950">Tick any that apply</legend>
        <Tick label="Big colour change (e.g. dark to light)" checked={c.colourChange === "significant"} onChange={(v) => set({ colourChange: v ? "significant" : "similar" })} />
        <Tick label="Newly plastered walls" checked={c.newlySkimmed} onChange={(v) => set({ newlySkimmed: v })} />
        <Tick label="Wallpaper that needs removing" checked={c.wallpaperToRemove} onChange={(v) => set({ wallpaperToRemove: v })} />
        <Tick label="Damp, mould or water stains" checked={c.dampOrStains} onChange={(v) => set({ dampOrStains: v })} />
      </fieldset>
    </div>
  );
}

function SkirtingCondition({ item, update }: { item: SkirtingDraft; update: (p: Partial<SkirtingDraft>) => void }) {
  return (
    <Choice
      name={`${item.id}-cond`}
      legend="What condition are the skirting boards in?"
      value={item.condition}
      onChange={(v) => update({ condition: v })}
      options={[
        { value: "good", label: "Already painted, just tired", note: "Included" },
        { value: "minor_defects", label: "Some scuffs, chips or small dents", note: "Included" },
        { value: "bare_wood", label: "Bare or new wood", note: "Needs primer – we'll confirm the price" },
        { value: "major_damage", label: "Split, loose or badly damaged", note: "We'll need to see this – manual quotation" },
      ]}
    />
  );
}

function CeilingCondition({ item, update }: { item: CeilingDraft; update: (p: Partial<CeilingDraft>) => void }) {
  const c = item.condition;
  const set = (patch: Partial<CeilingDraft["condition"]>) => update({ condition: { ...c, ...patch } });
  return (
    <div className="space-y-5">
      <Choice name={`${item.id}-surface`} legend="What condition is the ceiling in?" value={c.surface} onChange={(v) => set({ surface: v })} options={SURFACE} />
      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-sm font-medium text-ink-950">Tick any that apply</legend>
        <Tick label="Newly plastered ceiling" checked={c.newlySkimmed} onChange={(v) => set({ newlySkimmed: v })} />
        <Tick label="Water stains, damp or mould" checked={c.dampOrStains} onChange={(v) => set({ dampOrStains: v })} />
      </fieldset>
    </div>
  );
}

export function ItemCondition({ item, update }: { item: MeasuredDraft; update: (p: Partial<MeasuredDraft>) => void }) {
  if (item.type === "skirting") return <SkirtingCondition item={item} update={update} />;
  if (item.type === "ceiling") return <CeilingCondition item={item} update={update} />;
  return <RoomCondition item={item} update={update} />;
}
