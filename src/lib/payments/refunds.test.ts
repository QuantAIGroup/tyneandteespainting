import { describe, expect, it } from "vitest";
import { checkRefundRequest, isActiveRefund, refundablePence } from "./refunds";

describe("refund rules", () => {
  const base = { paid: true, paidPence: 37550, refunds: [], amountPence: 37550, note: "Cancelled more than 48 hours before" };
  it("allows a full refund of a paid booking", () => expect(checkRefundRequest(base)).toEqual({ ok: true, amountPence: 37550 }));
  it("allows a partial refund (e.g. late cancellation with evidenced costs)", () => expect(checkRefundRequest({ ...base, amountPence: 30000 })).toEqual({ ok: true, amountPence: 30000 }));
  it("refuses more than was paid", () => expect(checkRefundRequest({ ...base, amountPence: 37551 }).ok).toBe(false));
  it("refuses more than is left after earlier refunds", () => {
    const r = checkRefundRequest({ ...base, refunds: [{ amount_pence: 30000, status: "succeeded" }], amountPence: 8000 });
    expect(r.ok).toBe(false);
    expect(checkRefundRequest({ ...base, refunds: [{ amount_pence: 30000, status: "succeeded" }], amountPence: 7550 }).ok).toBe(true);
  });
  it("pending refunds count; failed or cancelled ones don't", () => {
    expect(refundablePence(37550, [{ amount_pence: 10000, status: "pending" }, { amount_pence: 5000, status: "failed" }, { amount_pence: 1000, status: "canceled" }])).toBe(27550);
    expect(isActiveRefund("requires_action")).toBe(true);
  });
  it("refuses an unpaid booking, zero, negative or fractional amounts, and a missing reason", () => {
    expect(checkRefundRequest({ ...base, paid: false }).ok).toBe(false);
    expect(checkRefundRequest({ ...base, amountPence: 0 }).ok).toBe(false);
    expect(checkRefundRequest({ ...base, amountPence: -5 }).ok).toBe(false);
    expect(checkRefundRequest({ ...base, amountPence: 1.5 }).ok).toBe(false);
    expect(checkRefundRequest({ ...base, amountPence: null }).ok).toBe(false);
    expect(checkRefundRequest({ ...base, note: " " }).ok).toBe(false);
  });
  it("refuses when already refunded in full", () => expect(checkRefundRequest({ ...base, refunds: [{ amount_pence: 37550, status: "succeeded" }] }).ok).toBe(false));
});
