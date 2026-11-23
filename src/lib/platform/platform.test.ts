import { describe, expect, it, beforeAll } from "vitest";
import { calculateCisPayment, isValidVerification, summariseReserve, taxMonthDates, taxMonthStart, taxYear, type CisVerification } from "./cis";
import { approvalBlockers, canMoveTo, paymentDueDate, validateTransfer } from "./painter-payments";
import { availableActions, describeChanges, offerTermsSchema, termsHash, type OfferTerms } from "./offers";
import {
  addWorkingDays,
  canAppeal,
  claimTotal,
  defaultResponseDue,
  recoveryClaimProblems,
  undisputedPainterAmount,
  validateResponseDeadline,
} from "./complaints";
import { checkCisMonth, checkPainterPayments } from "./reconciliation";
import { can } from "./permissions";
import { decryptField, encryptField, isAccountNumber, isNino, isSortCode, isUtr, lastChars } from "./crypto";

const verified = (status: "gross" | "standard" | "higher", rate: number): CisVerification => ({
  id: "v1",
  painterBusinessId: "p1",
  deductionStatus: status,
  ratePercent: rate,
  hmrcVerificationReference: "V1234567890",
  verifiedOn: "2026-12-01",
});

describe("CIS calculations", () => {
  it("deducts 20% from labour only, not materials or VAT", () => {
    const r = calculateCisPayment({ labourPence: 50000, materialsPence: 8000, vatPence: 0 }, verified("standard", 20));
    expect(r.grossPence).toBe(58000);
    expect(r.cisDeductionPence).toBe(10000);
    expect(r.netPence).toBe(48000);
  });

  it("applies 30% higher rate and 0% gross status", () => {
    expect(calculateCisPayment({ labourPence: 10000, materialsPence: 0, vatPence: 0 }, verified("higher", 30)).cisDeductionPence).toBe(3000);
    const gross = calculateCisPayment({ labourPence: 10000, materialsPence: 0, vatPence: 2000 }, verified("gross", 0));
    expect(gross.cisDeductionPence).toBe(0);
    expect(gross.netPence).toBe(12000);
  });

  it("rounds the deduction down to the penny (matches the database)", () => {
    expect(calculateCisPayment({ labourPence: 20001, materialsPence: 5000, vatPence: 0 }, verified("standard", 20)).cisDeductionPence).toBe(4000);
    expect(calculateCisPayment({ labourPence: 333, materialsPence: 0, vatPence: 0 }, verified("higher", 30)).cisDeductionPence).toBe(99);
  });

  it("adds VAT to the net payment without deducting CIS from it", () => {
    const r = calculateCisPayment({ labourPence: 10000, materialsPence: 0, vatPence: 2000 }, verified("standard", 20));
    expect(r.netPence).toBe(10000 + 2000 - 2000);
  });

  it("never guesses a rate when there is no verification", () => {
    expect(() => calculateCisPayment({ labourPence: 100, materialsPence: 0, vatPence: 0 }, null)).toThrow(/never guesses/);
  });

  it("rejects a verification whose status and rate disagree", () => {
    expect(isValidVerification({ deductionStatus: "standard", ratePercent: 30, hmrcVerificationReference: "V123456" })).toBe(false);
    expect(() => calculateCisPayment({ labourPence: 100, materialsPence: 0, vatPence: 0 }, verified("standard", 30))).toThrow(/inconsistent/);
  });

  it("rejects fractional pence and empty invoices", () => {
    expect(() => calculateCisPayment({ labourPence: 10.5, materialsPence: 0, vatPence: 0 }, verified("standard", 20))).toThrow();
    expect(() => calculateCisPayment({ labourPence: 0, materialsPence: 0, vatPence: 0 }, verified("standard", 20))).toThrow();
  });
});

describe("CIS tax months", () => {
  it("runs from the 6th to the 5th", () => {
    expect(taxMonthStart("2026-12-05")).toBe("2026-11-06");
    expect(taxMonthStart("2026-12-06")).toBe("2026-12-06");
    expect(taxMonthStart("2027-01-03")).toBe("2026-12-06");
  });
  it("gives return (19th) and payment (22nd) deadlines", () => {
    const d = taxMonthDates("2026-12-06");
    expect(d.end).toBe("2027-01-05");
    expect(d.returnDue).toBe("2027-01-19");
    expect(d.paymentDue).toBe("2027-01-22");
  });
  it("works out the tax year", () => {
    expect(taxYear("2027-04-05")).toBe("2026/27");
    expect(taxYear("2027-04-06")).toBe("2027/28");
  });
  it("summarises the reserve and shortfall", () => {
    const s = summariseReserve([
      { taxMonthStart: "2026-11-06", deductedPence: 4000, reservedPence: 4000, paidToHmrcPence: 4000 },
      { taxMonthStart: "2026-12-06", deductedPence: 6000, reservedPence: 2000, paidToHmrcPence: 0 },
    ]);
    expect(s.outstandingLiabilityPence).toBe(6000);
    expect(s.reserveShortfallPence).toBe(4000);
  });
});

