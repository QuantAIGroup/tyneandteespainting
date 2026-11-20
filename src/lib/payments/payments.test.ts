import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { calculateDeposit, calculatePaymentRequest, outstandingBalance, parsePoundsToPence, paymentLabel } from "./deposit";
import { canSetStatusManually, decideDepositOutcome, manualStatusOptions, type EnquiryPaymentState } from "./booking";
import { generatePaymentToken, isValidPaymentToken, verifyStripeWebhook } from "./stripe";

describe("50% deposit calculation", () => {
  it.each([
    [20000, 10000],
    [30000, 15000],
    [40000, 20000],
    [50000, 25000],
    [60000, 30000],
  ])("£%i pence job → %i pence deposit", (price, deposit) => {
    const r = calculateDeposit(price);
    expect(r.depositPence).toBe(deposit);
    expect(r.balancePence).toBe(price - deposit);
  });

  it("puts an odd penny on the deposit so the parts add up exactly", () => {
    expect(calculateDeposit(20001)).toEqual({ depositPence: 10001, balancePence: 10000 });
    expect(calculateDeposit(1)).toEqual({ depositPence: 1, balancePence: 0 });
  });

  it("matches the database rule deposit = (price + 1) / 2 using integer division", () => {
    for (const price of [1, 2, 99, 100, 101, 33333, 78250, 5000000]) {
      expect(calculateDeposit(price).depositPence).toBe(Math.floor((price + 1) / 2));
    }
  });

  it("rejects non-integer, zero or negative prices", () => {
    expect(() => calculateDeposit(0)).toThrow();
    expect(() => calculateDeposit(-100)).toThrow();
    expect(() => calculateDeposit(100.5)).toThrow();
  });
});

describe("parsing the agreed price typed in admin", () => {
  it("accepts normal amounts", () => {
    expect(parsePoundsToPence("400")).toBe(40000);
    expect(parsePoundsToPence("£400")).toBe(40000);
    expect(parsePoundsToPence("1,250.50")).toBe(125050);
    expect(parsePoundsToPence("199.9")).toBe(19990);
    expect(parsePoundsToPence(" 0.01 ")).toBe(1);
  });

  it("avoids floating point errors", () => {
    expect(parsePoundsToPence("0.29")).toBe(29); // 0.29 * 100 = 28.999… in floating point
    expect(parsePoundsToPence("1.15")).toBe(115);
  });

  it("rejects nonsense, zero, negatives, too many decimals and huge amounts", () => {
    for (const bad of ["", "abc", "0", "-50", "10.999", "1e5", "50000.01", "£", "12.3.4"]) {
      expect(parsePoundsToPence(bad)).toBeNull();
    }
  });
});

describe("outstanding balance", () => {
  it("is agreed price minus what has been paid", () => {
    expect(outstandingBalance({ agreedPricePence: 40000, depositPaidPence: null, balancePaidPence: null })).toBe(40000);
    expect(outstandingBalance({ agreedPricePence: 40000, depositPaidPence: 20000, balancePaidPence: null })).toBe(20000);
    expect(outstandingBalance({ agreedPricePence: 40000, depositPaidPence: 20000, balancePaidPence: 20000 })).toBe(0);
    expect(outstandingBalance({ agreedPricePence: null, depositPaidPence: null, balancePaidPence: null })).toBeNull();
  });
});

describe("booking status rules", () => {
  it("never offers 'deposit paid' as a manual choice", () => {
    expect(manualStatusOptions({ status: "deposit_requested", depositPaid: false })).not.toContain("deposit_paid");
    expect(manualStatusOptions({ status: "deposit_paid", depositPaid: true })).toContain("deposit_paid"); // only as the current value
    expect(canSetStatusManually("deposit_paid", { status: "deposit_requested", depositPaid: false })).toBe(false);
  });

  it("does not allow confirming a booking before a verified deposit", () => {
    for (const s of ["booking_confirmed", "work_completed", "balance_paid"]) {
      expect(canSetStatusManually(s, { status: "deposit_requested", depositPaid: false })).toBe(false);
      expect(canSetStatusManually(s, { status: "deposit_paid", depositPaid: true })).toBe(true);
    }
  });

  it("does not allow skipping the price/deposit buttons", () => {
    expect(canSetStatusManually("price_agreed", { status: "awaiting_consultation", depositPaid: false })).toBe(false);
    expect(canSetStatusManually("deposit_requested", { status: "price_agreed", depositPaid: false })).toBe(false);
  });
});

