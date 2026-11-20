import { statusLabel } from "@/lib/enquiry";

const COLOURS: Record<string, string> = {
  awaiting_consultation: "bg-brand-50 text-brand-700",
  price_agreed: "bg-grey-100 text-ink-900",
  deposit_requested: "bg-brand-50 text-brand-900",
  deposit_paid: "bg-brand-100 text-brand-900",
  booking_confirmed: "bg-brand-100 text-brand-900",
  work_completed: "bg-brand-600 text-white",
  balance_paid: "bg-ink-950 text-white",
  declined: "bg-ink-100 text-ink-700",
  cancelled: "bg-ink-100 text-ink-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${COLOURS[status] ?? "bg-ink-100"}`}>{statusLabel(status)}</span>;
}
