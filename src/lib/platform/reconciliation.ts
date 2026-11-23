/**
 * RECONCILIATION – compares the app's records with Stripe, Sage, the bank
 * and HMRC and lists anything that doesn't agree. Flags always need an admin
 * to review them; nothing is "fixed" automatically.
 */

export interface Flag {
  area: "stripe" | "painter_payment" | "cis" | "cis_reserve" | "hmrc" | "sage" | "refund" | "recovery_claim";
  entityType?: string;
  entityId?: string;
  description: string;
  expectedPence?: number;
  foundPence?: number;
}

export interface MonthCheckInput {
  taxMonthStart: string;
  ledgerDeductedPence: number;
  reservedPence: number;
  paidToHmrcPence: number;
  returnStatus: string;
  paymentDueDate: string;
  returnDueDate: string;
}

/** CIS checks for one tax month. `today` is YYYY-MM-DD. */
export function checkCisMonth(m: MonthCheckInput, today: string): Flag[] {
  const flags: Flag[] = [];
  const id = m.taxMonthStart;
  if (m.reservedPence < m.ledgerDeductedPence) {
    flags.push({
      area: "cis_reserve",
      entityType: "tax_month",
      entityId: id,
      description: "Less has been moved into the CIS Tax Reserve account than was deducted from painters this month.",
      expectedPence: m.ledgerDeductedPence,
      foundPence: m.reservedPence,
    });
  }
  if (today > m.returnDueDate && !["submitted", "accepted_by_hmrc", "nil_return_submitted"].includes(m.returnStatus)) {
    flags.push({ area: "hmrc", entityType: "tax_month", entityId: id, description: "The monthly CIS return is overdue (due by the 19th)." });
  }
  if (today > m.paymentDueDate && m.paidToHmrcPence < m.ledgerDeductedPence) {
    flags.push({
      area: "hmrc",
      entityType: "tax_month",
      entityId: id,
      description: "CIS deducted this month has not all been paid to HMRC (due by the 22nd).",
      expectedPence: m.ledgerDeductedPence,
      foundPence: m.paidToHmrcPence,
    });
  }
  if (m.paidToHmrcPence > m.ledgerDeductedPence) {
    flags.push({
      area: "hmrc",
      entityType: "tax_month",
      entityId: id,
      description: "More has been recorded as paid to HMRC than the app's CIS ledger shows was deducted. Check for missing ledger entries or an overpayment.",
      expectedPence: m.ledgerDeductedPence,
      foundPence: m.paidToHmrcPence,
    });
  }
  return flags;
}

export interface PaymentRecord {
  id: string;
  status: string;
  netPence: number;
  bankPaymentReference: string | null;
  sageStatus: string | null; // from sage_sync_records
}

export function checkPainterPayments(payments: PaymentRecord[]): Flag[] {
  const flags: Flag[] = [];
  const refs = new Map<string, string>();
  for (const p of payments) {
    if (p.bankPaymentReference && ["paid_awaiting_reconciliation", "paid_confirmed"].includes(p.status)) {
      const key = p.bankPaymentReference.trim().toUpperCase();
      const other = refs.get(key);
      if (other) {
        flags.push({
          area: "painter_payment",
          entityType: "painter_payment",
          entityId: p.id,
          description: `Bank reference "${p.bankPaymentReference}" is also used on another payment – possible duplicate transfer.`,
        });
      }
      refs.set(key, p.id);
    }
    if (p.status === "paid_awaiting_reconciliation" && p.sageStatus === "failed") {
      flags.push({ area: "sage", entityType: "painter_payment", entityId: p.id, description: "The payment could not be recorded in Sage." });
    }
  }
  return flags;
}

export interface StripePaymentRecord {
  enquiryId: string | null;
  amountPence: number;
  expectedPence: number | null;
  outcome: string;
}

export function checkStripePayments(rows: StripePaymentRecord[]): Flag[] {
  return rows.flatMap((r): Flag[] => {
    if (r.outcome === "needs_review")
      return [{ area: "stripe", entityType: "enquiry", entityId: r.enquiryId ?? undefined, description: "A Stripe payment needs review (wrong amount or unmatched)." }];
    if (r.expectedPence !== null && r.amountPence !== r.expectedPence && r.outcome === "deposit_recorded")
      return [
        {
          area: "stripe",
          entityType: "enquiry",
          entityId: r.enquiryId ?? undefined,
          description: "Stripe amount differs from the amount requested.",
          expectedPence: r.expectedPence,
          foundPence: r.amountPence,
        },
      ];
    return [];
  });
}
