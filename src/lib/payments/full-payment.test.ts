/**
 * 100% payment of the FINAL AGREED price (November 2026 change).
 */
import { describe, expect, it } from "vitest";
import { canSetStatusManually, decideDepositOutcome, manualStatusOptions, statusAfterVerifiedPayment, type EnquiryPaymentState } from "./booking";
import { MAX_AGREED_PRICE_PENCE, NEW_PAYMENT_TYPE, fullPaymentRequest, paidHeadline, paymentLabel } from "./deposit";
import { CANCELLATION_POLICY, CANCELLATION_SUMMARY, COOLING_OFF_DAYS, MODEL_FORM_LINES } from "@/config/cancellation";

describe("full payment calculation", () => {
  it("new payment requests are always for the full price", () => {
    expect(NEW_PAYMENT_TYPE).toBe("full");
  });

  it("asks for 100% of the agreed price with nothing left to pay", () => {
    expect(fullPaymentRequest(40000)).toEqual({ amountPence: 40000, balancePence: 0, depositPercent: null });
    expect(fullPaymentRequest(37551)).toEqual({ amountPence: 37551, balancePence: 0, depositPercent: null }); // odd pence: no rounding
  });

  it("uses the final agreed price, not the online estimate", () => {
    const estimatePence = 34000;
    const agreedPricePence = 37550; // agreed on the phone after seeing the photos
    const request = fullPaymentRequest(agreedPricePence)!;
    expect(request.amountPence).toBe(agreedPricePence);
    expect(request.amountPence).not.toBe(estimatePence);
  });

  it("rejects invalid agreed prices", () => {
    expect(fullPaymentRequest(0)).toBeNull();
    expect(fullPaymentRequest(-100)).toBeNull();
    expect(fullPaymentRequest(123.5)).toBeNull();
    expect(fullPaymentRequest(MAX_AGREED_PRICE_PENCE + 1)).toBeNull();
  });

  it("labels and thank-you message", () => {
    expect(paymentLabel("full")).toBe("Full payment");
    expect(paidHeadline("full")).toMatch(/received in full and your booking is confirmed/);
  });
});

describe("payment status after a verified Stripe payment", () => {
  it("full payment confirms the booking", () => {
    expect(statusAfterVerifiedPayment("full")).toBe("booking_confirmed");
  });

  it("older deposit payments still go to 'Payment received'", () => {
    expect(statusAfterVerifiedPayment("deposit")).toBe("deposit_paid");
  });

  const booking: EnquiryPaymentState = { id: "e1", status: "deposit_requested", depositPence: 37550, depositPaidAt: null, stripePaymentIntentId: null };
  const pay = (amountPence: number, extra: Partial<{ currency: string; paymentIntentId: string }> = {}) => ({ amountPence, currency: "gbp", paymentIntentId: "pi_1", ...extra });

  it("marks paid only when the full agreed amount is received", () => {
    expect(decideDepositOutcome(booking, pay(37550))).toEqual({ action: "mark_paid" });
  });

  it("does not mark paid if only the estimate (or half) was paid", () => {
    expect(decideDepositOutcome(booking, pay(34000)).action).toBe("needs_review");
    expect(decideDepositOutcome(booking, pay(18775)).action).toBe("needs_review");
  });

  it("refunds a second payment and ignores a repeat of the same payment", () => {
    const paid = { ...booking, status: "booking_confirmed", depositPaidAt: "2026-11-23T12:00:00Z", stripePaymentIntentId: "pi_1" };
    expect(decideDepositOutcome(paid, pay(37550)).action).toBe("already_recorded");
    expect(decideDepositOutcome(paid, pay(37550, { paymentIntentId: "pi_2" })).action).toBe("refund_duplicate");
  });

  it("needs the cancellation policy to have been confirmed (when the webhook supplies it)", () => {
    expect(decideDepositOutcome({ ...booking, termsAcceptedAt: null }, pay(37550)).action).toBe("needs_review");
    expect(decideDepositOutcome({ ...booking, termsAcceptedAt: "2026-11-23T12:00:00Z", paymentType: "full", agreedPricePence: 37550 }, pay(37550)).action).toBe("mark_paid");
  });

  it("flags wrong currency and payments for withdrawn requests", () => {
    expect(decideDepositOutcome(booking, pay(37550, { currency: "eur" })).action).toBe("needs_review");
    expect(decideDepositOutcome({ ...booking, status: "price_agreed" }, pay(37550)).action).toBe("needs_review");
  });
});

