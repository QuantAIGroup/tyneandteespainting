/**
 * End-to-end tests of the real server routes, using an in-memory database:
 *  - quote request submission (enquiry, room records, photo records)
 *  - photo upload links
 *  - the Stripe webhook (real signature check) for 100% payments
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/test/fake-supabase";
import { DEFAULT_PRICING } from "@/lib/pricing/defaults";

process.env.STRIPE_SECRET_KEY = "sk_test_routes_test";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_routes_test";

let db = new FakeDb();
const emails: { to?: string; subject: string; lines: string[] }[] = [];

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }));
vi.mock("@/lib/notifications", () => ({
  sendNotification: vi.fn(async (subject: string, lines: string[]) => {
    emails.push({ subject, lines });
  }),
  sendCustomerEmail: vi.fn(async (to: string, subject: string, lines: string[]) => {
    emails.push({ to, subject, lines });
    return { sent: true };
  }),
}));
vi.mock("@/lib/settings", () => ({
  getPricingSettingsUncached: async () => DEFAULT_PRICING,
  getBusinessSettings: async () => ({ name: "Tyne & Tees Painting", phone: "07444 359371", email: "", address: "", openingHours: "", logoUrl: "", verifiedClaims: [] }),
}));

const { POST: submitEnquiry } = await import("./enquiries/route");
const { POST: signUpload } = await import("./uploads/sign/route");
const { POST: stripeWebhook } = await import("./stripe/webhook/route");
const { POST: startCheckout } = await import("./pay/[token]/checkout/route");
const { getStripe } = await import("@/lib/payments/stripe");

const json = (body: unknown) => new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  db = new FakeDb();
  emails.length = 0;
});

// ---------------------------------------------------------------------------
describe("quote request submission", () => {
  const draftId = "6f1c2f4e-3a52-4b8e-9b1d-2f7a9c0d1e23";
  const customer = { fullName: "Sam Customer", email: "Sam@Example.com", phone: "07700 900123", postcode: "ne2 1ab", preferredContact: "phone" };
  const items = [
    { id: "r1", type: "bedroom", label: "Bedroom 1", measurementMode: "simple", length: 4, width: 3.5, height: 2.4, walls: [], includeCeiling: true, coats: 2, condition: { surface: "good", newlySkimmed: false, colourChange: "similar", wallpaperToRemove: false, dampOrStains: false } },
    { id: "s1", type: "skirting", label: "Skirting boards", linearMetres: 8.5, coats: 2, condition: "good" },
    { id: "extra-door_frame", type: "extra", label: "Door frames", extra: "door_frame", quantity: 3 },
    { id: "extra-sash_window", type: "extra", label: "Sash or unusual windows", extra: "sash_window", quantity: 1 },
  ];

  it("saves the enquiry, one row per room/extra, and the photo records", async () => {
    const photoPath = `pending/${draftId}/a.jpg`;
    db.addFile("enquiry-photos", photoPath);
    const res = await submitEnquiry(json({ draftId, items, customer, photos: [{ path: photoPath, fileName: "room.jpg", contentType: "image/jpeg", size: 2048 }], website: "" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reference).toMatch(/\S+/);

    const [enquiry] = db.table("enquiries");
    expect(enquiry).toMatchObject({ full_name: "Sam Customer", email: "sam@example.com", postcode: "NE2 1AB", requires_manual_quote: true });
    // £198 walls + £84 ceiling + £46.75 skirting + £90 door frames (sash window needs inspection)
    expect(enquiry.estimated_total_pence).toBe(19800 + 8400 + 4675 + 9000);

    const rooms = db.table("quote_rooms");
    expect(rooms).toHaveLength(4);
    expect(rooms[0]).toMatchObject({ item_type: "bedroom", length_m: 4, ceiling_area_sqm: 14, estimated_labour_pence: 28200 });
    expect(rooms[1]).toMatchObject({ item_type: "skirting", skirting_length_m: 8.5, estimated_labour_pence: 4675 });
    // Matches the database rule: fixed extras store kind, quantity and unit price, and total = quantity × unit price
    expect(rooms[2]).toMatchObject({ item_type: "extra", extra_kind: "door_frame", quantity: 3, unit_price_pence: 3000, estimated_labour_pence: 9000, requires_manual_quote: false, coats: null, condition: null });
    expect(rooms[3]).toMatchObject({ item_type: "extra", extra_kind: "sash_window", quantity: 1, unit_price_pence: null, estimated_labour_pence: null, requires_manual_quote: true });
    // Measured rooms carry no extra fields
    expect(rooms[0]).toMatchObject({ extra_kind: null, quantity: null, unit_price_pence: null, coats: 2 });

    expect(db.table("enquiry_photos")).toEqual([expect.objectContaining({ enquiry_id: enquiry.id, storage_path: photoPath, content_type: "image/jpeg" })]);
    expect(emails[0].subject).toContain("New painting enquiry");
  });

  it("recalculates the price on the server – a tampered price from the browser is ignored", async () => {
    await submitEnquiry(json({ draftId, items: [items[1]], customer, photos: [], totalPence: 1, estimated_total_pence: 1 }));
    expect(db.table("enquiries")[0].estimated_total_pence).toBe(4675);
  });

  it("rejects photos from another enquiry's folder", async () => {
    const res = await submitEnquiry(json({ draftId, items, customer, photos: [{ path: "pending/other/a.jpg", contentType: "image/jpeg", size: 10 }] }));
    expect(res.status).toBe(400);
    expect(db.table("enquiries")).toHaveLength(0);
  });

  it("rejects a photo that didn't finish uploading", async () => {
    const res = await submitEnquiry(json({ draftId, items, customer, photos: [{ path: `pending/${draftId}/missing.jpg`, contentType: "image/jpeg", size: 10 }] }));
    expect(res.status).toBe(400);
    expect(db.table("enquiries")).toHaveLength(0);
  });

  it("asks very large jobs to call instead of failing to save", async () => {
    const huge = { ...items[0], length: 1000, width: 1000, height: 20, includeCeiling: false }; // 80,000 m² of wall
    const res = await submitEnquiry(json({ draftId, items: [huge], customer, photos: [] }));
    // 80,000 m² × £5.50 = £440,000 – still under the £1,000,000 per-room limit, so it saves
    expect(res.status).toBe(200);
    db.tables = {};
    const res2 = await submitEnquiry(json({ draftId, items: [huge, { ...huge, id: "r2" }], customer, photos: [] }));
    expect(res2.status).toBe(200); // the limit is per room, not per enquiry
  });

  it("rejects invalid measurements and quantities", async () => {
    expect((await submitEnquiry(json({ draftId, items: [{ ...items[1], linearMetres: 0 }], customer, photos: [] }))).status).toBe(400);
    expect((await submitEnquiry(json({ draftId, items: [{ ...items[2], quantity: 0 }], customer, photos: [] }))).status).toBe(400);
    expect(db.table("enquiries")).toHaveLength(0);
  });

  it("removes the enquiry again if the room records can't be saved (no half-saved records)", async () => {
    db.failInsertOn.add("quote_rooms");
    const res = await submitEnquiry(json({ draftId, items, customer, photos: [] }));
    expect(res.status).toBe(500);
    expect(db.table("enquiries")).toHaveLength(0);
  });

  it("quietly ignores spam bots (hidden field filled in)", async () => {
    const res = await submitEnquiry(json({ draftId, items, customer, photos: [], website: "http://spam" }));
    expect(res.status).toBe(200);
    expect(db.table("enquiries")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("photo upload links", () => {
  const draftId = "6f1c2f4e-3a52-4b8e-9b1d-2f7a9c0d1e23";

  it("creates a one-time link inside this enquiry's private folder", async () => {
    const res = await signUpload(json({ draftId, contentType: "image/jpeg", size: 500_000 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.path).toMatch(new RegExp(`^pending/${draftId}/[0-9a-f-]+\\.jpg$`));
    expect(body.signedUrl).toContain(body.path);
  });

  it("rejects other file types, oversized photos and bad upload sessions", async () => {
    expect((await signUpload(json({ draftId, contentType: "application/pdf", size: 100 }))).status).toBe(400);
    expect((await signUpload(json({ draftId, contentType: "image/png", size: 11 * 1024 * 1024 }))).status).toBe(400);
    expect((await signUpload(json({ draftId: "../../etc", contentType: "image/png", size: 100 }))).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe("Stripe webhook – 100% payments", () => {
  const enquiryId = "9b2e7c1a-4d3f-4e5a-8b6c-7d8e9f0a1b2c";
  const stripe = getStripe()!;
  const refunds = vi.fn(async () => ({ id: "re_1" }));

  beforeAll(() => {
    Object.assign(stripe.paymentIntents, { retrieve: vi.fn(async () => ({ latest_charge: { receipt_url: "https://pay.stripe.com/receipts/r1" } })) });
    Object.assign(stripe.refunds, { create: refunds });
  });

  beforeEach(() => {
    refunds.mockClear();
    db.table("enquiries").push({
      id: enquiryId,
      reference: "TT-TEST",
      status: "deposit_requested",
      full_name: "Sam Customer",
      email: "sam@example.com",
      agreed_service: "Bedroom walls and ceiling",
      estimated_total_pence: 34000,
      agreed_price_pence: 37550,
      deposit_pence: 37550,
      payment_type: "full",
      deposit_percent: null,
      deposit_paid_at: null,
      stripe_payment_intent_id: null,
      payment_token: "tok",
      cancellation_terms_accepted_at: "2026-11-23T12:00:00Z",
    });
  });

  const event = (o: { id?: string; amount?: number; pi?: string; status?: string }) => ({
    id: o.id ?? "evt_1",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", object: "checkout.session", payment_status: o.status ?? "paid", amount_total: o.amount ?? 37550, currency: "gbp", payment_intent: o.pi ?? "pi_1", customer: "cus_1", client_reference_id: enquiryId, metadata: { kind: "full", enquiry_id: enquiryId } } },
  });

  const send = (payload: unknown, secret = process.env.STRIPE_WEBHOOK_SECRET!) => {
    const body = JSON.stringify(payload);
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    return stripeWebhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body }));
  };

  it("confirms the booking when the full agreed price is paid", async () => {
    const res = await send(event({}));
    expect(res.status).toBe(200);
    const [e] = db.table("enquiries");
    expect(e).toMatchObject({ status: "booking_confirmed", deposit_paid_pence: 37550, stripe_payment_intent_id: "pi_1", stripe_receipt_url: "https://pay.stripe.com/receipts/r1" });
    expect(e.booking_confirmed_at).toBeTruthy();
    expect(db.table("payments")).toEqual([expect.objectContaining({ outcome: "deposit_recorded", amount_pence: 37550, kind: "full" })]);
    expect(db.table("stripe_events")).toEqual([expect.objectContaining({ id: "evt_1" })]);
    const customerEmail = emails.find((m) => m.to === "sam@example.com")!;
    expect(customerEmail.subject).toContain("confirmed");
    expect(customerEmail.lines.join("\n")).toContain("/cancellation");
  });

  it("does NOT confirm the booking if the amount paid is the estimate rather than the agreed price", async () => {
    await send(event({ amount: 34000 }));
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review" });
  });

  it("rejects a webhook with an invalid signature and changes nothing", async () => {
    const res = await send(event({}), "whsec_wrong");
    expect(res.status).toBe(400);
    expect(db.table("enquiries")[0].status).toBe("deposit_requested");
  });

  it("ignores a checkout that isn't paid yet", async () => {
    await send(event({ status: "unpaid" }));
    expect(db.table("enquiries")[0].deposit_paid_at).toBeNull();
  });

  it("handles the same event arriving twice only once", async () => {
    await send(event({}));
    const res = await send(event({}));
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(db.table("payments")).toHaveLength(1);
  });

  it("the same event arriving twice at the same moment confirms the booking once", async () => {
    await Promise.all([send(event({})), send(event({}))]);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", deposit_paid_pence: 37550 });
    expect(db.table("payments")).toHaveLength(1);
    expect(emails.filter((m) => m.to === "sam@example.com")).toHaveLength(1);
  });

  it("automatically refunds a second, duplicate payment", async () => {
    await send(event({}));
    await send(event({ id: "evt_2", pi: "pi_2" }));
    expect(refunds).toHaveBeenCalledWith({ payment_intent: "pi_2", reason: "duplicate" }, expect.anything());
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", stripe_payment_intent_id: "pi_1" });
    expect(db.table("payments").map((p) => p.outcome)).toEqual(["deposit_recorded", "duplicate_refunded"]);
  });
});

// ---------------------------------------------------------------------------
describe("Stripe webhook – part-payments can never confirm a booking", () => {
  const enquiryId = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
  const stripe = getStripe()!;
  const send = (amount: number) => {
    const body = JSON.stringify({
      id: `evt_part_${amount}`, object: "event", type: "checkout.session.completed",
      data: { object: { id: "cs_p", object: "checkout.session", payment_status: "paid", amount_total: amount, currency: "gbp", payment_intent: `pi_part_${amount}`, customer: null, client_reference_id: enquiryId, metadata: { kind: "full", enquiry_id: enquiryId } } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return stripeWebhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body }));
  };
  const seed = (o: Record<string, unknown>) =>
    db.table("enquiries").push({ id: enquiryId, reference: "TT-PART", status: "deposit_requested", full_name: "Pat", email: "p@example.com", agreed_price_pence: 37550, deposit_pence: 37550, payment_type: "full", deposit_paid_at: null, stripe_payment_intent_id: null, cancellation_terms_accepted_at: "2026-11-23T12:00:00Z", ...o });

  it("refuses a half payment even if the stored request was altered to half", async () => {
    seed({ deposit_pence: 18775 }); // tampered: 50% stored as if it were "full"
    await send(18775);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review", notes: expect.stringContaining("not 100% of the agreed price") });
  });

  it("refuses an old-style 50% deposit request", async () => {
    seed({ deposit_pence: 18775, payment_type: "deposit", deposit_percent: 50 });
    await send(18775);
    expect(db.table("enquiries")[0].deposit_paid_at).toBeNull();
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review", notes: expect.stringContaining("Only full payment") });
  });

  it("refuses to confirm a booking if the cancellation policy confirmation wasn't recorded", async () => {
    seed({ cancellation_terms_accepted_at: null });
    await send(37550);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review", notes: expect.stringContaining("cancellation policy") });
  });

  it("refuses an overpayment", async () => {
    seed({});
    await send(40000);
    expect(db.table("enquiries")[0].deposit_paid_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("Stripe checkout – charges exactly 100% of the agreed price", () => {
  const token = "A".repeat(43);
  const enquiryId = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
  const stripe = getStripe()!;
  const create = vi.fn(async (params: Record<string, unknown>) => ({ id: "cs_new", url: "https://checkout.stripe.com/c/cs_new", status: "open", amount_total: (params?.line_items as { price_data: { unit_amount: number } }[] | undefined)?.[0]?.price_data.unit_amount }));

  beforeAll(() => {
    Object.assign(stripe.checkout.sessions, { create, retrieve: vi.fn(), expire: vi.fn() });
  });
  beforeEach(() => create.mockClear());

  const seed = (o: Record<string, unknown> = {}) =>
    db.table("enquiries").push({
      id: enquiryId, reference: "TT-PAY", status: "deposit_requested", full_name: "Sam Customer", email: "sam@example.com", agreed_service: "Bedroom walls",
      estimated_total_pence: 34000, agreed_price_pence: 37550, deposit_pence: 37550, payment_type: "full", deposit_percent: null,
      deposit_paid_at: null, deposit_requested_at: "2026-11-23T12:00:00Z", stripe_checkout_session_id: null, payment_token: token, ...o,
    });
  const pay = (fields: Record<string, string>) =>
    startCheckout(new Request(`http://localhost/api/pay/${token}/checkout`, { method: "POST", body: new URLSearchParams(fields) }), { params: Promise.resolve({ token }) });

  it("sends Stripe exactly the agreed price in GBP – not the estimate", async () => {
    seed();
    const res = await pay({ acceptTerms: "on" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/cs_new");
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0] as { line_items: { quantity: number; price_data: { unit_amount: number; currency: string } }[]; currency: string; metadata: Record<string, string> };
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0]).toMatchObject({ quantity: 1, price_data: { unit_amount: 37550, currency: "gbp" } });
    expect(params.metadata).toMatchObject({ kind: "full", agreed_price_pence: "37550", deposit_pence: "37550" });
    expect(db.table("enquiries")[0].cancellation_terms_accepted_at).toBeTruthy();
    expect(db.table("enquiries")[0].early_start_requested_at).toBeNull();
  });

  it("ignores any amount sent from the browser", async () => {
    seed();
    await pay({ acceptTerms: "on", amount: "1", deposit_pence: "1", unit_amount: "1" });
    expect((create.mock.calls[0][0] as { line_items: { price_data: { unit_amount: number } }[] }).line_items[0].price_data.unit_amount).toBe(37550);
  });

  it("accepting the terms is NOT treated as a request to start early", async () => {
    seed();
    await pay({ acceptTerms: "on" });
    const e = db.table("enquiries")[0];
    expect(e.cancellation_terms_accepted_at).toBeTruthy();
    expect(e.early_start_requested_at).toBeNull();
  });

  it("records an early-start request when ticked", async () => {
    seed();
    await pay({ acceptTerms: "on", earlyStart: "on" });
    expect(db.table("enquiries")[0].early_start_requested_at).toBeTruthy();
  });

  it("won't open the payment page until the cancellation policy is confirmed", async () => {
    seed();
    const res = await pay({});
    expect(res.headers.get("location")).toContain("error=terms");
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to charge anything other than 100% of the agreed price", async () => {
    seed({ deposit_pence: 18775, payment_type: "deposit", deposit_percent: 50 });
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).toContain("error=amount");
    expect(create).not.toHaveBeenCalled();
  });
});
