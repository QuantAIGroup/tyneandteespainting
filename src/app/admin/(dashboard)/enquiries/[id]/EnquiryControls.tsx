"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarCheck, CheckCircle2, Loader2, PhoneCall } from "lucide-react";
import { BOOKING_STATUSES, manualStatusOptions } from "@/lib/payments/booking";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Form";
import { markContacted, saveEnquiryNotes, setEnquiryStatus, type ActionState } from "../../../actions";

export function EnquiryActions({ id, status, depositPaid, contactedAt }: { id: string; status: string; depositPaid: boolean; contactedAt: string | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionState>(null);
  const options = manualStatusOptions({ status, depositPaid });

  const run = (fn: () => Promise<ActionState>) =>
    startTransition(async () => {
      setMessage(await fn());
    });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-4 ring-1 ring-ink-900/10">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => markContacted(id))}>
        <PhoneCall className="size-4" aria-hidden /> {contactedAt ? "Contacted again" : "Mark as contacted"}
      </Button>
      {depositPaid && (
        <>
          <Button variant="outline" size="sm" disabled={pending || status === "booking_confirmed"} onClick={() => run(() => setEnquiryStatus(id, "booking_confirmed"))}>
            <CalendarCheck className="size-4" aria-hidden /> Mark booking confirmed
          </Button>
          <Button variant="outline" size="sm" disabled={pending || status === "work_completed"} onClick={() => run(() => setEnquiryStatus(id, "work_completed"))}>
            <CheckCircle2 className="size-4" aria-hidden /> Mark work completed
          </Button>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="status" className="text-sm text-ink-700">
          Status
        </label>
        <div className="w-60">
          <Select id="status" value={status} disabled={pending} onChange={(e) => run(() => setEnquiryStatus(id, e.target.value))}>
            {BOOKING_STATUSES.filter((s) => options.includes(s.id)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        {pending && <Loader2 className="size-4 animate-spin text-ink-600" aria-label="Saving" />}
      </div>
      {contactedAt && <p className="w-full text-xs text-ink-600">Last contacted {new Date(contactedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}</p>}
      {message && (
        <p role="status" className={`w-full text-sm ${message.ok ? "text-brand-700" : "text-red-700"}`}>
          {message.message}
        </p>
      )}
    </div>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const [state, action, pending] = useActionState(saveEnquiryNotes.bind(null, id), null);
  return (
    <form action={action} className="rounded-xl bg-white p-4 ring-1 ring-ink-900/10">
      <label htmlFor="notes" className="mb-2 block font-medium">
        Private notes
      </label>
      <Textarea id="notes" name="notes" rows={5} defaultValue={notes} placeholder="e.g. Called Tuesday, agreed £380, prefers mornings" />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
        {state && <span className={`text-sm ${state.ok ? "text-brand-700" : "text-red-700"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
