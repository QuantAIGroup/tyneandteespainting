import { isPlaceholder } from "@/config/site";

/**
 * Shows a business detail. If it's still a [placeholder], it is highlighted
 * so you can't miss it before launch.
 */
export function PlaceholderValue({ value, className = "" }: { value: string; className?: string }) {
  if (isPlaceholder(value)) {
    return (
      <span className={`rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[0.85em] text-amber-900 ring-1 ring-amber-300 ${className}`} title="Placeholder – replace in /admin/settings">
        {value || "[Not set]"}
      </span>
    );
  }
  return <span className={className}>{value}</span>;
}

export function DemoBadge({ children = "Demonstration content", className = "" }: { children?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-300 ${className}`}>
      {children}
    </span>
  );
}
