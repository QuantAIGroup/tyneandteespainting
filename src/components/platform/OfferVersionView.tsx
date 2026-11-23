import { formatPence } from "@/lib/pricing/engine";
import { MATERIALS_OPTIONS } from "@/lib/platform/offers";
import type { OfferVersionRow } from "@/lib/platform/forms";
import { Details, Pill, formatDate } from "./ui";

/** Read-only view of one offer version (a proposed or agreed job record). */
export function OfferVersionView({ v, partyLabel }: { v: OfferVersionRow; partyLabel: { company: string; painter: string } }) {
  const agreed = Boolean(v.company_accepted_at && v.painter_accepted_at);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={agreed ? "strong" : "neutral"}>{agreed ? "Agreed by both" : `Version ${v.version_number}`}</Pill>
        <span className="text-ink-600">
          Proposed by {partyLabel[v.proposed_by]} on {formatDate(v.created_at, true)}
        </span>
      </div>
      {v.message && <p className="rounded-lg bg-ink-50 p-3 text-sm">“{v.message}”</p>}
      <Details
        items={[
          ["Fee", <strong key="f" className="text-lg">{formatPence(v.fee_pence, { alwaysShowPence: true })}</strong>],
          ["Start date", formatDate(v.proposed_start_date)],
          ["Arrival window", `${v.arrival_window_start.slice(0, 5)}–${v.arrival_window_end.slice(0, 5)}`],
          ["Estimated duration", v.estimated_duration_hours ? `${v.estimated_duration_hours} hours` : null],
          ["Scope", v.scope],
          ["Surfaces & preparation", v.surfaces_and_preparation],
          ["Exclusions", v.exclusions],
          ["Materials", `${MATERIALS_OPTIONS.find((m) => m.id === v.materials_responsibility)?.label ?? v.materials_responsibility}${v.materials_notes ? ` – ${v.materials_notes}` : ""}`],
          ["Access", v.access_requirements],
          ["Known hazards", v.known_hazards],
          ["Customer requirements", v.customer_requirements],
          ["Payment terms", `${v.payment_terms} (due ${v.payment_due_days} days after invoice)`],
          ["Specification", v.specification_version],
          ["Company accepted", v.company_accepted_at ? formatDate(v.company_accepted_at, true) : "Not yet"],
          ["Painter accepted", v.painter_accepted_at ? formatDate(v.painter_accepted_at, true) : "Not yet"],
        ]}
      />
      <p className="break-all font-mono text-[11px] text-ink-600">Record fingerprint (SHA-256): {v.content_sha256}</p>
    </div>
  );
}
