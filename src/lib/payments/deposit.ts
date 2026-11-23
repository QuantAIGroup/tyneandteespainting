/**
 * PAYMENT RULES
 *
 * Customers pay 100% of the FINAL AGREED PRICE (never the online estimate),
 * and only after the price has been agreed with them. A successful payment
 * confirms the booking.
 *
 * The deposit/custom maths below is kept only so that any older payment
 * request made under the previous 50% deposit arrangement still displays and
 * reconciles correctly. New payment requests are always "full".
 *
 * Plain functions (no website or database code) so they can be unit tested.
 * All money is whole PENCE – never floating-point pounds.
 */

/** Every new payment request is for the full agreed price. */
export const NEW_PAYMENT_TYPE = "full" as const;

/** Deposit percentage used by older (pre-November 2026) deposit requests only. */
export const DEFAULT_DEPOSIT_PERCENT = 50;

export type PaymentType = "deposit" | "full" | "custom";

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: "Booking deposit",
  full: "Full payment",
  custom: "Payment",
};

/**
 * The payment to request for a new booking: 100% of the agreed price.
 * Returns null if the agreed price isn't a valid amount.
 */
export function fullPaymentRequest(agreedPricePence: number): { amountPence: number; balancePence: number; depositPercent: null } | null {
  const r = calculatePaymentRequest({ agreedPricePence, type: NEW_PAYMENT_TYPE });
  return r ? { amountPence: r.amountPence, balancePence: 0, depositPercent: null } : null;
}

/** Largest job price the admin can enter (£50,000) – a guard against typos. */
export const MAX_AGREED_PRICE_PENCE = 50_000_00;

/**
 * Booking deposit = agreed price × percent ÷ 100, in whole pence (50% by default).
 * Any fraction of a penny is rounded UP onto the deposit
 * (e.g. 50% of £200.01 → £100.01 deposit + £100.00 balance), so deposit + balance
 * always adds up to the agreed price exactly. Integer maths only – the database
 * uses the identical formula: (price × percent + 99) ÷ 100.
 */
export function calculateDeposit(agreedPricePence: number, percent: number = DEFAULT_DEPOSIT_PERCENT): { depositPence: number; balancePence: number } {
  if (!Number.isInteger(agreedPricePence) || agreedPricePence <= 0) {
    throw new Error("Agreed price must be a positive whole number of pence");
  }
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) throw new Error("Deposit percentage must be a whole number from 1 to 100");
  const depositPence = Math.floor((agreedPricePence * percent + 99) / 100);
  return { depositPence, balancePence: agreedPricePence - depositPence };
}

/**
 * Works out how much to ask the customer to pay now.
 *  - deposit: percent of the agreed price
 *  - full:    the whole agreed price
 *  - custom:  an amount you type (must be between 1p and the agreed price)
 * Returns null if the request isn't valid.
 */
export function calculatePaymentRequest(input: {
  agreedPricePence: number;
  type: PaymentType;
  depositPercent?: number;
  customAmountPence?: number | null;
}): { amountPence: number; balancePence: number; depositPercent: number | null } | null {
  const { agreedPricePence, type } = input;
  if (!Number.isInteger(agreedPricePence) || agreedPricePence <= 0 || agreedPricePence > MAX_AGREED_PRICE_PENCE) return null;
  if (type === "full") return { amountPence: agreedPricePence, balancePence: 0, depositPercent: null };
  if (type === "deposit") {
    const pct = input.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) return null;
    const d = calculateDeposit(agreedPricePence, pct);
    return { amountPence: d.depositPence, balancePence: d.balancePence, depositPercent: pct };
  }
  const custom = input.customAmountPence;
  if (custom === null || custom === undefined || !Number.isInteger(custom) || custom < 1 || custom > agreedPricePence) return null;
  return { amountPence: custom, balancePence: agreedPricePence - custom, depositPercent: null };
}

/** e.g. "Booking deposit (50%)", "Full payment", "Payment" */
export function paymentLabel(type: PaymentType | string | null | undefined, percent?: number | null): string {
  if (type === "full") return PAYMENT_TYPE_LABELS.full;
  if (type === "custom") return PAYMENT_TYPE_LABELS.custom;
  return percent ? `${PAYMENT_TYPE_LABELS.deposit} (${percent}%)` : PAYMENT_TYPE_LABELS.deposit;
}

/**
 * Turns what the admin typed ("400", "£400", "1,250.50") into pence, without
 * any floating-point maths. Returns null if it isn't a valid amount.
 */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "");
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const pounds = Number(match[1]);
  const pence = Number((match[2] ?? "").padEnd(2, "0"));
  const total = pounds * 100 + pence;
  if (total <= 0 || total > MAX_AGREED_PRICE_PENCE) return null;
  return total;
}

/** Outstanding = agreed price − deposit paid − balance paid (never below zero). */
export function outstandingBalance(b: { agreedPricePence: number | null; depositPaidPence: number | null; balancePaidPence: number | null }): number | null {
  if (b.agreedPricePence === null) return null;
  return Math.max(0, b.agreedPricePence - (b.depositPaidPence ?? 0) - (b.balancePaidPence ?? 0));
}

/** The customer-facing "thank you" headline after a verified payment. */
export function paidHeadline(type: PaymentType | string | null | undefined, percent?: number | null): string {
  if (type === "full") return "Thank you! Your payment has been received in full and your booking is confirmed.";
  if (type === "custom") return "Thank you! Your payment has been received.";
  return `Thank you! Your ${percent ?? DEFAULT_DEPOSIT_PERCENT}% booking deposit has been received.`;
}
