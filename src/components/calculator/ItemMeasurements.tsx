"use client";

import { Plus, Trash2 } from "lucide-react";
import { ceilingArea, round2, simpleWallArea, wallsArea } from "@/lib/pricing/engine";
import { LIMITS } from "@/lib/pricing/schema";
import type { CeilingDraft, ItemDraft, RoomDraft, SkirtingDraft, Unit } from "./draft";
import { newWall } from "./draft";
import { NumberInput } from "./NumberInput";

type Update = (patch: Partial<ItemDraft>) => void;

function AreaNote({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return (
    <p className="mt-3 text-sm text-ink-700">
      {label}: <strong className="text-ink-950">{round2(value).toFixed(2)} {unit}</strong>
    </p>
  );
}

function RoomMeasurements({ item, unit, errors, update }: { item: RoomDraft; unit: Unit; errors: Record<string, string>; update: (p: Partial<RoomDraft>) => void }) {
  const simpleArea = item.length !== null && item.width !== null && item.height !== null ? simpleWallArea(item.length, item.width, item.height) : null;
  const wallTotal = item.walls.every((w) => w.width !== null && w.height !== null)
    ? wallsArea(item.walls.map((w) => ({ width: w.width!, height: w.height! })))
    : null;
  const k = (name: string) => `${item.id}-${name}-${unit}`;

  return (
    <div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-900">How would you like to measure?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["simple", "Standard room", "Rectangular room – length, width and wall height"],
              ["walls", "Measure each wall", "For L-shaped rooms, alcoves or sloped ceilings"],
            ] as const
          ).map(([mode, title, text]) => (
            <label
              key={mode}
              className={`flex cursor-pointer gap-3 rounded-lg p-3.5 ring-1 transition ${item.measurementMode === mode ? "bg-grey-50 ring-brand-600" : "ring-ink-900/12 hover:bg-grey-50/60"}`}
            >
              <input type="radio" name={`${item.id}-mode`} checked={item.measurementMode === mode} onChange={() => update({ measurementMode: mode })} className="mt-1 accent-ink-900" />
              <span>
                <span className="block text-[15px] font-medium text-ink-950">{title}</span>
                <span className="block text-sm text-ink-600">{text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {item.measurementMode === "simple" ? (
        <div className="mt-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberInput key={k("l")} id={k("l")} label="Room length" unit={unit} value={item.length} onChange={(v) => update({ length: v })} error={errors.length} hint="Along the floor, wall to wall" />
            <NumberInput key={k("w")} id={k("w")} label="Room width" unit={unit} value={item.width} onChange={(v) => update({ width: v })} error={errors.width} hint="The other direction" />
            <NumberInput key={k("h")} id={k("h")} label="Wall height" unit={unit} value={item.height} onChange={(v) => update({ height: v })} error={errors.height} hint="Floor to ceiling (often about 2.4 m)" />
          </div>
          <AreaNote label="Wall area = 2 × (length + width) × height" value={simpleArea} unit="m²" />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-ink-700">Measure the width and height of each wall you want painted. Include chimney breasts and alcove walls as separate walls.</p>
          {errors.walls && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {errors.walls}
            </p>
          )}
          {item.walls.map((wall, index) => (
            <div key={wall.key} className="grid grid-cols-[1fr_1fr_auto] items-start gap-3 rounded-lg bg-grey-50/60 p-3">
              <NumberInput
                key={`${wall.key}-w-${unit}`}
                id={`${wall.key}-w-${unit}`}
                label={`Wall ${index + 1} width`}
                unit={unit}
                value={wall.width}
                error={errors[`walls.${index}.width`]}
                onChange={(v) => update({ walls: item.walls.map((w) => (w.key === wall.key ? { ...w, width: v } : w)) })}
              />
              <NumberInput
                key={`${wall.key}-h-${unit}`}
                id={`${wall.key}-h-${unit}`}
                label="Height"
                unit={unit}
                value={wall.height}
                error={errors[`walls.${index}.height`]}
                onChange={(v) => update({ walls: item.walls.map((w) => (w.key === wall.key ? { ...w, height: v } : w)) })}
              />
              <button
                type="button"
                onClick={() => update({ walls: item.walls.filter((w) => w.key !== wall.key) })}
                disabled={item.walls.length <= 1}
                className="mt-7 grid size-10 place-items-center rounded-md text-ink-600 hover:bg-white hover:text-red-700 disabled:opacity-30"
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">Remove wall {index + 1}</span>
              </button>
            </div>
          ))}
          {item.walls.length < LIMITS.maxWalls && (
            <button type="button" onClick={() => update({ walls: [...item.walls, newWall()] })} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600">
              <Plus className="size-4" aria-hidden /> Add another wall
            </button>
          )}
          <AreaNote label="Total wall area" value={wallTotal} unit="m²" />
        </div>
      )}

      <div className="mt-6 rounded-lg p-4 ring-1 ring-ink-900/10">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={item.includeCeiling} onChange={(e) => update({ includeCeiling: e.target.checked })} className="mt-1 size-4 accent-ink-900" />
          <span>
            <span className="block text-[15px] font-medium text-ink-950">Also paint the ceiling (optional extra)</span>
            <span className="block text-sm text-ink-600">Priced separately: ceiling area = length × width.</span>
          </span>
        </label>
        {item.includeCeiling && item.measurementMode === "walls" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberInput key={k("cl")} id={k("cl")} label="Ceiling length" unit={unit} value={item.length} onChange={(v) => update({ length: v })} error={errors.length} />
            <NumberInput key={k("cw")} id={k("cw")} label="Ceiling width" unit={unit} value={item.width} onChange={(v) => update({ width: v })} error={errors.width} />
          </div>
        )}
        {item.includeCeiling && item.length !== null && item.width !== null && <AreaNote label="Ceiling area" value={ceilingArea(item.length, item.width)} unit="m²" />}
      </div>
    </div>
  );
}

