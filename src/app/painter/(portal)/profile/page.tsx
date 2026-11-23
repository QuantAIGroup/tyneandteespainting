import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { requirePainter } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/platform/ActionForm";
import { FileUpload } from "@/components/platform/FileUpload";
import { Card, EmptyState, Notice, Pill, formatDate } from "@/components/platform/ui";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { registerEvidence, saveBusinessDetails, savePrivateDetails } from "../../actions";

export const metadata: Metadata = { title: "My business" };

const EVIDENCE_KINDS = [
  ["public_liability_insurance", "Public liability insurance"],
  ["employers_liability_insurance", "Employers' liability insurance"],
  ["other_insurance", "Other insurance"],
  ["qualification", "Qualification / certificate"],
  ["experience_reference", "Reference"],
  ["portfolio", "Examples of work"],
  ["health_and_safety", "Health & safety document"],
  ["other", "Other"],
] as const;

export default async function ProfilePage() {
  const painter = await requirePainter();
  const supabase = (await createSessionClient())!;
  const [{ data: b }, { data: evidence }, { data: cis }] = await Promise.all([
    supabase.from("painter_businesses").select("*").eq("id", painter.painterBusinessId).single(),
    supabase.from("painter_evidence").select("id, kind, title, verification_status, expires_on, verification_note").eq("painter_business_id", painter.painterBusinessId).order("created_at", { ascending: false }),
    supabase.from("cis_verifications").select("deduction_status, rate_percent, verified_on").eq("painter_business_id", painter.painterBusinessId).eq("is_current", true).maybeSingle(),
  ]);
  const biz = (b ?? {}) as Record<string, string | boolean | null>;
  const v = (k: string) => (biz[k] as string | null) ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl">My business</h1>

      <Card title="Business details">
        <ActionForm action={saveBusinessDetails} submitLabel="Save details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" htmlFor="legalName" required>
              <Input id="legalName" name="legalName" defaultValue={v("legal_name")} required />
            </Field>
            <Field label="Trading name" htmlFor="tradingName">
              <Input id="tradingName" name="tradingName" defaultValue={v("trading_name")} />
            </Field>
            <Field label="Business type" htmlFor="businessStructure">
              <Select id="businessStructure" name="businessStructure" defaultValue={v("business_structure") || "sole_trader"}>
                <option value="sole_trader">Sole trader</option>
                <option value="partnership">Partnership</option>
                <option value="limited_company">Limited company</option>
                <option value="llp">LLP</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Company number (if any)" htmlFor="companyNumber">
              <Input id="companyNumber" name="companyNumber" defaultValue={v("company_number")} />
            </Field>
            <Field label="Address line 1" htmlFor="addressLine1">
              <Input id="addressLine1" name="addressLine1" autoComplete="address-line1" defaultValue={v("address_line1")} />
            </Field>
            <Field label="Address line 2" htmlFor="addressLine2">
              <Input id="addressLine2" name="addressLine2" autoComplete="address-line2" defaultValue={v("address_line2")} />
            </Field>
            <Field label="Town" htmlFor="town">
              <Input id="town" name="town" autoComplete="address-level2" defaultValue={v("town")} />
            </Field>
            <Field label="Postcode" htmlFor="postcode">
              <Input id="postcode" name="postcode" autoComplete="postal-code" defaultValue={v("postcode")} />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" defaultValue={v("phone")} />
            </Field>
            <Field label="Invoice / contact email" htmlFor="invoiceEmail">
              <Input id="invoiceEmail" name="invoiceEmail" type="email" defaultValue={v("invoice_email")} />
            </Field>
            <Field label="VAT registered?" htmlFor="vatRegistered">
              <Select id="vatRegistered" name="vatRegistered" defaultValue={biz.vat_registered ? "yes" : "no"}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </Field>
            <Field label="VAT number" htmlFor="vatNumber">
              <Input id="vatNumber" name="vatNumber" defaultValue={v("vat_number")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Your team and substitutes" htmlFor="substitutionArrangements" hint="Do you have staff, partners or other painters who may do jobs for you? You can send a suitable substitute to an accepted job – tell us how you usually organise this.">
                <Textarea id="substitutionArrangements" name="substitutionArrangements" defaultValue={v("substitution_arrangements")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Experience and qualifications" htmlFor="competenceSummary">
                <Textarea id="competenceSummary" name="competenceSummary" defaultValue={v("competence_summary")} />
              </Field>
            </div>
            <Field label="Website or social profile" htmlFor="website">
              <Input id="website" name="website" defaultValue={v("website_or_profile")} />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Lock className="size-4" aria-hidden /> Tax (CIS) and bank details</span>}>
        <Notice>
          These are encrypted before they&apos;re saved and only our finance administrator can see them. For your security, they are never shown back on this page. To change them, just enter the new details.
        </Notice>
        {cis && (
          <p className="mt-3 text-sm">
            CIS status from HMRC: <strong>{cis.rate_percent as number}% deduction</strong> (verified {formatDate(cis.verified_on as string)})
          </p>
        )}
        <div className="mt-4">
          <ActionForm action={savePrivateDetails} submitLabel="Save securely">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your UTR (10 digits)" htmlFor="utr" hint="Sole traders/partners: your personal UTR.">
                <Input id="utr" name="utr" inputMode="numeric" autoComplete="off" />
              </Field>
              <Field label="Company UTR (limited companies)" htmlFor="companyUtr">
                <Input id="companyUtr" name="companyUtr" inputMode="numeric" autoComplete="off" />
              </Field>
              <Field label="National Insurance number (sole traders only)" htmlFor="nino" hint="Only needed so HMRC can verify you for CIS.">
                <Input id="nino" name="nino" autoComplete="off" />
              </Field>
              <div />
              <Field label="Bank account name" htmlFor="accountName">
                <Input id="accountName" name="accountName" autoComplete="off" />
              </Field>
              <Field label="Sort code" htmlFor="sortCode">
                <Input id="sortCode" name="sortCode" inputMode="numeric" autoComplete="off" placeholder="12-34-56" />
              </Field>
              <Field label="Account number" htmlFor="accountNumber">
                <Input id="accountNumber" name="accountNumber" inputMode="numeric" autoComplete="off" />
              </Field>
            </div>
          </ActionForm>
        </div>
      </Card>

      <Card title="Insurance and evidence">
        {(evidence ?? []).length === 0 ? (
          <EmptyState>No documents yet.</EmptyState>
        ) : (
          <ul className="mb-6 divide-y divide-ink-900/10">
            {(evidence ?? []).map((e) => (
              <li key={e.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="block font-medium">{e.title as string}</span>
                  {e.expires_on && <span className="text-sm text-ink-600">Expires {formatDate(e.expires_on as string)}</span>}
                  {e.verification_note && <span className="block text-sm text-ink-600">{e.verification_note as string}</span>}
                </span>
                <Pill tone={e.verification_status === "verified" ? "strong" : e.verification_status === "rejected" ? "danger" : "neutral"}>
                  {String(e.verification_status).replace(/_/g, " ")}
                </Pill>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-3 font-bold">Add a document</h3>
        <ActionForm action={registerEvidence} submitLabel="Add document">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="kind" required>
              <Select id="kind" name="kind" defaultValue="public_liability_insurance">
                {EVIDENCE_KINDS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="title">
              <Input id="title" name="title" placeholder="e.g. Hiscox PL certificate 2026" />
            </Field>
            <Field label="Insurer (insurance only)" htmlFor="insurer">
              <Input id="insurer" name="insurer" />
            </Field>
            <Field label="Policy number" htmlFor="policyNumber">
              <Input id="policyNumber" name="policyNumber" />
            </Field>
            <Field label="Cover limit (£)" htmlFor="coverLimit">
              <Input id="coverLimit" name="coverLimit" inputMode="numeric" placeholder="2000000" />
            </Field>
            <Field label="Expiry date" htmlFor="expiresOn" hint="Required for insurance.">
              <Input id="expiresOn" name="expiresOn" type="date" />
            </Field>
            <div className="sm:col-span-2">
              <FileUpload name="path" purpose="evidence" label="Choose PDF or photo" required />
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
