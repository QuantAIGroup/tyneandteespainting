import type { ComponentProps, ReactNode } from "react";

export const inputClasses =
  "block w-full rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-[15px] text-ink-950 shadow-xs placeholder:text-ink-600/60 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400/40 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-red-200 disabled:bg-ink-50";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={inputClasses} {...props} />;
}

export function Textarea({ invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={`${inputClasses} min-h-28`} {...props} />;
}

export function Select({ invalid, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return <select aria-invalid={invalid || undefined} className={inputClasses} {...props} />;
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "error" | "success"; title?: string; children: ReactNode }) {
  const tones = {
    info: "bg-ink-50 text-ink-900 ring-ink-100",
    warning: "bg-brand-50 text-brand-900 ring-brand-200",
    error: "bg-red-50 text-red-900 ring-red-200",
    success: "bg-brand-50 text-brand-900 ring-brand-200",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl p-4 text-sm ring-1 ${tones[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
