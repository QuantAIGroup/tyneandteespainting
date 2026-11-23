import type { Metadata } from "next";
import { ActionForm } from "@/components/platform/ActionForm";
import { Field, Input } from "@/components/ui/Form";
import { setPassword } from "../../actions";
import { PublicShell } from "../PublicShell";

export const metadata: Metadata = { title: "Choose a password" };

export default function SetPasswordPage() {
  return (
    <PublicShell title="Choose a password" intro="At least 10 characters. A short phrase is easy to remember and hard to guess.">
      <ActionForm action={setPassword} submitLabel="Save password">
        <Field label="New password" htmlFor="password" required>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <Field label="Repeat password" htmlFor="confirm" required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
      </ActionForm>
    </PublicShell>
  );
}
