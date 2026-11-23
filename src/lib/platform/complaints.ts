/**
 * COMPLAINTS, RECTIFICATION AND RECOVERY – rules
 * (Master Legal Pack v3.0 clauses 3.12–3.13 and section 4; Dev Spec v2.0 §2–6)
 *
 *  • Default painter response time: 5 working days. Shorter only with a
 *    recorded urgency reason.
 *  • Category is "undetermined" until evidence supports one – workmanship is
 *    never assumed.
 *  • A customer refund NEVER becomes a painter deduction. Recovery claims are
 *    a separate case needing breach, causation, itemised loss and mitigation.
 *  • Undisputed painter fees are paid when due even while a complaint is open.
 */

export const COMPLAINT_CATEGORIES = [
  { id: "undetermined", label: "Not yet determined", painterRelated: null },
  { id: "workmanship", label: "Workmanship defect", painterRelated: true },
  { id: "incomplete_work", label: "Incomplete agreed scope", painterRelated: true },
  { id: "property_damage", label: "Damage to property", painterRelated: true },
  { id: "conduct", label: "Conduct", painterRelated: true },
  { id: "pre_existing_damage", label: "Pre-existing damage", painterRelated: false },
  { id: "damp_or_leak", label: "Damp or leak", painterRelated: false },
  { id: "substrate_failure", label: "Substrate (plaster/surface) failure", painterRelated: false },
  { id: "product_failure", label: "Product failure", painterRelated: false },
  { id: "customer_change", label: "Customer changes", painterRelated: false },
  { id: "excluded_work", label: "Excluded work", painterRelated: false },
  { id: "normal_wear", label: "Normal wear", painterRelated: false },
  { id: "access_problem", label: "Access problem", painterRelated: false },
  { id: "other", label: "Other", painterRelated: null },
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]["id"];

export const DEFAULT_RESPONSE_WORKING_DAYS = 5;
export const APPEAL_WINDOW_CALENDAR_DAYS = 10;

/** Adds Monday–Friday working days. (Bank holidays aren't excluded – check manually around holidays.) */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export function defaultResponseDue(notifiedAt: Date): Date {
  return addWorkingDays(notifiedAt, DEFAULT_RESPONSE_WORKING_DAYS);
}

/** Returns an error if a shorter deadline is set without a reason. */
export function validateResponseDeadline(notifiedAt: Date, dueAt: Date, urgencyReason?: string | null): string | null {
  if (dueAt <= notifiedAt) return "The response deadline must be after the painter is notified.";
  if (dueAt < defaultResponseDue(notifiedAt) && (urgencyReason ?? "").trim().length < 10) {
    return "A deadline shorter than five working days needs a recorded urgency reason.";
  }
  return null;
}

export function canAppeal(decidedAt: Date, now: Date): boolean {
  const limit = new Date(decidedAt.getTime());
  limit.setUTCDate(limit.getUTCDate() + APPEAL_WINDOW_CALENDAR_DAYS);
  return now <= limit;
}

export interface RecoveryClaimDraft {
  allegedBreach: string;
  contractualBasis: string;
  causationExplanation: string;
  mitigationSteps?: string;
  itemisedLoss: { description: string; amountPence: number; evidence?: string }[];
}

/**
 * A recovery claim can only be NOTIFIED to a painter when it is properly made out.
 * (It is never deducted automatically – this release has no set-off at all.)
 */
export function recoveryClaimProblems(c: RecoveryClaimDraft): string[] {
  const problems: string[] = [];
  if (c.allegedBreach.trim().length < 20) problems.push("Describe the alleged breach of the accepted job record.");
  if (c.contractualBasis.trim().length < 10) problems.push("State the contractual/legal basis.");
  if (c.causationExplanation.trim().length < 20) problems.push("Explain how the breach caused the loss (and consider other causes).");
  if (c.itemisedLoss.length === 0) problems.push("Itemise the loss – a single total is not enough.");
  for (const item of c.itemisedLoss) {
    if (!Number.isInteger(item.amountPence) || item.amountPence <= 0) problems.push(`"${item.description}" needs a positive amount.`);
  }
  return problems;
}

export function claimTotal(c: Pick<RecoveryClaimDraft, "itemisedLoss">): number {
  return c.itemisedLoss.reduce((s, i) => s + i.amountPence, 0);
}

/**
 * Painter undisputed amount: the agreed fee is payable when due regardless of
 * an open complaint or claim. Returned as-is – we deliberately do not subtract
 * customer refunds or claimed amounts (Dev Spec v2.0 §6, Master v3.0 cl. 3.13).
 */
export function undisputedPainterAmount(agreedFeePence: number, agreedVariationsPence = 0): number {
  return agreedFeePence + agreedVariationsPence;
}

export const ALTERNATIVE_CONTRACTOR_REASONS = [
  { id: "urgent_safety", label: "Urgent safety issue" },
  { id: "risk_of_further_damage", label: "Risk of further property damage" },
  { id: "abandonment", label: "Painter abandoned the job" },
  { id: "refusal", label: "Painter refused to engage" },
  { id: "no_response_after_notice", label: "No response after reasonable notice" },
  { id: "other_documented", label: "Other documented reason" },
] as const;
