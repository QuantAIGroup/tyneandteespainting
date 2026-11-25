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

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin" })) }));
vi.mock("next/cache", async (orig) => ({ ...(await orig<typeof import("next/cache")>()), refresh: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));

const { POST: submitEnquiry } = await import("./enquiries/route");
const { POST: signUpload } = await import("./uploads/sign/route");
const { POST: stripeWebhook } = await import("./stripe/webhook/route");
const { POST: startCheckout } = await import("./pay/[token]/checkout/route");
const { getStripe } = await import("@/lib/payments/stripe");
const { refundPayment } = await import("@/app/admin/payment-actions");
const { CANCELLATION_TERMS_VERSION, CONSENT_STATEMENTS, TERMS_FINGERPRINTS } = await import("@/config/cancellation");

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
  // What Stripe says about the payment itself (each test can change it)
  let stripePayment: Record<string, unknown> = {};
  const retrievePayment = vi.fn(async (id: string) => ({
    id, status: "succeeded", amount_received: 37550, currency: "gbp", metadata: { enquiry_id: enquiryId },
    latest_charge: { receipt_url: "https://pay.stripe.com/receipts/r1" }, ...stripePayment,
  }));

  beforeAll(() => {
    Object.assign(stripe.paymentIntents, { retrieve: retrievePayment });
    Object.assign(stripe.refunds, { create: refunds });
  });

  beforeEach(() => {
    refunds.mockClear();
    retrievePayment.mockClear();
    stripePayment = {};
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
      stripe_checkout_session_id: "cs_1", // saved by the payment page when it opened Stripe checkout
      consent_id: "con_1", // the customer's consent evidence record
      cancellation_terms_version: "2026-11-23",
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
    expect(db.table("payments")).toEqual([expect.objectContaining({ outcome: "payment_recorded", amount_pence: 37550, kind: "full" })]);
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
    // The customer's one real payment must never be refunded as a "duplicate"
    expect(refunds).not.toHaveBeenCalled();
  });

  it("automatically refunds a second, duplicate payment", async () => {
    await send(event({}));
    await send(event({ id: "evt_2", pi: "pi_2" }));
    expect(refunds).toHaveBeenCalledWith({ payment_intent: "pi_2", reason: "duplicate" }, expect.anything());
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", stripe_payment_intent_id: "pi_1" });
    expect(db.table("payments").map((p) => p.outcome)).toEqual(["payment_recorded", "duplicate_refunded"]);
  });

  it("records the automatic duplicate refund in the refund record, without changing the original payment", async () => {
    await send(event({}));
    const paidBefore = { ...db.table("enquiries")[0] };
    const logBefore = db.table("payments").map((p) => ({ ...p }));
    refunds.mockImplementationOnce(async () => ({ id: "re_dup", amount: 37550, currency: "gbp", status: "succeeded", reason: "duplicate", payment_intent: "pi_2" }) as never);
    await send(event({ id: "evt_2", pi: "pi_2" }));
    expect(db.table("refunds")).toHaveLength(1);
    expect(db.table("refunds")[0]).toMatchObject({ stripe_refund_id: "re_dup", stripe_payment_intent_id: "pi_2", amount_pence: 37550, source: "duplicate_payment", status: "succeeded" });
    expect(db.table("enquiries")[0]).toEqual(paidBefore);
    expect(db.table("payments").slice(0, 1)).toEqual(logBefore);
  });

  it("ignores a live-mode event when the site uses test keys (and so never confirms from it)", async () => {
    const live = event({}) as ReturnType<typeof event> & { livemode?: boolean };
    live.livemode = true;
    await send(live);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")).toHaveLength(0);
  });

  it("if the payment-log entry can't be written, Stripe is asked to retry, and the retry writes it", async () => {
    db.failInsertOn.add("payments");
    const first = await send(event({}));
    expect(first.status).toBe(500);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", stripe_payment_intent_id: "pi_1" });
    expect(db.table("payments")).toHaveLength(0);
    db.failInsertOn.delete("payments");
    const retry = await send(event({}));
    expect(retry.status).toBe(200);
    expect(db.table("payments")).toEqual([expect.objectContaining({ outcome: "payment_recorded", stripe_payment_intent_id: "pi_1", amount_pence: 37550, currency: "gbp" })]);
    expect(refunds).not.toHaveBeenCalled();
  });

  it("the currency is logged in Stripe's lowercase form even if sent in capitals", async () => {
    const e = event({});
    e.data.object.currency = "GBP";
    await send(e);
    expect(db.table("payments")[0]).toMatchObject({ outcome: "payment_recorded", currency: "gbp" });
  });

  it("two DIFFERENT payments at the same moment: one confirms the booking, only the other is refunded", async () => {
    await Promise.all([send(event({})), send(event({ id: "evt_2", pi: "pi_2" }))]);
    const e = db.table("enquiries")[0];
    expect(e.status).toBe("booking_confirmed");
    expect(refunds).toHaveBeenCalledTimes(1);
    const refundedPi = (refunds.mock.calls[0] as unknown as [{ payment_intent: string }])[0].payment_intent;
    expect(refundedPi).not.toBe(e.stripe_payment_intent_id);
  });

  it("'completed' and 'async payment succeeded' for the same payment: confirmed once, never refunded", async () => {
    await send(event({}));
    const async = event({ id: "evt_async" });
    async.type = "checkout.session.async_payment_succeeded";
    await send(async);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", stripe_payment_intent_id: "pi_1" });
    expect(refunds).not.toHaveBeenCalled();
    expect(db.table("payments")).toHaveLength(1);
  });

  it("a failed bank payment does not confirm the booking", async () => {
    const failed = event({ status: "unpaid" });
    failed.type = "checkout.session.async_payment_failed";
    await send(failed);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")).toHaveLength(0);
  });

  it("a checkout needing no payment (e.g. 100% discount) does not confirm the booking", async () => {
    await send(event({ status: "no_payment_required", amount: 0 }));
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
  });

  it("a payment in the wrong currency is held for review, not confirmed", async () => {
    const eur = event({});
    eur.data.object.currency = "eur";
    await send(eur);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review" });
  });

  it("a payment arriving after the booking was cancelled is held for review, not confirmed", async () => {
    db.table("enquiries")[0].status = "cancelled";
    await send(event({}));
    expect(db.table("enquiries")[0]).toMatchObject({ status: "cancelled", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review" });
  });

  it("ignores Stripe checkouts that aren't booking payments", async () => {
    const other = event({});
    other.data.object.metadata = { kind: "gift_card", enquiry_id: enquiryId };
    await send(other);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")).toHaveLength(0);
  });

  it("a paid booking's payment details are not changed by a later webhook", async () => {
    await send(event({}));
    const before = { ...db.table("enquiries")[0] };
    await send(event({ id: "evt_late", pi: "pi_late", amount: 99 }));
    const after = db.table("enquiries")[0];
    for (const k of ["deposit_paid_at", "deposit_paid_pence", "stripe_payment_intent_id", "agreed_price_pence", "deposit_pence", "status"]) expect(after[k]).toEqual(before[k]);
  });

  // ---- The payment must be the booking's own, confirmed by Stripe itself
  const notPaid = () => expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });

  it("a payment made on an old/other Stripe checkout page is held for review, not confirmed", async () => {
    db.table("enquiries")[0].stripe_checkout_session_id = "cs_current";
    await send(event({}));
    notPaid();
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review" });
  });

  it("a payment on a booking with no saved checkout page is held for review", async () => {
    db.table("enquiries")[0].stripe_checkout_session_id = null;
    await send(event({}));
    notPaid();
  });

  for (const [label, override] of [
    ["Stripe says the payment hasn't succeeded", { status: "requires_payment_method" }],
    ["Stripe received a different amount", { amount_received: 18775 }],
    ["Stripe says the payment wasn't in GBP", { currency: "eur" }],
    ["the Stripe payment belongs to a different booking", { metadata: { enquiry_id: "00000000-0000-4000-8000-000000000000" } }],
  ] as const) {
    it(`not confirmed when ${label}`, async () => {
      stripePayment = { ...override };
      await send(event({}));
      notPaid();
      expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review" });
      expect(refunds).not.toHaveBeenCalled();
    });
  }

  it("checks the payment with Stripe before confirming", async () => {
    await send(event({}));
    expect(retrievePayment).toHaveBeenCalledWith("pi_1");
  });

  it("if Stripe can't be reached, nothing is marked paid and Stripe is asked to retry", async () => {
    retrievePayment.mockImplementationOnce(async () => { throw new Error("network down"); });
    const res = await send(event({}));
    expect(res.status).toBe(500);
    notPaid();
    expect(db.table("stripe_events")).toHaveLength(0); // not marked as handled, so the retry is processed
    const retry = await send(event({}));
    expect(retry.status).toBe(200);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "booking_confirmed", stripe_payment_intent_id: "pi_1" });
  });
});

