import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { availableActions, type OfferStatus } from "@/lib/platform/offers";
import { OFFER_VERSION_COLUMNS, rowToDefaults, type OfferVersionRow } from "@/lib/platform/forms";
import { formatPence } from "@/lib/pricing/engine";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { OfferTermsFields } from "@/components/platform/OfferTermsFields";
import { OfferVersionView } from "@/components/platform/OfferVersionView";
import { Card, Details, EmptyState, Notice, Pill, formatDate } from "@/components/platform/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import {
  cancelJob,
  companyAcceptLatest,
  companyCounter,
  handleEmergency,
  reviewCompletion,
  saveSiteDetails,
  sendOffer,
  withdrawOffer,
} from "../../../platform-actions";
import { JOB_STATUS_LABELS } from "@/lib/platform/labels";

const OFFER_STATUS: Record<string, string> = {
  open: "Open",
  agreed: "Agreed",
  declined_by_painter: "Declined by painter",
  withdrawn_by_company: "Withdrawn",
  closed: "Closed",
};

export default async function AdminJobPage({ params }: PageProps<"/admin/jobs/[id]">) {
  await requireAdmin("jobs.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: job } = await supabase
    .from("jobs")
    .select("*, enquiries(reference, full_name), painter_businesses(legal_name, trading_name)")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [{ data: site }, { data: offers }, { data: painters }, { data: photos }, { data: notices }] = await Promise.all([
    supabase.from("job_site_details").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("job_offers").select("id, status, decline_reason, painter_business_id, painter_businesses(legal_name, trading_name)").eq("job_id", id).order("created_at"),
    supabase.from("painter_businesses").select("id, legal_name, trading_name").eq("onboarding_status", "approved").order("legal_name"),
    supabase.from("job_photos").select("id, stage, caption, created_at").eq("job_id", id).order("created_at"),
    supabase.from("emergency_notices").select("*").eq("job_id", id).order("created_at", { ascending: false }),
  ]);
  const offerIds = (offers ?? []).map((o) => o.id as string);
  const { data: vrows } = offerIds.length
    ? await supabase.from("job_offer_versions").select(OFFER_VERSION_COLUMNS).in("offer_id", offerIds).order("version_number", { ascending: false })
    : { data: [] };
  const versions = (vrows ?? []) as unknown as OfferVersionRow[];
  const s = (site ?? {}) as Record<string, string | null>;
  const enquiry = job.enquiries as { reference: string } | null;
  const painter = job.painter_businesses as { legal_name: string; trading_name: string | null } | null;
  const canOffer = ["draft", "offered"].includes(job.status as string);
  const lastVersion = versions[0];
  const agreed = versions.find((v) => v.id === job.agreed_offer_version_id);

  return (
    <div className="space-y-6">
      <Link href="/admin/jobs" className="text-sm text-ink-700 hover:text-ink-950">← All jobs</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{job.title as string}</h1>
        <Pill tone="blue">{JOB_STATUS_LABELS[job.status as string]}</Pill>
      </div>
      <p className="font-mono text-sm text-ink-600">
        {job.reference as string}
        {enquiry && (
          <>
            {" "}· website enquiry{" "}
            <Link href={`/admin/enquiries/${job.enquiry_id}`} className="underline">
              {enquiry.reference}
            </Link>
          </>
        )}
      </p>

      {(notices ?? []).filter((n) => n.status !== "resolved").map((n) => (
        <Card key={n.id as string} title={<span className="text-red-800">Attendance issue reported {formatDate(n.created_at as string, true)}</span>}>
          <Details
            items={[
              ["Reason", String(n.category).replace(/_/g, " ")],
              ["Explanation", n.explanation as string],
              ["Expected delay", n.expected_delay_minutes ? `${n.expected_delay_minutes} minutes` : null],
              ["Wants to reschedule", n.reschedule_requested ? `Yes${n.proposed_new_date ? ` – suggests ${formatDate(n.proposed_new_date as string)}` : ""}` : "No"],
              ["Offers a substitute", n.substitute_proposed ? "Yes" : "No"],
              ["Call back OK", n.callback_permitted ? "Yes" : "No – message instead"],
              ["Evidence attached", n.evidence_storage_path ? "Yes (restricted)" : "No"],
            ]}
          />
          <p className="mt-3 text-sm text-ink-700">Assess fairly: a genuine emergency is not a breach and there are no automatic penalties. Don&apos;t ask for diagnoses.</p>
          <div className="mt-4">
            <ActionForm action={handleEmergency.bind(null, n.id as string)} submitLabel="Save">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Outcome" htmlFor={`out-${n.id}`}>
                  <Select id={`out-${n.id}`} name="outcome" defaultValue="">
                    <option value="">Acknowledge only</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="substitute_approved">Substitute approved</option>
                    <option value="job_cancelled_no_fault">Job cancelled – no fault</option>
                    <option value="job_reassigned">Job offered to someone else</option>
                    <option value="resolved_other">Resolved another way</option>
                  </Select>
                </Field>
                <Field label="Note" htmlFor={`note-${n.id}`}>
                  <Input id={`note-${n.id}`} name="note" />
                </Field>
              </div>
            </ActionForm>
          </div>
        </Card>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Job">
          <Details
            items={[
              ["Scope summary", job.scope_summary as string],
              ["Shown to painters as", [job.site_town, job.site_postcode_district].filter(Boolean).join(" · ")],
              ["Customer price (website)", job.customer_price_pence ? formatPence(job.customer_price_pence as number, { alwaysShowPence: true }) : "Not agreed yet"],
              ["Agreed painter", painter ? painter.trading_name || painter.legal_name : null],
              ["Agreed painter fee", agreed ? formatPence(agreed.fee_pence, { alwaysShowPence: true }) : null],
            ]}
          />
        </Card>
        <Card title="Site & customer contact (private)">
          <ActionForm action={saveSiteDetails.bind(null, id)} submitLabel="Save">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer name" htmlFor="customerName"><Input id="customerName" name="customerName" defaultValue={s.customer_contact_name ?? ""} /></Field>
              <Field label="Phone" htmlFor="customerPhone"><Input id="customerPhone" name="customerPhone" defaultValue={s.customer_phone ?? ""} /></Field>
              <Field label="Address line 1" htmlFor="addressLine1"><Input id="addressLine1" name="addressLine1" defaultValue={s.address_line1 ?? ""} /></Field>
              <Field label="Address line 2" htmlFor="addressLine2"><Input id="addressLine2" name="addressLine2" defaultValue={s.address_line2 ?? ""} /></Field>
              <Field label="Town" htmlFor="town"><Input id="town" name="town" defaultValue={s.town ?? ""} /></Field>
              <Field label="Postcode" htmlFor="postcode"><Input id="postcode" name="postcode" defaultValue={s.postcode ?? ""} /></Field>
              <Field label="Access notes" htmlFor="accessNotes"><Textarea id="accessNotes" name="accessNotes" defaultValue={s.access_notes ?? ""} /></Field>
              <Field label="Parking" htmlFor="parkingNotes"><Textarea id="parkingNotes" name="parkingNotes" defaultValue={s.parking_notes ?? ""} /></Field>
            </div>
          </ActionForm>
          <p className="mt-3 text-xs text-ink-600">The painter sees these only once the job is mutually agreed.</p>
        </Card>
      </div>

      {job.status === "completion_submitted" && (
        <Card title="Review completion">
          <p className="mb-3 text-sm">
            Submitted {formatDate(job.completion_submitted_at as string, true)}
            {job.completion_note ? ` – “${job.completion_note}”` : ""}. Check the photos below and the customer&apos;s feedback (call, email or website).
          </p>
          <ActionForm action={reviewCompletion.bind(null, id)} submitLabel="Save decision">
            <Field label="Decision" htmlFor="decision">
              <Select id="decision" name="decision" defaultValue="accept">
                <option value="accept">Accept completion – painter can invoice</option>
                <option value="return">Return – something agreed is outstanding</option>
              </Select>
            </Field>
            <Field label="What is outstanding (if returning)" htmlFor="note"><Input id="note" name="note" /></Field>
          </ActionForm>
        </Card>
      )}

      {(photos ?? []).length > 0 && (
        <Card title="Photos">
          <ul className="flex flex-wrap gap-2">
            {(photos ?? []).map((p) => (
              <li key={p.id as string}><Pill>{p.stage as string} · {formatDate(p.created_at as string, true)}</Pill></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-600">Photo viewing with secure short-lived links is part of the next phase (completion review).</p>
        </Card>
      )}

      <Card title="Offers to painters">
        {(offers ?? []).length === 0 && <EmptyState>Not offered to anyone yet.</EmptyState>}
        <div className="space-y-6">
          {(offers ?? []).map((o) => {
            const thread = versions.filter((v) => v.offer_id === o.id);
            const latest = thread[0];
            const p = o.painter_businesses as unknown as { legal_name: string; trading_name: string | null };
            const acts = availableActions(
              o.status as OfferStatus,
              thread.map((v) => ({ versionNumber: v.version_number, proposedBy: v.proposed_by, companyAcceptedAt: v.company_accepted_at, painterAcceptedAt: v.painter_accepted_at })),
              "company",
            );
            return (
              <div key={o.id as string} className="rounded-xl p-4 ring-1 ring-ink-900/10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{p.trading_name || p.legal_name}</h3>
                  <Pill tone={o.status === "agreed" ? "strong" : "neutral"}>{OFFER_STATUS[o.status as string]}</Pill>
                </div>
                {o.decline_reason && <p className="mb-2 text-sm text-ink-700">Reason given: {o.decline_reason as string}</p>}
                {latest && <OfferVersionView v={latest} partyLabel={{ company: "us", painter: "the painter" }} />}
                {thread.length > 1 && <p className="mt-2 text-xs text-ink-600">{thread.length} versions in this negotiation – all kept permanently.</p>}
                {acts.accept && latest && (
                  <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-900/10 pt-4">
                    <ActionForm action={companyAcceptLatest.bind(null, o.id as string, latest.id)} submitLabel="Accept painter's terms" confirm="Accept these terms? The job becomes agreed with this painter." />
                  </div>
                )}
                {acts.counter && latest && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-brand-700">Reply with different terms</summary>
                    <div className="mt-3">
                      <ActionForm action={companyCounter.bind(null, o.id as string)} submitLabel="Send revised offer">
                        <OfferTermsFields d={rowToDefaults(latest)} idPrefix={`cc-${o.id}`} />
                      </ActionForm>
                    </div>
                  </details>
                )}
                {acts.withdraw && (
                  <div className="mt-3">
                    <ActionForm action={withdrawOffer.bind(null, o.id as string)} submitLabel="Withdraw offer" variant="outline" confirm="Withdraw this offer?" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {canOffer && (
        <Card title="Offer this job to a painter">
          {(painters ?? []).length === 0 ? (
            <EmptyState>No approved painters yet. Approve a painter&apos;s onboarding first.</EmptyState>
          ) : (
            <>
              <Notice>
                The painter can accept, decline or counteroffer. Nothing is binding until both sides accept the same version. Don&apos;t put the customer&apos;s name or full
                address in the offer.
              </Notice>
              <div className="mt-4">
                <ActionForm action={sendOffer.bind(null, id)} submitLabel="Send offer">
                  <Field label="Painter" htmlFor="painterBusinessId" required>
                    <Select id="painterBusinessId" name="painterBusinessId" required defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {(painters ?? []).map((p) => (
                        <option key={p.id as string} value={p.id as string}>{(p.trading_name as string) || (p.legal_name as string)}</option>
                      ))}
                    </Select>
                  </Field>
                  <OfferTermsFields d={lastVersion ? rowToDefaults(lastVersion) : { scope: job.scope_summary as string }} idPrefix="new" />
                </ActionForm>
              </div>
            </>
          )}
        </Card>
      )}

      {canOffer && (
        <Card title="Cancel job">
          <ActionForm action={cancelJob.bind(null, id)} submitLabel="Cancel job" variant="danger" confirm="Cancel this job and withdraw open offers?">
            <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" /></Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
