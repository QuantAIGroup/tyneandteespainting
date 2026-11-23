import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { CIS_STATUS_LABELS, type CisStatus } from "@/lib/platform/cis";
import { ENGAGEMENT_ROUTE_LABELS, ONBOARDING_LABELS } from "@/lib/platform/labels";
import { can } from "@/lib/platform/permissions";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { Card, Details, EmptyState, Notice, Pill, formatDate } from "@/components/platform/ui";
import { Field, Input, Select } from "@/components/ui/Form";
import { decideOnboarding, recordCisVerification, setEngagementRoute, verifyEvidence } from "../../../platform-actions";

export default async function AdminPainterPage({ params }: PageProps<"/admin/painters/[id]">) {
  const admin = await requireAdmin("painters.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: b } = await supabase.from("painter_businesses").select("*").eq("id", id).maybeSingle();
  if (!b) notFound();
  const showFinance = can(admin.role, "finance.bank_details");
  const [{ data: users }, { data: evidence }, { data: cis }, { data: priv }, { data: acceptances }, { data: jobs }] = await Promise.all([
    supabase.from("painter_users").select("full_name, created_at").eq("painter_business_id", id),
    supabase.from("painter_evidence").select("*").eq("painter_business_id", id).order("created_at", { ascending: false }),
    supabase.from("cis_verifications").select("*").eq("painter_business_id", id).order("created_at", { ascending: false }),
    showFinance
      ? supabase.from("painter_private_details").select("utr_last3, company_utr_encrypted, nino_encrypted, bank_account_name, bank_account_last4, bank_details_confirmed_at").eq("painter_business_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("document_acceptances").select("accepted_at, legal_document_versions(version_label, legal_documents(title))").eq("painter_business_id", id),
    supabase.from("jobs").select("id, reference, title, status").eq("painter_business_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const name = (b.trading_name as string) || (b.legal_name as string);

  return (
    <div className="space-y-6">
      <Link href="/admin/painters" className="text-sm text-ink-700 hover:text-ink-950">← All painters</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{name}</h1>
        <Pill tone="blue">{ONBOARDING_LABELS[b.onboarding_status as string]}</Pill>
        {b.engagement_route !== "independent_business" && <Pill tone="danger">{ENGAGEMENT_ROUTE_LABELS[b.engagement_route as string]}</Pill>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Business">
          <Details
            items={[
              ["Legal name", b.legal_name as string],
              ["Trading name", b.trading_name as string],
              ["Type", String(b.business_structure).replace(/_/g, " ")],
              ["Company number", b.company_number as string],
              ["Address", [b.address_line1, b.address_line2, b.town, b.postcode].filter(Boolean).join(", ")],
              ["Phone", b.phone as string],
              ["Email", b.invoice_email as string],
              ["VAT", b.vat_registered ? `Registered – ${b.vat_number}` : "Not VAT registered"],
              ["Logins", (users ?? []).map((u) => u.full_name as string).join(", ")],
              ["Team / substitution", b.substitution_arrangements as string],
              ["Experience", b.competence_summary as string],
              ["Website", b.website_or_profile as string],
            ]}
          />
        </Card>
        <div className="space-y-6">
          {can(admin.role, "painters.approve") && ["submitted", "more_information_requested", "approved", "draft"].includes(b.onboarding_status as string) && (
            <Card title="Onboarding decision">
              <ActionForm action={decideOnboarding.bind(null, id)} submitLabel="Save decision">
                <Field label="Decision" htmlFor="decision">
                  <Select id="decision" name="decision" defaultValue="approve">
                    <option value="approve">Approve – can receive job offers</option>
                    <option value="more_info">Ask for more information</option>
                    <option value="reject">Don&apos;t approve</option>
                  </Select>
                </Field>
                <Field label="Message to painter" htmlFor="note" hint="Required when asking for information or not approving.">
                  <Input id="note" name="note" />
                </Field>
              </ActionForm>
            </Card>
          )}
          <Card title="Engagement route">
            <p className="mb-3 text-sm text-ink-700">
              Currently: <strong>{ENGAGEMENT_ROUTE_LABELS[b.engagement_route as string]}</strong>. This label does <em>not</em> decide employment status – the real working
              relationship does. If you suspect worker/employee status, choose “review required”: payments are blocked and no deductions can be made until you have advice.
            </p>
            {can(admin.role, "painters.approve") && (
              <ActionForm action={setEngagementRoute.bind(null, id)} submitLabel="Update">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select name="route" defaultValue={b.engagement_route as string} aria-label="Engagement route">
                    {Object.entries(ENGAGEMENT_ROUTE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                  <Input name="reason" placeholder="Reason (recorded in the audit log)" aria-label="Reason" />
                </div>
              </ActionForm>
            )}
          </Card>
        </div>
      </div>

      <Card title="Insurance and evidence">
        {(evidence ?? []).length === 0 ? (
          <EmptyState>No documents uploaded.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-900/10">
            {(evidence ?? []).map((e) => (
              <li key={e.id as string} className="grid gap-3 py-4 lg:grid-cols-[1fr_420px]">
                <div>
                  <p className="font-semibold">
                    {e.title as string} <Pill tone={e.verification_status === "verified" ? "strong" : e.verification_status === "rejected" ? "danger" : "warning"}>{e.verification_status as string}</Pill>
                  </p>
                  <p className="text-sm text-ink-700">
                    {String(e.kind).replace(/_/g, " ")}
                    {e.insurer ? ` · ${e.insurer}` : ""}
                    {e.policy_number ? ` · policy ${e.policy_number}` : ""}
                    {e.cover_limit_pence ? ` · £${((e.cover_limit_pence as number) / 100).toLocaleString("en-GB")} cover` : ""}
                    {e.expires_on ? ` · expires ${formatDate(e.expires_on as string)}` : ""}
                  </p>
                  <p className="text-xs text-ink-600">File: {e.storage_path ? "uploaded (private)" : "none"}</p>
                </div>
                {can(admin.role, "evidence.verify") && e.verification_status === "pending" && (
                  <ActionForm action={verifyEvidence.bind(null, e.id as string)} submitLabel="Save" className="flex flex-wrap items-end gap-2">
                    <Select name="status" defaultValue="verified" aria-label="Verification">
                      <option value="verified">Verified – checked with insurer/issuer</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                    <Input name="note" placeholder="Note" aria-label="Note" />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showFinance && (
        <Card title="Tax, CIS and bank (finance only)">
          <Details
            items={[
              ["UTR", priv?.utr_last3 ? `•••••••${priv.utr_last3}` : "Not provided"],
              ["Company UTR", priv?.company_utr_encrypted ? "Provided (encrypted)" : null],
              ["NI number", priv?.nino_encrypted ? "Provided (encrypted)" : null],
              ["Bank account", priv?.bank_account_last4 ? `${priv.bank_account_name} · ••••${priv.bank_account_last4}` : "Not provided"],
              ["Bank details confirmed by call-back", priv?.bank_details_confirmed_at ? formatDate(priv.bank_details_confirmed_at as string, true) : "Not yet – confirm by phone before paying"],
            ]}
          />
          <h3 className="mb-2 mt-6 font-bold">HMRC CIS verifications</h3>
          {(cis ?? []).length === 0 ? (
            <Notice tone="warning">Not verified. Verify this subcontractor in Sage (or HMRC online) and record the result below. The app never guesses a rate.</Notice>
          ) : (
            <ul className="space-y-1 text-sm">
              {(cis ?? []).map((c) => (
                <li key={c.id as string}>
                  {c.is_current ? <Pill tone="strong">Current</Pill> : <Pill>Previous</Pill>} {CIS_STATUS_LABELS[c.deduction_status as CisStatus]} · ref {c.hmrc_verification_reference as string} · verified{" "}
                  {formatDate(c.verified_on as string)} via {String(c.verified_via).replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          )}
          {can(admin.role, "cis.manage") && (
            <div className="mt-4">
              <ActionForm action={recordCisVerification.bind(null, id)} submitLabel="Record verification">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="HMRC result" htmlFor="status">
                    <Select id="status" name="status" defaultValue="standard">
                      {Object.entries(CIS_STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Verification reference" htmlFor="reference" hint="e.g. V1234567890 (with suffix for higher rate)">
                    <Input id="reference" name="reference" required />
                  </Field>
                  <Field label="Verified on" htmlFor="verifiedOn"><Input id="verifiedOn" name="verifiedOn" type="date" required /></Field>
                  <Field label="Verified using" htmlFor="via">
                    <Select id="via" name="via" defaultValue="sage">
                      <option value="sage">Sage Accounting</option>
                      <option value="hmrc_online">HMRC online service</option>
                      <option value="hmrc_phone">HMRC helpline</option>
                      <option value="other_software">Other software</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" /> The status and rate above are exactly what HMRC returned.</label>
              </ActionForm>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Accepted documents">
          {(acceptances ?? []).length === 0 ? (
            <EmptyState>None yet. (Painters can only accept documents once they are approved for publication.)</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm">
              {(acceptances ?? []).map((a, i) => {
                const v = a.legal_document_versions as unknown as { version_label: string; legal_documents: { title: string } };
                return <li key={i}>{v.legal_documents.title} v{v.version_label} – {formatDate(a.accepted_at as string, true)}</li>;
              })}
            </ul>
          )}
        </Card>
        <Card title="Jobs">
          {(jobs ?? []).length === 0 ? (
            <EmptyState>No agreed jobs.</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm">
              {(jobs ?? []).map((j) => (
                <li key={j.id as string}><Link href={`/admin/jobs/${j.id}`} className="text-brand-700 underline">{j.reference as string}</Link> – {j.title as string} ({String(j.status).replace(/_/g, " ")})</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