describe("deciding what to do with a Stripe payment", () => {
  const requested: EnquiryPaymentState = { id: "e1", status: "deposit_requested", depositPence: 20000, depositPaidAt: null, stripePaymentIntentId: null };
  const payment = { amountPence: 20000, currency: "gbp", paymentIntentId: "pi_1" };

  it("marks the deposit paid when everything matches", () => {
    expect(decideDepositOutcome(requested, payment)).toEqual({ action: "mark_paid" });
  });

  it("ignores the same payment being reported twice", () => {
    expect(decideDepositOutcome({ ...requested, status: "deposit_paid", depositPaidAt: "2026-11-19", stripePaymentIntentId: "pi_1" }, payment).action).toBe("already_recorded");
  });

  it("refunds a second, duplicate deposit", () => {
    expect(decideDepositOutcome({ ...requested, status: "deposit_paid", depositPaidAt: "2026-11-19", stripePaymentIntentId: "pi_1" }, { ...payment, paymentIntentId: "pi_2" }).action).toBe("refund_duplicate");
  });

  it("does not mark paid if the amount or currency is wrong", () => {
    expect(decideDepositOutcome(requested, { ...payment, amountPence: 19999 }).action).toBe("needs_review");
    expect(decideDepositOutcome(requested, { ...payment, currency: "eur" }).action).toBe("needs_review");
  });

  it("does not mark paid if no deposit was requested", () => {
    expect(decideDepositOutcome({ ...requested, status: "cancelled" }, payment).action).toBe("needs_review");
    expect(decideDepositOutcome(null, payment).action).toBe("needs_review");
  });
});

describe("Stripe webhook signature check", () => {
  const stripe = new Stripe("sk_test_dummy");
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: {} } });

  it("accepts a correctly signed event", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(verifyStripeWebhook(stripe, payload, header, secret).id).toBe("evt_1");
  });

  it("rejects a forged, altered or unsigned event", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect(() => verifyStripeWebhook(stripe, payload, header, secret)).toThrow();
    const good = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect(() => verifyStripeWebhook(stripe, payload.replace("evt_1", "evt_2"), good, secret)).toThrow();
    expect(() => verifyStripeWebhook(stripe, payload, null, secret)).toThrow();
  });
});

describe("payment link tokens", () => {
  it("are long, random and URL-safe", () => {
    const a = generatePaymentToken();
    const b = generatePaymentToken();
    expect(a).not.toBe(b);
    expect(isValidPaymentToken(a)).toBe(true);
    expect(isValidPaymentToken("short")).toBe(false);
    expect(isValidPaymentToken("../../etc/passwd-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});

describe("configurable payment requests", () => {
  it("defaults to a 50% deposit and matches the brief's examples", () => {
    for (const [price, dep] of [[20000, 10000], [30000, 15000], [40000, 20000], [50000, 25000], [60000, 30000]]) {
      expect(calculatePaymentRequest({ agreedPricePence: price, type: "deposit" })?.amountPence).toBe(dep);
    }
  });

  it("supports other deposit percentages, rounding any part-penny up", () => {
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "deposit", depositPercent: 25 })).toEqual({ amountPence: 10000, balancePence: 30000, depositPercent: 25 });
    expect(calculatePaymentRequest({ agreedPricePence: 33333, type: "deposit", depositPercent: 30 })?.amountPence).toBe(10000); // 9999.9 → 10000
    expect(calculateDeposit(33333, 30).depositPence).toBe(Math.floor((33333 * 30 + 99) / 100));
  });

  it("supports full payment", () => {
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "full" })).toEqual({ amountPence: 40000, balancePence: 0, depositPercent: null });
  });

  it("supports a custom amount between 1p and the agreed price", () => {
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "custom", customAmountPence: 15000 })?.balancePence).toBe(25000);
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "custom", customAmountPence: 40001 })).toBeNull();
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "custom", customAmountPence: 0 })).toBeNull();
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "custom", customAmountPence: null })).toBeNull();
  });

  it("rejects invalid percentages", () => {
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "deposit", depositPercent: 0 })).toBeNull();
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "deposit", depositPercent: 101 })).toBeNull();
    expect(calculatePaymentRequest({ agreedPricePence: 40000, type: "deposit", depositPercent: 12.5 })).toBeNull();
  });

  it("labels payments clearly", () => {
    expect(paymentLabel("deposit", 50)).toBe("Booking deposit (50%)");
    expect(paymentLabel("full")).toBe("Full payment");
  });
});
