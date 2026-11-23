"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Link2, Loader2, MessageSquare, Send, XCircle } from "lucide-react";
import { fullPaymentRequest, parsePoundsToPence } from "@/lib/payments/deposit";
import { formatPence } from "@/lib/pricing/engine";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Textarea } from "@/components/ui/Form";
import { agreeFinalPrice, cancelPaymentRequest, recordBalancePaid, refundPayment, sendPaymentLink, type PaymentActionState } from "../../../payment-actions";

/** Step 1 – approve the quotation: enter the final agreed price. The customer pays 100% of it. */
export function AgreePriceForm({
  id,
  defaultService,
  defaultPricePence,
  estimatePence,
  hasActiveLink,
}: {
  id: string;
  defaultService: string;
  defaultPricePence: number | null;
  estimatePence: number;
  hasActiveLink: boolean;
}) {
  const [state, action, pending] = useActionState(agreeFinalPrice.bind(null, id), null);
  const [price, setPrice] = useState(defaultPricePence ? (defaultPricePence / 100).toFixed(2) : "");
  const pence = parsePoundsToPence(price);
  const preview = pence ? fullPaymentRequest(pence) : null;

  return (
    <form action={action} className="space-y-4">
      <Field label="Agreed painting work" htmlFor="agreedService" required hint="Shown to the customer on their payment page.">
        <Textarea id="agreedService" name="agreedService" rows={3} required minLength={3} maxLength={500} defaultValue={defaultService} />
      </Field>
      <Field
        label="Final agreed labour price"
        htmlFor="agreedPrice"
        required
        hint={estimatePence > 0 ? `Online estimate was ${formatPence(estimatePence, { alwaysShowPence: true })}. Enter the price you agreed with the customer – it can differ from the estimate.` : undefined}
      >
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-600">£</span>
          <input id="agreedPrice" name="agreedPrice" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className="block w-full rounded-md border border-ink-950/15 bg-white py-2.5 pr-3 pl-7 text-[15px] focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none" />
        </div>
      </Field>
      {preview && (
        <div className="max-w-md rounded-lg bg-grey-50 p-3 text-sm ring-1 ring-grey-200">
          <p className="text-ink-600">Customer pays online (100% of the agreed price)</p>
          <p className="text-lg font-semibold text-brand-600">{formatPence(preview.amountPence, { alwaysShowPence: true })}</p>
        </div>
      )}
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="spokeToCustomer" required className="mt-1 size-4 accent-brand-600" />
        <span>I have spoken to the customer and they have agreed this final price.</span>
      </label>
      {hasActiveLink && <Alert tone="warning">Changing the price cancels the payment link already sent. You&rsquo;ll need to send the new one.</Alert>}
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Approve quotation
      </Button>
    </form>
  );
}

/** Step 2 – send / resend / withdraw the secure payment link. */
export function PaymentLinkControls({ id, existingLink, phone, firstName, amountLabel, sendCount }: { id: string; existingLink: string | null; phone: string; firstName: string; amountLabel: string; sendCount: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PaymentActionState>(null);
  const [copied, setCopied] = useState(false);
  const link = result?.link ?? existingLink;
  const smsBody = link ? `Hi ${firstName}, thanks for speaking with us. You can pay ${amountLabel} securely here: ${link}` : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => start(async () => setResult(await sendPaymentLink(id)))}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {existingLink ? "Resend payment link" : "Send payment link"}
        </Button>
        {existingLink && (
          <Button
            type="button"
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Withdraw this payment link? The customer won't be able to pay with it any more.")) start(async () => setResult(await cancelPaymentRequest(id)));
            }}
          >
            <XCircle className="size-4" aria-hidden /> Withdraw link
          </Button>
        )}
      </div>
      {sendCount > 0 && <p className="text-xs text-ink-600">Link sent {sendCount} time{sendCount === 1 ? "" : "s"}.</p>}
      {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
      {link && (
        <div className="rounded-lg bg-ink-50 p-3 ring-1 ring-ink-100">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700">
            <Link2 className="size-3.5" aria-hidden /> Customer payment link
          </p>
          <p className="break-all font-mono text-xs text-ink-900">{link}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied!" : "Copy link"}
            </Button>
            <a href={`sms:${phone.replace(/\s/g, "")}?&body=${encodeURIComponent(smsBody)}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-ink-900/20 bg-white px-3 text-sm font-medium text-ink-900 hover:bg-grey-50">
              <MessageSquare className="size-4" aria-hidden /> Text to customer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/** Older deposit bookings only – record the remaining balance once received (never charged automatically). */
export function BalancePaidForm({ id, balanceLabel }: { id: string; balanceLabel: string }) {
  const [state, action, pending] = useActionState(recordBalancePaid.bind(null, id), null);
  return (
    <form action={action} className="space-y-3">
      <Field label={`Record remaining balance (${balanceLabel}) as received`} htmlFor="note" hint="e.g. 'Bank transfer, 28 Nov' or 'Cash on completion'">
        <Input id="note" name="note" required minLength={2} maxLength={300} />
      </Field>
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Mark balance paid
      </Button>
    </form>
  );
}

/**
 * Refund through Stripe, back to the customer's original payment method.
 * The refund is kept in its own record; the original payment is never changed.
 */
export function RefundForm({ id, refundableLabel, refundablePounds, canCancel }: { id: string; refundableLabel: string; refundablePounds: string; canCancel: boolean }) {
  const [state, action, pending] = useActionState(refundPayment.bind(null, id), null);
  return (
    <form action={action} className="space-y-3 rounded-lg bg-ink-900/[0.03] p-4">
      <h3 className="font-sans text-[15px] font-semibold text-ink-950">Refund through Stripe</h3>
      <p className="text-sm text-ink-600">Up to {refundableLabel} can be refunded. It goes back to the customer&rsquo;s original payment method. Follow the cancellation policy: only reasonable, evidenced costs may be kept.</p>
      <Field label="Amount to refund (£)" htmlFor="refund-amount">
        <Input id="refund-amount" name="amount" inputMode="decimal" required defaultValue={refundablePounds} />
      </Field>
      <Field label="Reason" htmlFor="refund-note" hint="e.g. 'Cancelled more than 48 hours before' or 'Within 14-day cooling-off period'">
        <Input id="refund-note" name="note" required minLength={3} maxLength={500} />
      </Field>
      {canCancel && (
        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" name="cancelBooking" defaultChecked className="size-4" /> Also mark the booking as cancelled
        </label>
      )}
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Refund now
      </Button>
    </form>
  );
}
