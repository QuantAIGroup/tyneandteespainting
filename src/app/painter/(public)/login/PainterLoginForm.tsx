"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input } from "@/components/ui/Form";

export function PainterLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserSupabase();
  if (!supabase) return <Alert tone="warning">The painter portal isn&apos;t connected yet.</Alert>;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setLoading(true);
    const { error } = await supabase!.auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("password")) });
    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    router.replace("/painter");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />} Sign in
      </Button>
    </form>
  );
}
