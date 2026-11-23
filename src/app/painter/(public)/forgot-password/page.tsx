import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/platform/ActionForm";
import { Field, Input } from "@/components/ui/Form";
import { requestPasswordReset } from "../../actions";
import { PublicShell } from "../PublicShell";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <PublicShell title="Reset your password" footer={<Link href="/painter/login" className="underline">Back to sign in</Link>}>
      <ActionForm action={requestPasswordReset} submitLabel="Email me a reset link">
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
      </ActionForm>
    </PublicShell>
  );
}
