/**
 * CONSTRUCTION INDUSTRY SCHEME (CIS) – calculations
 *
 * Plain rules (Master Legal Pack v3.0 section 9, HMRC CIS guidance):
 *  • The rate ALWAYS comes from an HMRC verification you have recorded:
 *      gross payment status → 0%, standard (registered) → 20%, higher (unregistered/unmatched) → 30%.
 *    The app never guesses a rate, and a UTR on its own proves nothing.
 *  • The deduction is taken from the LABOUR part only. Eligible materials the
 *    painter bought for the job, and VAT, are excluded.
 *  • Deductions are rounded DOWN to the penny. ⚠️ Your accountant must confirm
 *    this (and the labour/materials split) before the CIS approval gate is signed.
 *  • CIS deductions are tax paid on the painter's behalf. They are NOT company
 *    income, and they are completely separate from complaint/recovery claims.
 *
 * The database recalculates and enforces the same maths (painter_payments
 * check constraints), so a wrong figure can never be saved.
 */

export type CisStatus = "gross" | "standard" | "higher";

export const CIS_RATES: Record<CisStatus, number> = { gross: 0, standard: 20, higher: 30 };

export const CIS_STATUS_LABELS: Record<CisStatus, string> = {
  gross: "Gross payment status (0%)",
  standard: "Registered – standard rate (20%)",
  higher: "Unregistered / not matched – higher rate (30%)",
};

export interface CisVerification {
  id: string;
  painterBusinessId: string;
  deductionStatus: CisStatus;
  ratePercent: number;
  hmrcVerificationReference: string;
  verifiedOn: string; // YYYY-MM-DD
}

export interface PaymentInput {
  labourPence: number;
  materialsPence: number; // eligible materials only
  vatPence: number;
}

export interface PaymentBreakdown {
  labourPence: number;
  materialsPence: number;
  grossPence: number; // labour + materials (excluding VAT)
  vatPence: number;
  cisRatePercent: number;
  cisDeductionPence: number;
  netPence: number; // what you transfer to the painter
}

function assertPence(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number of pence, 0 or more`);
}

/** Checks that a verification is internally consistent (status ↔ rate). */
export function isValidVerification(v: Pick<CisVerification, "deductionStatus" | "ratePercent" | "hmrcVerificationReference">): boolean {
  return CIS_RATES[v.deductionStatus] === v.ratePercent && v.hmrcVerificationReference.trim().length >= 4;
}

/** Works out the CIS deduction and net payment. Throws if there is no valid verification. */
export function calculateCisPayment(input: PaymentInput, verification: CisVerification | null): PaymentBreakdown {
  assertPence("Labour", input.labourPence);
  assertPence("Materials", input.materialsPence);
  assertPence("VAT", input.vatPence);
  if (input.labourPence + input.materialsPence <= 0) throw new Error("The invoice must have a labour or materials amount");
  if (!verification) {
    throw new Error("No HMRC CIS verification is recorded for this painter. Verify them in Sage or with HMRC first – the app never guesses a rate.");
  }
  if (!isValidVerification(verification)) throw new Error("The recorded CIS verification is inconsistent (status and rate don't match)");

  const rate = verification.ratePercent;
  const cisDeductionPence = Math.floor((input.labourPence * rate) / 100);
  const grossPence = input.labourPence + input.materialsPence;
  return {
    labourPence: input.labourPence,
    materialsPence: input.materialsPence,
    grossPence,
    vatPence: input.vatPence,
    cisRatePercent: rate,
    cisDeductionPence,
    netPence: grossPence + input.vatPence - cisDeductionPence,
  };
}

// ---------------------------------------------------------------------
// Tax months: CIS tax months run from the 6th of one month to the 5th of
// the next. Returns are due by the 19th and electronic payments by the 22nd
// after the end of the tax month.
// ---------------------------------------------------------------------

function parseDate(d: string): { y: number; m: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!match) throw new Error(`Invalid date: ${d}`);
  return { y: Number(match[1]), m: Number(match[2]), day: Number(match[3]) };
}
function fmt(y: number, m: number, day: number): string {
  const date = new Date(Date.UTC(y, m - 1, day));
  return date.toISOString().slice(0, 10);
}

/** First day (the 6th) of the CIS tax month containing this date. */
export function taxMonthStart(date: string): string {
  const { y, m, day } = parseDate(date);
  return day >= 6 ? fmt(y, m, 6) : fmt(y, m - 1, 6);
}

export interface TaxMonthDates {
  start: string;
  end: string;
  returnDue: string;
  paymentDue: string;
  label: string;
}

export function taxMonthDates(start: string): TaxMonthDates {
  const { y, m, day } = parseDate(start);
  if (day !== 6) throw new Error("A CIS tax month starts on the 6th");
  const label = new Date(Date.UTC(y, m - 1, 6)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const endLabel = new Date(Date.UTC(y, m, 5)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  return {
    start,
    end: fmt(y, m + 1, 5),
    returnDue: fmt(y, m + 1, 19),
    paymentDue: fmt(y, m + 1, 22),
    label: `6 ${label} – 5 ${endLabel}`,
  };
}

/** UK tax year label for a date, e.g. "2026/27" (tax year starts 6 April). */
export function taxYear(date: string): string {
  const { y, m, day } = parseDate(date);
  const startYear = m > 4 || (m === 4 && day >= 6) ? y : y - 1;
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------
// Reserve dashboard summary
// ---------------------------------------------------------------------
export interface MonthTotals {
  taxMonthStart: string;
  deductedPence: number;
  reservedPence: number;
  paidToHmrcPence: number;
}

export interface ReserveSummary {
  totalDeductedPence: number;
  totalReservedPence: number;
  totalPaidToHmrcPence: number;
  outstandingLiabilityPence: number; // deducted − paid to HMRC
  reserveShortfallPence: number; // outstanding liability not yet moved into the reserve account
}

export function summariseReserve(months: MonthTotals[]): ReserveSummary {
  const totalDeductedPence = months.reduce((s, m) => s + m.deductedPence, 0);
  const totalReservedPence = months.reduce((s, m) => s + m.reservedPence, 0);
  const totalPaidToHmrcPence = months.reduce((s, m) => s + m.paidToHmrcPence, 0);
  const outstandingLiabilityPence = totalDeductedPence - totalPaidToHmrcPence;
  const reserveBalance = totalReservedPence - totalPaidToHmrcPence;
  return {
    totalDeductedPence,
    totalReservedPence,
    totalPaidToHmrcPence,
    outstandingLiabilityPence,
    reserveShortfallPence: Math.max(0, outstandingLiabilityPence - reserveBalance),
  };
}
