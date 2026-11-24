import "server-only";
import { createHash } from "node:crypto";
import {
  CANCELLATION_POLICY,
  CANCELLATION_SUMMARY,
  CANCELLATION_TERMS_VERSION,
  CONSENT_STATEMENTS,
  COOLING_OFF_DAYS,
  LATE_CANCELLATION_HOURS,
  MODEL_FORM_LINES,
} from "@/config/cancellation";

/** Everything the customer is agreeing to, in a fixed order. */
export function termsDocument() {
  return {
    version: CANCELLATION_TERMS_VERSION,
    coolingOffDays: COOLING_OFF_DAYS,
    lateCancellationHours: LATE_CANCELLATION_HOURS,
    policy: CANCELLATION_POLICY,
    summary: CANCELLATION_SUMMARY,
    modelCancellationForm: MODEL_FORM_LINES,
    statements: CONSENT_STATEMENTS,
  };
}

/** SHA-256 of the exact terms text – stored with every consent as evidence of what was shown. */
export function termsFingerprint(): string {
  return createHash("sha256").update(JSON.stringify(termsDocument())).digest("hex");
}

export type ConsentChoice = {
  acceptTerms: boolean;
  earlyStart: boolean;
  ackPayForWork: boolean;
  ackLosesRight: boolean;
};

export type ConsentCheck =
  | { ok: true; earlyStart: boolean; statements: Record<string, string> }
  | { ok: false; error: "terms" | "earlystart" };

/**
 * The cancellation terms must be accepted. Starting early is optional, but if
 * asked for, BOTH acknowledgements the law requires must be ticked too.
 * Acknowledgements without an early-start request are ignored.
 */
export function checkConsent(c: ConsentChoice): ConsentCheck {
  if (!c.acceptTerms) return { ok: false, error: "terms" };
  if (c.earlyStart && !(c.ackPayForWork && c.ackLosesRight)) return { ok: false, error: "earlystart" };
  const statements: Record<string, string> = { acceptTerms: CONSENT_STATEMENTS.acceptTerms };
  if (c.earlyStart) {
    statements.earlyStart = CONSENT_STATEMENTS.earlyStart;
    statements.ackPayForWork = CONSENT_STATEMENTS.ackPayForWork;
    statements.ackLosesRight = CONSENT_STATEMENTS.ackLosesRight;
  }
  return { ok: true, earlyStart: c.earlyStart, statements };
}
