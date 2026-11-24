import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CANCELLATION_TERMS_VERSION, CONSENT_STATEMENTS } from "@/config/cancellation";
import { BookingSummary } from "./[token]/BookingSummary";

// Render the real payment page (awaiting payment) and compare what the customer SEES with what is STORED
const html = renderToStaticMarkup(
  createElement(BookingSummary, {
    booking: {
      id: "e1", reference: "TT-1", status: "deposit_requested", fullName: "Sam", email: "s@example.com", agreedService: "Lounge",
      agreedPricePence: 37550, depositPence: 37550, depositPaidPence: null, depositPaidAt: null, depositRequestedAt: "2026-11-23T10:00:00Z",
      stripeCheckoutSessionId: null, paymentType: "full", depositPercent: null, stripePaymentIntentId: null, stripeReceiptUrl: null,
    },
    token: "t".repeat(43), phone: "07000000000", cancelled: false, stripeReady: true,
  }),
);
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("payment page shows exactly the wording that is stored as consent evidence", () => {
  for (const [name, wording] of Object.entries(CONSENT_STATEMENTS)) {
    it(`box "${name}" shows the stored wording word for word, with a checkbox named ${name}`, () => {
      expect(text).toContain(wording);
      expect(html).toMatch(new RegExp(`<input[^>]*type="checkbox"[^>]*name="${name}"`));
    });
  }
  it("shows the terms version being accepted", () => expect(text).toContain(`version ${CANCELLATION_TERMS_VERSION}`));
  it("links to the full cancellation policy and form", () => expect(html).toContain('href="/cancellation"'));
  it("accepting the terms is required by the form; the early-start boxes are optional and unticked", () => {
    const input = (n: string) => html.match(new RegExp(`<input[^>]*name="${n}"[^>]*>`))?.[0] ?? "";
    expect(input("acceptTerms")).toMatch(/\brequired\b/);
    for (const n of ["earlyStart", "ackPayForWork", "ackLosesRight"]) {
      expect(input(n)).not.toBe("");
      expect(input(n)).not.toMatch(/\b(required|checked)\b/);
    }
  });
  it("the form sends only tick boxes – no wording, version or fingerprint fields the customer could change", () => {
    const names = [...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(["acceptTerms", "ackLosesRight", "ackPayForWork", "earlyStart"]);
  });
});