describe("Painter payment workflow", () => {
  it("blocks approval until every check passes", () => {
    const blockers = approvalBlockers({ cisGateApproved: false, painterOnboardingApproved: false, engagementRoute: "status_review_required", hasCisVerification: false });
    expect(blockers).toHaveLength(4);
    expect(approvalBlockers({ cisGateApproved: true, painterOnboardingApproved: true, engagementRoute: "independent_business", hasCisVerification: true })).toEqual([]);
  });
  it("only moves forward one step at a time", () => {
    expect(canMoveTo("awaiting_admin_approval", "approved_awaiting_transfer")).toBe(true);
    expect(canMoveTo("awaiting_admin_approval", "paid_confirmed")).toBe(false);
    expect(canMoveTo("paid_confirmed", "approved_awaiting_transfer")).toBe(false);
    expect(canMoveTo("paid_awaiting_reconciliation", "cancelled")).toBe(false);
  });
  it("requires a confirmed bank transfer with a reference", () => {
    expect(validateTransfer({ bankPaymentReference: "TT123", transferDate: "2026-12-01", confirmedTransferMade: false }, "2026-12-02")).toMatch(/Tick/);
    expect(validateTransfer({ bankPaymentReference: "", transferDate: "2026-12-01", confirmedTransferMade: true }, "2026-12-02")).toMatch(/reference/);
    expect(validateTransfer({ bankPaymentReference: "TT123", transferDate: "2026-12-05", confirmedTransferMade: true }, "2026-12-02")).toMatch(/future/);
    expect(validateTransfer({ bankPaymentReference: "TT123", transferDate: "2026-12-01", confirmedTransferMade: true }, "2026-12-02")).toBeNull();
  });
  it("works out the due date from the accepted payment days", () => {
    expect(paymentDueDate("2026-12-20", 14)).toBe("2027-01-03");
  });
});

const baseTerms: OfferTerms = offerTermsSchema.parse({
  scope: "Paint walls and ceiling of front bedroom, two coats",
  feePence: 20000,
  materialsResponsibility: "painter",
  proposedStartDate: "2026-12-07",
  arrivalWindowStart: "08:00",
  arrivalWindowEnd: "10:00",
  paymentTerms: "Within 14 days of a valid invoice",
  paymentDueDays: 14,
  specificationVersion: "TT-J-261207-1 v1",
});

describe("Offers and mutual acceptance", () => {
  it("validates offer terms", () => {
    expect(offerTermsSchema.safeParse({ ...baseTerms, arrivalWindowEnd: "07:00" }).success).toBe(false);
    expect(offerTermsSchema.safeParse({ ...baseTerms, materialsResponsibility: "split" }).success).toBe(false);
    expect(offerTermsSchema.safeParse({ ...baseTerms, feePence: 0 }).success).toBe(false);
  });
  it("gives a stable fingerprint that changes when terms change", () => {
    expect(termsHash(baseTerms)).toBe(termsHash({ ...baseTerms }));
    expect(termsHash({ ...baseTerms, feePence: 20001 })).not.toBe(termsHash(baseTerms));
  });
  it("lets only the other side accept or counter the latest proposal", () => {
    const v1 = [{ versionNumber: 1, proposedBy: "company" as const, companyAcceptedAt: "t", painterAcceptedAt: null }];
    expect(availableActions("open", v1, "painter")).toMatchObject({ accept: true, counter: true, decline: true });
    expect(availableActions("open", v1, "company")).toMatchObject({ accept: false, counter: false, withdraw: true, waitingFor: "painter" });
    const v2 = [...v1, { versionNumber: 2, proposedBy: "painter" as const, companyAcceptedAt: null, painterAcceptedAt: "t" }];
    expect(availableActions("open", v2, "company")).toMatchObject({ accept: true, counter: true });
    expect(availableActions("open", v2, "painter")).toMatchObject({ accept: false, decline: true });
  });
  it("allows nothing once the offer is closed", () => {
    expect(availableActions("agreed", [], "painter")).toMatchObject({ accept: false, decline: false });
  });
  it("describes counteroffer changes", () => {
    expect(describeChanges(baseTerms, { ...baseTerms, feePence: 25000, proposedStartDate: "2026-12-08" })).toEqual([
      "Fee: £200.00 → £250.00",
      "Start date changed",
    ]);
  });
});

