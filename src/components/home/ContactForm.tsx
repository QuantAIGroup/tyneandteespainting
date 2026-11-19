"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Textarea } from "@/components/ui/Form";

type Status = { state: "idle" } | { state: "sending" } | { state: "sent" } | { state: "error"; message: string };

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setStatus({ state: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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
      <Alert tone="success" title="Thank you – your message has been sent.">
        We&rsquo;ll get back to you as soon as we can, usually within one working day.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" required>
          <Input id="c-name" name="name" autoComplete="name" required minLength={2} />
        </Field>
        <Field label="Phone (optional)" htmlFor="c-phone">
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" />
        </Field>
      </div>
      <Field label="Email" htmlFor="c-email" required>
        <Input id="c-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Message" htmlFor="c-message" required>
        <Textarea id="c-message" name="message" required minLength={10} rows={5} />
      </Field>
      {/* Honeypot: hidden from people, bots fill it in */}
      <div className="hidden" aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {status.state === "error" && <Alert tone="error">{status.message}</Alert>}
      <Button type="submit" disabled={status.state === "sending"} className="w-full sm:w-auto">
        {status.state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {status.state === "sending" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
