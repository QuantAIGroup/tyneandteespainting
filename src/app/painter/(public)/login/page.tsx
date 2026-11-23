import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "../PublicShell";
import { PainterLoginForm } from "./PainterLoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function PainterLoginPage() {
  return (
    <PublicShell
      title="Painter sign in"
      intro="For independent painting businesses working with Tyne & Tees Painting."
      footer={
        <>
          <Link href="/painter/forgot-password" className="underline">Forgotten password?</Link> ·{" "}
          <Link href="/painter/apply" className="underline">Register your business</Link>
        </>
      }
    >
      <PainterLoginForm />
    </PublicShell>
  );
}
