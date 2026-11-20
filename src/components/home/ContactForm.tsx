"use client";

import { useState, type FormEvent } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";

export const SERVICE_OPTIONS = ["Bedroom painting", "Living room painting", "Skirting board painting", "Ceiling painting", "More than one room", "Not sure yet"] as const;

type Status = { state: "idle" } | { state: "sending" } | { state: "sent" } | { state: "error"; message: string };

/** Simple booking request form. Sending it does NOT confirm a booking. */
export function ContactForm() {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setStatus({ state: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      form.reset();
      setStatus({ state: "sent" });
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  if (status.state === "sent") {
    return (
      <Alert tone="success" title="Thank you – we've received your booking request.">
        This is a request, not a confirmed booking yet. We&rsquo;ll be in touch to talk through your project, agree a price and arrange a date that suits you.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Your name" htmlFor="c-name" required>
        <Input id="c-name" name="name" autoComplete="name" required minLength={2} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telephone number" htmlFor="c-phone" required>
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" required minLength={10} />
        </Field>
        <Field label="Email" htmlFor="c-email" required>
          <Input id="c-email" name="email" type="email" autoComplete="email" required />
        </Field>
      </div>
      <Field label="Service required" htmlFor="c-service" required>
        <Select id="c-service" name="service" required defaultValue="">
          <option value="" disabled>
            Please choose…
          </option>
          {SERVICE_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      </Field>
      <Field label="Message" htmlFor="c-message" required hint="Tell us about your room and when you'd like the work done.">
        <Textarea id="c-message" name="message" required minLength={10} rows={5} />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {status.state === "error" && <Alert tone="error">{status.message}</Alert>}
      <Button type="submit" size="lg" disabled={status.state === "sending"} className="w-full font-bold sm:w-auto">
        {status.state === "sending" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CalendarCheck className="size-5" aria-hidden />}
        {status.state === "sending" ? "Sending…" : "Request a booking"}
      </Button>
      <p className="text-sm text-ink-600">Sending this form doesn&rsquo;t confirm a booking – we&rsquo;ll contact you first to agree the details.</p>
    </form>
  );
}
