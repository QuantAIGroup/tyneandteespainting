"use client";

import type { ReactNode } from "react";
import type { CeilingDraft, ItemDraft, RoomDraft, SkirtingDraft } from "./draft";

function Choice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: ReactNode;
  value: T;
  options: { value: T; label: string; note?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-medium text-navy-950">{legend}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-lg px-3.5 py-3 ring-1 transition ${value === o.value ? "bg-sand-50 ring-gold-500" : "ring-navy-900/12 hover:bg-sand-50/60"}`}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1 accent-navy-900" />
            <span>
              <span className="block text-[15px] text-navy-950">{o.label}</span>
              {o.note && <span className="block text-sm text-navy-600">{o.note}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function YesNo({ name, legend, hint, value, onChange }: { name: string; legend: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset>
      <legend className="text-[15px] font-medium text-navy-950">{legend}</legend>
      {hint && <p className="mt-0.5 text-sm text-navy-600">{hint}</p>}
      <div className="mt-2 flex gap-2">
        {[
          [false, "No"],
          [true, "Yes"],
        ].map(([v, label]) => (
          <label key={String(v)} className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 ring-1 transition ${value === v ? "bg-sand-50 ring-gold-500" : "ring-navy-900/12 hover:bg-sand-50/60"}`}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v as boolean)} className="accent-navy-900" />
            <span className="text-[15px]">{label as string}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Coats({ id, value, onChange, standard }: { id: string; value: number; onChange: (v: number) => void; standard: number }) {
  return (
    <Choice
      name={`${id}-coats`}
      legend="Number of coats"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={[
        { value: String(standard), label: `${standard} coats (standard – included)`, note: "Right for almost every room repainted in a similar colour." },
        { value: String(standard + 1), label: `${standard + 1} coats`, note: "We'll review this and confirm with you before any work starts." },
      ]}
    />
  );
}

const SURFACE_OPTIONS = [
  { value: "good" as const, label: "Good condition", note: "Ready to paint" },
  { value: "minor_defects" as const, label: "Small nail holes or minor hairline cracks", note: "Included in the standard price" },
  { value: "major_damage" as const, label: "Larger cracks, holes or damaged plaster", note: "We'll need to see this and quote separately" },
];

function RoomCondition({ item, update, standardCoats }: { item: RoomDraft; update: (p: Partial<RoomDraft>) => void; standardCoats: number }) {
  const c = item.condition;
  const set = (patch: Partial<RoomDraft["condition"]>) => update({ condition: { ...c, ...patch } });
  return (
    <div className="space-y-6">
      <Choice name={`${item.id}-surface`} legend="What condition are the walls in?" value={c.surface} onChange={(v) => set({ surface: v })} options={SURFACE_OPTIONS} />
      <Choice
        name={`${item.id}-colour`}
        legend="What colour change is it?"
        value={c.colourChange}
        onChange={(v) => set({ colourChange: v })}
        options={[
          { value: "similar", label: "A similar colour to what's there now" },
          { value: "significant", label: "A significant change", note: "e.g. dark to light, or a strong colour – may need an extra coat" },
        ]}
      />
      <YesNo name={`${item.id}-skim`} legend="Is the plaster newly skimmed?" hint="Fresh plaster needs a diluted 'mist coat' first." value={c.newlySkimmed} onChange={(v) => set({ newlySkimmed: v })} />
      <YesNo name={`${item.id}-paper`} legend="Is there wallpaper that needs removing?" value={c.wallpaperToRemove} onChange={(v) => set({ wallpaperToRemove: v })} />
      <YesNo name={`${item.id}-damp`} legend="Any damp, mould, smoke or water stains?" value={c.dampOrStains} onChange={(v) => set({ dampOrStains: v })} />
      <Coats id={item.id} value={item.coats} standard={standardCoats} onChange={(v) => update({ coats: v })} />
    </div>
  );
}

function SkirtingCondition({ item, update, standardCoats }: { item: SkirtingDraft; update: (p: Partial<SkirtingDraft>) => void; standardCoats: number }) {
  return (
    <div className="space-y-6">
      <Choice
        name={`${item.id}-cond`}
        legend="What condition are the skirting boards in?"
        value={item.condition}
        onChange={(v) => update({ condition: v })}
        options={[
          { value: "good", label: "Good – already painted, just tired", note: "Included" },
          { value: "minor_defects", label: "Some scuffs, chips or small dents", note: "Included in the standard price" },
          { value: "bare_wood", label: "Bare or new wood", note: "Needs primer and undercoat – we'll confirm the price" },
          { value: "major_damage", label: "Split, loose or badly damaged", note: "We'll need to see this and quote separately" },
        ]}
      />
      <Coats id={item.id} value={item.coats} standard={standardCoats} onChange={(v) => update({ coats: v })} />
    </div>
  );
}

function CeilingCondition({ item, update, standardCoats }: { item: CeilingDraft; update: (p: Partial<CeilingDraft>) => void; standardCoats: number }) {
  const c = item.condition;
  const set = (patch: Partial<CeilingDraft["condition"]>) => update({ condition: { ...c, ...patch } });
  return (
    <div className="space-y-6">
      <Choice name={`${item.id}-surface`} legend="What condition is the ceiling in?" value={c.surface} onChange={(v) => set({ surface: v })} options={SURFACE_OPTIONS} />
      <YesNo name={`${item.id}-skim`} legend="Is the ceiling newly plastered?" value={c.newlySkimmed} onChange={(v) => set({ newlySkimmed: v })} />
      <YesNo name={`${item.id}-damp`} legend="Any water stains, damp or mould?" value={c.dampOrStains} onChange={(v) => set({ dampOrStains: v })} />
      <Coats id={item.id} value={item.coats} standard={standardCoats} onChange={(v) => update({ coats: v })} />
    </div>
  );
}

export function ItemCondition({ item, update, standardCoats }: { item: ItemDraft; update: (p: Partial<ItemDraft>) => void; standardCoats: number }) {
  if (item.type === "skirting") return <SkirtingCondition item={item} update={update} standardCoats={standardCoats} />;
  if (item.type === "ceiling") return <CeilingCondition item={item} update={update} standardCoats={standardCoats} />;
  return <RoomCondition item={item} update={update} standardCoats={standardCoats} />;
}
