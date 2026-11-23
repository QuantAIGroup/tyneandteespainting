import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ENGAGEMENT_ROUTE_LABELS, ONBOARDING_LABELS, isoDateFromToday } from "@/lib/platform/labels";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, EmptyState, Pill, formatDate } from "@/components/platform/ui";

export default async function PaintersPage() {
  await requireAdmin("painters.view");
  const supabase = (await createSessionClient())!;
  const soon = isoDateFromToday(30);
  const [{ data: painters, error }, { data: expiring }] = await Promise.all([
    supabase.from("painter_businesses").select("id, legal_name, trading_name, onboarding_status, engagement_route, submitted_at, created_at").order("created_at", { ascending: false }),
    supabase.from("painter_evidence").select("painter_business_id, title, expires_on").eq("verification_status", "verified").lte("expires_on", soon),
  ]);
  const expiringBy = new Map<string, string>();
  for (const e of expiring ?? []) expiringBy.set(e.painter_business_id as string, e.expires_on as string);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Independent painters</h1>
        <p className="mt-1 text-ink-600">Painting businesses that registered through the painter portal (/painter/apply).</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-900">Could not load painters: {error.message}</p>}
      <Card>
        {(painters ?? []).length === 0 ? (
          <EmptyState>No painters yet. Send painters the link {"/painter/apply"} to register.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-900/10">
            {(painters ?? []).map((p) => (
              <li key={p.id as string} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <Link href={`/admin/painters/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                    {(p.trading_name as string) || (p.legal_name as string)}
                  </Link>
                  <span className="block text-sm text-ink-600">Registered {formatDate(p.created_at as string)}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Pill tone={p.onboarding_status === "submitted" ? "strong" : p.onboarding_status === "approved" ? "blue" : "neutral"}>{ONBOARDING_LABELS[p.onboarding_status as string]}</Pill>
                  {p.engagement_route !== "independent_business" && <Pill tone="danger">{ENGAGEMENT_ROUTE_LABELS[p.engagement_route as string]}</Pill>}
                  {expiringBy.has(p.id as string) && <Pill tone="warning">Insurance expires {formatDate(expiringBy.get(p.id as string))}</Pill>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
