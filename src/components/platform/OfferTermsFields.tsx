import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { MATERIALS_OPTIONS } from "@/lib/platform/offers";

export interface OfferDefaults {
  scope?: string;
  surfacesAndPreparation?: string | null;
  exclusions?: string | null;
  fee?: string;
  materialsResponsibility?: string;
  materialsNotes?: string | null;
  proposedStartDate?: string;
  arrivalWindowStart?: string;
  arrivalWindowEnd?: string;
  estimatedDurationHours?: string;
  accessRequirements?: string | null;
  knownHazards?: string | null;
  customerRequirements?: string | null;
  paymentTerms?: string;
  paymentDueDays?: string;
}

/** The Schedule B job-record fields, used for offers AND counteroffers. */
export function OfferTermsFields({ d = {}, idPrefix = "o" }: { d?: OfferDefaults; idPrefix?: string }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Scope of work" htmlFor={id("scope")} required hint="Rooms, surfaces, coats and finish – the agreed result.">
          <Textarea id={id("scope")} name="scope" required minLength={10} defaultValue={d.scope} />
        </Field>
      </div>
      <Field label="Surfaces and preparation" htmlFor={id("prep")}>
        <Textarea id={id("prep")} name="surfacesAndPreparation" defaultValue={d.surfacesAndPreparation ?? ""} />
      </Field>
      <Field label="Exclusions" htmlFor={id("excl")} hint="What is NOT included.">
        <Textarea id={id("excl")} name="exclusions" defaultValue={d.exclusions ?? ""} />
      </Field>
      <Field label="Fee (£)" htmlFor={id("fee")} required hint="The subcontract fee for this job. It is only fixed once both sides accept.">
        <Input id={id("fee")} name="fee" inputMode="decimal" required pattern="^\d+(\.\d{1,2})?$" defaultValue={d.fee} />
      </Field>
      <Field label="Materials" htmlFor={id("mat")} required>
        <Select id={id("mat")} name="materialsResponsibility" defaultValue={d.materialsResponsibility ?? "painter"}>
          {MATERIALS_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Materials notes" htmlFor={id("matn")}>
          <Input id={id("matn")} name="materialsNotes" defaultValue={d.materialsNotes ?? ""} />
        </Field>
      </div>
      <Field label="Start date" htmlFor={id("date")} required>
        <Input id={id("date")} name="proposedStartDate" type="date" required defaultValue={d.proposedStartDate} />
      </Field>
      <Field label="Estimated duration (hours)" htmlFor={id("dur")}>
        <Input id={id("dur")} name="estimatedDurationHours" inputMode="decimal" defaultValue={d.estimatedDurationHours} />
      </Field>
      <Field label="Arrival window from" htmlFor={id("from")} required hint="Agreed for customer access – not a shift.">
        <Input id={id("from")} name="arrivalWindowStart" type="time" required defaultValue={d.arrivalWindowStart ?? "08:00"} />
      </Field>
      <Field label="Arrival window until" htmlFor={id("to")} required>
        <Input id={id("to")} name="arrivalWindowEnd" type="time" required defaultValue={d.arrivalWindowEnd ?? "10:00"} />
      </Field>
      <Field label="Access requirements" htmlFor={id("acc")}>
        <Textarea id={id("acc")} name="accessRequirements" defaultValue={d.accessRequirements ?? ""} />
      </Field>
      <Field label="Known hazards" htmlFor={id("haz")}>
        <Textarea id={id("haz")} name="knownHazards" defaultValue={d.knownHazards ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Customer requirements" htmlFor={id("cust")}>
          <Textarea id={id("cust")} name="customerRequirements" defaultValue={d.customerRequirements ?? ""} />
        </Field>
      </div>
      <Field label="Payment terms" htmlFor={id("pt")} required>
        <Input id={id("pt")} name="paymentTerms" required defaultValue={d.paymentTerms ?? "Within [X] days of a valid invoice – solicitor to confirm"} />
      </Field>
      <Field label="Payment due (days after invoice)" htmlFor={id("pdd")} required>
        <Input id={id("pdd")} name="paymentDueDays" type="number" min={0} max={60} required defaultValue={d.paymentDueDays ?? "14"} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Message (optional)" htmlFor={id("msg")}>
          <Input id={id("msg")} name="message" />
        </Field>
      </div>
    </div>
  );
}
