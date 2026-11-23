import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requirePainter } from "@/lib/auth";
import { formatPence } from "@/lib/pricing/engine";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, EmptyState, Notice, Pill, formatDate } from "@/components/platform/ui";
import { ActionForm } from "@/components/platform/ActionForm";
import { submitForReview } from "../actions";

const ONBOARDING: Record<string, { label: string; tone: "neutral" | "blue" | "strong" | "warning" | "danger" }> = {
  draft: { label: "Profile not yet submitted", tone: "warning" },
  submitted: { label: "Submitted – being reviewed", tone: "blue" },
  more_information_requested: { label: "More information requested", tone: "warning" },
  approved: { label: "Approved – you can receive offers", tone: "strong" },
  rejected: { label: "Not approved", tone: "danger" },
  ended: { label: "Account closed", tone: "neutral" },
};

const JOB_STATUS: Record<string, string> = {
  agreed: "Agreed",
  in_progress: "In progress",
  completion_submitted: "Completion submitted",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

interface OfferRow {
  id: string;
  status: string;
  jobs: { reference: string; title: string; site_town: string | null; site_postcode_district: string | null };
  job_offer_versions: { version_number: number; proposed_by: string; fee_pence: number; proposed_start_date: string }[];
}

export default async function PainterHome() {
  const painter = await requirePainter();
  const supabase = (await createSessionClient())!;
  const [{ data: biz }, { data: offers }, { data: jobs }] = await Promise.all([
    supabase.from("painter_businesses").select("onboarding_admin_note").eq("id", painter.painterBusinessId).single(),
    supabase
      .from("job_offers")
      .select("id, status, jobs(reference, title, site_town, site_postcode_district), job_offer_versions(version_number, proposed_by, fee_pence, proposed_start_date)")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.from("jobs").select("id, reference, title, status, site_town").eq("painter_business_id", painter.painterBusinessId).order("created_at", { ascending: false }).limit(50),
  ]);
  const status = ONBOARDING[painter.onboardingStatus] ?? ONBOARDING.draft;
  const open = (offers ?? []) as unknown as OfferRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">Hello {painter.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-ink-700">
          <Pill tone={status.tone}>{status.label}</Pill>
        </p>
      </div>

      {["draft", "more_information_requested"].includes(painter.onboardingStatus) && (
        <Card title="Finish your business profile">
          {biz?.onboarding_admin_note && painter.onboardingStatus === "more_information_requested" && (
            <div className="mb-4">
              <Notice tone="warning">
                <strong>We need:</strong> {biz.onboarding_admin_note as string}
              </Notice>
            </div>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-ink-800">
            <li>Business address and contact details</li>
            <li>UTR (for the Construction Industry Scheme) and bank details – stored encrypted</li>
            <li>Public liability insurance certificate</li>
            <li>Any qualifications or examples of your work (optional)</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <Link href="/painter/profile" className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Complete my profile
            </Link>
            <ActionForm action={submitForReview} submitLabel="Submit for review" variant="outline" className="space-y-2" />
          </div>
        </Card>
      )}
      {painter.onboardingStatus === "rejected" && biz?.onboarding_admin_note && <Notice tone="danger">{biz.onboarding_admin_note as string}</Notice>}

      <Card title="Job offers">
        {open.length === 0 ? (
          <EmptyState>No open offers right now. You&apos;re free to take on other work – there are no minimum jobs or availability requirements.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-900/10">
            {open.map((o) => {
              const latest = [...o.job_offer_versions].sort((a, b) => b.version_number - a.version_number)[0];
              const yourTurn = latest?.proposed_by === "company";
              return (
                <li key={o.id}>
                  <Link href={`/painter/offers/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                    <span>
                      <span className="block font-semibold">{o.jobs.title}</span>
                      <span className="block text-sm text-ink-600">
                        {[o.jobs.site_town, o.jobs.site_postcode_district].filter(Boolean).join(" · ")} · {latest && formatDate(latest.proposed_start_date)} · {latest && formatPence(latest.fee_pence, { alwaysShowPence: true })}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={yourTurn ? "strong" : "neutral"}>{yourTurn ? "Your reply" : "Awaiting us"}</Pill>
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="My agreed jobs">
        {(jobs ?? []).length === 0 ? (
          <EmptyState>No agreed jobs yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-900/10">
            {(jobs ?? []).map((j) => (
              <li key={j.id as string}>
                <Link href={`/painter/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                  <span>
                    <span className="block font-semibold">{j.title as string}</span>
                    <span className="block font-mono text-xs text-ink-600">{j.reference as string}</span>
                  </span>
                  <Pill tone="blue">{JOB_STATUS[j.status as string] ?? (j.status as string)}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