// ---------------------------------------------------------------------------
describe("Refunds – through Stripe, recorded separately, original payment untouched", () => {
  const enquiryId = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
  const stripe = getStripe()!;
  const createRefund = vi.fn(async (params: { amount: number; payment_intent: string }) => ({ id: "re_admin", amount: params.amount, currency: "gbp", status: "succeeded", reason: "requested_by_customer", payment_intent: params.payment_intent, metadata: { source: "admin" } }));
  let original: Record<string, unknown> = {};
  const retrieveOriginal = vi.fn(async (id: string) => ({
    id, status: "succeeded", amount_received: 37550, currency: "gbp", metadata: { enquiry_id: enquiryId },
    latest_charge: { amount: 37550, amount_refunded: 0 }, ...original,
  }));
  beforeAll(() => Object.assign(stripe.refunds, { create: createRefund }));
  beforeEach(() => {
    Object.assign(stripe.paymentIntents, { retrieve: retrieveOriginal });
    original = {};
    createRefund.mockClear();
    db.table("enquiries").push({
      id: enquiryId, reference: "TT-REF", status: "booking_confirmed", full_name: "Robin", email: "r@example.com", agreed_price_pence: 37550, deposit_pence: 37550,
      payment_type: "full", deposit_paid_at: "2026-11-23T12:00:00Z", deposit_paid_pence: 37550, stripe_payment_intent_id: "pi_paid", stripe_checkout_session_id: "cs_paid",
      cancellation_terms_accepted_at: "2026-11-23T11:59:00Z", consent_id: "con_r",
    });
    db.table("payments").push({ id: "pay1", enquiry_id: enquiryId, outcome: "payment_recorded", amount_pence: 37550, currency: "gbp", stripe_payment_intent_id: "pi_paid", stripe_event_id: "evt_paid", kind: "full" });
  });
  const snapshot = () => JSON.stringify({ e: db.table("enquiries")[0], p: db.table("payments") });
  const refundEvent = (type: string, o: Record<string, unknown> = {}) => {
    const body = JSON.stringify({ id: `evt_${type}_${o.status ?? "x"}_${o.id ?? "re_dash"}`, object: "event", type, data: { object: { id: "re_dash", object: "refund", amount: 37550, currency: "gbp", status: "succeeded", reason: "requested_by_customer", payment_intent: "pi_paid", metadata: {}, ...o } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return stripeWebhook(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body }));
  };
  const form = (f: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(f)) d.set(k, v); return d; };

  it("a refund made in the Stripe dashboard is recorded, and the payment is unchanged", async () => {
    const before = snapshot();
    await refundEvent("refund.created");
    expect(db.table("refunds")).toHaveLength(1);
    expect(db.table("refunds")[0]).toMatchObject({ enquiry_id: enquiryId, stripe_refund_id: "re_dash", stripe_payment_intent_id: "pi_paid", amount_pence: 37550, source: "stripe_dashboard", status: "succeeded" });
    expect(snapshot()).toBe(before);
    expect(emails.some((m) => m.subject.startsWith("Refund recorded"))).toBe(true);
  });

  it("the same refund reported twice is recorded once", async () => {
    await refundEvent("refund.created");
    await refundEvent("refund.updated");
    expect(db.table("refunds")).toHaveLength(1);
  });

  it("a pending refund's status is updated when Stripe reports the outcome; a failure alerts you", async () => {
    await refundEvent("refund.created", { status: "pending" });
    await refundEvent("refund.failed", { status: "failed" });
    expect(db.table("refunds")).toHaveLength(1);
    expect(db.table("refunds")[0].status).toBe("failed");
    expect(emails.some((m) => m.subject.includes("REFUND FAILED"))).toBe(true);
  });

  it("a failed refund alerts you once, even when Stripe sends both 'refund.updated' and 'refund.failed'", async () => {
    await refundEvent("refund.created", { status: "succeeded" });
    await refundEvent("refund.updated", { status: "failed" });
    await refundEvent("refund.failed", { status: "failed" });
    expect(db.table("refunds")[0].status).toBe("failed");
    expect(emails.filter((m) => m.subject.includes("REFUND FAILED"))).toHaveLength(1);
  });

  it("a finished refund's outcome isn't overwritten by a later, out-of-order event", async () => {
    await refundEvent("refund.created", { status: "succeeded" });
    await refundEvent("refund.updated", { status: "pending" });
    expect(db.table("refunds")[0].status).toBe("succeeded");
  });

  it("a refund in a different currency from the original payment is not recorded; you're alerted", async () => {
    const before = snapshot();
    const res = await refundEvent("refund.created", { currency: "eur" });
    expect(res.status).toBe(200); // handled – Stripe doesn't keep retrying
    expect(db.table("refunds")).toHaveLength(0);
    expect(snapshot()).toBe(before);
    expect(emails.some((m) => m.subject.startsWith("⚠ REFUND NEEDS CHECKING"))).toBe(true);
  });

  it("a refund that would exceed what's left of the original payment is not recorded; you're alerted", async () => {
    await refundEvent("refund.created", { id: "re_a", amount: 30000 });
    const res = await refundEvent("refund.created", { id: "re_b", amount: 7551 });
    expect(res.status).toBe(200);
    expect(db.table("refunds").map((r) => r.stripe_refund_id)).toEqual(["re_a"]);
    expect(emails.some((m) => m.subject.startsWith("⚠ REFUND NEEDS CHECKING"))).toBe(true);
    await refundEvent("refund.created", { id: "re_c", amount: 7550 }); // exactly the rest is fine
    expect(db.table("refunds").map((r) => r.stripe_refund_id)).toEqual(["re_a", "re_c"]);
  });

  it("'refund created (pending)' and 'refund updated (succeeded)' arriving at the same moment end up succeeded, recorded once", async () => {
    await Promise.all([refundEvent("refund.created", { status: "pending" }), refundEvent("refund.updated", { status: "succeeded" })]);
    expect(db.table("refunds")).toHaveLength(1);
    expect(db.table("refunds")[0].status).toBe("succeeded");
  });

  it("admin refund: Stripe is asked to refund the original payment only – no currency or amount comes from the form except the amount checked above", async () => {
    await refundPayment(enquiryId, null, form({ amount: "375.50", note: "Cancelled", currency: "usd", payment_intent: "pi_other" }));
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: "pi_paid", amount: 37550 }), expect.anything());
    expect(createRefund.mock.calls[0][0]).not.toHaveProperty("currency");
  });

  it("ignores refunds of payments this website never took", async () => {
    await refundEvent("refund.created", { payment_intent: "pi_someone_else" });
    expect(db.table("refunds")).toHaveLength(0);
  });

  it("admin refund: refunds through Stripe to the original payment, records it, cancels if asked, payment untouched", async () => {
    const payBefore = JSON.stringify(db.table("payments"));
    const paidFields = ["deposit_paid_at", "deposit_paid_pence", "stripe_payment_intent_id", "agreed_price_pence", "deposit_pence"].map((k) => db.table("enquiries")[0][k]);
    const res = await refundPayment(enquiryId, null, form({ amount: "375.50", note: "Cancelled more than 48 hours before", cancelBooking: "on" }));
    expect(res?.ok).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ payment_intent: "pi_paid", amount: 37550 }), expect.objectContaining({ idempotencyKey: expect.any(String) }));
    expect(db.table("refunds")[0]).toMatchObject({ stripe_refund_id: "re_admin", amount_pence: 37550, source: "admin", note: "Cancelled more than 48 hours before" });
    expect(db.table("enquiries")[0].status).toBe("cancelled");
    expect(JSON.stringify(db.table("payments"))).toBe(payBefore);
    expect(["deposit_paid_at", "deposit_paid_pence", "stripe_payment_intent_id", "agreed_price_pence", "deposit_pence"].map((k) => db.table("enquiries")[0][k])).toEqual(paidFields);
  });

  it("admin refund: partial refund allowed; can't refund more than what's left", async () => {
    expect((await refundPayment(enquiryId, null, form({ amount: "300", note: "Late cancellation – evidenced materials cost" })))?.ok).toBe(true);
    const again = await refundPayment(enquiryId, null, form({ amount: "100", note: "Second refund" }));
    expect(again?.ok).toBe(false);
    expect(createRefund).toHaveBeenCalledTimes(1);
  });

  it("admin refund: refused for an unpaid booking, without a reason, or for a bad amount – Stripe isn't called", async () => {
    db.table("enquiries")[0].deposit_paid_at = null;
    expect((await refundPayment(enquiryId, null, form({ amount: "10", note: "Test reason" })))?.ok).toBe(false);
    db.table("enquiries")[0].deposit_paid_at = "2026-11-23T12:00:00Z";
    expect((await refundPayment(enquiryId, null, form({ amount: "10", note: "" })))?.ok).toBe(false);
    expect((await refundPayment(enquiryId, null, form({ amount: "-5", note: "Test reason" })))?.ok).toBe(false);
    expect((await refundPayment(enquiryId, null, form({ amount: "999", note: "Test reason" })))?.ok).toBe(false);
    expect(createRefund).not.toHaveBeenCalled();
  });

  for (const [label, o] of [
    ["Stripe says the original payment didn't succeed", { status: "processing" }],
    ["the original payment isn't in GBP", { currency: "eur" }],
    ["Stripe says the payment belongs to another booking", { metadata: { enquiry_id: "00000000-0000-4000-8000-000000000000" } }],
    ["Stripe's amount differs from the booking's recorded payment", { amount_received: 30000 }],
    ["Stripe shows it was already refunded in the dashboard", { latest_charge: { amount: 37550, amount_refunded: 37550 } }],
  ] as const) {
    it(`admin refund: refused when ${label} – Stripe isn't asked to refund`, async () => {
      original = { ...o };
      const res = await refundPayment(enquiryId, null, form({ amount: "375.50", note: "Cancelled more than 48 hours before" }));
      expect(res?.ok).toBe(false);
      expect(createRefund).not.toHaveBeenCalled();
      expect(db.table("refunds")).toHaveLength(0);
    });
  }

  it("admin refund: refused when the payment log doesn't match the booking's payment", async () => {
    db.table("payments")[0].amount_pence = 100;
    const res = await refundPayment(enquiryId, null, form({ amount: "375.50", note: "Cancelled more than 48 hours before" }));
    expect(res?.ok).toBe(false);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("admin refund: verifies the original payment with Stripe (including its charge) before refunding", async () => {
    await refundPayment(enquiryId, null, form({ amount: "100", note: "Partial – evidenced costs" }));
    expect(retrieveOriginal).toHaveBeenCalledWith("pi_paid", { expand: ["latest_charge"] });
    expect(createRefund).toHaveBeenCalledTimes(1);
  });

  it("a refund that later fails (after succeeding) is updated; a stale 'pending' afterwards is ignored", async () => {
    await refundEvent("refund.created", { status: "succeeded" });
    await refundEvent("refund.failed", { status: "failed" });
    await refundEvent("refund.updated", { status: "pending" });
    expect(db.table("refunds")[0].status).toBe("failed");
  });

  it("admin refund: if Stripe refuses, nothing is recorded or changed", async () => {
    createRefund.mockImplementationOnce(async () => { throw new Error("charge_already_refunded"); });
    const before = snapshot();
    const res = await refundPayment(enquiryId, null, form({ amount: "375.50", note: "Cancelled", cancelBooking: "on" }));
    expect(res?.ok).toBe(false);
    expect(db.table("refunds")).toHaveLength(0);
    expect(snapshot()).toBe(before);
  });
});

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
    db.table("enquiries").push({ id: enquiryId, reference: "TT-PART", status: "deposit_requested", full_name: "Pat", email: "p@example.com", agreed_price_pence: 37550, deposit_pence: 37550, payment_type: "full", deposit_paid_at: null, stripe_payment_intent_id: null, cancellation_terms_accepted_at: "2026-11-23T12:00:00Z", stripe_checkout_session_id: "cs_p", consent_id: "con_p", ...o });

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

  it("refuses to confirm a booking without a consent evidence record (a timestamp alone isn't enough)", async () => {
    seed({ consent_id: null });
    await send(37550);
    expect(db.table("enquiries")[0]).toMatchObject({ status: "deposit_requested", deposit_paid_at: null });
    expect(db.table("payments")[0]).toMatchObject({ outcome: "needs_review", notes: expect.stringContaining("consent") });
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

  it("records an early-start request only with both legally required acknowledgements", async () => {
    seed();
    await pay({ acceptTerms: "on", earlyStart: "on", ackPayForWork: "on", ackLosesRight: "on" });
    expect(db.table("enquiries")[0].early_start_requested_at).toBeTruthy();
    expect(db.table("booking_consents")[0]).toMatchObject({ early_start_requested: true, early_start_ack_pay_for_work: true, early_start_ack_loses_right: true });
    expect(Object.keys(db.table("booking_consents")[0].statements as object)).toEqual(["acceptTerms", "earlyStart", "ackPayForWork", "ackLosesRight"]);
  });

  it("refuses an early-start request without both acknowledgements – no consent saved, no payment page", async () => {
    for (const extra of [{}, { ackPayForWork: "on" }, { ackLosesRight: "on" }] as Record<string, string>[]) {
      seed();
      const res = await pay({ acceptTerms: "on", earlyStart: "on", ...extra });
      expect(res.headers.get("location")).toContain("error=earlystart");
      db.tables.enquiries = [];
    }
    expect(db.table("booking_consents")).toHaveLength(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("stores consent evidence: terms version, fingerprint of the exact text, exact wording, price shown – and links it to the booking", async () => {
    seed();
    await pay({ acceptTerms: "on" });
    const c = db.table("booking_consents")[0];
    expect(c).toMatchObject({ enquiry_id: db.table("enquiries")[0].id, terms_version: CANCELLATION_TERMS_VERSION, terms_sha256: TERMS_FINGERPRINTS[CANCELLATION_TERMS_VERSION], accepted_terms: true, early_start_requested: false, early_start_ack_pay_for_work: false, early_start_ack_loses_right: false, amount_pence: 37550 });
    expect(c.statements).toEqual({ acceptTerms: CONSENT_STATEMENTS.acceptTerms });
    expect(db.table("enquiries")[0]).toMatchObject({ consent_id: c.id, cancellation_terms_version: CANCELLATION_TERMS_VERSION, early_start_requested_at: null });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ consent_id: c.id, terms_version: CANCELLATION_TERMS_VERSION }) }), expect.anything());
  });

  it("fabricated consent evidence in a crafted request is ignored – wording, version, fingerprint and price come only from the server", async () => {
    seed();
    await pay({
      acceptTerms: "on",
      statements: JSON.stringify({ acceptTerms: "I agree to pay nothing" }),
      terms_version: "1999-01-01", terms_sha256: "0".repeat(64), early_start_requested: "true",
      early_start_ack_pay_for_work: "true", consent_id: "c0000000-0000-4000-a000-000000000099", amount_pence: "1", agreedPricePence: "1",
      user_agent: "forged",
    });
    const c = db.table("booking_consents")[0];
    expect(c).toMatchObject({ terms_version: CANCELLATION_TERMS_VERSION, terms_sha256: TERMS_FINGERPRINTS[CANCELLATION_TERMS_VERSION], early_start_requested: false, early_start_ack_pay_for_work: false, amount_pence: 37550 });
    expect(c.statements).toEqual({ acceptTerms: CONSENT_STATEMENTS.acceptTerms });
    expect(c.id).not.toBe("c0000000-0000-4000-a000-000000000099");
    expect(db.table("enquiries")[0].consent_id).toBe(c.id);
  });

  it("acknowledgements ticked without an early-start request are not recorded as an early-start request", async () => {
    seed();
    await pay({ acceptTerms: "on", ackPayForWork: "on", ackLosesRight: "on" });
    expect(db.table("booking_consents")[0]).toMatchObject({ early_start_requested: false, early_start_ack_pay_for_work: false, early_start_ack_loses_right: false });
    expect(db.table("enquiries")[0].early_start_requested_at).toBeNull();
  });

  it("a box only counts when ticked ('on'): other values for the early-start boxes are refused", async () => {
    seed();
    const res = await pay({ acceptTerms: "on", earlyStart: "on", ackPayForWork: "yes", ackLosesRight: "true" });
    expect(res.headers.get("location")).toContain("error=earlystart");
    expect(db.table("booking_consents")).toHaveLength(0);
  });

  it("if the consent evidence can't be saved, no payment page is opened", async () => {
    seed();
    db.failInsertOn.add("booking_consents");
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).toContain("error=stripe");
    expect(create).not.toHaveBeenCalled();
    expect(db.table("enquiries")[0].consent_id ?? null).toBeNull();
  });

  it("won't open the payment page until the cancellation policy is confirmed", async () => {
    seed();
    const res = await pay({});
    expect(res.headers.get("location")).toContain("error=terms");
    expect(create).not.toHaveBeenCalled();
  });

  it("won't open the payment page if the confirmation couldn't be saved", async () => {
    seed();
    db.noopUpdateOn.add("enquiries");
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).toContain("error=");
    expect(create).not.toHaveBeenCalled();
  });

  it("records the acceptance time and passes it to Stripe", async () => {
    seed();
    await pay({ acceptTerms: "on" });
    const accepted = db.table("enquiries")[0].cancellation_terms_accepted_at as string;
    expect(accepted).toBeTruthy();
    expect((create.mock.calls[0][0] as { metadata: Record<string, string> }).metadata.terms_accepted_at).toBe(accepted);
  });

  it("refuses when there is no agreed price", async () => {
    seed({ agreed_price_pence: null, deposit_pence: null });
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).not.toContain("checkout.stripe.com");
    expect(create).not.toHaveBeenCalled();
  });

  it("closes an old open Stripe page for a different amount before opening a new one", async () => {
    seed({ stripe_checkout_session_id: "cs_old" });
    const retrieve = vi.fn(async () => ({ id: "cs_old", status: "open", amount_total: 18775, url: "https://checkout.stripe.com/c/cs_old" }));
    const expire = vi.fn(async () => ({}));
    Object.assign(stripe.checkout.sessions, { retrieve, expire });
    const res = await pay({ acceptTerms: "on" });
    expect(expire).toHaveBeenCalledWith("cs_old");
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/cs_new");
    expect(db.table("enquiries")[0].stripe_checkout_session_id).toBe("cs_new");
    Object.assign(stripe.checkout.sessions, { retrieve: vi.fn(), expire: vi.fn() });
  });

  it("the Stripe page is created in GBP for exactly the agreed price, as one item", async () => {
    seed();
    await pay({ acceptTerms: "on", amount: "1", currency: "usd", unit_amount: "100" });
    const params = create.mock.calls[0][0] as { currency: string; line_items: { quantity: number; price_data: { currency: string; unit_amount: number } }[] };
    expect(params.currency).toBe("gbp");
    expect((params as unknown as { adaptive_pricing: { enabled: boolean } }).adaptive_pricing).toEqual({ enabled: false }); // customer can't be charged in another currency
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0]).toMatchObject({ quantity: 1, price_data: { currency: "gbp", unit_amount: 37550 } });
  });

  it("only an actual tick counts as accepting the terms", async () => {
    seed();
    for (const v of ["", "false", "off", "yes"]) {
      const res = await pay({ acceptTerms: v });
      expect(res.headers.get("location")).toContain("error=terms");
    }
    expect(create).not.toHaveBeenCalled();
    expect(db.table("enquiries")[0].cancellation_terms_accepted_at ?? null).toBeNull();
  });

  it("won't open a payment page for a booking that is already paid", async () => {
    seed({ status: "booking_confirmed", deposit_paid_at: "2026-11-23T12:00:00Z", deposit_paid_pence: 37550, cancellation_terms_accepted_at: "2026-11-23T11:00:00Z" });
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).not.toContain("checkout.stripe.com");
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a half-price request labelled as a full payment", async () => {
    seed({ deposit_pence: 18775, payment_type: "full" });
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).toContain("error=amount");
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to charge anything other than 100% of the agreed price", async () => {
    seed({ deposit_pence: 18775, payment_type: "deposit", deposit_percent: 50 });
    const res = await pay({ acceptTerms: "on" });
    expect(res.headers.get("location")).toContain("error=amount");
    expect(create).not.toHaveBeenCalled();
  });
});
