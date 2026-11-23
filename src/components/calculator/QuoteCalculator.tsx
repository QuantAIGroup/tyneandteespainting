"use client";

/**
 * THE INSTANT QUOTATION CALCULATOR
 *
 * Step 1  Choose rooms/services (add as many as you like)
 * Step 2  Enter measurements (metres or centimetres)
 * Step 3  Room condition + number of coats
 * Step 4  Upload up to six photos
 * Step 5  See the estimate with a full breakdown
 * Step 6  Send your details → saved as an enquiry with a reference number
 *
 * The price shown here uses the same pricing engine as the server. The server
 * recalculates it when the enquiry is saved, so the saved price can't be tampered with.
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BedDouble, CheckCircle2, Layers, Loader2, Pencil, PaintRoller, Sofa, Trash2, Square } from "lucide-react";
import { calculateQuote } from "@/lib/pricing/engine";
import { INSPECTION_MESSAGE } from "@/lib/pricing/extras";
import type { ExtraKind, PricingSettings } from "@/lib/pricing/types";
import { customerDetailsSchema, type CustomerDetails } from "@/lib/enquiry";
import { LIMITS } from "@/lib/pricing/schema";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PRICING_RULES } from "@/components/home/PricingPromise";
import { createExtra, createItem, isMeasured, validItems, validateDraft, type ExtraDraft, type ItemDraft, type ItemKind, type Unit } from "./draft";
import { ExtrasPicker, QuantityStepper } from "./ExtrasPicker";
import { ItemPrice } from "./ItemPrice";
import { extraWorking, money, optionPrice } from "./prices";
import { ItemMeasurements } from "./ItemMeasurements";
import { ItemCondition } from "./ItemCondition";
import { RoomSummary } from "./RoomSummary";
import { PhotoUploader, type UploadedPhoto } from "./PhotoUploader";
import { QuoteBreakdown, ESTIMATE_STATEMENT } from "./QuoteBreakdown";
import { RoomDiagram, SkirtingDiagram } from "./MeasureDiagram";
import { CallToDiscuss } from "@/components/CallToDiscuss";

const STEPS = ["Select your service", "Enter measurements", "Upload photographs", "Your estimate"] as const;

const ADD_OPTIONS: { kind: ItemKind; label: string; note: string; icon: typeof BedDouble }[] = [
  { kind: "bedroom", label: "Bedroom", note: "Walls – enter the room size", icon: BedDouble },
  { kind: "living_room", label: "Living room", note: "Walls – enter the room size", icon: Sofa },
  { kind: "ceiling", label: "Ceiling Painting", note: "Enter the ceiling length and width", icon: Square },
  { kind: "skirting", label: "Skirting Boards", note: "Enter the total length in metres", icon: Layers },
];

type CustomerDraft = {
  fullName: string;
  email: string;
  phone: string;
  postcode: string;
  preferredContact: "phone" | "email" | "either";
  preferredStartDate: string;
  comments: string;
  website: string;
};

const EMPTY_CUSTOMER: CustomerDraft = { fullName: "", email: "", phone: "", postcode: "", preferredContact: "phone", preferredStartDate: "", comments: "", website: "" };

const VALID_KINDS: ItemKind[] = ["bedroom", "living_room", "skirting", "ceiling"];

export function QuoteCalculator({ pricing, uploadsEnabled, phone }: { pricing: PricingSettings; uploadsEnabled: boolean; phone: string }) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ItemDraft[]>(() => {
    const add = searchParams.get("add") as ItemKind | null;
    return add && VALID_KINDS.includes(add) ? [createItem(add, [], pricing.standardCoats, `initial-${add}`)] : [];
  });
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>("m");
  const [showErrors, setShowErrors] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [customer, setCustomer] = useState<CustomerDraft>(EMPTY_CUSTOMER);
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerDetails, string>>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const draftIdRef = useRef<string | null>(null);
  const getDraftId = () => (draftIdRef.current ??= crypto.randomUUID());

  const quote = useMemo(() => calculateQuote(validItems(items), pricing), [items, pricing]);
  const validations = useMemo(() => Object.fromEntries(items.map((i) => [i.id, validateDraft(i)])), [items]);
  const allValid = items.length > 0 && items.every((i) => validations[i.id].item !== null);

  const update = (id: string, patch: Partial<ItemDraft>) => setItems((prev) => prev.map((i) => (i.id === id ? ({ ...i, ...patch } as ItemDraft) : i)));
  const addItem = (kind: ItemKind) => setItems((prev) => [...prev, createItem(kind, prev, pricing.standardCoats)]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const addExtra = (kind: ExtraKind) => setItems((prev) => (prev.some((i) => i.type === "extra" && i.extra === kind) ? prev : [...prev, createExtra(kind)]));
  const changeExtra = (kind: ExtraKind, quantity: number | null) =>
    setItems((prev) => prev.map((i) => (i.type === "extra" && i.extra === kind ? { ...i, quantity } : i)));
  const removeExtra = (kind: ExtraKind) => setItems((prev) => prev.filter((i) => !(i.type === "extra" && i.extra === kind)));
  const measured = items.filter(isMeasured);
  const extras = items.filter((i): i is ExtraDraft => i.type === "extra");
  const extraErrors = Object.fromEntries(extras.map((e) => [e.id, Object.values(validations[e.id]?.errors ?? {})[0]]));
  /** Price for one item in the running total – never blank. */
  const itemPriceText = (item: ItemDraft): string => {
    const lines = quote.lines.filter((l) => l.itemId === item.id);
    if (lines.length === 0) return item.type === "extra" ? "Enter a quantity" : "Enter measurements";
    if (lines.some((l) => l.status === "manual")) return "Inspection required";
    return money(lines.reduce((s, l) => s + (l.amountPence ?? 0), 0));
  };

  function goTo(next: number) {
    setStepError(null);
    setStep(next);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function next() {
    if (step === 0 && items.length === 0) return setStepError("Add at least one room, service or extra to continue.");
    if (step === 0 && extras.some((e) => validations[e.id].item === null)) return setStepError("Please enter a quantity for each extra you've selected.");
    if (step === 1 && !allValid) {
      setShowErrors(true);
      return setStepError("Please check the highlighted measurements.");
    }
    if (step === 2 && photos.some((p) => p.status === "uploading")) return setStepError("Please wait for your photos to finish uploading.");
    goTo(step + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = customerDetailsSchema.safeParse({
      ...customer,
      preferredStartDate: customer.preferredStartDate || undefined,
      comments: customer.comments || undefined,
    });
    if (!parsed.success) {
      const errs: Partial<Record<keyof CustomerDetails, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CustomerDetails;
        if (!errs[key]) errs[key] = issue.message;
      }
      setCustomerErrors(errs);
      return;
    }
    setCustomerErrors({});
    const finalItems = validItems(items);
    if (finalItems.length !== items.length) return setSubmitError("Some measurements are missing. Please go back and check them.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: getDraftId(),
          items: finalItems,
          customer: parsed.data,
          photos: photos.filter((p) => p.status === "done" && p.path).map((p) => ({ path: p.path, fileName: p.fileName, contentType: p.contentType, size: p.size })),
          website: customer.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      setReference(json.reference);
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasRooms = items.some((i) => i.type === "bedroom" || i.type === "living_room" || i.type === "ceiling");
  const hasSkirting = items.some((i) => i.type === "skirting");

  // ---------- Confirmation ----------
  if (reference) {
    return (
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-ink-900/10 sm:p-12">
        <CheckCircle2 className="mx-auto size-14 text-brand-700" aria-hidden />
        <h2 className="mt-5 text-3xl">Thank you – your enquiry has been sent</h2>
        <p className="mt-4 text-lg text-ink-700">Your enquiry reference is</p>
        <p className="mt-2 inline-block rounded-lg bg-grey-50 px-5 py-3 font-mono text-2xl font-semibold tracking-wider text-ink-950 ring-1 ring-grey-200">{reference}</p>
        <div className="mt-8 text-left">
          <CallToDiscuss phone={phone} compact />
        </div>
        <div className="mt-6 space-y-3 text-left text-[15px] leading-relaxed text-ink-800">
          <p>
            <strong>What happens next:</strong> we&rsquo;ll review your measurements and photographs. Give us a call (or we&rsquo;ll contact you by your preferred method) to talk through the job and agree your final price.
          </p>
          <p>
            <strong>This is not a booking yet.</strong> Nothing has been charged and you are not committed to anything. We only send a payment link for the full agreed price after we&rsquo;ve spoken and you&rsquo;ve agreed the final quotation.
          </p>
          <p>Please keep your reference handy when you call.</p>
        </div>
        <Link href="/" className={buttonClasses("outline", "md", "mt-8")}>
          Back to the homepage
        </Link>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progress */}
      <nav aria-label="Quotation steps" className="mb-8">
        <ol className="flex gap-1.5">
          {STEPS.map((name, i) => (
            <li key={name} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-ink-900/10"}`} />
              <span className={`mt-2 hidden text-xs font-medium sm:block ${i === step ? "text-ink-950" : "text-ink-600"}`} aria-current={i === step ? "step" : undefined}>
                {i + 1}. {name}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-medium text-ink-700 sm:hidden">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </nav>

      <div className={`grid gap-8 ${step >= 1 && step <= 2 ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <div className="min-w-0">
          {/* STEP 1: SERVICES */}
          {step === 0 && (
            <section aria-labelledby="step-services">
              <h2 id="step-services" className="text-2xl sm:text-3xl">
                Select your service
              </h2>
              <p className="mt-2 text-ink-700">Add each room separately – for example Bedroom 1, Bedroom 2 and the living room. Every option shows its price, and your estimate updates as you go.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {ADD_OPTIONS.map(({ kind, label, note, icon: Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addItem(kind)}
                    disabled={items.length >= LIMITS.maxItems}
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-ink-900/12 transition hover:bg-grey-50 hover:ring-brand-600 disabled:opacity-50"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-grey-100 text-brand-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium text-ink-950">+ Add {label}</span>
                      <span className="block text-sm font-semibold text-brand-600">{optionPrice(kind, pricing)}</span>
                      <span className="block text-sm text-ink-600">{note}</span>
                    </span>
                  </button>
                ))}
              </div>

              <h3 className="mt-10 font-sans text-lg font-semibold">Your rooms and services ({measured.length})</h3>
              {measured.length === 0 ? (
                <p className="mt-3 rounded-lg bg-grey-50 p-5 text-ink-700">No rooms added yet. Choose from the options above, or just pick extras below.</p>
              ) : (
                <ul className="mt-3 divide-y divide-ink-900/8 rounded-2xl bg-white ring-1 ring-ink-900/10">
                  {measured.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <PaintRoller className="size-5 shrink-0 text-brand-600" aria-hidden />
                      <label className="sr-only" htmlFor={`label-${item.id}`}>
                        Name for this item
                      </label>
                      <div className="relative flex-1">
                        <input
                          id={`label-${item.id}`}
                          value={item.label}
                          maxLength={60}
                          onChange={(e) => update(item.id, { label: e.target.value })}
                          onBlur={(e) => !e.target.value.trim() && update(item.id, { label: "Room" })}
                          className="w-full rounded-md border border-transparent px-2 py-1.5 text-[15px] font-medium text-ink-950 hover:border-ink-900/15 focus:border-brand-600 focus:outline-none"
                        />
                        <Pencil className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-600/50" aria-hidden />
                      </div>
                      <span className="shrink-0 text-right text-sm font-semibold text-ink-800">
                        {quote.lines.some((l) => l.itemId === item.id) ? itemPriceText(item) : optionPrice(item.type, pricing)}
                      </span>
                      <button type="button" onClick={() => removeItem(item.id)} className="grid size-10 place-items-center rounded-md text-ink-600 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Remove {item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-10 font-sans text-lg font-semibold">Extras</h3>
              <p className="mt-1 mb-4 text-ink-700">Choose any extras and set how many. The price updates straight away.</p>
              <ExtrasPicker items={extras} pricing={pricing} errors={extraErrors} onAdd={addExtra} onChange={changeExtra} onRemove={removeExtra} />

              <div className="mt-8 flex items-baseline justify-between gap-4 rounded-2xl bg-ink-950 px-6 py-4 text-white" aria-live="polite">
                <span className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-300">Estimated labour so far</span>
                <span className="text-2xl font-extrabold">{money(quote.totalPence)}</span>
              </div>
            </section>
          )}

          {/* STEP 2: MEASUREMENTS */}
          {step === 1 && (
            <section aria-labelledby="step-measure">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="step-measure" className="text-2xl sm:text-3xl">
                    Enter your measurements
                  </h2>
                  <p className="mt-2 text-ink-700">A tape measure is all you need. Round to the nearest 5 cm – it doesn&rsquo;t need to be exact.</p>
                </div>
                <fieldset className="flex rounded-lg bg-white p-1 ring-1 ring-ink-900/12">
                  <legend className="sr-only">Measurement units</legend>
                  {(["m", "cm"] as const).map((u) => (
                    <label key={u} className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium ${unit === u ? "bg-ink-900 text-white" : "text-ink-800 hover:bg-grey-50"}`}>
                      <input type="radio" name="unit" value={u} checked={unit === u} onChange={() => setUnit(u)} className="sr-only" />
                      {u === "m" ? "Metres" : "Centimetres"}
                    </label>
                  ))}
                </fieldset>
              </div>

              <details className="mt-6 rounded-2xl bg-grey-50 ring-1 ring-grey-200" open>
                <summary className="cursor-pointer px-5 py-4 font-medium text-ink-950">Where do I measure?</summary>
                <div className="grid gap-6 px-5 pb-5 md:grid-cols-2">
                  {hasRooms && (
                    <div>
                      <RoomDiagram />
                      <ul className="mt-3 space-y-1.5 text-sm text-ink-800">
                        <li>
                          <strong>Length and width:</strong> measure along the floor from one wall to the opposite wall.
                        </li>
                        <li>
                          <strong>Wall height:</strong> from the top of the floor to the ceiling.
                        </li>
                        <li>
                          <strong>Doors and windows:</strong> don&rsquo;t subtract them – measure the full wall. That covers the careful cutting-in around them.
                        </li>
                      </ul>
                    </div>
                  )}
                  {hasSkirting && (
                    <div>
                      <SkirtingDiagram />
                      <p className="mt-3 text-sm text-ink-800">
                        <strong>Skirting boards:</strong> measure the skirting along each wall and add the lengths together. Don&rsquo;t include doorways.
                      </p>
                    </div>
                  )}
                </div>
              </details>

              <div className="mt-6 space-y-6">
                {measured.length === 0 && <p className="rounded-lg bg-grey-50 p-5 text-ink-700">No measurements needed – you&rsquo;ve only chosen extras.</p>}
                {measured.map((item) => (
                  <fieldset key={item.id} className="rounded-2xl bg-white p-5 ring-1 ring-ink-900/10 sm:p-6">
                    <legend className="sr-only">{item.label}</legend>
                    <h3 aria-hidden className="mb-5 font-bold tracking-tight text-xl">
                      {item.label}
                    </h3>
                    <ItemMeasurements item={item} unit={unit} errors={showErrors ? validations[item.id].errors : {}} update={(p) => update(item.id, p)} />
                    <ItemPrice lines={quote.lines.filter((l) => l.itemId === item.id)} valid={validations[item.id].item !== null} />
                    <div className="mt-6 border-t border-ink-950/8 pt-5">
                      <h4 className="mb-1 text-[15px] font-bold text-ink-950">Condition</h4>
                      <p className="mb-4 text-sm text-ink-600">Small nail holes and minor cracks are included. Bigger repairs need a manual quotation.</p>
                      <ItemCondition item={item} update={(p) => update(item.id, p)} />
                    </div>
                  </fieldset>
                ))}
                {extras.length > 0 && (
                  <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-900/10 sm:p-6">
                    <h3 className="mb-4 font-bold tracking-tight text-xl">Your extras</h3>
                    <ul className="divide-y divide-ink-950/8">
                      {extras.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div>
                            <p className="font-semibold text-ink-950">{e.label}</p>
                            <p className="text-sm text-ink-700">{extraErrors[e.id] ?? (e.quantity === null ? "Please enter a quantity" : extraWorking(e.extra, e.quantity, pricing))}</p>
                          </div>
                          <QuantityStepper id={`qty2-${e.extra}`} label={e.label.toLowerCase()} value={e.quantity} onChange={(n) => changeExtra(e.extra, n)} onRemove={() => removeExtra(e.extra)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* STEP 3: PHOTOS */}
          {step === 2 && (
            <section aria-labelledby="step-photos">
              <h2 id="step-photos" className="text-2xl sm:text-3xl">
                Upload photographs <span className="text-lg font-normal text-ink-600">(optional, up to {LIMITS.maxPhotos})</span>
              </h2>
              <p className="mt-2 mb-6 text-ink-700">Photographs help us assess the condition of your room, so we can confirm your price without a wasted visit. Your price is still based on your measurements.</p>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-900/10 sm:p-6">
                <PhotoUploader getDraftId={getDraftId} photos={photos} setPhotos={setPhotos} enabled={uploadsEnabled} />
              </div>
            </section>
          )}

          {/* STEP 4: ESTIMATE + SEND DETAILS */}
          {step === 3 && (
            <section aria-labelledby="step-estimate">
              <h2 id="step-estimate" className="text-2xl sm:text-3xl">
                Your estimated labour price
              </h2>
              <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4">
                  <RoomSummary items={items} />
                  <QuoteBreakdown quote={quote} />
                  <p className="rounded-lg bg-grey-50 p-4 text-[15px] leading-relaxed text-ink-900">
                    <strong>Labour only.</strong> Paint, primer, filler and other materials are not included. There are no hidden charges – if the job turns out to need more work, we&rsquo;ll explain why and agree it with you first.
                  </p>
                  <p className="text-sm leading-relaxed text-ink-600">{ESTIMATE_STATEMENT}</p>
                </div>
                <div className="space-y-6">
                  <CallToDiscuss phone={phone} compact />
                  <ul className="space-y-3">
                    {PRICING_RULES.map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex gap-3">
                        <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                        <span className="text-sm">
                          <strong className="text-ink-950">{title}.</strong> <span className="text-ink-700">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-12 border-t border-ink-950/8 pt-10">
                <h3 className="text-2xl">Send us your estimate</h3>
                <p className="mt-2 max-w-2xl text-ink-700">
                  Free and no obligation. We&rsquo;ll review your details and photographs, talk it through with you and confirm your fixed labour price. Nothing is charged and nothing is booked yet.
                </p>
                <div className="mt-6 max-w-2xl">
                <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl bg-white p-5 ring-1 ring-ink-900/10 sm:p-6">
                  <Field label="Full name" htmlFor="q-name" required error={customerErrors.fullName}>
                    <Input id="q-name" autoComplete="name" value={customer.fullName} invalid={!!customerErrors.fullName} onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })} />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Email address" htmlFor="q-email" required error={customerErrors.email}>
                      <Input id="q-email" type="email" autoComplete="email" value={customer.email} invalid={!!customerErrors.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                    </Field>
                    <Field label="Telephone number" htmlFor="q-phone" required error={customerErrors.phone}>
                      <Input id="q-phone" type="tel" autoComplete="tel" value={customer.phone} invalid={!!customerErrors.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                    </Field>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Property postcode" htmlFor="q-postcode" required error={customerErrors.postcode}>
                      <Input id="q-postcode" autoComplete="postal-code" value={customer.postcode} invalid={!!customerErrors.postcode} onChange={(e) => setCustomer({ ...customer, postcode: e.target.value.toUpperCase() })} />
                    </Field>
                    <Field label="Preferred contact method" htmlFor="q-contact" required>
                      <Select id="q-contact" value={customer.preferredContact} onChange={(e) => setCustomer({ ...customer, preferredContact: e.target.value as CustomerDraft["preferredContact"] })}>
                        <option value="phone">Telephone</option>
                        <option value="email">Email</option>
                        <option value="either">Either</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Preferred start date (optional)" htmlFor="q-date" error={customerErrors.preferredStartDate} hint="We'll confirm availability with you.">
                    <Input id="q-date" type="date" value={customer.preferredStartDate} onChange={(e) => setCustomer({ ...customer, preferredStartDate: e.target.value })} />
                  </Field>
                  <Field label="Anything else we should know? (optional)" htmlFor="q-comments" error={customerErrors.comments}>
                    <Textarea id="q-comments" rows={4} value={customer.comments} onChange={(e) => setCustomer({ ...customer, comments: e.target.value })} />
                  </Field>
                  <div className="hidden" aria-hidden>
                    <label htmlFor="q-website">Website</label>
                    <input id="q-website" tabIndex={-1} autoComplete="off" value={customer.website} onChange={(e) => setCustomer({ ...customer, website: e.target.value })} />
                  </div>
                  <p className="text-sm text-ink-600">
                    We&rsquo;ll only use your details to deal with this enquiry. See our{" "}
                    <Link href="/privacy" className="underline underline-offset-2">
                      privacy notice
                    </Link>
                    .
                  </p>
                  {submitError && <Alert tone="error">{submitError}</Alert>}
                  <Button type="submit" size="lg" disabled={submitting} className="w-full">
                    {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                    {submitting ? "Sending…" : "Send my estimate"}
                  </Button>
                </form>
                </div>
              </div>
            </section>
          )}

          {stepError && (
            <div className="mt-6">
              <Alert tone="error">{stepError}</Alert>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-ink-900/8 pt-6 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 && (
              <Button type="button" size="lg" onClick={next}>
                {step === 2 ? "See my estimate" : "Continue"} <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        {/* Live running total (steps 2–4) */}
        {step >= 1 && step <= 2 && (
          <aside aria-label="Running estimate" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <div className="rounded-2xl bg-ink-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">Running estimate</p>
              <p className="mt-2 font-bold tracking-tight text-4xl" aria-live="polite">
                {money(quote.totalPence)}
              </p>
              {!quote.hasPricedItems && <p className="mt-1 text-xs text-brand-300">Enter measurements or quantities to see your price.</p>}
              <p className="mt-1 text-sm text-ink-100/70">Labour only · paint not included</p>
              <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                {items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="truncate text-ink-100/85">
                      {item.label}
                      {item.type === "extra" && item.quantity !== null ? ` × ${item.quantity}` : ""}
                    </span>
                    <span className="shrink-0 font-medium">{itemPriceText(item)}</span>
                  </li>
                ))}
              </ul>
              {quote.requiresManualQuote && <p className="mt-4 text-xs text-brand-300">Items marked &ldquo;Inspection required&rdquo; aren&rsquo;t in this total – {INSPECTION_MESSAGE.toLowerCase()}.</p>}
              {quote.needsReview && <p className="mt-4 text-xs text-brand-300">Some items are flagged for review – see the estimate step.</p>}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile: slim running total pinned to the bottom of the screen */}
      {step >= 1 && step <= 2 && (
        <>
          <div className="h-20 lg:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-[72px] z-30 border-t border-white/10 bg-ink-950 px-5 py-3 text-white lg:hidden" aria-live="polite">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Running estimate</p>
                <p className="text-xs text-ink-100/70">Labour only · paint not included</p>
              </div>
              <p className="font-bold tracking-tight text-2xl">{money(quote.totalPence)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