function SkirtingMeasurements({ item, unit, errors, update }: { item: SkirtingDraft; unit: Unit; errors: Record<string, string>; update: (p: Partial<SkirtingDraft>) => void }) {
  return (
    <div className="max-w-xs">
      <NumberInput
        key={`${item.id}-lm-${unit}`}
        id={`${item.id}-lm-${unit}`}
        label="Total length of skirting"
        unit={unit}
        value={item.linearMetres}
        onChange={(v) => update({ linearMetres: v })}
        error={errors.linearMetres}
        hint="Add up the skirting along every wall. Leave out doorways."
      />
    </div>
  );
}

function CeilingMeasurements({ item, unit, errors, update }: { item: CeilingDraft; unit: Unit; errors: Record<string, string>; update: (p: Partial<CeilingDraft>) => void }) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput key={`${item.id}-l-${unit}`} id={`${item.id}-l-${unit}`} label="Ceiling length" unit={unit} value={item.length} onChange={(v) => update({ length: v })} error={errors.length} hint="Same as the room's floor length" />
        <NumberInput key={`${item.id}-w-${unit}`} id={`${item.id}-w-${unit}`} label="Ceiling width" unit={unit} value={item.width} onChange={(v) => update({ width: v })} error={errors.width} hint="Same as the room's floor width" />
      </div>
      {item.length !== null && item.width !== null && <AreaNote label="Ceiling area = length × width" value={ceilingArea(item.length, item.width)} unit="m²" />}
    </div>
  );
}

export function ItemMeasurements({ item, unit, errors, update }: { item: ItemDraft; unit: Unit; errors: Record<string, string>; update: Update }) {
  if (item.type === "skirting") return <SkirtingMeasurements item={item} unit={unit} errors={errors} update={update} />;
  if (item.type === "ceiling") return <CeilingMeasurements item={item} unit={unit} errors={errors} update={update} />;
  return <RoomMeasurements item={item} unit={unit} errors={errors} update={update} />;
}