describe("admin status menu after full payment", () => {
  it("offers no 'Balance paid' step when nothing is owed", () => {
    expect(manualStatusOptions({ status: "booking_confirmed", depositPaid: true, balanceDue: false })).not.toContain("balance_paid");
    expect(canSetStatusManually("balance_paid", { status: "booking_confirmed", depositPaid: true, balanceDue: false })).toBe(false);
    expect(canSetStatusManually("work_completed", { status: "booking_confirmed", depositPaid: true, balanceDue: false })).toBe(true);
  });

  it("still blocks confirming a booking before payment", () => {
    expect(canSetStatusManually("booking_confirmed", { status: "deposit_requested", depositPaid: false, balanceDue: true })).toBe(false);
  });
});

describe("cancellation and refund information", () => {
  const all = [...CANCELLATION_POLICY.map((p) => `${p.title} ${p.text}`), ...CANCELLATION_SUMMARY].join(" ");

  it("covers every point of the policy", () => {
    expect(COOLING_OFF_DAYS).toBe(14);
    expect(all).toMatch(/14 days/);
    expect(all).toMatch(/more than 48 hours before.*full refund/i);
    expect(all).toMatch(/less than 48 hours/i);
    expect(all).toMatch(/reasonable, evidenced direct losses or costs/i);
    expect(all).toMatch(/If Tyne & Tees Painting cancels your booking, you receive a full refund/);
    expect(all).toMatch(/only for work properly completed/i);
    expect(all).toMatch(/through Stripe to the card or payment method you originally used/i);
    expect(all).toMatch(/expressly asked us to start work/i);
  });

  it("never describes payments as non-refundable", () => {
    expect(all).not.toMatch(/non-refundable/i);
  });

  it("includes the statutory model cancellation form wording for services", () => {
    expect(MODEL_FORM_LINES[0]).toContain("for the supply of the following service");
    expect(MODEL_FORM_LINES).toContain("Date");
  });
});

describe("Stripe checkout helper refuses anything but 100% with consent", async () => {
  const { createDepositCheckout } = await import("./checkout");
  const base = {
    enquiryId: "e", reference: "R", token: "t", customerEmail: "a@b.c", agreedService: "Work", agreedPricePence: 37550, depositPence: 37550,
    businessName: "B", paymentType: "full" as const, depositPercent: null, termsAcceptedAt: "2026-11-23T12:00:00Z", requestVersion: "1", previousSessionId: null,
  };
  const calls: unknown[] = [];
  const stripe = { checkout: { sessions: { create: async (p: unknown) => { calls.push(p); return { id: "cs" }; } } } } as unknown as Parameters<typeof createDepositCheckout>[0];

  it.each([
    ["a part payment", { depositPence: 18775 }],
    ["an old-style deposit", { paymentType: "deposit" as const, depositPence: 18775, depositPercent: 50 }],
    ["no agreed price", { agreedPricePence: 0, depositPence: 0 }],
    ["no recorded consent", { termsAcceptedAt: null }],
  ])("refuses %s", async (_label, change) => {
    await expect(createDepositCheckout(stripe, { ...base, ...change })).rejects.toThrow(/Refusing/);
    expect(calls).toHaveLength(0);
  });

  it("creates a session for exactly the agreed price", async () => {
    await createDepositCheckout(stripe, base);
    expect(calls).toHaveLength(1);
  });
});
