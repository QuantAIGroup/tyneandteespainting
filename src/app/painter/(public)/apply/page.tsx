import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/platform/ActionForm";
import { Field, Input, Select } from "@/components/ui/Form";
import { applyAsPainter } from "../../actions";
import { PublicShell } from "../PublicShell";

export const metadata: Metadata = { title: "Register your painting business" };

export default function ApplyPage() {
  return (
    <PublicShell
      title="Register your painting business"
      intro={
        <>
          <p>We work with independent painting and decorating businesses on a job-by-job basis.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You choose which jobs to take – declining is always fine.</li>
            <li>You can negotiate the fee and dates before agreeing.</li>
            <li>You can keep working for your own customers and others.</li>
            <li>There are no minimum jobs, hours or earnings.</li>
          </ul>
        </>
      }
      footer={<>Already registered? <Link href="/painter/login" className="underline">Sign in</Link></>}
    >
      <ActionForm action={applyAsPainter} submitLabel="Register">
        <Field label="Your name" htmlFor="fullName" required>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </Field>
        <Field label="Email" htmlFor="email" required hint="We'll send a link to set your password.">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Phone" htmlFor="phone" required>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
        </Field>
        <Field label="Business legal name" htmlFor="legalName" required hint="Your own name if you're a sole trader, or your company's registered name.">
          <Input id="legalName" name="legalName" required />
        </Field>
        <Field label="Trading name (if different)" htmlFor="tradingName">
          <Input id="tradingName" name="tradingName" />
        </Field>
        <Field label="Business type" htmlFor="businessStructure" required>
          <Select id="businessStructure" name="businessStructure" defaultValue="sole_trader">
            <option value="sole_trader">Sole trader</option>
            <option value="partnership">Partnership</option>
            <option value="limited_company">Limited company</option>
            <option value="llp">LLP</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        {/* spam trap – hidden from people */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <label className="flex gap-2 text-sm">
          <input type="checkbox" name="independent" value="yes" required className="mt-1" />
          <span>I run my own painting/decorating business and am responsible for my own tax, insurance, tools and business costs.</span>
        </label>
        <p className="text-xs text-ink-600">
          We use your details to assess your application and, if approved, to offer you work. See the Painter Privacy Notice in the portal.
        </p>
      </ActionForm>
    </PublicShell>
  );
}
