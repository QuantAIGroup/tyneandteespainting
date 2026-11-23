import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePainter } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { Card, DOC_STATUS_LABELS, DraftBanner, EmptyState, Notice, Pill, formatDate, isApprovedStatus } from "@/components/platform/ui";
import { DocumentText } from "@/components/platform/DocumentText";
import { acceptDocument } from "../../../actions";

export const metadata: Metadata = { title: "Document" };

export default async function PainterDocumentPage({ params }: PageProps<"/painter/documents/[id]">) {
  const painter = await requirePainter();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: doc } = await supabase
    .from("legal_documents")
    .select("id, title, sector, requires_acceptance, legal_document_versions(id, version_label, status, body_markdown, effective_date, created_at)")
    .eq("id", id)
    .maybeSingle();
  if (!doc || doc.sector !== "painter") notFound();
  const versions = (doc.legal_document_versions as { id: string; version_label: string; status: string; body_markdown: string | null; effective_date: string | null; created_at: string }[]).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const current = versions.find((v) => v.status === "published") ?? versions.find((v) => v.status === "approved_for_publication") ?? versions[0];
  const { data: acc } = current
    ? await supabase.from("document_acceptances").select("accepted_at").eq("painter_business_id", painter.painterBusinessId).eq("version_id", current.id).maybeSingle()
    : { data: null };
  const approved = current && isApprovedStatus(current.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/painter/documents" className="text-sm text-brand-700 underline">← Documents</Link>
        <h1 className="mt-2 text-2xl sm:text-3xl">{doc.title as string}</h1>
        {current && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-700">
            Version {current.version_label} <Pill tone={approved ? "strong" : "warning"}>{DOC_STATUS_LABELS[current.status]}</Pill>
            {current.effective_date && <>· effective {formatDate(current.effective_date)}</>}
          </p>
        )}
      </div>
      {!approved && <DraftBanner />}
      <Card>{current?.body_markdown ? <DocumentText text={current.body_markdown} /> : <EmptyState>This document hasn&apos;t been written yet.</EmptyState>}</Card>
      {doc.requires_acceptance && current && (
        <Card title="Your acceptance">
          {acc ? (
            <Notice>You accepted this version on {formatDate(acc.accepted_at as string, true)}.</Notice>
          ) : approved ? (
            <ActionForm action={acceptDocument.bind(null, current.id)} submitLabel="I accept this agreement" confirm="Accept this exact version of the document?">
              <p className="text-sm text-ink-700">We record the date, time, version and a fingerprint of the text you accepted. You can download or view it here at any time.</p>
            </ActionForm>
          ) : (
            <Notice tone="warning">This can&apos;t be accepted until it has been approved by our solicitor. You can&apos;t accept job offers until then.</Notice>
          )}
        </Card>
      )}
    </div>
  );
}
