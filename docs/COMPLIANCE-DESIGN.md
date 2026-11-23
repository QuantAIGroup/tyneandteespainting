# How the app is designed around the legal pack

_This explains what the software does and doesn't do. It is not legal advice and it does not make the business model lawful on its own – the way you actually work with painters matters more than any screen or contract._

## Independent painter model (Model A)

| Requirement (Master Legal Pack v3.0) | How the app does it |
| --- | --- |
| No minimum jobs, hours or earnings | No availability calendar, shifts, targets or earnings guarantees exist anywhere. |
| Painter can decline without penalty | "Decline" is always available on an open offer. No acceptance-rate, strike, warning or rating field exists in the database. The reason box is optional. |
| Painter can counteroffer fee, dates and terms | Painter can propose a new version of every Schedule B field. |
| Binding only when both accept the same record | Each proposal is a permanent version. A database trigger agrees the job only when the company AND painter have accepted the same version. Silence is never acceptance. |
| No unilateral changes after acceptance | Offer versions can't be edited or deleted (database trigger). Changes after agreement are variations needing both acceptances. |
| Painter controls method | Offers describe the result, scope, safety and customer commitments only. The arrival window is labelled as customer access, not a shift. |
| Genuine substitution | Painters describe their team/substitutes; emergency reports let them propose a substitute. Refusing a substitute requires one of five objective reasons plus a written explanation (database rule). |
| Can work for others | Stated at registration; no exclusivity anywhere. |
| Not "Employer/Employee" | Labels used are Company and Painter / independent business. |
| A label doesn't decide status | "Engagement route" can be set to *status review required* or *worker/employee*: this **blocks payments** and all deduction logic until advice is taken. |

### Features deliberately NOT built (could undermine independent status)
Acceptance-rate tracking · penalties/fines/strikes · compulsory availability or minimum hours · exclusivity · rating-triggered suspension · fixed no-show charges · automatic deductions · continuous location tracking · forced personal attendance · company-imposed working methods · staff-style uniforms. (Listed in `src/lib/platform/offers.ts` → `INDEPENDENCE_RISK_FEATURES` so future changes can be checked against it.)

### Things in the app that you should keep an eye on
- **Protective access restrictions** are allowed only for safety, suspected fraud, data security, insurance lapse or property risk, need a written reason (20+ characters) and a review date. Using them often, or for other reasons, would look like discipline.
- **Customer feedback** is stored for quality only. It doesn't change offers or access automatically. Painters can respond, and moderation needs a recorded reason.
- **Onboarding approval** requires verified public liability insurance. Keep other checks objective and job-related.

## Money

| Rule | Enforced by |
| --- | --- |
| Customer refunds never become painter deductions | Separate `customer_remedies` table with no link to painter pay; `undisputedPainterAmount()` has no refund input (tested). |
| No commercial set-off in this release | The painter payment table has **no column** for commercial deductions. `net = gross + VAT − CIS` is a database constraint. |
| Recovery claims need breach, causation, itemised loss | Database constraint (itemised list required) + app check before notifying the painter. A quote never creates a debt. |
| Undisputed sums paid when due | A complaint doesn't block an invoice or payment anywhere in the workflow. |
| CIS rate only from HMRC | Rate can only be stored with a verification reference; status↔rate must match (0/20/30); payment rate must match the painter's verification (trigger). |
| CIS on labour only | Database constraint: `cis = floor(labour × rate / 100)`. Rounding **to be confirmed by your accountant**. |
| CIS ≠ company money | Separate ledger (`cis_ledger_entries`, permanent), single "CIS Tax Reserve" account movements, HMRC payments need a reference. |
| Paid needs proof | Bank reference, transfer date, recording admin and confirming admin all required; paid amounts frozen; status can't go backwards. |

## Approval gates (Admin → Approvals)

Locked until the named adviser approves in writing (approver name + evidence recorded, audit-logged):

| Gate | Adviser | What it unlocks |
| --- | --- | --- |
| Independent painter operating model | Employment-status solicitor | (Record only – nothing should go live without it) |
| CIS contractor set-up | Accountant / CIS adviser | Approving any painter payment |
| Painter payment terms | Construction solicitor | (Record only) |
| Construction Act notices | Construction solicitor | Recording Payment Notices / Pay Less Notices |
| Commercial deductions and set-off | Commercial solicitor | Nothing – no set-off feature exists |
| Insurance | Insurance broker | (Record only) |
| Privacy, DPIA, retention | Data protection adviser | (Record only) |

Legal documents have their own approval: a version can only be accepted by painters once it is "Approved for publication" with the approver's name, date and effective date recorded – and never while `[INSERT` placeholders remain.

## Privacy and security

- Painters see only their own business's rows (Postgres Row Level Security, tested).
- Customer name, phone and full address are hidden from painters until the job is mutually agreed, and then only for that job. Offers show town + postcode district.
- UTR, NI number, sort code and account number are encrypted with AES-256-GCM before storage; only the finance role can see masked values; painters can't read them back. Changing bank details clears the "confirmed by call-back" flag and emails you.
- Emergency reports: categories + short explanation; the form asks painters **not** to include medical details; evidence optional; visible only to the painter and operations/owner.
- All files go to private storage buckets via one-time upload links into the painter's own folder.
- Audit log is append-only (even the server key can't change or delete it); every sensitive table change is also logged automatically. Bank/tax changes are logged without the values.
- No location tracking.
- Retention periods are recorded in `retention_rules` and need adviser confirmation; automatic deletion is not switched on.
