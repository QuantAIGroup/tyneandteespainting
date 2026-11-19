"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Loader2, PhoneCall, ThumbsUp } from "lucide-react";
import { ENQUIRY_STATUSES } from "@/lib/enquiry";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Form";
import { saveEnquiryNotes, setEnquiryStatus, type ActionState } from "../../../actions";

export function EnquiryActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionState>(null);

  const change = (next: string) =>
    startTransition(async () => {
      setMessage(await setEnquiryStatus(id, next));
    });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-4 ring-1 ring-navy-900/10">
      <Button variant="outline" size="sm" disabled={pending || status === "contacted"} onClick={() => change("contacted")}>
        <PhoneCall className="size-4" aria-hidden /> Mark as contacted
      </Button>
      <Button variant="outline" size="sm" disabled={pending || status === "accepted"} onClick={() => change("accepted")}>
        <ThumbsUp className="size-4" aria-hidden /> Mark quote accepted
      </Button>
      <Button variant="outline" size="sm" disabled={pending || status === "completed"} onClick={() => change("completed")}>
        <CheckCircle2 className="size-4" aria-hidden /> Mark job completed
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="status" className="text-sm text-navy-700">
          Status
        </label>
        <div className="w-48">
          <Select id="status" value={status} disabled={pending} onChange={(e) => change(e.target.value)}>
            {ENQUIRY_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        {pending && <Loader2 className="size-4 animate-spin text-navy-600" aria-label="Saving" />}
      </div>
      {message && (
        <p role="status" className={`w-full text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
          {message.message}
        </p>
      )}
    </div>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string }) {
  const [state, action, pending] = useActionState(saveEnquiryNotes.bind(null, id), null);
  return (
    <form action={action} className="rounded-xl bg-white p-4 ring-1 ring-navy-900/10">
      <label htmlFor="notes" className="mb-2 block font-medium">
        Private notes
      </label>
      <Textarea id="notes" name="notes" rows={5} defaultValue={notes} placeholder="e.g. Called Tuesday, sent fixed quote £380, prefers mornings" />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
        {state && <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