describe("Complaints and recovery", () => {
  const mon = new Date("2026-12-07T09:00:00Z");
  it("defaults to five working days (skips weekends)", () => {
    expect(defaultResponseDue(mon).toISOString().slice(0, 10)).toBe("2026-12-14");
    expect(addWorkingDays(new Date("2026-12-11T09:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-12-14");
  });
  it("needs an urgency reason for a shorter deadline", () => {
    const tue = new Date("2026-12-08T09:00:00Z");
    expect(validateResponseDeadline(mon, tue)).toMatch(/urgency/);
    expect(validateResponseDeadline(mon, tue, "Customer moving in tomorrow")).toBeNull();
  });
  it("limits appeals to 10 calendar days", () => {
    expect(canAppeal(mon, new Date("2026-12-17T09:00:00Z"))).toBe(true);
    expect(canAppeal(mon, new Date("2026-12-18T09:00:00Z"))).toBe(false);
  });
  it("never reduces the undisputed fee for a customer refund", () => {
    // There is deliberately no refund parameter at all.
    expect(undisputedPainterAmount(20000)).toBe(20000);
    expect(undisputedPainterAmount.length).toBe(1);
  });
  it("requires breach, causation and an itemised loss before a claim is notified", () => {
    expect(recoveryClaimProblems({ allegedBreach: "", contractualBasis: "", causationExplanation: "", itemisedLoss: [] })).toHaveLength(4);
    const ok = {
      allegedBreach: "Paint applied over unprepared surface contrary to spec v2",
      contractualBasis: "Clause 3.11 standard of service",
      causationExplanation: "Independent assessor found peeling due to missing primer",
      itemisedLoss: [{ description: "Assessor fee", amountPence: 9000 }, { description: "Repaint", amountPence: 15000 }],
    };
    expect(recoveryClaimProblems(ok)).toEqual([]);
    expect(claimTotal(ok)).toBe(24000);
  });
});

describe("Reconciliation", () => {
  it("flags reserve shortfall, overdue return and unpaid HMRC liability", () => {
    const flags = checkCisMonth(
      { taxMonthStart: "2026-11-06", ledgerDeductedPence: 4000, reservedPence: 1000, paidToHmrcPence: 0, returnStatus: "not_started", returnDueDate: "2026-12-19", paymentDueDate: "2026-12-22" },
      "2026-12-23",
    );
    expect(flags.map((f) => f.area)).toEqual(["cis_reserve", "hmrc", "hmrc"]);
  });
  it("is quiet when everything matches", () => {
    expect(
      checkCisMonth(
        { taxMonthStart: "2026-11-06", ledgerDeductedPence: 4000, reservedPence: 4000, paidToHmrcPence: 4000, returnStatus: "submitted", returnDueDate: "2026-12-19", paymentDueDate: "2026-12-22" },
        "2026-12-23",
      ),
    ).toEqual([]);
  });
  it("flags duplicate bank references", () => {
    const flags = checkPainterPayments([
      { id: "a", status: "paid_confirmed", netPence: 1, bankPaymentReference: "TT-1", sageStatus: "synced" },
      { id: "b", status: "paid_awaiting_reconciliation", netPence: 1, bankPaymentReference: "tt-1 ", sageStatus: null },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0].entityId).toBe("b");
  });
});

describe("Admin permissions", () => {
  it("gives each role only what it needs", () => {
    expect(can("owner", "finance.bank_details")).toBe(true);
    expect(can("operations", "finance.bank_details")).toBe(false);
    expect(can("finance", "finance.bank_details")).toBe(true);
    expect(can("compliance", "audit.view")).toBe(true);
    expect(can("operations", "audit.view")).toBe(false);
    expect(can(null, "jobs.manage")).toBe(false);
  });
});

describe("Encryption of bank and tax details", () => {
  beforeAll(() => {
    process.env.PAINTER_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  it("round-trips and never stores plain text", () => {
    const enc = encryptField("12345678");
    expect(enc).not.toContain("12345678");
    expect(decryptField(enc)).toBe("12345678");
    expect(encryptField("12345678")).not.toBe(enc); // random IV each time
  });
  it("detects tampering", () => {
    const enc = encryptField("1234567890").split(":");
    enc[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptField(enc.join(":"))).toThrow();
  });
  it("checks UK formats", () => {
    expect(isUtr("12345 67890")).toBe(true);
    expect(isUtr("123")).toBe(false);
    expect(isSortCode("12-34-56")).toBe(true);
    expect(isAccountNumber("12345678")).toBe(true);
    expect(isNino("AB 12 34 56 C")).toBe(true);
    expect(isNino("BG123456C")).toBe(false);
    expect(lastChars("12-34-56-78", 4)).toBe("5678");
  });
});
