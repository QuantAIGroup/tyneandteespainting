import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { formatPence } from "@/lib/pricing/engine";
import type { QuoteResult } from "@/lib/pricing/types";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { Card, Notice } from "@/components/platform/ui";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { createJobFromEnquiry } from "../../../platform-actions";

export default async function NewJobPage({ searchParams }: PageProps<"/admin/jobs/new">) {
  await requireAdmin("jobs.manage");
  const { enquiry: enquiryParam } = await searchParams;
  const enquiryId = typeof enquiryParam === "string" && isUuid(enquiryParam) ? enquiryParam : null;
  const supabase = (await createSessionClient())!;
  const { data: e } = enquiryId
    ? await supabase.from("enquiries").select("id, reference, full_name, phone, postcode, comments, breakdown, agreed_service, agreed_price_pence, preferred_start_date").eq("id", enquiryId).maybeSingle()
    : { data: null };
  const { data: existing } = enquiryId ? await supabase.from("jobs").select("id, reference").eq("enquiry_id", enquiryId) : { data: null };

  const breakdown = (e?.breakdown ?? null) as QuoteResult | null;
  const scope = breakdown?.lines?.length
    ? breakdown.lines.map((l) => `• ${l.label} – ${l.kind} (${l.quantity} ${l.unit})`).join("\n")
    : ((e?.agreed_service as string | null) ?? "");

  return (
    <div className="space-y-6">
      <Link href={enquiryId ? `/admin/enquiries/${enquiryId}` : "/admin/jobs"} className="text-sm text-ink-700 hover:text-ink-950">
        ← Back
      </Link>
      <h1 className="text-3xl">New painter job</h1>
      {e && (
        <Notice>
          From website enquiry <strong className="font-mono">{e.reference as string}</strong>
          {e.agreed_price_pence ? ` · agreed customer price ${formatPence(e.agreed_price_pence as number, { alwaysShowPence: true })}` : " · no customer price agreed yet"}. The customer keeps
          paying Tyne &amp; Tees Painting through the website; nothing changes for them.
        </Notice>
      )}
      {(existing ?? []).length > 0 && (
        <Notice tone="warning">
          This enquiry already has job(s):{" "}
          {(existing ?? []).map((j) => (
            <Link key={j.id as string} href={`/admin/jobs/${j.id}`} className="font-mono underline">
              {j.reference as string}
            </Link>
          ))}
          . Only create another if the work is genuinely split into separate jobs.
        </Notice>
      )}
      <Card>
        <ActionForm action={createJobFromEnquiry} submitLabel="Create job">
          <input type="hidden" name="enquiryId" value={enquiryId ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Job title (shown to painters)" htmlFor="title" required>
                <Input id="title" name="title" required defaultValue={(e?.agreed_service as string | null) ?? ""} placeholder="e.g. Bedroom walls and ceiling" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Scope summary" htmlFor="scope" required hint="Painters see this in offers. Don't include the customer's name or full address here.">
                <Textarea id="scope" name="scope" required defaultValue={scope} className="min-h-40" />
              </Field>
            </div>
          </div>
          <h2 className="pt-2 text-lg font-bold">Site and customer contact</h2>
          <p className="text-sm text-ink-600">Only shown to the painter AFTER the job is agreed. Offers show just the town and postcode district (e.g. NE3).</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" htmlFor="customerName">
              <Input id="customerName" name="customerName" defaultValue={(e?.full_name as string | null) ?? ""} />
            </Field>
            <Field label="Customer phone" htmlFor="customerPhone">
              <Input id="customerPhone" name="customerPhone" defaultValue={(e?.phone as string | null) ?? ""} />
            </Field>
            <Field label="Address line 1" htmlFor="addressLine1">
              <Input id="addressLine1" name="addressLine1" />
            </Field>
            <Field label="Address line 2" htmlFor="addressLine2">
              <Input id="addressLine2" name="addressLine2" />
            </Field>
            <Field label="Town" htmlFor="town">
              <Input id="town" name="town" defaultValue="Newcastle upon Tyne" />
            </Field>
            <Field label="Postcode" htmlFor="postcode">
              <Input id="postcode" name="postcode" defaultValue={(e?.postcode as string | null) ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Access notes" htmlFor="accessNotes">
                <Textarea id="accessNotes" name="accessNotes" defaultValue={(e?.comments as string | null) ?? ""} />
              </Field>
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
