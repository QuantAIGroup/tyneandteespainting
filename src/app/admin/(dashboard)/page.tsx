import Link from "next/link";
import { AlertTriangle, Camera, Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { ENQUIRY_STATUSES } from "@/lib/enquiry";
import { formatPence } from "@/lib/pricing/engine";
import { createSessionClient } from "@/lib/supabase/server";
import { StatusBadge } from "./StatusBadge";

interface EnquiryRow {
  id: string;
  reference: string;
  status: string;
  full_name: string;
  postcode: string;
  estimated_total_pence: number;
  requires_manual_quote: boolean;
  needs_review: boolean;
  agreed_price_pence: number | null;
  deposit_paid_pence: number | null;
  created_at: string;
  enquiry_photos: { count: number }[];
}

export default async function EnquiriesPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter = typeof status === "string" && ENQUIRY_STATUSES.some((s) => s.id === status) ? status : null;

  const supabase = (await createSessionClient())!;
  let query = supabase
    .from("enquiries")
    .select("id, reference, status, full_name, postcode, estimated_total_pence, requires_manual_quote, needs_review, agreed_price_pence, deposit_paid_pence, created_at, enquiry_photos(count)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as EnquiryRow[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Enquiries</h1>
          <p className="mt-1 text-ink-600">Estimates from the website calculator. Call the customer, agree the final price, then send the payment link for 100% of the agreed price from the enquiry page.</p>
        </div>
      </div>

      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        <Link href="/admin" className={`rounded-full px-3.5 py-1.5 text-sm ${!filter ? "bg-ink-900 text-white" : "bg-white text-ink-800 ring-1 ring-ink-900/10"}`}>
          All
        </Link>
        {ENQUIRY_STATUSES.map((s) => (
          <Link key={s.id} href={`/admin?status=${s.id}`} className={`rounded-full px-3.5 py-1.5 text-sm ${filter === s.id ? "bg-ink-900 text-white" : "bg-white text-ink-800 ring-1 ring-ink-900/10"}`}>
            {s.label}
          </Link>
        ))}
      </nav>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-900">Could not load enquiries: {error.message}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl bg-white ring-1 ring-ink-900/10">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-grey-50 text-ink-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Reference</th>
              <th scope="col" className="px-4 py-3 font-semibold">Received</th>
              <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
              <th scope="col" className="px-4 py-3 font-semibold">Postcode</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Online estimate</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Agreed price</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Paid</th>
              <th scope="col" className="px-4 py-3 font-semibold">Flags</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/8">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-ink-600">
                  No enquiries {filter ? "with this status" : "yet"}.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-grey-50/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/enquiries/${r.id}`} className="font-mono font-semibold text-ink-950 underline-offset-2 hover:underline">
                    {r.reference}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-700">{new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}</td>
                <td className="px-4 py-3 font-medium text-ink-950">{r.full_name}</td>
                <td className="px-4 py-3 text-ink-700">{r.postcode}</td>
                <td className="px-4 py-3 text-right text-ink-700">{r.estimated_total_pence > 0 ? formatPence(r.estimated_total_pence) : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{r.agreed_price_pence ? formatPence(r.agreed_price_pence) : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand-700">{r.deposit_paid_pence ? formatPence(r.deposit_paid_pence) : "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex gap-2 text-ink-600">
                    {r.requires_manual_quote && <AlertTriangle className="size-4 text-brand-600" aria-label="Manual quote needed" />}
                    {r.needs_review && <Info className="size-4 text-brand-600" aria-label="Flagged for review" />}
                    {(r.enquiry_photos?.[0]?.count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5" aria-label={`${r.enquiry_photos[0].count} photos`}>
                        <Camera className="size-4" aria-hidden /> {r.enquiry_photos[0].count}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
