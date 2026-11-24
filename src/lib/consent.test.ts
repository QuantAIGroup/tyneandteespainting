import { describe, expect, it } from "vitest";
import { CANCELLATION_TERMS_VERSION, CONSENT_STATEMENTS, TERMS_FINGERPRINTS } from "@/config/cancellation";
import { checkConsent, termsFingerprint } from "./consent";

describe("cancellation terms version and fingerprint", () => {
  it("the current terms text matches the fingerprint recorded for the current version (change the wording → set a new version)", () => {
    expect(TERMS_FINGERPRINTS[CANCELLATION_TERMS_VERSION], `Fingerprint for ${CANCELLATION_TERMS_VERSION} should be ${termsFingerprint()}`).toBe(termsFingerprint());
  });
  it("the version has the format the database accepts", () => {
    expect(CANCELLATION_TERMS_VERSION).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}(\.[0-9]{1,3})?$/);
    expect(termsFingerprint()).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("consent rules", () => {
  const all = { acceptTerms: true, earlyStart: false, ackPayForWork: false, ackLosesRight: false };
  it("the terms must be accepted", () => expect(checkConsent({ ...all, acceptTerms: false })).toEqual({ ok: false, error: "terms" }));
  it("accepting the terms never implies an early start", () => {
    const r = checkConsent(all);
    expect(r).toMatchObject({ ok: true, earlyStart: false });
    if (r.ok) expect(Object.keys(r.statements)).toEqual(["acceptTerms"]);
  });
  it("an early start needs both acknowledgements", () => {
    expect(checkConsent({ ...all, earlyStart: true })).toEqual({ ok: false, error: "earlystart" });
    expect(checkConsent({ ...all, earlyStart: true, ackPayForWork: true })).toEqual({ ok: false, error: "earlystart" });
    expect(checkConsent({ ...all, earlyStart: true, ackLosesRight: true })).toEqual({ ok: false, error: "earlystart" });
  });
  it("records the exact wording of every box ticked", () => {
    const r = checkConsent({ acceptTerms: true, earlyStart: true, ackPayForWork: true, ackLosesRight: true });
    expect(r.ok && r.statements).toEqual(CONSENT_STATEMENTS);
  });
  it("acknowledgements without an early-start request are ignored", () => {
    const r = checkConsent({ ...all, ackPayForWork: true, ackLosesRight: true });
    expect(r).toMatchObject({ ok: true, earlyStart: false });
  });
});
