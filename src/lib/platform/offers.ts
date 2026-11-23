/**
 * JOB OFFERS, COUNTEROFFERS AND MUTUAL ACCEPTANCE
 * (Master Legal Pack v3.0 clauses 3.2, 3.3, 3.7; Schedule B)
 *
 *  • The Company proposes terms (version 1). The painter can ACCEPT, DECLINE
 *    or COUNTEROFFER (fee, date, arrival window, scope assumptions…).
 *  • Each proposal is a new, permanent version. Nobody edits a version.
 *  • Whoever made the latest proposal has accepted it by making it; the job
 *    is agreed only when the OTHER side accepts that same version.
 *  • Silence is not acceptance. Declining costs the painter nothing – there
 *    is no acceptance rate, strike or rating effect anywhere in the system.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const MATERIALS_OPTIONS = [
  { id: "painter", label: "Painter supplies materials" },
  { id: "company", label: "Company supplies materials" },
  { id: "customer", label: "Customer supplies materials" },
  { id: "split", label: "Split – see notes" },
] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const offerTermsSchema = z
  .object({
    scope: z.string().trim().min(10, "Describe the scope (at least 10 characters)").max(4000),
    surfacesAndPreparation: optionalText(2000),
    exclusions: optionalText(2000),
    feePence: z.number().int().positive("Enter a fee above £0").max(5_000_000, "That fee looks too large"),
    materialsResponsibility: z.enum(["painter", "company", "customer", "split"]),
    materialsNotes: optionalText(1000),
    proposedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    arrivalWindowStart: time,
    arrivalWindowEnd: time,
    estimatedDurationHours: z.number().positive().max(500).optional(),
    accessRequirements: optionalText(1000),
    knownHazards: optionalText(1000),
    customerRequirements: optionalText(2000),
    paymentTerms: z.string().trim().min(5).max(500),
    paymentDueDays: z.number().int().min(0).max(60),
    specificationVersion: z.string().trim().min(1).max(50),
    message: optionalText(1000),
  })
  .refine((t) => t.arrivalWindowEnd > t.arrivalWindowStart, { message: "The arrival window must end after it starts", path: ["arrivalWindowEnd"] })
  .refine((t) => t.materialsResponsibility !== "split" || Boolean(t.materialsNotes), {
    message: "Explain the materials split",
    path: ["materialsNotes"],
  });

export type OfferTerms = z.infer<typeof offerTermsSchema>;

/** Stable fingerprint of the terms – stored with the version and with the acceptance record. */
export function termsHash(terms: OfferTerms): string {
  const keys = Object.keys(terms).sort() as (keyof OfferTerms)[];
  const canonical = JSON.stringify(keys.map((k) => [k, terms[k] ?? null]));
  return createHash("sha256").update(canonical).digest("hex");
}

export type Party = "company" | "painter";

export interface VersionState {
  versionNumber: number;
  proposedBy: Party;
  companyAcceptedAt: string | null;
  painterAcceptedAt: string | null;
}

export type OfferStatus = "open" | "agreed" | "declined_by_painter" | "withdrawn_by_company" | "closed";

export interface AvailableActions {
  accept: boolean;
  counter: boolean;
  decline: boolean; // painter only
  withdraw: boolean; // company only
  waitingFor: Party | null;
}

/** What each side can do right now on an offer thread. */
export function availableActions(status: OfferStatus, versions: VersionState[], party: Party): AvailableActions {
  const none: AvailableActions = { accept: false, counter: false, decline: false, withdraw: false, waitingFor: null };
  if (status !== "open" || versions.length === 0) return none;
  const latest = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const otherSide: Party = latest.proposedBy === "company" ? "painter" : "company";
  const myTurn = party === otherSide;
  return {
    accept: myTurn,
    counter: myTurn,
    decline: party === "painter",
    withdraw: party === "company",
    waitingFor: otherSide,
  };
}

export function isAgreed(v: VersionState): boolean {
  return Boolean(v.companyAcceptedAt && v.painterAcceptedAt);
}

/** Human summary of what changed between two versions (shown on counteroffers). */
export function describeChanges(prev: OfferTerms, next: OfferTerms): string[] {
  const labels: Partial<Record<keyof OfferTerms, string>> = {
    feePence: "Fee",
    proposedStartDate: "Start date",
    arrivalWindowStart: "Arrival from",
    arrivalWindowEnd: "Arrival until",
    scope: "Scope",
    exclusions: "Exclusions",
    materialsResponsibility: "Materials",
    materialsNotes: "Materials notes",
    paymentTerms: "Payment terms",
    paymentDueDays: "Payment days",
    estimatedDurationHours: "Estimated duration",
    surfacesAndPreparation: "Surfaces & preparation",
    accessRequirements: "Access",
    knownHazards: "Hazards",
    customerRequirements: "Customer requirements",
  };
  const changes: string[] = [];
  for (const key of Object.keys(labels) as (keyof OfferTerms)[]) {
    if ((prev[key] ?? null) !== (next[key] ?? null)) {
      if (key === "feePence") changes.push(`Fee: £${(prev.feePence / 100).toFixed(2)} → £${(next.feePence / 100).toFixed(2)}`);
      else changes.push(`${labels[key]} changed`);
    }
  }
  return changes;
}

/**
 * Features that could undermine independent-contractor status. The build
 * brief asks us to flag them; none of these exist in this app. Kept here so
 * future changes can be checked against the list (see docs/COMPLIANCE-DESIGN.md).
 */
export const INDEPENDENCE_RISK_FEATURES = [
  "Acceptance-rate tracking or targets",
  "Penalties, fines, strikes or warnings for declining or counteroffering",
  "Compulsory availability calendars, shifts or minimum hours",
  "Exclusivity or restrictions on working for others",
  "Rating-triggered suspension or automatic deactivation",
  "Fixed no-show charges or automatic deductions",
  "Continuous location tracking",
  "Requiring the named individual to attend personally (no substitution)",
  "Company-set working methods beyond result, safety and customer commitments",
  "Uniform/branding requirements that present painters as staff",
] as const;
