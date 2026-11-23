import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/platform/permissions";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { Card, Notice, Pill, formatDate } from "@/components/platform/ui";
import { Field, Input } from "@/components/ui/Form";
import { approveGate } from "../../platform-actions";

/**
 * Approval gates: features that stay switched OFF until a named adviser has
 * approved them in writing. Only the owner can record an approval.
 */
export default async function ApprovalsPage() {
  const admin = await requireAdmin();
  const supabase = (await createSessionClient())!;
  const { data: gates, error } = await supabase.from("compliance_gates").select("*").order("key");
  const owner = can(admin.role, "gates.approve");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Legal and accounting approvals</h1>
        <p className="mt-1 max-w-3xl text-ink-600">
          These features stay locked until the right adviser has approved them in writing. Record who approved it and keep the email or letter. This app does not make
          anything legally compliant by itself.
        </p>
      </div>
      <Notice tone="warning">
        Never built (by design, in this release): automatic deductions or set-off from painter pay, automatic defect recovery, fines or strikes, and automatic CIS
        submissions to HMRC. CIS returns are filed from Sage by a person.
      </Notice>
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-900">Could not load approvals: {error.message}</p>}
      {(gates ?? []).map((g) => (
        <Card
          key={g.key as string}
          title={g.title as string}
          actions={g.approved ? <Pill tone="strong">Approved</Pill> : <Pill tone="warning">Locked – awaiting approval</Pill>}
        >
          <p className="text-ink-800">{g.description as string}</p>
          <p className="mt-2 text-sm text-ink-600">Who must approve: {g.required_adviser as string}</p>
          {g.approved && (
            <p className="mt-2 text-sm">
              Approved by <strong>{g.approved_by_name as string}</strong> on {formatDate(g.approved_at as string, true)} – {g.evidence_note as string}
            </p>
          )}
          {owner && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">{g.approved ? "Withdraw approval" : "Record approval"}</summary>
              <div className="mt-3">
                <ActionForm action={approveGate.bind(null, g.key as string)} submitLabel={g.approved ? "Withdraw approval" : "Record approval"} variant={g.approved ? "danger" : "primary"}>
                  {g.approved ? (
                    <>
                      <input type="hidden" name="revoke" value="yes" />
                      <Field label="Reason" htmlFor={`ev-${g.key}`}><Input id={`ev-${g.key}`} name="evidence" /></Field>
                    </>
                  ) : (
                    <>
                      <Field label="Approved by (name and firm)" htmlFor={`by-${g.key}`}><Input id={`by-${g.key}`} name="approvedBy" /></Field>
                      <Field label="Evidence" htmlFor={`ev-${g.key}`} hint="e.g. 'Letter from Smith & Co Solicitors dated 3 Dec 2026, ref TT/001'">
                        <Input id={`ev-${g.key}`} name="evidence" />
                      </Field>
                      <label className="flex gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" /> I have this approval in writing and have kept a copy.</label>
                    </>
                  )}
                </ActionForm>
              </div>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}
