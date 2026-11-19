import { statusLabel } from "@/lib/enquiry";

const COLOURS: Record<string, string> = {
  new: "bg-blue-100 text-blue-900",
  contacted: "bg-sky-100 text-sky-900",
  quote_sent: "bg-violet-100 text-violet-900",
  accepted: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-teal-100 text-teal-900",
  completed: "bg-green-200 text-green-950",
  declined: "bg-navy-100 text-navy-700",
  cancelled: "bg-navy-100 text-navy-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${COLOURS[status] ?? "bg-navy-100"}`}>{statusLabel(status)}</span>;
}
