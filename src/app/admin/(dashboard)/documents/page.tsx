import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, DOC_STATUS_LABELS, Notice, Pill } from "@/components/platform/ui";

const SECTORS = [
  { id: "painter", title: "A – Painter documents", text: "Shown to painters in their portal. Only approved versions can be accepted." },
  { id: "admin", title: "B – Admin and internal compliance", text: "Restricted to administrators. Never shown to painters or the public." },
  { id: "public", title: "C – Website (customer) documents", text: "Approved versions are for the public website. The current /terms and /privacy pages must be aligned before publishing." },
];

interface DocRow {
  id: string;
  title: string;
  category: string;
  sector: string;
  requires_acceptance: boolean;
  legal_document_versions: { version_label: string; status: string; body_markdown: string | null; created_at: string }[];
}

export default async function DocumentsPage() {
  await requireAdmin("documents.view");
  const supabase = (await createSessionClient())!;
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, title, category, sector, requires_acceptance, legal_document_versions(version_label, status, body_markdown, created_at)")
    .order("sort_order");
  const docs = (data ?? []) as unknown as DocRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Legal document centre</h1>
        <p className="mt-1 max-w-3xl text-ink-600">
          Loaded from your supplied legal pack (23 Nov 2026). Nothing is approved yet. Documents that weren&apos;t in the pack are listed as “not written” – they were not
          invented. See <code>docs/legal/RECONCILIATION.md</code> for the conflicts between versions.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-900">Could not load documents: {error.message}</p>}
      <Notice tone="warning">Only versions marked “Approved for publication” or “Published” can be presented as approved or accepted by painters.</Notice>
      {SECTORS.map((s) => (
        <Card key={s.id} title={s.title}>
          <p className="mb-3 text-sm text-ink-600">{s.text}</p>
          <ul className="divide-y divide-ink-900/10">
            {docs
              .filter((d) => d.sector === s.id)
              .map((d) => {
                const latest = [...d.legal_document_versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                const written = d.legal_document_versions.some((v) => v.body_markdown);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/admin/documents/${d.id}`} className="font-medium text-brand-700 hover:underline">
                      {d.title}
                    </Link>
                    <span className="flex gap-2">
                      {d.requires_acceptance && <Pill>Needs painter acceptance</Pill>}
                      {!written ? <Pill tone="danger">Not written</Pill> : <Pill tone={latest?.status === "published" ? "strong" : "warning"}>{latest ? `v${latest.version_label} · ${DOC_STATUS_LABELS[latest.status]}` : "—"}</Pill>}
                    </span>
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
