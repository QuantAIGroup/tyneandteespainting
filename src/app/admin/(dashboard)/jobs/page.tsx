import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatPence } from "@/lib/pricing/engine";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, EmptyState, Pill, formatDate } from "@/components/platform/ui";
import { JOB_STATUS_LABELS } from "@/lib/platform/labels";


export default async function JobsPage() {
  await requireAdmin("jobs.manage");
  const supabase = (await createSessionClient())!;
  const [{ data: jobs, error }, { data: emergencies }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, reference, title, status, site_town, customer_price_pence, created_at, painter_businesses(legal_name, trading_name), enquiries(reference)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("emergency_notices").select("id, job_id, category, created_at").neq("status", "resolved"),
  ]);
  const urgent = new Set((emergencies ?? []).map((e) => e.job_id as string));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Painter jobs</h1>
          <p className="mt-1 text-ink-600">Internal jobs created from website bookings and offered to independent painters.</p>
        </div>
        <Link href="/admin/jobs/new" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          New job
        </Link>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-900">Could not load jobs: {error.message}. Have the painter platform migrations been run?</p>}
      <Card>
        {(jobs ?? []).length === 0 ? (
          <EmptyState>No jobs yet. Open a website enquiry and choose “Create painter job”.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Painter</th>
                  <th className="py-2 pr-4">Customer price</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/10">
                {(jobs ?? []).map((j) => {
                  const p = j.painter_businesses as unknown as { legal_name: string; trading_name: string | null } | null;
                  const e = j.enquiries as unknown as { reference: string } | null;
                  return (
                    <tr key={j.id as string}>
                      <td className="py-3 pr-4">
                        <Link href={`/admin/jobs/${j.id}`} className="font-semibold text-brand-700 hover:underline">
                          {j.title as string}
                        </Link>
                        <span className="block font-mono text-xs text-ink-600">
                          {j.reference as string}
                          {e ? ` · ${e.reference}` : ""}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Pill tone={j.status === "completion_submitted" ? "strong" : "blue"}>{JOB_STATUS_LABELS[j.status as string] ?? (j.status as string)}</Pill>{" "}
                        {urgent.has(j.id as string) && <Pill tone="danger">Attendance issue</Pill>}
                      </td>
                      <td className="py-3 pr-4">{p ? p.trading_name || p.legal_name : "—"}</td>
                      <td className="py-3 pr-4">{j.customer_price_pence ? formatPence(j.customer_price_pence as number, { alwaysShowPence: true }) : "—"}</td>
                      <td className="py-3">{formatDate(j.created_at as string)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
