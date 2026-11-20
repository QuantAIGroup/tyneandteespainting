"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Link2, Loader2, MessageSquare, Send, XCircle } from "lucide-react";
import { calculatePaymentRequest, parsePoundsToPence, paymentLabel, type PaymentType } from "@/lib/payments/deposit";
import { formatPence } from "@/lib/pricing/engine";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Textarea } from "@/components/ui/Form";
import { agreeFinalPrice, cancelDepositRequest, recordBalancePaid, sendDepositLink, type PaymentActionState } from "../../../payment-actions";

/** Step 1 – approve the quotation: enter the agreed price and what the customer pays now. */
export function AgreePriceForm({
  id,
  defaultService,
  defaultPricePence,
  estimatePence,
  hasActiveLink,
  defaultDepositPercent,
  current,
}: {
  id: string;
  defaultService: string;
  defaultPricePence: number | null;
  estimatePence: number;
  hasActiveLink: boolean;
  defaultDepositPercent: number;
  current: { type: PaymentType; percent: number | null; amountPence: number | null };
}) {
  const [state, action, pending] = useActionState(agreeFinalPrice.bind(null, id), null);
  const [price, setPrice] = useState(defaultPricePence ? (defaultPricePence / 100).toFixed(2) : "");
  const [type, setType] = useState<PaymentType>(current.type);
  const [percent, setPercent] = useState(String(current.percent ?? defaultDepositPercent));
  const [custom, setCustom] = useState(current.type === "custom" && current.amountPence ? (current.amountPence / 100).toFixed(2) : "");
  const pence = parsePoundsToPence(price);
  const preview = pence
    ? calculatePaymentRequest({ agreedPricePence: pence, type, depositPercent: Number(percent), customAmountPence: type === "custom" ? parsePoundsToPence(custom) : null })
    : null;

  const radio = (value: PaymentType, label: string) => (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${type === value ? "bg-brand-50 font-semibold ring-brand-600" : "ring-ink-950/12"}`}>
      <input type="radio" name="paymentType" value={value} checked={type === value} onChange={() => setType(value)} className="accent-brand-600" />
      {label}
    </label>
  );

  return (
    <form action={action} className="space-y-4">
      <Field label="Agreed painting work" htmlFor="agreedService" required hint="Shown to the customer on their payment page.">
        <Textarea id="agreedService" name="agreedService" rows={3} required minLength={3} maxLength={500} defaultValue={defaultService} />
      </Field>
      <Field label="Final fixed labour price" htmlFor="agreedPrice" required hint={estimatePence > 0 ? `Online estimate was ${formatPence(estimatePence)}.` : undefined}>
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-600">£</span>
          <input id="agreedPrice" name="agreedPrice" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className="block w-full rounded-md border border-ink-950/15 bg-white py-2.5 pr-3 pl-7 text-[15px] focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none" />
        </div>
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-950">What should the customer pay online now?</legend>
        <div className="flex flex-wrap gap-2">
          {radio("deposit", "Booking deposit")}
          {radio("full", "Full payment")}
          {radio("custom", "Other amount")}
        </div>
        {type === "deposit" && (
          <div className="mt-3 flex max-w-xs items-center gap-2">
            <label htmlFor="depositPercent" className="text-sm text-ink-700">
              Deposit
            </label>
            <input id="depositPercent" name="depositPercent" type="number" min={1} max={100} step={1} value={percent} onChange={(e) => setPercent(e.target.value)} className="w-20 rounded-md border border-ink-950/15 px-2 py-1.5 text-[15px]" />
            <span className="text-sm text-ink-700">% of the agreed price</span>
          </div>
        )}
        {type === "custom" && (
          <div className="relative mt-3 max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-600">£</span>
            <input name="customAmount" aria-label="Amount to pay now" inputMode="decimal" required value={custom} onChange={(e) => setCustom(e.target.value)} className="block w-full rounded-md border border-ink-950/15 bg-white py-2.5 pr-3 pl-7 text-[15px]" />
          </div>
        )}
      </fieldset>
      {preview && (
        <div className="grid max-w-md grid-cols-2 gap-3 rounded-lg bg-grey-50 p-3 text-sm ring-1 ring-grey-200">
          <div>
            <p className="text-ink-600">{paymentLabel(type, preview.depositPercent)}</p>
            <p className="text-lg font-semibold text-brand-600">{formatPence(preview.amountPence)}</p>
          </div>
          <div>
            <p className="text-ink-600">Remaining balance</p>
            <p className="text-lg font-semibold text-ink-950">{formatPence(preview.balancePence)}</p>
          </div>
        </div>
      )}
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="spokeToCustomer" required className="mt-1 size-4 accent-brand-600" />
        <span>I have spoken to the customer and they have agreed this final price.</span>
      </label>
      {hasActiveLink && <Alert tone="warning">Changing the price or amount cancels the payment link already sent. You&rsquo;ll need to send the new one.</Alert>}
      {state && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Approve quotation
      </Button>
    </form>
  );
}

/** Step 2 – send / resend / withdraw the secure payment link. */
export function DepositLinkControls({ id, existingLink, phone, firstName, depositLabel, sendCount }: { id: string; existingLink: string | null; phone: string; firstName: string; depositLabel: string; sendCount: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PaymentActionState>(null);
  const [copied, setCopied] = useState(false);
  const link = result?.link ?? existingLink;
  const smsBody = link ? `Hi ${firstName}, thanks for speaking with us. You can pay ${depositLabel} securely here: ${link}` : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => start(async () => setResult(await sendDepositLink(id)))}>
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
              if (window.confirm("Withdraw this payment link? The customer won't be able to pay with it any more.")) start(async () => setResult(await cancelDepositRequest(id)));
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

/** After the work – record the remaining balance once you've received it (never charged automatically). */
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
