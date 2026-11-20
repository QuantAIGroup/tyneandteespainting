"use client";

import { useState } from "react";
import { inputClasses } from "@/components/ui/Form";
import type { Num, Unit } from "./draft";

function toDisplay(metres: Num, unit: Unit): string {
  if (metres === null) return "";
  return unit === "cm" ? String(Math.round(metres * 100)) : String(Math.round(metres * 100) / 100);
}

/**
 * A measurement box. The customer types in metres or centimetres (their choice);
 * the value is always stored in metres. Accepts "3.5", "3,5" or "350" (cm).
 */
export function NumberInput({
  id,
  label,
  value,
  unit,
  onChange,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: Num;
  unit: Unit;
  onChange: (metres: Num) => void;
  error?: string;
  hint?: string;
}) {
  // Local text so people can type freely (e.g. "3." on the way to "3.5").
  // The parent re-mounts this input (via key) when the unit changes.
  const [text, setText] = useState(() => toDisplay(value, unit));

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const raw = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
            setText(raw);
            const n = parseFloat(raw);
            onChange(raw === "" || Number.isNaN(n) ? null : unit === "cm" ? n / 100 : n);
          }}
          className={`${inputClasses} pr-12`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-ink-600">{unit}</span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
