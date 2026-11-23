import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { can } from "@/lib/platform/permissions";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { DocumentText } from "@/components/platform/DocumentText";
import { Card, DOC_STATUS_LABELS, DraftBanner, EmptyState, Pill, formatDate, isApprovedStatus } from "@/components/platform/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { createDocumentVersion, setDocumentStatus } from "../../../platform-actions";

interface Version {
  id: string;
  version_label: string;
  status: string;
  body_markdown: string | null;
  source_note: string | null;
  effective_date: string | null;
  review_date: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  content_sha256: string | null;
  created_at: string;
}

export default async function AdminDocumentPage({ params }: PageProps<"/admin/documents/[id]">) {
  const admin = await requireAdmin("documents.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: doc } = await supabase.from("legal_documents").select("*, legal_document_versions(*)").eq("id", id).maybeSingle();
  if (!doc) notFound();
  const versions = (doc.legal_document_versions as Version[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const manage = can(admin.role, "documents.manage");
  const { count: acceptances } = await supabase
    .from("document_acceptances")
    .select("id", { count: "exact", head: true })
    .in("version_id", versions.map((v) => v.id));

  return (
    <div className="space-y-6">
      <Link href="/admin/documents" className="text-sm text-ink-700 hover:text-ink-950">← Legal documents</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{doc.title as string}</h1>
        <Pill>Sector {doc.sector === "painter" ? "A – painters" : doc.sector === "admin" ? "B – internal" : "C – website"}</Pill>
        {doc.requires_acceptance && <Pill tone="blue">Painters must accept · {acceptances ?? 0} acceptances recorded</Pill>}
      </div>

      {versions.map((v, i) => (
        <Card
          key={v.id}
          title={`Version ${v.version_label}`}
          actions={<Pill tone={isApprovedStatus(v.status) ? "strong" : v.status === "superseded" || v.status === "archived" ? "neutral" : "warning"}>{DOC_STATUS_LABELS[v.status]}</Pill>}
        >
          {v.source_note && <p className="mb-3 text-sm text-ink-700"><strong>Source:</strong> {v.source_note}</p>}
          {v.approved_by_name && (
            <p className="mb-3 text-sm">
              Approved by <strong>{v.approved_by_name}</strong> on {formatDate(v.approved_at, true)} · effective {formatDate(v.effective_date)}
              {v.review_date ? ` · review by ${formatDate(v.review_date)}` : ""}
            </p>
          )}
          {!isApprovedStatus(v.status) && v.body_markdown && <div className="mb-4"><DraftBanner /></div>}
          {v.body_markdown ? (
            <details open={i === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">Show text</summary>
              <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl bg-ink-50 p-4">
                <DocumentText text={v.body_markdown} />
              </div>
              {v.content_sha256 && <p className="mt-2 break-all font-mono text-[11px] text-ink-600">SHA-256: {v.content_sha256}</p>}
            </details>
          ) : (
            <EmptyState>Not written. Ask the right adviser to draft it, then add it as a new version below.</EmptyState>
          )}
          {manage && !["archived"].includes(v.status) && (
            <div className="mt-4 border-t border-ink-900/10 pt-4">
              <ActionForm action={setDocumentStatus.bind(null, v.id)} submitLabel="Change status">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="New status" htmlFor={`st-${v.id}`}>
                    <Select id={`st-${v.id}`} name="status" defaultValue="">
                      <option value="" disabled>Choose…</option>
                      {Object.entries(DOC_STATUS_LABELS)
                        .filter(([k]) => k !== v.status)
                        .map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Approved by (for approval only)" htmlFor={`ab-${v.id}`}><Input id={`ab-${v.id}`} name="approvedBy" placeholder="Name, firm" /></Field>
                  <Field label="Effective date" htmlFor={`ed-${v.id}`}><Input id={`ed-${v.id}`} name="effectiveDate" type="date" /></Field>
                  <Field label="Review date" htmlFor={`rd-${v.id}`}><Input id={`rd-${v.id}`} name="reviewDate" type="date" /></Field>
                </div>
                <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" /> (For approval) the approver has approved this exact version in writing.</label>
              </ActionForm>
            </div>
          )}
        </Card>
      ))}

      {manage && (
        <Card title="Add a new version">
          <p className="mb-3 text-sm text-ink-600">Use this for the solicitor/accountant-approved wording. Approved versions can never be edited – changes always create a new version.</p>
          <ActionForm action={createDocumentVersion.bind(null, id)} submitLabel="Save as draft version">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Version label" htmlFor="versionLabel"><Input id="versionLabel" name="versionLabel" placeholder="e.g. 3.1" /></Field>
              <Field label="Source" htmlFor="sourceNote"><Input id="sourceNote" name="sourceNote" placeholder="e.g. Final wording from Smith & Co, 3 Dec 2026" /></Field>
            </div>
            <Field label="Full text" htmlFor="body"><Textarea id="body" name="body" className="min-h-80 font-mono text-sm" /></Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
