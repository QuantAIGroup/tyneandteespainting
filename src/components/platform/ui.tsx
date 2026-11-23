import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** White rounded panel used throughout the admin and painter portals. */
export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 ring-1 ring-ink-900/10 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  neutral: "bg-ink-100 text-ink-800",
  blue: "bg-brand-50 text-brand-800",
  strong: "bg-brand-600 text-white",
  dark: "bg-ink-950 text-white",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-900",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

/** Label/value pairs. */
export function Details({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-600">{k}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[15px] text-ink-950">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export const DRAFT_NOTICE =
  "DRAFT – NOT APPROVED FOR USE. This document requires review by the Company’s solicitor and/or accountant before publication or signature.";

export function DraftBanner() {
  return (
    <div role="note" className="flex gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-sm font-semibold">{DRAFT_NOTICE}</p>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: ReactNode }) {
  const cls = { info: "bg-brand-50 text-brand-900 ring-brand-200", warning: "bg-amber-50 text-amber-950 ring-amber-300", danger: "bg-red-50 text-red-950 ring-red-200" }[tone];
  return <div className={`rounded-xl p-4 text-sm ring-1 ${cls}`}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-ink-900/15 p-6 text-center text-ink-600">{children}</p>;
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return d.toLocaleString("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" } : { dateStyle: "medium", timeZone: "Europe/London" });
}

export const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_solicitor_review: "Awaiting solicitor review",
  awaiting_accountant_review: "Awaiting accountant review",
  awaiting_company_approval: "Awaiting company approval",
  approved_for_publication: "Approved for publication",
  published: "Published",
  superseded: "Superseded",
  archived: "Archived",
};

export const isApprovedStatus = (s: string) => s === "approved_for_publication" || s === "published";
