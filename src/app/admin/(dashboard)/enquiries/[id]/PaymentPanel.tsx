import { ExternalLink } from "lucide-react";
import { bookingStatusLabel } from "@/lib/payments/booking";
import { outstandingBalance, paymentLabel, type PaymentType } from "@/lib/payments/deposit";
import { getPaymentSettings } from "@/lib/settings";
import { paymentLinkUrl } from "@/lib/payments/checkout";
import { isStripeConfigured, stripeDashboardPaymentUrl, stripeMode } from "@/lib/payments/stripe";
import { formatPence } from "@/lib/pricing/engine";
import type { QuoteItem } from "@/lib/pricing/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert } from "@/components/ui/Form";
import { AgreePriceForm, BalancePaidForm, DepositLinkControls } from "./PaymentControls";

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }) : "—");

function defaultServiceText(items: QuoteItem[]): string {
  return items
    .map((i) => {
      if (i.type === "bedroom" || i.type === "living_room") return `${i.label} walls${i.includeCeiling ? " and ceiling" : ""}`;
      return i.label;
    })
    .join(", ");
}

/** Payment tracking + the deposit workflow for one enquiry. */
export async function PaymentPanel({ enquiry, items, estimatePence }: { enquiry: Record<string, unknown>; items: QuoteItem[]; estimatePence: number }) {
  const agreed = (enquiry.agreed_price_pence as number | null) ?? null;
  const deposit = (enquiry.deposit_pence as number | null) ?? null;
  const depositPaid = (enquiry.deposit_paid_pence as number | null) ?? null;
  const balancePaid = (enquiry.balance_paid_pence as number | null) ?? null;
  const paidAt = enquiry.deposit_paid_at as string | null;
  const pi = enquiry.stripe_payment_intent_id as string | null;
  const status = enquiry.status as string;
  const token = enquiry.payment_token as string | null;
  const paymentType = ((enquiry.payment_type as string) ?? "deposit") as PaymentType;
  const percent = (enquiry.deposit_percent as number | null) ?? null;
  const label = paymentLabel(paymentType, percent);
  const { defaultDepositPercent } = await getPaymentSettings();
  const outstanding = outstandingBalance({ agreedPricePence: agreed, depositPaidPence: depositPaid, balancePaidPence: balancePaid });

  // Any duplicate / unusual payments for this booking
  const admin = createAdminClient();
  const { data: payments } = admin ? await admin.from("payments").select("outcome, amount_pence, stripe_payment_intent_id, notes, created_at").eq("enquiry_id", enquiry.id as string).order("created_at") : { data: [] };
  const problems = (payments ?? []).filter((p) => p.outcome !== "deposit_recorded");

  const rows: [string, React.ReactNode][] = [
    ["Booking status", <strong key="s">{bookingStatusLabel(status)}</strong>],
    ["Total agreed job price", agreed ? formatPence(agreed) : "Not agreed yet"],
    ["Payment requested", deposit ? `${label}: ${formatPence(deposit)}` : "—"],
    ["Paid online", depositPaid ? <span key="d" className="font-semibold text-brand-700">{formatPence(depositPaid)}</span> : "Not paid"],
    ["Outstanding balance", outstanding !== null ? formatPence(outstanding) : "—"],
    ["Payment date", fmtDate(paidAt)],
    [
      "Stripe payment reference",
      pi ? (
        <a key="pi" href={stripeDashboardPaymentUrl(pi)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-xs underline-offset-2 hover:underline">
          {pi} <ExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      ) : (
        "—"
      ),
    ],
  ];
  if (enquiry.stripe_receipt_url)
    rows.push([
      "Stripe receipt",
      <a key="r" href={enquiry.stripe_receipt_url as string} target="_blank" rel="noreferrer" className="text-brand-600 underline-offset-2 hover:underline">
        View receipt
      </a>,
    ]);
  if (enquiry.balance_paid_at) rows.push(["Balance received", `${fmtDate(enquiry.balance_paid_at as string)} – ${enquiry.balance_payment_note ?? ""}`]);

  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-ink-900/10">
      <div className="flex items-center justify-between bg-ink-950 px-5 py-3">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-brand-200">Quotation & payment</h2>
        {stripeMode() === "test" && <span className="rounded bg-brand-300 px-2 py-0.5 text-[11px] font-bold text-brand-900">STRIPE TEST MODE</span>}
      </div>
      <dl className="divide-y divide-ink-900/8 px-5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-600">{k}</dt>
            <dd className="text-right text-ink-950">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-5 border-t border-ink-900/8 px-5 py-5">
        {problems.length > 0 && (
          <Alert tone="warning" title="Payments needing attention">
            <ul className="space-y-1">
              {problems.map((p) => (
                <li key={p.stripe_payment_intent_id as string}>
                  {formatPence(p.amount_pence as number)} ({p.stripe_payment_intent_id as string}) –{" "}
                  {p.outcome === "duplicate_refunded" ? "duplicate payment, automatically refunded" : p.outcome === "duplicate_refund_failed" ? "duplicate payment – REFUND FAILED, refund it in Stripe" : `check in Stripe: ${p.notes ?? ""}`}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {!isStripeConfigured() && !paidAt && <Alert tone="warning">Stripe isn&rsquo;t connected yet, so customers can&rsquo;t pay online. Add your Stripe keys (see README).</Alert>}

        {paidAt ? (
          <>
            <Alert tone="success">Payment verified by Stripe. The agreed price is now locked.{outstanding ? " The remaining balance is never charged automatically – collect it as agreed." : ""}</Alert>
            {!enquiry.balance_paid_at && outstanding !== null && outstanding > 0 && <BalancePaidForm id={enquiry.id as string} balanceLabel={formatPence(outstanding)} />}
          </>
        ) : (
          <>
            <div>
              <h3 className="mb-3 font-sans text-[15px] font-semibold text-ink-950">1. Approve the quotation (after speaking to the customer)</h3>
              <AgreePriceForm
                id={enquiry.id as string}
                defaultService={(enquiry.agreed_service as string | null) ?? defaultServiceText(items)}
                defaultPricePence={agreed}
                estimatePence={estimatePence}
                hasActiveLink={status === "deposit_requested"}
                defaultDepositPercent={defaultDepositPercent}
                current={{ type: paymentType, percent, amountPence: deposit }}
              />
            </div>
            {agreed && deposit && ["price_agreed", "deposit_requested"].includes(status) && (
              <div className="border-t border-ink-900/8 pt-5">
                <h3 className="mb-1 font-sans text-[15px] font-semibold text-ink-950">2. Send the payment request ({label}: {formatPence(deposit)})</h3>
                <p className="mb-3 text-sm text-ink-600">The customer can&rsquo;t change the amount. It is only marked paid once Stripe confirms the payment.</p>
                <DepositLinkControls
                  id={enquiry.id as string}
                  existingLink={status === "deposit_requested" && token ? paymentLinkUrl(token) : null}
                  phone={enquiry.phone as string}
                  firstName={String(enquiry.full_name).split(" ")[0]}
                  depositLabel={`your ${label.toLowerCase()} of ${formatPence(deposit)}`}
                  sendCount={(enquiry.payment_link_send_count as number) ?? 0}
                />
                {status === "deposit_requested" && <p className="mt-2 text-xs text-ink-600">Requested {fmtDate(enquiry.deposit_requested_at as string)} · last sent {fmtDate(enquiry.payment_link_last_sent_at as string)}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
