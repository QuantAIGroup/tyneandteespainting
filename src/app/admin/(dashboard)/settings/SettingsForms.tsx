"use client";

import { useActionState } from "react";
import type { BusinessSettings } from "@/config/site";
import type { PricingSettings } from "@/lib/pricing/types";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Textarea } from "@/components/ui/Form";
import { saveBusiness, savePricing } from "../../actions";

function MoneyInput({ name, label, defaultValue, suffix }: { name: string; label: string; defaultValue: number; suffix?: string }) {
  return (
    <Field label={label} htmlFor={name}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-navy-600">£</span>
        <input id={name} name={name} type="number" inputMode="decimal" step="0.01" min="0" required defaultValue={defaultValue} className="block w-full rounded-md border border-navy-900/15 bg-white py-2.5 pr-16 pl-7 text-[15px] focus:border-gold-500 focus:ring-2 focus:ring-gold-400/40 focus:outline-none" />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-navy-600">{suffix}</span>}
      </div>
    </Field>
  );
}

export function PricingForm({ pricing }: { pricing: PricingSettings }) {
  const [state, action, pending] = useActionState(savePricing, null);
  const groups = [
    { title: "Bedroom painting", rateName: "bedroom.ratePerSqm", rate: pricing.bedroom.ratePerSqm, rateSuffix: "per m²", minName: "bedroom.minimumCharge", min: pricing.bedroom.minimumCharge, minLabel: "Minimum per bedroom" },
    { title: "Living room painting", rateName: "livingRoom.ratePerSqm", rate: pricing.livingRoom.ratePerSqm, rateSuffix: "per m²", minName: "livingRoom.minimumCharge", min: pricing.livingRoom.minimumCharge, minLabel: "Minimum per living room" },
    { title: "Skirting boards", rateName: "skirting.ratePerMetre", rate: pricing.skirting.ratePerMetre, rateSuffix: "per metre", minName: "skirting.minimumCharge", min: pricing.skirting.minimumCharge, minLabel: "Minimum charge" },
    { title: "Ceiling painting", rateName: "ceiling.ratePerSqm", rate: pricing.ceiling.ratePerSqm, rateSuffix: "per m²", minName: "ceiling.minimumCharge", min: pricing.ceiling.minimumCharge, minLabel: "Minimum charge" },
  ];

  return (
    <form action={action} className="rounded-xl bg-white p-6 ring-1 ring-navy-900/10">
      <h2 className="font-sans text-lg font-semibold">Labour prices</h2>
      <p className="mt-1 text-sm text-navy-600">Labour only. Hourly rates are never shown anywhere on the website.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.title} className="rounded-lg bg-sand-50/70 p-4">
            <legend className="px-1 font-medium text-navy-950">{g.title}</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <MoneyInput name={g.rateName} label="Rate" defaultValue={g.rate} suffix={g.rateSuffix} />
              <MoneyInput name={g.minName} label={g.minLabel} defaultValue={g.min} />
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:max-w-xl">
        <MoneyInput name="roundToNearest" label="Round final total to the nearest" defaultValue={pricing.roundToNearest} />
        <Field label="Coats included as standard" htmlFor="standardCoats" hint="Requests for more coats are flagged for review.">
          <Input id="standardCoats" name="standardCoats" type="number" min={1} max={5} step={1} required defaultValue={pricing.standardCoats} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </Button>
        {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}

export function BusinessForm({ business }: { business: BusinessSettings }) {
  const [state, action, pending] = useActionState(saveBusiness, null);
  return (
    <form action={action} className="rounded-xl bg-white p-6 ring-1 ring-navy-900/10">
      <h2 className="font-sans text-lg font-semibold">Business details</h2>
      <p className="mt-1 text-sm text-navy-600">Anything still in [square brackets] is highlighted on the website as a placeholder.</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Business name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={business.name} required />
        </Field>
        <Field label="Telephone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={business.phone} />
        </Field>
        <Field label="Email" htmlFor="b-email">
          <Input id="b-email" name="email" defaultValue={business.email} />
        </Field>
        <Field label="Opening hours (optional)" htmlFor="openingHours" hint="e.g. Mon–Fri 8am–6pm">
          <Input id="openingHours" name="openingHours" defaultValue={business.openingHours} />
        </Field>
        <Field label="Business address (optional)" htmlFor="address" hint="Leave blank if you don't want to publish an address.">
          <Input id="address" name="address" defaultValue={business.address} />
        </Field>
        <Field label="Logo image URL (optional)" htmlFor="logoUrl" hint="Upload your logo to the gallery bucket or anywhere online and paste the https:// link.">
          <Input id="logoUrl" name="logoUrl" type="url" defaultValue={business.logoUrl} />
        </Field>
      </div>
      <div className="mt-5">
        <Field
          label="Verified claims (optional, one per line)"
          htmlFor="verifiedClaims"
          hint="Only add things you can prove, e.g. 'Fully insured – £2m public liability'. Each line appears in 'Why choose us'."
        >
          <Textarea id="verifiedClaims" name="verifiedClaims" rows={4} defaultValue={business.verifiedClaims.join("\n")} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save business details"}
        </Button>
        {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      </div>
    </form>
  );
}
