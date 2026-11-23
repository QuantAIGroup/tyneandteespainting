import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, canSetStatusManually, manualStatusOptions } from "./booking";
import { STATUS_TRANSITIONS, allowedTransitionKeys, canChangeStatus } from "./status-transitions";

const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/20261123170000_price_revision_full_payment.sql"), "utf8");
const sqlArray = (name: string) => {
  const m = sql.match(new RegExp(`${name} constant text\\[\\] := array\\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`${name} not found in the migration`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};
const ALL = BOOKING_STATUSES.map((s) => s.id);

describe("booking status changes – app and database agree", () => {
  it("the database allows exactly the same status changes as the app", () => {
    expect([...sqlArray("allowed_transitions")].sort()).toEqual([...allowedTransitionKeys()].sort());
  });

  it("the database knows exactly the same nine statuses as the app", () => {
    expect([...sqlArray("known_statuses")].sort()).toEqual([...ALL].sort());
  });
});

describe("booking status changes – rules", () => {
  it("a paid booking can never return to an unpaid status", () => {
    for (const from of ALL) for (const to of ["awaiting_consultation", "price_agreed", "deposit_requested", "declined"]) {
      if (from !== to) expect(canChangeStatus("paid", from, to)).toBe(false);
    }
  });

  it("an unpaid booking can never be confirmed, completed or marked paid without a payment", () => {
    for (const from of ALL) for (const to of ["deposit_paid", "booking_confirmed", "work_completed", "balance_paid"]) {
      if (from !== to) expect(canChangeStatus("unpaid", from, to)).toBe(false);
    }
  });

  it("a payment can only confirm a booking that is awaiting payment", () => {
    for (const from of ALL) for (const to of ALL) {
      expect(canChangeStatus("payment", from, to)).toBe(from === "deposit_requested" && to === "booking_confirmed");
    }
  });

  it("the old deposit-era statuses can't be entered", () => {
    for (const kind of ["unpaid", "payment", "paid"] as const) for (const from of ALL) {
      if (from !== "deposit_paid") expect(canChangeStatus(kind, from, "deposit_paid")).toBe(false);
      if (from !== "balance_paid") expect(canChangeStatus(kind, from, "balance_paid")).toBe(false);
    }
  });

  it("a cancelled paid booking is final", () => {
    for (const to of ALL) if (to !== "cancelled") expect(canChangeStatus("paid", "cancelled", to)).toBe(false);
  });

  it("legitimate admin actions are still allowed", () => {
    expect(canSetStatusManually("work_completed", { status: "booking_confirmed", depositPaid: true })).toBe(true);
    expect(canSetStatusManually("cancelled", { status: "booking_confirmed", depositPaid: true })).toBe(true);
    expect(canSetStatusManually("booking_confirmed", { status: "work_completed", depositPaid: true })).toBe(true);
    expect(canSetStatusManually("cancelled", { status: "work_completed", depositPaid: true })).toBe(true);
    expect(canSetStatusManually("declined", { status: "awaiting_consultation", depositPaid: false })).toBe(true);
    expect(canSetStatusManually("awaiting_consultation", { status: "cancelled", depositPaid: false })).toBe(true);
  });

  it("the admin status menu only ever offers moves the database allows", () => {
    for (const depositPaid of [false, true]) for (const status of ALL) {
      for (const option of manualStatusOptions({ status, depositPaid })) {
        if (option !== status) expect(canChangeStatus(depositPaid ? "paid" : "unpaid", status, option)).toBe(true);
      }
    }
  });

  it("the menu for a cancelled paid booking offers nothing else", () => {
    expect(manualStatusOptions({ status: "cancelled", depositPaid: true })).toEqual(["cancelled"]);
  });

  it("every status in the table is a real status", () => {
    for (const kind of Object.values(STATUS_TRANSITIONS)) for (const [from, tos] of Object.entries(kind)) {
      expect(ALL).toContain(from);
      for (const to of tos) expect(ALL).toContain(to);
    }
  });
});
