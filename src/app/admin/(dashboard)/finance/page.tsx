import { requireAdmin } from "@/lib/auth";
import { summariseReserve, taxMonthDates } from "@/lib/platform/cis";
import { paymentStatusLabel } from "@/lib/platform/painter-payments";
import { checkCisMonth } from "@/lib/platform/reconciliation";
import { formatPence } from "@/lib/pricing/engine";
import { isoDateFromToday } from "@/lib/platform/labels";
import { createSessionClient } from "@/lib/supabase/server";
import { Card, EmptyState, Notice, Pill, formatDate } from "@/components/platform/ui";

const gbp = (p: number) => formatPence(p, { alwaysShowPence: true });

/**
 * Payments & CIS overview. The full invoice → approval → bank transfer →
 * reconciliation screens and the Sage connection are the next build phases;
 * the database rules for them are already in place and tested.
 */
export default async function FinancePage() {
  await requireAdmin("finance.view");
  const supabase = (await createSessionClient())!;
  const today = isoDateFromToday();
  const [{ data: gate }, { data: months, error }, { data: payments }] = await Promise.all([
    supabase.from("compliance_gates").select("approved, approved_by_name").eq("key", "cis_contractor_setup").maybeSingle(),
    supabase.from("cis_monthly_summary").select("*").order("tax_month_start", { ascending: false }),
    supabase
      .from("painter_payments")
      .select("id, status, gross_pence, cis_deduction_pence, net_pence, due_date, painter_businesses(legal_name, trading_name), jobs(reference)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const rows = (months ?? []) as {
    tax_month_start: string;
    return_due_date: string;
    payment_due_date: string;
    cis_deducted_pence: number;
    reserved_pence: number;
    paid_to_hmrc_pence: number;
    outstanding_liability_pence: number;
    return_status: string;
  }[];
  const summary = summariseReserve(rows.map((m) => ({ taxMonthStart: m.tax_month_start, deductedPence: m.cis_deducted_pence, reservedPence: m.reserved_pence, paidToHmrcPence: m.paid_to_hmrc_pence })));
  const flags = rows.flatMap((m) =>
    checkCisMonth(
      {
        taxMonthStart: m.tax_month_start,
        ledgerDeductedPence: m.cis_deducted_pence,
        reservedPence: m.reserved_pence,
        paidToHmrcPence: m.paid_to_hmrc_pence,
        returnStatus: m.return_status,
        returnDueDate: m.return_due_date,
        paymentDueDate: m.payment_due_date,
      },
      today,
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Painter payments &amp; CIS</h1>
        <p className="mt-1 max-w-3xl text-ink-600">
          Customers pay through the website (Stripe). Painters are paid separately by manual bank transfer. CIS deductions are tax held for HMRC – not company money – and
          are kept in one “CIS Tax Reserve” savings account with a digital ledger per painter.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-900">Could not load CIS data: {error.message}</p>}
      {!gate?.approved && (
        <Notice tone="warning">
          <strong>Painter payments are locked.</strong> Your accountant must confirm your CIS contractor registration and deduction method, then you record it under
          Approvals. Until then invoices can be received but no payment can be approved.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["CIS deducted (all months)", summary.totalDeductedPence],
          ["Moved into reserve", summary.totalReservedPence],
          ["Paid to HMRC", summary.totalPaidToHmrcPence],
          ["Outstanding CIS liability", summary.outstandingLiabilityPence],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">{label as string}</p>
            <p className="mt-1 text-2xl font-bold">{gbp(value as number)}</p>
          </Card>
        ))}
      </div>
      {summary.reserveShortfallPence > 0 && <Notice tone="danger">The reserve account is short by {gbp(summary.reserveShortfallPence)} against the outstanding CIS liability.</Notice>}

      {flags.length > 0 && (
        <Card title="Needs attention">
          <ul className="space-y-2 text-sm">
            {flags.map((f, i) => (
              <li key={i}>
                <Pill tone="danger">{f.area}</Pill> {taxMonthDates(f.entityId!).label}: {f.description}
                {f.expectedPence !== undefined && ` (expected ${gbp(f.expectedPence)}, found ${gbp(f.foundPence ?? 0)})`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="CIS by tax month">
        {rows.length === 0 ? (
          <EmptyState>No CIS deductions recorded yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="py-2 pr-4">Tax month</th>
                  <th className="py-2 pr-4">Deducted</th>
                  <th className="py-2 pr-4">Reserved</th>
                  <th className="py-2 pr-4">Paid to HMRC</th>
                  <th className="py-2 pr-4">Return (due)</th>
                  <th className="py-2">Payment due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/10">
                {rows.map((m) => (
                  <tr key={m.tax_month_start}>
                    <td className="py-2 pr-4">{taxMonthDates(m.tax_month_start).label}</td>
                    <td className="py-2 pr-4">{gbp(m.cis_deducted_pence)}</td>
                    <td className="py-2 pr-4">{gbp(m.reserved_pence)}</td>
                    <td className="py-2 pr-4">{gbp(m.paid_to_hmrc_pence)}</td>
                    <td className="py-2 pr-4">{m.return_status.replace(/_/g, " ")} ({formatDate(m.return_due_date)})</td>
                    <td className="py-2">{formatDate(m.payment_due_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Painter payments">
        {(payments ?? []).length === 0 ? (
          <EmptyState>No painter invoices yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-900/10 text-sm">
            {(payments ?? []).map((p) => {
              const b = p.painter_businesses as unknown as { legal_name: string; trading_name: string | null };
              const j = p.jobs as unknown as { reference: string };
              return (
                <li key={p.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <strong>{b.trading_name || b.legal_name}</strong> · <span className="font-mono">{j.reference}</span> · due {formatDate(p.due_date as string)}
                    <span className="block text-ink-600">
                      Gross {gbp(p.gross_pence as number)} − CIS {gbp(p.cis_deduction_pence as number)} = net {gbp(p.net_pence as number)}
                    </span>
                  </span>
                  <Pill tone="blue">{paymentStatusLabel(p.status as string)}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
