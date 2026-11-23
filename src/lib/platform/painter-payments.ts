/**
 * PAINTER PAYMENTS – manual bank transfer workflow
 *
 *  Awaiting invoice → Invoice submitted → Awaiting admin approval →
 *  Approved – awaiting bank transfer → Paid – awaiting reconciliation →
 *  Paid – confirmed
 *
 * Nothing here moves money. You make the transfer in your bank, then record
 * the reference. A payment is never marked paid just because a screen opened.
 * There is NO commercial deduction or set-off in this release: the only thing
 * ever taken off is the statutory CIS deduction.
 */

export const PAINTER_PAYMENT_STATUSES = [
  { id: "awaiting_invoice", label: "Awaiting invoice" },
  { id: "invoice_submitted", label: "Invoice submitted" },
  { id: "awaiting_admin_approval", label: "Awaiting admin approval" },
  { id: "approved_awaiting_transfer", label: "Approved – awaiting bank transfer" },
  { id: "paid_awaiting_reconciliation", label: "Paid – awaiting reconciliation" },
  { id: "paid_confirmed", label: "Paid – confirmed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export type PainterPaymentStatus = (typeof PAINTER_PAYMENT_STATUSES)[number]["id"];

export function paymentStatusLabel(status: string): string {
  return PAINTER_PAYMENT_STATUSES.find((s) => s.id === status)?.label ?? status;
}

/** Statuses stored on painter_payments rows (the first two are derived from the job/invoice). */
const STORED_ORDER: PainterPaymentStatus[] = [
  "awaiting_admin_approval",
  "approved_awaiting_transfer",
  "paid_awaiting_reconciliation",
  "paid_confirmed",
];

export interface ApprovalContext {
  cisGateApproved: boolean;
  painterOnboardingApproved: boolean;
  engagementRoute: string;
  hasCisVerification: boolean;
}

/** Reasons a payment can't be approved yet (empty array = OK to approve). */
export function approvalBlockers(ctx: ApprovalContext): string[] {
  const reasons: string[] = [];
  if (!ctx.cisGateApproved) reasons.push("Your accountant hasn't signed off the CIS set-up approval gate yet (Admin → Approvals).");
  if (!ctx.painterOnboardingApproved) reasons.push("This painter's onboarding hasn't been approved.");
  if (ctx.engagementRoute !== "independent_business")
    reasons.push("This engagement is marked for an employment-status review. Get advice before paying – no deductions may be made.");
  if (!ctx.hasCisVerification) reasons.push("No HMRC CIS verification is recorded for this painter.");
  return reasons;
}

export function canMoveTo(from: PainterPaymentStatus, to: PainterPaymentStatus): boolean {
  if (from === "cancelled") return false;
  if (to === "cancelled") return from === "awaiting_admin_approval" || from === "approved_awaiting_transfer";
  const a = STORED_ORDER.indexOf(from);
  const b = STORED_ORDER.indexOf(to);
  return a >= 0 && b === a + 1;
}

export interface TransferRecord {
  bankPaymentReference: string;
  transferDate: string; // YYYY-MM-DD
  confirmedTransferMade: boolean; // admin ticked "I have made this transfer in our bank"
}

/** Validates what an admin enters after making the bank transfer. Returns an error message or null. */
export function validateTransfer(t: TransferRecord, today: string): string | null {
  if (!t.confirmedTransferMade) return "Tick the box to confirm you have actually made this transfer in your bank.";
  if (t.bankPaymentReference.trim().length < 3) return "Enter the payment reference used in your bank.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.transferDate)) return "Enter the date the transfer was made.";
  if (t.transferDate > today) return "The transfer date can't be in the future.";
  return null;
}

/** Due date = invoice date + agreed payment days (from the accepted job record). */
export function paymentDueDate(invoiceDate: string, paymentDueDays: number): string {
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + paymentDueDays);
  return d.toISOString().slice(0, 10);
}
