import { offerTermsSchema, type OfferTerms } from "./offers";

/** "£1,234.50" → 123450 pence, or null if not a valid amount. */
export function parsePounds(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/** Reads the Schedule B job-record fields from a form. */
export function parseOfferForm(fd: FormData, specificationVersion: string): { ok: true; terms: OfferTerms } | { ok: false; message: string } {
  const fee = parsePounds(fd.get("fee"));
  if (fee === null) return { ok: false, message: "Enter the fee in pounds, e.g. 250 or 250.50" };
  const duration = str(fd, "estimatedDurationHours").trim();
  const parsed = offerTermsSchema.safeParse({
    scope: str(fd, "scope"),
    surfacesAndPreparation: str(fd, "surfacesAndPreparation"),
    exclusions: str(fd, "exclusions"),
    feePence: fee,
    materialsResponsibility: str(fd, "materialsResponsibility"),
    materialsNotes: str(fd, "materialsNotes"),
    proposedStartDate: str(fd, "proposedStartDate"),
    arrivalWindowStart: str(fd, "arrivalWindowStart"),
    arrivalWindowEnd: str(fd, "arrivalWindowEnd"),
    estimatedDurationHours: duration ? Number(duration) : undefined,
    accessRequirements: str(fd, "accessRequirements"),
    knownHazards: str(fd, "knownHazards"),
    customerRequirements: str(fd, "customerRequirements"),
    paymentTerms: str(fd, "paymentTerms"),
    paymentDueDays: Number(str(fd, "paymentDueDays")),
    specificationVersion,
    message: str(fd, "message"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `${issue.path.join(".") || "Form"}: ${issue.message}` };
  }
  return { ok: true, terms: parsed.data };
}

/** Database column names for an offer version row. */
export function termsToRow(t: OfferTerms) {
  return {
    scope: t.scope,
    surfaces_and_preparation: t.surfacesAndPreparation ?? null,
    exclusions: t.exclusions ?? null,
    fee_pence: t.feePence,
    materials_responsibility: t.materialsResponsibility,
    materials_notes: t.materialsNotes ?? null,
    proposed_start_date: t.proposedStartDate,
    arrival_window_start: t.arrivalWindowStart,
    arrival_window_end: t.arrivalWindowEnd,
    estimated_duration_hours: t.estimatedDurationHours ?? null,
    access_requirements: t.accessRequirements ?? null,
    known_hazards: t.knownHazards ?? null,
    customer_requirements: t.customerRequirements ?? null,
    payment_terms: t.paymentTerms,
    payment_due_days: t.paymentDueDays,
    specification_version: t.specificationVersion,
    message: t.message ?? null,
  };
}

export interface OfferVersionRow {
  id: string;
  offer_id: string;
  version_number: number;
  proposed_by: "company" | "painter";
  scope: string;
  surfaces_and_preparation: string | null;
  exclusions: string | null;
  fee_pence: number;
  materials_responsibility: string;
  materials_notes: string | null;
  proposed_start_date: string;
  arrival_window_start: string;
  arrival_window_end: string;
  estimated_duration_hours: number | null;
  access_requirements: string | null;
  known_hazards: string | null;
  customer_requirements: string | null;
  payment_terms: string;
  payment_due_days: number;
  specification_version: string;
  message: string | null;
  content_sha256: string;
  company_accepted_at: string | null;
  painter_accepted_at: string | null;
  created_at: string;
}

/** Turns a stored version back into form defaults (for counteroffers). */
export function rowToDefaults(v: OfferVersionRow) {
  return {
    scope: v.scope,
    surfacesAndPreparation: v.surfaces_and_preparation,
    exclusions: v.exclusions,
    fee: (v.fee_pence / 100).toFixed(2),
    materialsResponsibility: v.materials_responsibility,
    materialsNotes: v.materials_notes,
    proposedStartDate: v.proposed_start_date,
    arrivalWindowStart: v.arrival_window_start.slice(0, 5),
    arrivalWindowEnd: v.arrival_window_end.slice(0, 5),
    estimatedDurationHours: v.estimated_duration_hours?.toString(),
    accessRequirements: v.access_requirements,
    knownHazards: v.known_hazards,
    customerRequirements: v.customer_requirements,
    paymentTerms: v.payment_terms,
    paymentDueDays: String(v.payment_due_days),
  };
}

export const OFFER_VERSION_COLUMNS =
  "id, offer_id, version_number, proposed_by, scope, surfaces_and_preparation, exclusions, fee_pence, materials_responsibility, materials_notes, proposed_start_date, arrival_window_start, arrival_window_end, estimated_duration_hours, access_requirements, known_hazards, customer_requirements, payment_terms, payment_due_days, specification_version, message, content_sha256, company_accepted_at, painter_accepted_at, created_at";
