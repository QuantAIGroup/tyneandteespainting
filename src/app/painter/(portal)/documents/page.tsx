import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requirePainter } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, DOC_STATUS_LABELS, Pill, isApprovedStatus } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Documents" };

interface DocRow {
  id: string;
  title: string;
  category: string;
  requires_acceptance: boolean;
  legal_document_versions: { id: string; version_label: string; status: string; created_at: string }[];
}

export default async function PainterDocumentsPage() {
  const painter = await requirePainter();
  const supabase = (await createSessionClient())!;
  const [{ data }, { data: acc }] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("id, title, category, requires_acceptance, legal_document_versions(id, version_label, status, created_at)")
      .eq("sector", "painter")
      .order("sort_order"),
    supabase.from("document_acceptances").select("version_id").eq("painter_business_id", painter.painterBusinessId),
  ]);
  const accepted = new Set((acc ?? []).map((a) => a.version_id as string));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl">Documents</h1>
      <p className="text-ink-700">Your agreement and the policies that apply when you take on jobs. Drafts are shown for information only.</p>
      <Card>
        <ul className="divide-y divide-ink-900/10">
          {((data ?? []) as unknown as DocRow[]).map((d) => {
            const current =
              d.legal_document_versions.find((v) => v.status === "published") ??
              d.legal_document_versions.find((v) => v.status === "approved_for_publication") ??
              [...d.legal_document_versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            const approved = current && isApprovedStatus(current.status);
            return (
              <li key={d.id}>
                <Link href={`/painter/documents/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-700">
                  <span>
                    <span className="block font-semibold">{d.title}</span>
                    <span className="text-sm text-ink-600">
                      {current ? `Version ${current.version_label}` : "Not yet written"}
                      {d.requires_acceptance && " · needs your acceptance"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {current && accepted.has(current.id) ? (
                      <Pill tone="strong">Accepted</Pill>
                    ) : (
                      <Pill tone={approved ? "blue" : "warning"}>{current ? (approved ? "Approved" : DOC_STATUS_LABELS[current.status] ?? "Draft") : "Not written"}</Pill>
                    )}
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
