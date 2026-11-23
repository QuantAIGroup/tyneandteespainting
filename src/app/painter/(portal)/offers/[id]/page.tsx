import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePainter } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { availableActions, type OfferStatus } from "@/lib/platform/offers";
import { OFFER_VERSION_COLUMNS, rowToDefaults, type OfferVersionRow } from "@/lib/platform/forms";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { OfferTermsFields } from "@/components/platform/OfferTermsFields";
import { OfferVersionView } from "@/components/platform/OfferVersionView";
import { Card, Notice, Pill } from "@/components/platform/ui";
import { Field, Input } from "@/components/ui/Form";
import { painterAccept, painterCounter, painterDecline } from "../../../actions";

export const metadata: Metadata = { title: "Job offer" };

const STATUS_TEXT: Record<string, string> = {
  open: "Open",
  agreed: "Agreed",
  declined_by_painter: "You declined",
  withdrawn_by_company: "Withdrawn by Tyne & Tees Painting",
  closed: "Closed (agreed with someone else)",
};

export default async function PainterOfferPage({ params }: PageProps<"/painter/offers/[id]">) {
  await requirePainter();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: offer } = await supabase
    .from("job_offers")
    .select("id, status, job_id, jobs(reference, title, scope_summary, site_town, site_postcode_district, status)")
    .eq("id", id)
    .maybeSingle();
  if (!offer) notFound(); // RLS: only this painter's own offers are visible
  const { data: vrows } = await supabase.from("job_offer_versions").select(OFFER_VERSION_COLUMNS).eq("offer_id", id).order("version_number", { ascending: false });
  const versions = (vrows ?? []) as unknown as OfferVersionRow[];
  const latest = versions[0];
  const job = offer.jobs as unknown as { reference: string; title: string; scope_summary: string; site_town: string | null; site_postcode_district: string | null; status: string };
  const actions = availableActions(
    offer.status as OfferStatus,
    versions.map((v) => ({ versionNumber: v.version_number, proposedBy: v.proposed_by, companyAcceptedAt: v.company_accepted_at, painterAcceptedAt: v.painter_accepted_at })),
    "painter",
  );
  const labels = { company: "Tyne & Tees Painting", painter: "you" };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/painter" className="text-sm text-brand-700 underline">← Home</Link>
        <h1 className="mt-2 text-2xl sm:text-3xl">{job.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-700">
          <span className="font-mono text-sm">{job.reference}</span>
          <span>{[job.site_town, job.site_postcode_district].filter(Boolean).join(" · ")}</span>
          <Pill tone={offer.status === "agreed" ? "strong" : "blue"}>{STATUS_TEXT[offer.status as string]}</Pill>
        </p>
      </div>

      {offer.status === "open" && (
        <Notice>
          You can accept, decline or propose different terms. Declining or counteroffering never affects future offers. Nothing is agreed until both sides accept the
          same version. The full address is shared once the job is agreed.
        </Notice>
      )}
      {offer.status === "agreed" && (
        <Notice>
          This job is agreed. <Link href={`/painter/jobs/${offer.job_id}`} className="font-semibold underline">Open the job</Link> for the address, photos and updates.
        </Notice>
      )}

      {latest && (
        <Card title={latest.proposed_by === "company" ? "Current offer" : "Your latest proposal"}>
          <OfferVersionView v={latest} partyLabel={labels} />
          {actions.accept && (
            <div className="mt-6 border-t border-ink-900/10 pt-5">
              <ActionForm action={painterAccept.bind(null, id, latest.id)} submitLabel="Accept these terms" confirm="Accept this job on these exact terms? This forms a binding job-specific agreement.">
                <p className="text-sm text-ink-700">By accepting, you agree to carry out this job on the terms above under your Independent Painter Business Services Agreement.</p>
              </ActionForm>
            </div>
          )}
          {actions.waitingFor === "company" && <p className="mt-4 text-sm text-ink-700">Waiting for Tyne &amp; Tees Painting to reply to your proposal.</p>}
        </Card>
      )}

      {actions.counter && latest && (
        <Card title="Propose different terms">
          <ActionForm action={painterCounter.bind(null, id)} submitLabel="Send counteroffer">
            <OfferTermsFields d={rowToDefaults(latest)} idPrefix="c" />
          </ActionForm>
        </Card>
      )}

      {actions.decline && (
        <Card title="Decline this offer">
          <ActionForm action={painterDecline.bind(null, id)} submitLabel="Decline offer" variant="outline">
            <Field label="Reason (optional – only to help us)" htmlFor="reason">
              <Input id="reason" name="reason" />
            </Field>
          </ActionForm>
        </Card>
      )}

      {versions.length > 1 && (
        <Card title="History">
          <div className="space-y-6 divide-y divide-ink-900/10">
            {versions.slice(1).map((v) => (
              <div key={v.id} className="pt-6 first:pt-0">
                <OfferVersionView v={v} partyLabel={labels} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
