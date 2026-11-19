import { describe, expect, it } from "vitest";
import { customerDetailsSchema, generateReference, normalisePostcode } from "./enquiry";

describe("customer details", () => {
  const valid = {
    fullName: "Sam Smith",
    email: "sam@example.com",
    phone: "0191 123 4567",
    postcode: "NE2 1AB",
    preferredContact: "phone" as const,
  };

  it("accepts valid details", () => {
    expect(customerDetailsSchema.safeParse(valid).success).toBe(true);
    expect(customerDetailsSchema.safeParse({ ...valid, postcode: "ne21ab", phone: "+44 7700 900123" }).success).toBe(true);
  });

  it("rejects bad email, phone and postcode", () => {
    expect(customerDetailsSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(customerDetailsSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
    expect(customerDetailsSchema.safeParse({ ...valid, postcode: "12345" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("normalises postcodes", () => {
    expect(normalisePostcode("ne21ab")).toBe("NE2 1AB");
    expect(normalisePostcode("NE3  4PL")).toBe("NE3 4PL");
  });

  it("generates readable references", () => {
    expect(generateReference(new Date(2026, 10, 19))).toMatch(/^NP-261119-[A-HJ-NP-Z2-9]{4}$/);
  });
});
