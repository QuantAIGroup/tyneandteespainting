import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePainter } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { OFFER_VERSION_COLUMNS, type OfferVersionRow } from "@/lib/platform/forms";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { FileUpload } from "@/components/platform/FileUpload";
import { OfferVersionView } from "@/components/platform/OfferVersionView";
import { Card, Details, Notice, Pill, formatDate } from "@/components/platform/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { registerJobPhoto, reportEmergency, submitCompletion } from "../../../actions";

export const metadata: Metadata = { title: "Agreed job" };

const EMERGENCY_CATEGORIES = [
  ["sudden_illness", "Sudden illness"],
  ["accident", "Accident"],
  ["family_emergency", "Family emergency"],
  ["transport_failure", "Vehicle / transport failure"],
  ["unsafe_site", "Unsafe site"],
  ["customer_access_failure", "Can't get access to the property"],
  ["other_emergency", "Other emergency"],
] as const;

export default async function PainterJobPage({ params }: PageProps<"/painter/jobs/[id]">) {
  const painter = await requirePainter();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: job } = await supabase
    .from("jobs")
    .select("id, reference, title, status, agreed_offer_version_id, painter_business_id, completion_note")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.painter_business_id !== painter.painterBusinessId) notFound();

  const [{ data: site }, { data: version }, { data: photos }, { data: notices }] = await Promise.all([
    supabase.from("job_site_details").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("job_offer_versions").select(OFFER_VERSION_COLUMNS).eq("id", job.agreed_offer_version_id as string).maybeSingle(),
    supabase.from("job_photos").select("id, stage, caption, created_at").eq("job_id", id).order("created_at"),
    supabase.from("emergency_notices").select("id, category, status, outcome, created_at").eq("job_id", id).order("created_at", { ascending: false }),
  ]);
  const active = ["agreed", "in_progress"].includes(job.status as string);
  const s = (site ?? {}) as Record<string, string | null>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/painter" className="text-sm text-brand-700 underline">← Home</Link>
        <h1 className="mt-2 text-2xl sm:text-3xl">{job.title as string}</h1>
        <p className="mt-1 flex items-center gap-2">
          <span className="font-mono text-sm">{job.reference as string}</span>
          <Pill tone="blue">{String(job.status).replace(/_/g, " ")}</Pill>
        </p>
      </div>
      {job.status === "in_progress" && (job.completion_note as string | null)?.startsWith("Returned:") && <Notice tone="warning">{job.completion_note as string}</Notice>}

      {site && (
        <Card title="Site and customer contact">
          <Details
            items={[
              ["Address", [s.address_line1, s.address_line2, s.town, s.postcode].filter(Boolean).join(", ")],
              ["Customer", s.customer_contact_name],
              ["Phone", s.customer_phone ? <a key="p" href={`tel:${s.customer_phone}`} className="text-brand-700 underline">{s.customer_phone}</a> : null],
              ["Access notes", s.access_notes],
              ["Parking", s.parking_notes],
            ]}
          />
          <p className="mt-4 text-xs text-ink-600">Use the customer&apos;s details only for this job and keep them secure (agreement clause 3.15).</p>
        </Card>
      )}

      {version && (
        <Card title="Agreed job record">
          <OfferVersionView v={version as unknown as OfferVersionRow} partyLabel={{ company: "Tyne & Tees Painting", painter: "you" }} />
        </Card>
      )}

      <Card title="Photos">
        <p className="mb-3 text-sm text-ink-700">Photograph the work only – avoid people, personal documents and unrelated belongings.</p>
        <ul className="mb-4 flex flex-wrap gap-2">
          {(photos ?? []).map((p) => (
            <li key={p.id as string}>
              <Pill tone="neutral">
                {p.stage as string} · {formatDate(p.created_at as string, true)}
              </Pill>
            </li>
          ))}
        </ul>
        {active || job.status === "completion_submitted" ? (
          <ActionForm action={registerJobPhoto.bind(null, id)} submitLabel="Add photo">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Stage" htmlFor="stage">
                <Select id="stage" name="stage" defaultValue="before">
                  <option value="before">Before</option>
                  <option value="progress">Progress</option>
                  <option value="after">After</option>
                </Select>
              </Field>
              <Field label="Caption" htmlFor="caption">
                <Input id="caption" name="caption" />
              </Field>
            </div>
            <FileUpload name="path" purpose="job-photo" jobId={id} accept="image/*" label="Take or choose photo" required />
          </ActionForm>
        ) : null}
      </Card>

      {active && (
        <Card title="Mark the job complete">
          <ActionForm action={submitCompletion.bind(null, id)} submitLabel="Submit completion">
            <Field label="Notes for us (optional)" htmlFor="note">
              <Textarea id="note" name="note" />
            </Field>
          </ActionForm>
        </Card>
      )}

      {active && (
        <Card title="Can't attend or running late?">
          <Notice>
            Tell us as soon as you reasonably can. A genuine emergency is not treated as a breach and there are no automatic penalties. Please don&apos;t include medical
            details or diagnoses – a short explanation is enough.
          </Notice>
          <div className="mt-4">
            <ActionForm action={reportEmergency.bind(null, id)} submitLabel="Send to Tyne & Tees Painting">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What has happened?" htmlFor="category" required>
                  <Select id="category" name="category" required defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {EMERGENCY_CATEGORIES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expected delay (minutes)" htmlFor="delayMinutes">
                  <Input id="delayMinutes" name="delayMinutes" inputMode="numeric" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Short explanation" htmlFor="explanation" required hint="No medical details needed.">
                    <Textarea id="explanation" name="explanation" required maxLength={1000} />
                  </Field>
                </div>
                <Field label="Suggest a new date" htmlFor="newDate">
                  <Input id="newDate" name="newDate" type="date" />
                </Field>
                <div className="space-y-2 text-sm">
                  <label className="flex gap-2"><input type="checkbox" name="reschedule" value="yes" /> I&apos;d like to reschedule</label>
                  <label className="flex gap-2"><input type="checkbox" name="substitute" value="yes" /> I can send a suitable substitute</label>
                  <label className="flex gap-2"><input type="checkbox" name="callback" value="no" /> Please don&apos;t call me back</label>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-sm font-medium">Evidence (optional – only if you want to)</p>
                  <FileUpload name="evidencePath" purpose="case-evidence" jobId={id} label="Attach file" />
                </div>
              </div>
            </ActionForm>
          </div>
          {(notices ?? []).length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-ink-700">
              {(notices ?? []).map((n) => (
                <li key={n.id as string}>
                  {formatDate(n.created_at as string, true)} – {String(n.category).replace(/_/g, " ")} – {n.status as string}
                  {n.outcome ? ` (${String(n.outcome).replace(/_/g, " ")})` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
