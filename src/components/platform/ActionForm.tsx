"use client";

import { useActionState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type FormState = { ok: boolean; message: string } | null;

/**
 * A form that runs a server action and shows the result message.
 * Every check happens again on the server – the browser can't skip rules.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  variant = "primary",
  confirm,
  className = "space-y-4",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger";
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} size="sm" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {submitLabel}
        </Button>
        {state && (
          <p role="status" className={`text-sm font-medium ${state.ok ? "text-brand-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
