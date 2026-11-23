-- =====================================================================
-- LEGAL DOCUMENT REGISTER – initial entries (generated from the supplied
-- PDF "Tyne_Tees_PDF.pdf", 33 pages, 23 Nov 2026, by docs/legal/gen_seed.py)
--
-- Every version is a DRAFT or AWAITING REVIEW. Nothing here is approved.
-- Documents that are not in the supplied pack are registered with no text
-- ("NOT DRAFTED") rather than invented.
-- Run AFTER the painter platform migrations. Safe to run twice.
-- =====================================================================

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('painter-business-services-agreement', 'Independent Painter Business Services Agreement', 'Agreement', 'painter', true, 0)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$1. What Model A means in practice
The Painter is a separate business offering services job by job. The Company does not promise work, hours or earnings. The Painter does not have to accept an offer, stay available or accept future offers. The Painter may negotiate the fee and job terms, work for other clients and, where the right is genuine and workable, arrange a suitably qualified and insured substitute or team to perform the accepted job. The Painter controls the method and organisation of the work, subject to the agreed result, safety and law.

Reality matters more than the label. A contract or app setting cannot turn a worker into a self-employed business. If in practice painters must personally do the work, have prices imposed, are closely managed like staff, cannot genuinely substitute, or are subject to staff-style discipline or penalties, obtain employment-status advice and use the correct model. Do not use this pack to avoid statutory rights.

2. Complete these details before signing
Company's full legal entity name and legal form: [INSERT]
Trading name: Tyne & Tees Painting
Registered/trading address: [INSERT]
Company number (if applicable): [INSERT]
Customer contact email/phone: [INSERT]
Painter-contract contact: [INSERT]
Privacy contact: [INSERT]
VAT status: [ACCOUNTANT TO CONFIRM]
Insurance limits and policy details: [BROKER TO CONFIRM]
Payment timetable and notice dates: [CONSTRUCTION SOLICITOR TO COMPLETE]
Framework termination notice: [INSERT]

3. Painter Independent Business Services Agreement
Parties: [FULL LEGAL ENTITY NAME] trading as Tyne & Tees Painting (Company) and [PAINTER'S LEGAL NAME / BUSINESS
NAME], of [ADDRESS], trading as [BUSINESS NAME] (Painter). Start date: [DATE].

3.1 Nature of relationship
The parties intend this framework agreement to govern separate business-to-business subcontracts for individual jobs. This wording records the intended arrangement but does not determine legal status. The actual relationship and how it operates will determine whether the Painter is self-employed, a worker or an employee. Nothing excludes any statutory right that applies.

3.2 No obligation to offer or accept work
The Company is not obliged to offer any minimum number or value of jobs. The Painter is not obliged to accept any offer, remain available, work particular hours or accept future work. Each job is a separate offer. Declining an unaccepted offer, including repeated offers, does not by itself constitute breach, misconduct or grounds for a fee penalty, strike or reduced rating.

3.3 Job offer, counteroffer and acceptance
Each offer must identify the customer/job reference, site address, scope and surfaces, preparation and finish requirements, exclusions, proposed dates or access window, expected duration if known, materials responsibility, known site conditions, safety information, proposed subcontract fee and payment terms. The Painter may accept, decline or submit a counteroffer changing the fee, dates, scope or other terms. The Company may accept, reject or counter that proposal. No subcontract for that job exists until both

parties affirmatively accept the same final job record in the app or in another durable written form. The accepted job record forms part of this agreement.

3.4 Independent business operation
The Painter is responsible for operating its own business, tax and accounting, ordinary business costs, tools, equipment, transport, and any registrations required by law. The Painter may advertise and provide services to other customers, including competitors, and is not exclusive to the Company. The Painter may decide which opportunities to pursue and is responsible for its business profit or loss. The Painter must not represent that it is an employee or has authority to bind the Company.

3.5 Method and control
The Company may define the contracted result, scope, quality specification, customer commitments, site access arrangements, safety requirements and legal standards. Subject to those requirements, the Painter controls the method, sequence, staffing and organisation used to deliver the job. The Company does not set general working hours or require availability outside a job the Painter has accepted.
Any site timing agreed for customer access is a job-specific commitment, not a general shift pattern.

3.6 Substitution and personnel
The Painter may arrange for a suitably competent substitute or its own personnel to perform all or part of an accepted job, at the
Painter's cost and responsibility. This right must be genuine and capable of being used in practice. The Company may require reasonable, objective checks relevant to the job, including identity, right to work where legally required, competence, insurance, health and safety and customer/site security. Approval must not be unreasonably withheld or used to require personal service. The Painter remains responsible for the contracted result and for paying its own personnel. Nothing in this clause removes any rights those personnel may have against the Painter or another engager.

3.7 Fee and commercial risk
The fee is the amount negotiated and accepted in the final job record. No fee may be changed unilaterally after acceptance. A
variation must be agreed in writing by both parties. The Painter is responsible for its agreed operating costs and may make a profit or loss. The Painter is not paid merely for being registered on the platform, declining an offer, or not carrying out work.

3.8 Invoicing and payment
The Painter will provide an invoice or other payment request appropriate to its legal and tax status and the agreed payment arrangement. The job record must state the payment due date, final date for payment where required, invoice requirements and any applicable CIS treatment. The Company will provide a payment statement showing gross fee, any statutory CIS deduction, any agreed variation and net payment. Undisputed amounts will be paid when due. A customer complaint does not automatically cancel or reduce the Painter's fee.

3.9 Attendance, illness and emergencies
Once the Painter accepts a job, it must take reasonable steps to attend and complete it as agreed. If illness, accident, emergency, transport failure or another event makes attendance or completion impossible or materially delayed, the Painter must notify the
Company as soon as reasonably practicable, preferably before the agreed arrival time, and provide an updated estimate where possible. The Painter may propose a substitute where suitable and permitted under clause 3.6. The Company may request reasonable information needed to verify the operational impact, but must not routinely demand detailed medical records or unnecessary sensitive health information. Evidence should be proportionate to the circumstances and handled confidentially. A genuine emergency is not an automatic breach or penalty event. The parties will consider rescheduling, substitution or cancellation of that individual job.

3.10 Non-attendance or abandonment after acceptance
If the Painter does not attend, leaves the job without agreement or fails to complete a material part of the accepted scope without reasonable explanation, the Company will first seek an explanation and assess the circumstances. The Painter is not entitled to a fee for work not performed, except for any amount expressly due under the accepted job record or applicable law. The Company may seek recovery of actual, proven and legally recoverable loss caused by a material breach, subject to causation, mitigation, evidence and the dispute procedure. No fixed no-show fine, automatic strike or arbitrary forfeiture applies. A genuine emergency, safety concern, customer access failure or other reasonable cause must be considered.

3.11 Standard of service
The Painter will carry out the accepted scope with reasonable care and skill, comply with applicable law and product instructions, protect customer property and promptly report any condition that may affect quality, timing, cost or safety. Work outside the accepted scope requires an agreed variation, except where immediate action is reasonably necessary to prevent danger or damage.

3.12 Complaints and rectification
Where a customer reports a possible defect or incomplete work, the Company will give the Painter the particulars and relevant available evidence as soon as reasonably practicable. The Painter will normally have five working days to respond, unless urgency or circumstances justify a shorter reasonable period. Where appropriate, the Painter will be offered a reasonable opportunity to inspect and rectify at its own cost within an agreed reasonable period. This opportunity may be bypassed where urgent safety action, risk of further property damage, abandonment, refusal to engage, failure to respond after reasonable notice or customer/legal obligations

make that reasonable. The Company remains responsible for its own customer-facing obligations. A customer refund or price reduction does not automatically establish an equivalent debt owed by the Painter.

3.13 Recovery claims and set-off
No automatic deduction, fixed defect charge, strike-related fine, forfeiture or automatic set-off applies. The Company may bring a separate claim for loss caused by a proven material breach, but only to the extent the loss is legally recoverable, evidenced, caused by the breach and reasonably mitigated. Before seeking settlement or set-off, the Company will provide the alleged breach, evidence, causal explanation, itemised calculation, invoices/quotes where available, mitigation steps and contractual/legal basis, and allow a reasonable response. A quote alone does not prove liability or the amount. Undisputed sums will be paid when due. Any set-off must have a clear legal and contractual basis and comply with applicable construction payment law. No clause authorises an unlawful deduction from wages if the Painter is legally a worker or employee.

3.14 Insurance, safety and competence
Before accepting a job, the Painter must maintain the insurance specified in Schedule A and any legally required cover, and provide current evidence on request. The Painter must notify the Company of any lapse, cancellation or material restriction. The Painter is responsible for ensuring that it and any substitute/personnel have the competence, equipment and protective measures needed for the accepted work. The Company must separately confirm its own insurance covers its role and subcontracted work.

3.15 Customer property, data and confidentiality
The Painter must take reasonable care of the customer's property, protect floors and belongings as agreed, report damage promptly, treat occupants respectfully and use customer information only for the accepted job and lawful administration. The Painter must keep information secure, limit access to people who need it, report suspected loss or breach promptly and delete/return information when no longer needed, subject to lawful recordkeeping. A separate data-processing agreement is required if the Painter processes personal data solely on the Company's documented instructions.

3.16 Platform access and protective restrictions
The Company may temporarily restrict access only where reasonably necessary to address a documented material risk involving safety, suspected fraud, data security, insurance lapse or property. A restriction is a protective platform measure, not an employee disciplinary sanction. The Company will record the reason, scope and start time, provide the substance of the concern and relevant evidence as soon as reasonably practicable, invite a response and review the restriction promptly. A low rating or complaint alone is not sufficient proof of breach.

3.17 Termination
Either party may terminate this framework agreement on [NOTICE PERIOD] written notice. Either party may terminate an accepted individual job for material breach, subject to a reasonable opportunity to remedy where appropriate and any customer/safety obligations. On termination, the Company will pay undisputed fees properly due for work performed and deal with any separate proven claim under clause 3.13. Termination does not create a right to withhold unrelated undisputed job fees.

3.18 Disputes and appeal
The parties will first exchange written details and supporting evidence and attempt to resolve the issue in good faith. The Painter may request an internal review within ten calendar days of a reasoned decision. Where practicable, a different reviewer will consider the appeal. Nothing prevents either party from obtaining legal advice, using adjudication where available, or bringing proceedings before a court or tribunal with jurisdiction.

3.19 Governing law
This agreement is governed by the law of England and Wales, subject to mandatory statutory rights and the jurisdiction of any court or tribunal with authority.

Schedule A — Painter and job particulars
Painter legal name/business name: [INSERT]
Business address and invoice email: [INSERT]
Business structure / company number (if any): [INSERT]
UTR / CIS details where required: [COLLECT SECURELY]
Insurance type, insurer, policy number, expiry and limit: [INSERT]
Relevant skills/qualifications: [INSERT]
Subcontractor fee and payment timetable: stated in each accepted job record
Materials responsibility: stated in each accepted job record
Substitute/personnel checks: objective job-related criteria disclosed to Painter$doc$, 'Master Legal Pack v3.0 sections 1–3 and Schedule A. Replaces the earlier agreements (v2.0 Document 3 and Contract + App Change Pack v3.0). The v3.1 Legal Corrections Addendum (replacement complaint/recovery clauses) and the Liability Limitation Addendum (clauses 20–22, blank cap) have NOT been merged – see docs/legal/RECONCILIATION.md.', 'awaiting_solicitor_review', '971dec29818255df5a9e0c2ba75e0321cee715a6238011a94302a6353a0b9aa1' from public.legal_documents where slug = 'painter-business-services-agreement'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('job-acceptance-record', 'Individual Job Subcontract / Job Acceptance Record', 'Agreement', 'painter', false, 1)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$SCHEDULE B — JOB RECORD MINIMUM CONTENT
Job ID; customer/site address; scope and exclusions; specification version; materials responsibility; agreed fee; proposed and confirmed date; arrival window; expected duration (if used); access and hazards; customer-specific instructions; painter acceptance; Company acceptance; timestamp; variation history; completion evidence; invoice and payment status.$doc$, 'Contract + App Change Pack v3.0 Schedule B (minimum job record content) and Master Legal Pack v3.0 clause 3.3. The app generates one immutable record per agreed job from these fields.', 'awaiting_solicitor_review', '40b5784cfbf151215e8bab8e276ac426d73299a71bd90a2fc505921c87dd5542' from public.legal_documents where slug = 'job-acceptance-record'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('painter-privacy-notice', 'Painter Privacy Notice', 'Privacy', 'painter', false, 2)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 12 — PAINTER PRIVACY NOTICE
Controller and contact
[FULL LEGAL ENTITY NAME] trading as Tyne & Tees Painting, [ADDRESS], [EMAIL] is the controller for the Painter information described here.

Information collected
Identity/contact/business details, insurance and qualification evidence, profile and work photographs, account/device data, accepted job records, attendance/job-status data, customer feedback, incident/appeal records, payment references, communications and audit logs.

Purposes
Onboarding and verification, job contracting, payment administration, customer service, safety, insurance checks, fraud/security prevention, complaint investigation, legal claims and compliance.

Monitoring
Explain precisely what the app records, when, whether location is collected, whether tracking is continuous or job-only, who sees it and how long it is kept. Do not activate continuous background location tracking by default. Complete a
DPIA where required.

Lawful bases and recipients
Document a lawful basis per purpose. Identify actual hosting, database, notification, payment and verification providers, authorised administrators, insurers and advisers.

Retention and rights
Publish specific retention periods and a contact for data rights requests. Delete ID and insurance records when no longer necessary, subject to documented legal/claims requirements.$doc$, 'Revised Legal & Compliance Draft Pack v2.0 Document 12. Must also meet Master Legal Pack v3.0 section 10 (name actual processors: Supabase, Vercel, Stripe, Resend, Sage). Contains placeholders.', 'awaiting_solicitor_review', '515689690091396be94614ffeba1789d58aef09a8d69abc73250e54d9bba2f42' from public.legal_documents where slug = 'painter-privacy-notice'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('painter-data-protection-confidentiality', 'Painter Data Protection and Confidentiality Terms', 'Privacy', 'painter', false, 3)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Master Legal Pack v3.0 clause 3.15 covers confidentiality in the agreement and says a separate data-processing agreement is needed if the Painter processes data only on the Company''s instructions. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'painter-data-protection-confidentiality'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('insurance-requirements', 'Insurance Requirements', 'Insurance', 'painter', false, 4)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Schedule A says ''Insurance type, insurer, policy number, expiry and limit: [INSERT]'' and Document 20 asks the broker to set requirements. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'insurance-requirements'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('health-safety-customer-property', 'Health, Safety and Customer Property Requirements', 'Safety', 'painter', false, 5)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 13 — HEALTH, SAFETY & CUSTOMER PROPERTY
POLICY
Planning
Consider access, working at height, ladders, ventilation, dust, manual handling, electrical hazards, occupants, children, pets, fragile items, damp and suspected asbestos.

Stop-work
Do not start or continue where there is imminent serious risk, unsafe access, suspected asbestos disturbance, unsafe electrical conditions or work outside competence. Make the area safe and contact the customer and Company.

Products and equipment
Follow product labels and safety data sheets, assess hazardous substances where required, use suitable maintained equipment and PPE, and dispose of materials safely.

Property protection
Agree what must be moved or protected. Use dust sheets and masking as appropriate, keep exits clear, secure tools and report damage immediately.

Incident reporting

Report injuries, near misses, spills, damage, unsafe conditions and suspected exposure promptly. Preserve relevant evidence.

Legal duties
This policy does not transfer or remove duties imposed by law. Each party remains responsible for duties applicable to it.$doc$, 'Revised Legal & Compliance Draft Pack v2.0 Document 13 (covers health and safety, site safety and customer property).', 'awaiting_solicitor_review', '23911894d6799fc8a22828e0a8f31b4c7e663bdb29f52cae2672348fa2fe8d1c' from public.legal_documents where slug = 'health-safety-customer-property'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('substitution-team-requirements', 'Substitution and Team Requirements', 'Operations', 'painter', false, 6)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'The substitution right itself is Master Legal Pack v3.0 clause 3.6 (in the agreement). The objective checks for substitutes are not yet written down. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'substitution-team-requirements'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('emergency-attendance-procedure', 'Emergency and Attendance Procedure', 'Operations', 'painter', false, 7)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$5. Painter emergency and non-attendance procedure
The Painter should notify the Company as soon as reasonably practicable if unable to attend or continue an accepted job. The app should offer reason categories such as sudden illness, accident, family emergency, vehicle/transport failure, unsafe site, customer access failure and other. The Painter may add a short explanation and propose a new time or substitute. Request only proportionate evidence where needed to decide a disputed claim; do not routinely collect diagnosis details, full medical records or unrelated sensitive information. A genuine emergency should be assessed fairly. If no work was performed, no ordinary job fee is due for unperformed work, subject to the accepted job terms and law. Any claim for actual loss must follow clause 3.13.$doc$, 'Master Legal Pack v3.0 section 5 (with clause 3.9–3.10 of the agreement).', 'awaiting_solicitor_review', '9c6417ab9174f3dddb0d6b068e438da403cc52106e07e70d9d8cc60a8388d114' from public.legal_documents where slug = 'emergency-attendance-procedure'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('quality-standards', 'Painter Professional and Quality Standards', 'Quality', 'painter', false, 8)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 8 — PAINTER PROFESSIONAL STANDARDS
These are outcome, safety, privacy and customer-protection standards. They are not a staff disciplinary handbook.

Professional conduct
Treat customers and occupants respectfully. Do not discriminate, harass, threaten or behave abusively. Do not smoke or consume alcohol or illegal drugs at a customer's property.

Work quality and honesty
Follow the accepted specification, protect property, use products safely, report issues promptly and do not conceal defects or falsely mark work complete.

Customer property
Take reasonable care of floors, furniture and belongings, keep exits clear, secure tools and report accidental damage immediately.

Customer information

Use customer details only for the accepted job and lawful administration. Do not retain or disclose unnecessary information or publish property photographs without a lawful basis.

Safety
Use suitable equipment and PPE, follow product instructions and stop work where there is a serious risk or the work is outside competence.

App integrity
Do not share credentials, falsify photographs, signatures, job records or attendance, or access another person's information.

Reviews and complaints
Do not pressure customers to provide positive ratings or withdraw complaints. Cooperate reasonably with evidence-led investigations.

Consequences
A concern is assessed under the incident and access-review procedure. A low rating or customer complaint alone is not proof of breach and does not create an automatic strike.$doc$, 'Revised Legal & Compliance Draft Pack v2.0 Document 8. Check against Master v3.0 – no conflict found, but it pre-dates v3.0.', 'awaiting_solicitor_review', 'efbe32e5a060b21af91f7820661d94774d0ae3ccf91976ad8055e7cbec72ecd3' from public.legal_documents where slug = 'quality-standards'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('complaint-rectification-procedure', 'Complaint and Rectification Procedure', 'Quality', 'painter', false, 9)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$4. Workmanship, defects and rectification procedure
1. Open a case against a specific accepted job and specification version. Record the customer's description, date, photographs and remedy requested.
2. Separate workmanship issues from excluded work, customer changes, pre-existing damage, damp/leaks, substrate or product failure, access problems and ordinary wear.
3. Give the Painter the relevant details and evidence. Allow a normal five-working-day response period unless urgency justifies a shorter reasonable time.
4. Where appropriate, offer inspection and a practical rectification opportunity with clear scope, access, deadline and evidence of completion.
5. If disputed or not rectified, obtain an independent assessment or itemised quote where proportionate. Consider alternative causes, causation, reasonable scope and mitigation.
6. The Company may arrange urgent alternative work where safety, further damage, abandonment, refusal or customer obligations reasonably require it. Record the reason and cost evidence.
7. Decide the customer's legal remedy separately from any recovery claim against the Painter. Never assume a customer refund equals the Painter's liability.
8. Pay undisputed Painter sums when due. Do not impose an automatic deduction, fine or indefinite hold.
9. Provide a reasoned written outcome and appeal route. Preserve the full evidence trail.$doc$, 'Master Legal Pack v3.0 section 4. The v3.1 addendum (clause 6) has more detailed wording – solicitor to choose which is final.', 'awaiting_solicitor_review', '7a5486a0060a93a7f20faede110a857ced5cb1ef0296ee3fb0a7332d0c2fb5d9' from public.legal_documents where slug = 'complaint-rectification-procedure'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('payment-dispute-recovery-procedure', 'Payment Dispute and Recovery Procedure', 'Payments', 'painter', false, 10)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 7 — PAINTER PAYMENT DISPUTE & RECOVERY
PROCEDURE
Do not use this procedure as a blanket authority to deduct money. The Painter Agreement and the painter's true legal status govern what can be recovered.

1. Separate customer remedy from painter recovery
The Company must decide and provide any customer remedy required by the customer contract and law. That decision does not automatically establish that the Painter owes the same amount. A customer refund may be made even while

the Company and Painter continue to dispute responsibility.

2. Open a case
A case may be opened where there is credible evidence of defective/incomplete work, damage, non-attendance or another material breach. Record the job, alleged breach, evidence and potential loss.

3. Notice and response
Give the Painter written particulars, the evidence relied upon, the contractual basis alleged, the amount claimed (if quantifiable) and a reasonable response deadline. Invite photographs, witness details, an inspection or other evidence.

4. Rectification opportunity
Where appropriate, offer a reasonable opportunity to inspect and rectify. Record the scope, access, deadline and customer impact. Do not insist on rectification where it is impossible, unsafe or inconsistent with the customer's statutory rights.

5. Calculate actual loss
Consider causation, responsibility, pre-existing conditions, agreed scope, customer changes, mitigation and reasonable cost. Obtain independent quotations where proportionate. Do not include penalties, speculative losses or double recovery.

6. Payment while disputed
Pay all undisputed amounts by the agreed due date. Do not withhold the whole fee merely because a complaint exists.
A genuinely disputed sum may be retained only where the contract and applicable law permit it.

7. Agreement or formal recovery
Prefer a written, job-specific settlement or repayment agreement that identifies the facts, amount, timing and effect. If there is no agreement, obtain legal advice before unilateral set-off or court recovery. If the Painter is a worker/employee, comply with statutory wage-deduction restrictions; a generic clause may not be sufficient.

8. Decision and appeal
Provide a reasoned written outcome and allow a review by someone not involved in the original decision where practicable. Record the evidence, response, calculation, legal basis, payments and appeal outcome.

9. No double recovery
The Company must not recover more than its properly established loss or contractual entitlement, and must not recover the same loss twice.$doc$, 'Revised Legal & Compliance Draft Pack v2.0 Document 7. Superseded in substance by Master v3.0 clause 3.13 and v3.1 addendum clause 8 – solicitor to confirm.', 'awaiting_solicitor_review', '2f1342e38f29e85a9850a895adae99f6b8c59ec471530bbfcb665f2d098066c7' from public.legal_documents where slug = 'payment-dispute-recovery-procedure'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('payment-invoicing-policy', 'Payment and Invoicing Policy', 'Payments', 'painter', false, 11)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Master v3.0 clause 3.8 and the agreement say payment is due within ''[X] days of [completion / valid invoice / milestone]'' – the timetable is blank and must be completed by a construction solicitor. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'payment-invoicing-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('cis-information', 'CIS Information and Deduction Statement Guidance', 'Tax', 'painter', false, 12)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$9. Construction Industry Scheme (CIS) — separate tax withholding
CIS is not a defect deduction. If the Company is a CIS contractor paying subcontractors for construction work, it may need to register as a CIS contractor before engaging its first subcontractor, verify each subcontractor with HMRC before payment where required, apply the HMRC-confirmed deduction rate, make monthly returns and provide payment/deduction statements. HMRC currently describes rates of 20% for registered subcontractors, 30% where unregistered/unverifiable and 0% for gross-payment status; the applicable rate must come from HMRC verification. CIS deductions are tax prepayments and must be separately itemised. An app must never confuse CIS deductions with a disputed repair-cost claim. Confirm whether the Company's activities and contracts fall

within CIS with an accountant/CIS specialist before the first subcontractor payment.$doc$, 'Master Legal Pack v3.0 section 9. Accountant/CIS adviser must confirm before use.', 'awaiting_accountant_review', '9fd05d25cb43d4eb63afd4e8f455307eaaa4f91e0e1c4c5518c7f2fe93973d3c' from public.legal_documents where slug = 'cis-information'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('incident-access-ratings-policy', 'Incident, Access Restriction and Ratings Policy', 'Operations', 'painter', false, 13)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$7. Incident, access and ratings policy
Do not use a three-strike system, automatic deactivation based on ratings, automatic loss of livelihood or rating-triggered fee penalties.
A concern must be assessed on evidence. Temporary access restriction is permitted only for a documented and proportionate safety, fraud, data-security, insurance or property risk. Give reasons and a chance to respond as soon as reasonably practicable, review promptly and lift restrictions when the reason ends. Ratings are feedback, not conclusive proof of breach. Permit a Painter to challenge false, abusive, discriminatory or misattributed feedback.$doc$, 'Master Legal Pack v3.0 section 7 (replaces v2.0 Documents 9 and 10 for painters).', 'awaiting_solicitor_review', '8ac7bb9f45cf43e4e212ec11fb99f793a8d7f40110bcced5be4ec9d41ff4a27d' from public.legal_documents where slug = 'incident-access-ratings-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('photo-evidence-rules', 'Photograph and Evidence Upload Rules', 'Operations', 'painter', false, 14)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Master v3.0 section 10 says: limit job photos to relevant work and avoid unnecessary images of people, personal documents or unrelated belongings. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'photo-evidence-rules'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('master-legal-pack', 'Master Legal Pack v3.0 – Independent Painter Subcontractors', 'Master', 'admin', false, 15)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$MASTER LEGAL PACK — INDEPENDENT
PAINTER SUBCONTRACTORS
Version 3.0 • 23 November 2026 • England & Wales

Draft for review by a UK solicitor and accountant before use. Not legal advice, not a legal-status certificate and not ready for signature until every placeholder is completed.
This pack adopts Model A: Tyne & Tees Painting contracts with the customer and separately engages genuinely independent painting businesses for individual jobs. It replaces the earlier painter agreement and consolidates the revised quality, emergency, complaint, payment and platform rules.

1. What Model A means in practice
The Painter is a separate business offering services job by job. The Company does not promise work, hours or earnings. The Painter does not have to accept an offer, stay available or accept future offers. The Painter may negotiate the fee and job terms, work for other clients and, where the right is genuine and workable, arrange a suitably qualified and insured substitute or team to perform the accepted job. The Painter controls the method and organisation of the work, subject to the agreed result, safety and law.

Reality matters more than the label. A contract or app setting cannot turn a worker into a self-employed business. If in practice painters must personally do the work, have prices imposed, are closely managed like staff, cannot genuinely substitute, or are subject to staff-style discipline or penalties, obtain employment-status advice and use the correct model. Do not use this pack to avoid statutory rights.

2. Complete these details before signing
Company's full legal entity name and legal form: [INSERT]
Trading name: Tyne & Tees Painting
Registered/trading address: [INSERT]
Company number (if applicable): [INSERT]
Customer contact email/phone: [INSERT]
Painter-contract contact: [INSERT]
Privacy contact: [INSERT]
VAT status: [ACCOUNTANT TO CONFIRM]
Insurance limits and policy details: [BROKER TO CONFIRM]
Payment timetable and notice dates: [CONSTRUCTION SOLICITOR TO COMPLETE]
Framework termination notice: [INSERT]

3. Painter Independent Business Services Agreement
Parties: [FULL LEGAL ENTITY NAME] trading as Tyne & Tees Painting (Company) and [PAINTER'S LEGAL NAME / BUSINESS
NAME], of [ADDRESS], trading as [BUSINESS NAME] (Painter). Start date: [DATE].

3.1 Nature of relationship
The parties intend this framework agreement to govern separate business-to-business subcontracts for individual jobs. This wording records the intended arrangement but does not determine legal status. The actual relationship and how it operates will determine whether the Painter is self-employed, a worker or an employee. Nothing excludes any statutory right that applies.

3.2 No obligation to offer or accept work
The Company is not obliged to offer any minimum number or value of jobs. The Painter is not obliged to accept any offer, remain available, work particular hours or accept future work. Each job is a separate offer. Declining an unaccepted offer, including repeated offers, does not by itself constitute breach, misconduct or grounds for a fee penalty, strike or reduced rating.

3.3 Job offer, counteroffer and acceptance
Each offer must identify the customer/job reference, site address, scope and surfaces, preparation and finish requirements, exclusions, proposed dates or access window, expected duration if known, materials responsibility, known site conditions, safety information, proposed subcontract fee and payment terms. The Painter may accept, decline or submit a counteroffer changing the fee, dates, scope or other terms. The Company may accept, reject or counter that proposal. No subcontract for that job exists until both

parties affirmatively accept the same final job record in the app or in another durable written form. The accepted job record forms part of this agreement.

3.4 Independent business operation
The Painter is responsible for operating its own business, tax and accounting, ordinary business costs, tools, equipment, transport, and any registrations required by law. The Painter may advertise and provide services to other customers, including competitors, and is not exclusive to the Company. The Painter may decide which opportunities to pursue and is responsible for its business profit or loss. The Painter must not represent that it is an employee or has authority to bind the Company.

3.5 Method and control
The Company may define the contracted result, scope, quality specification, customer commitments, site access arrangements, safety requirements and legal standards. Subject to those requirements, the Painter controls the method, sequence, staffing and organisation used to deliver the job. The Company does not set general working hours or require availability outside a job the Painter has accepted.
Any site timing agreed for customer access is a job-specific commitment, not a general shift pattern.

3.6 Substitution and personnel
The Painter may arrange for a suitably competent substitute or its own personnel to perform all or part of an accepted job, at the
Painter's cost and responsibility. This right must be genuine and capable of being used in practice. The Company may require reasonable, objective checks relevant to the job, including identity, right to work where legally required, competence, insurance, health and safety and customer/site security. Approval must not be unreasonably withheld or used to require personal service. The Painter remains responsible for the contracted result and for paying its own personnel. Nothing in this clause removes any rights those personnel may have against the Painter or another engager.

3.7 Fee and commercial risk
The fee is the amount negotiated and accepted in the final job record. No fee may be changed unilaterally after acceptance. A
variation must be agreed in writing by both parties. The Painter is responsible for its agreed operating costs and may make a profit or loss. The Painter is not paid merely for being registered on the platform, declining an offer, or not carrying out work.

3.8 Invoicing and payment
The Painter will provide an invoice or other payment request appropriate to its legal and tax status and the agreed payment arrangement. The job record must state the payment due date, final date for payment where required, invoice requirements and any applicable CIS treatment. The Company will provide a payment statement showing gross fee, any statutory CIS deduction, any agreed variation and net payment. Undisputed amounts will be paid when due. A customer complaint does not automatically cancel or reduce the Painter's fee.

3.9 Attendance, illness and emergencies
Once the Painter accepts a job, it must take reasonable steps to attend and complete it as agreed. If illness, accident, emergency, transport failure or another event makes attendance or completion impossible or materially delayed, the Painter must notify the
Company as soon as reasonably practicable, preferably before the agreed arrival time, and provide an updated estimate where possible. The Painter may propose a substitute where suitable and permitted under clause 3.6. The Company may request reasonable information needed to verify the operational impact, but must not routinely demand detailed medical records or unnecessary sensitive health information. Evidence should be proportionate to the circumstances and handled confidentially. A genuine emergency is not an automatic breach or penalty event. The parties will consider rescheduling, substitution or cancellation of that individual job.

3.10 Non-attendance or abandonment after acceptance
If the Painter does not attend, leaves the job without agreement or fails to complete a material part of the accepted scope without reasonable explanation, the Company will first seek an explanation and assess the circumstances. The Painter is not entitled to a fee for work not performed, except for any amount expressly due under the accepted job record or applicable law. The Company may seek recovery of actual, proven and legally recoverable loss caused by a material breach, subject to causation, mitigation, evidence and the dispute procedure. No fixed no-show fine, automatic strike or arbitrary forfeiture applies. A genuine emergency, safety concern, customer access failure or other reasonable cause must be considered.

3.11 Standard of service
The Painter will carry out the accepted scope with reasonable care and skill, comply with applicable law and product instructions, protect customer property and promptly report any condition that may affect quality, timing, cost or safety. Work outside the accepted scope requires an agreed variation, except where immediate action is reasonably necessary to prevent danger or damage.

3.12 Complaints and rectification
Where a customer reports a possible defect or incomplete work, the Company will give the Painter the particulars and relevant available evidence as soon as reasonably practicable. The Painter will normally have five working days to respond, unless urgency or circumstances justify a shorter reasonable period. Where appropriate, the Painter will be offered a reasonable opportunity to inspect and rectify at its own cost within an agreed reasonable period. This opportunity may be bypassed where urgent safety action, risk of further property damage, abandonment, refusal to engage, failure to respond after reasonable notice or customer/legal obligations

make that reasonable. The Company remains responsible for its own customer-facing obligations. A customer refund or price reduction does not automatically establish an equivalent debt owed by the Painter.

3.13 Recovery claims and set-off
No automatic deduction, fixed defect charge, strike-related fine, forfeiture or automatic set-off applies. The Company may bring a separate claim for loss caused by a proven material breach, but only to the extent the loss is legally recoverable, evidenced, caused by the breach and reasonably mitigated. Before seeking settlement or set-off, the Company will provide the alleged breach, evidence, causal explanation, itemised calculation, invoices/quotes where available, mitigation steps and contractual/legal basis, and allow a reasonable response. A quote alone does not prove liability or the amount. Undisputed sums will be paid when due. Any set-off must have a clear legal and contractual basis and comply with applicable construction payment law. No clause authorises an unlawful deduction from wages if the Painter is legally a worker or employee.

3.14 Insurance, safety and competence
Before accepting a job, the Painter must maintain the insurance specified in Schedule A and any legally required cover, and provide current evidence on request. The Painter must notify the Company of any lapse, cancellation or material restriction. The Painter is responsible for ensuring that it and any substitute/personnel have the competence, equipment and protective measures needed for the accepted work. The Company must separately confirm its own insurance covers its role and subcontracted work.

3.15 Customer property, data and confidentiality
The Painter must take reasonable care of the customer's property, protect floors and belongings as agreed, report damage promptly, treat occupants respectfully and use customer information only for the accepted job and lawful administration. The Painter must keep information secure, limit access to people who need it, report suspected loss or breach promptly and delete/return information when no longer needed, subject to lawful recordkeeping. A separate data-processing agreement is required if the Painter processes personal data solely on the Company's documented instructions.

3.16 Platform access and protective restrictions
The Company may temporarily restrict access only where reasonably necessary to address a documented material risk involving safety, suspected fraud, data security, insurance lapse or property. A restriction is a protective platform measure, not an employee disciplinary sanction. The Company will record the reason, scope and start time, provide the substance of the concern and relevant evidence as soon as reasonably practicable, invite a response and review the restriction promptly. A low rating or complaint alone is not sufficient proof of breach.

3.17 Termination
Either party may terminate this framework agreement on [NOTICE PERIOD] written notice. Either party may terminate an accepted individual job for material breach, subject to a reasonable opportunity to remedy where appropriate and any customer/safety obligations. On termination, the Company will pay undisputed fees properly due for work performed and deal with any separate proven claim under clause 3.13. Termination does not create a right to withhold unrelated undisputed job fees.

3.18 Disputes and appeal
The parties will first exchange written details and supporting evidence and attempt to resolve the issue in good faith. The Painter may request an internal review within ten calendar days of a reasoned decision. Where practicable, a different reviewer will consider the appeal. Nothing prevents either party from obtaining legal advice, using adjudication where available, or bringing proceedings before a court or tribunal with jurisdiction.

3.19 Governing law
This agreement is governed by the law of England and Wales, subject to mandatory statutory rights and the jurisdiction of any court or tribunal with authority.

Schedule A — Painter and job particulars
Painter legal name/business name: [INSERT]
Business address and invoice email: [INSERT]
Business structure / company number (if any): [INSERT]
UTR / CIS details where required: [COLLECT SECURELY]
Insurance type, insurer, policy number, expiry and limit: [INSERT]
Relevant skills/qualifications: [INSERT]
Subcontractor fee and payment timetable: stated in each accepted job record
Materials responsibility: stated in each accepted job record
Substitute/personnel checks: objective job-related criteria disclosed to Painter

4. Workmanship, defects and rectification procedure
1. Open a case against a specific accepted job and specification version. Record the customer's description, date, photographs and remedy requested.
2. Separate workmanship issues from excluded work, customer changes, pre-existing damage, damp/leaks, substrate or product failure, access problems and ordinary wear.
3. Give the Painter the relevant details and evidence. Allow a normal five-working-day response period unless urgency justifies a shorter reasonable time.
4. Where appropriate, offer inspection and a practical rectification opportunity with clear scope, access, deadline and evidence of completion.
5. If disputed or not rectified, obtain an independent assessment or itemised quote where proportionate. Consider alternative causes, causation, reasonable scope and mitigation.
6. The Company may arrange urgent alternative work where safety, further damage, abandonment, refusal or customer obligations reasonably require it. Record the reason and cost evidence.
7. Decide the customer's legal remedy separately from any recovery claim against the Painter. Never assume a customer refund equals the Painter's liability.
8. Pay undisputed Painter sums when due. Do not impose an automatic deduction, fine or indefinite hold.
9. Provide a reasoned written outcome and appeal route. Preserve the full evidence trail.

5. Painter emergency and non-attendance procedure
The Painter should notify the Company as soon as reasonably practicable if unable to attend or continue an accepted job. The app should offer reason categories such as sudden illness, accident, family emergency, vehicle/transport failure, unsafe site, customer access failure and other. The Painter may add a short explanation and propose a new time or substitute. Request only proportionate evidence where needed to decide a disputed claim; do not routinely collect diagnosis details, full medical records or unrelated sensitive information. A genuine emergency should be assessed fairly. If no work was performed, no ordinary job fee is due for unperformed work, subject to the accepted job terms and law. Any claim for actual loss must follow clause 3.13.

6. Customer completion record — app wording
“I confirm that the work identified in this job record has been presented for my inspection. This record captures my comments and any visible issues I choose to report today. My signature does not waive my statutory rights or prevent me reporting a defect that could not reasonably be identified at this inspection.”
Customer choices: (A) I am satisfied with the work as inspected today; (B) I acknowledge presentation/inspection but have listed outstanding concerns; (C) I do not wish to sign. Customer may add comments. Refusal to sign alone does not prove defective work.

7. Incident, access and ratings policy
Do not use a three-strike system, automatic deactivation based on ratings, automatic loss of livelihood or rating-triggered fee penalties.
A concern must be assessed on evidence. Temporary access restriction is permitted only for a documented and proportionate safety, fraud, data-security, insurance or property risk. Give reasons and a chance to respond as soon as reasonably practicable, review promptly and lift restrictions when the reason ends. Ratings are feedback, not conclusive proof of breach. Permit a Painter to challenge false, abusive, discriminatory or misattributed feedback.

8. Construction payment legislation — mandatory classification step
Painting and decorating may fall within the construction operations regime. The Housing Grants, Construction and Regeneration Act
1996 excludes a qualifying construction contract with a residential occupier from Part II, but that exclusion does not automatically extend to a separate subcontract between the Company and the Painter. A construction solicitor must confirm whether Part II applies to each subcontract and complete the payment mechanism, due dates, final date for payment, payment notice and Pay Less Notice periods. Do not assume the customer contract's residential-occupier status exempts the painter subcontract.

Where Part II applies, the contract must provide an adequate payment mechanism and final date for payment. Payment notices and any notice of intention to pay less must state the relevant sum and basis of calculation and be served within the applicable statutory/contractual timetable. The Scheme for Construction Contracts may supply default terms where the contract does not comply.
An internal app complaint does not extend a statutory notice deadline. The app must not mark an amount as lawfully withheld simply because a complaint is open.

9. Construction Industry Scheme (CIS) — separate tax withholding
CIS is not a defect deduction. If the Company is a CIS contractor paying subcontractors for construction work, it may need to register as a CIS contractor before engaging its first subcontractor, verify each subcontractor with HMRC before payment where required, apply the HMRC-confirmed deduction rate, make monthly returns and provide payment/deduction statements. HMRC currently describes rates of 20% for registered subcontractors, 30% where unregistered/unverifiable and 0% for gross-payment status; the applicable rate must come from HMRC verification. CIS deductions are tax prepayments and must be separately itemised. An app must never confuse CIS deductions with a disputed repair-cost claim. Confirm whether the Company's activities and contracts fall

within CIS with an accountant/CIS specialist before the first subcontractor payment.

10. Data protection and emergency evidence
Publish separate customer and Painter privacy notices naming the actual legal entity as controller and identifying actual processors/providers. State the data collected, purposes, lawful bases, recipients, retention periods, rights and ICO complaint route.
Limit job photos to relevant work and avoid unnecessary images of people, personal documents or unrelated belongings. Do not enable continuous background location tracking by default. If location is needed, use job-specific collection with clear notice.
Health/emergency evidence is sensitive personal data: collect the minimum necessary, establish an appropriate UK GDPR condition and lawful basis, restrict access, set a short justified retention period and do not collect diagnosis details unless genuinely necessary and legally justified. Complete a DPIA where required.

11. Website and customer document alignment
The existing Customer Terms, cancellation information and refund policy from the earlier Revised Legal & Compliance Draft Pack v2.0
remain separate from this Painter Agreement. Keep the Company identified as the customer's supplier. The Company remains responsible for customer-facing Consumer Rights Act 2015 remedies. For covered online/telephone/off-premises bookings, provide the required cancellation information and obtain a separate express early-start request where work is to begin within the cancellation period. Have the checkout flow and model cancellation form approved before publication.

12. Launch checklist — must complete
■ Confirm exact legal entity, address, company number, contact details and VAT position.
■ Employment solicitor reviews real working practices, substitution, fee negotiation, platform control and job allocation.
■ Construction solicitor confirms Construction Act application to painter subcontract and completes payment calendar/notices.
■ Accountant/CIS specialist confirms CIS contractor status, registration, verification, deductions, returns and statements.
■ Insurance broker confirms Company and Painter cover and limits.
■ Complete payment due dates, final dates and invoice rules in every job offer.
■ Publish customer and Painter privacy notices, retention schedule and cookie notice.
■ Test all app workflows and preserve accepted job records and audit logs.
■ Complete customer cancellation/early-start checkout review.
■ Do not launch automatic repair-cost deductions or set-off.

Official sources to be checked by your advisers
GOV.UK employment status checklist and guidance; Employment Rights Act 1996; Housing Grants, Construction and Regeneration
Act 1996 Part II, including sections 106, 110, 110A, 110B and 111; Scheme for Construction Contracts (England and Wales)
Regulations 1998; Construction Industry Scheme guidance; Consumer Rights Act 2015; Consumer Contracts (Information,
Cancellation and Additional Charges) Regulations 2013; UK GDPR and Data Protection Act 2018.
Important: This master pack is a structured draft, not a guarantee that Model A will be legally recognised. Have a UK employment solicitor review the actual relationship and a construction solicitor/accountant confirm the construction payment and CIS requirements before use.$doc$, 'Full text of Master Legal Pack v3.0 as supplied (23 Nov 2026). Upload the original PDF to the legal-documents bucket as well.', 'awaiting_solicitor_review', 'f9069c0307ba71a244cd90c37664fda99df4f2a348b274f2b45b81b7aa0c6600' from public.legal_documents where slug = 'master-legal-pack'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('developer-amendment-spec', 'Developer Amendment Specification v2.0', 'Specification', 'admin', false, 16)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0', $doc$TYNE & TEES PAINTING
DEVELOPER AMENDMENT SPECIFICATION
Version 2.0 • Payment disputes, rectification, statutory notices and status labels

Implement against the existing app only after legal review. Inspect current code and payment flow first. Do not alter unrelated functionality or migrate existing records destructively.

1. Remove misleading status language
For the independent subcontractor route, display Company / Principal and Painter / Subcontractor. Remove Employer / Employee labels from that route. Add an admin-configured engagement type, but do not allow an admin toggle to determine legal status by itself. If the business chooses to employ painters, that requires a separate employment workflow, payroll and statutory entitlement logic.

2. Complaint case workflow
Create a case from a customer complaint with job ID, accepted specification version, customer complaint, date/time, photographs, customer remedy requested, and suspected cause. Distinguish customer-facing remedy from the Company's separate claim against the Painter.

3. Painter response and rectification
Provide a private painter case view with evidence, response box, document/photo upload, inspection request and rectification proposal. Default response target: five working days. This is an internal target, not a waiver of legal rights. Permit the admin to set a shorter reasonable period with a recorded urgency reason. Support agreed rectification appointment, access confirmation, completion evidence and customer feedback.

4. Alternative contractor / emergency exception
Allow the Company to record why it arranged an alternative contractor without first offering rectification: urgent safety issue, risk of further property damage, abandonment, refusal, no response after reasonable notice, or other documented reason. Require a factual explanation and evidence. Never apply this exception automatically from a low rating.

5. Independent assessment and loss calculation
Allow attachment of independent inspection reports, itemised quotes, invoices and evidence of mitigation. Capture alleged breach, causal link, reasonable repair scope, pre-existing conditions, alternative causes, customer changes and any betterment. A quote alone must not automatically create a debt.

6. Payment and recovery separation
Keep separate ledgers for: (a) customer refund/price reduction; (b) painter invoice and amount undisputed; (c) proposed damages/recovery claim; (d) agreed settlement; and (e) any lawful set-off. Never automatically copy a customer refund into a painter deduction. Do not auto-deduct from painter balance. Pay undisputed sums when due.

7. Construction Act payment calendar — conditional module
Create a per-contract configuration field: 'Construction Act Part II applies: yes / no / solicitor review required'. Default new subcontract records to 'solicitor review required' until classified. If set to yes, require payment due date, final date for payment, payer, payee, notice recipient, payment notice deadline, Pay Less Notice deadline and method of service. The system must create reminders and immutable records of notices served.

Where applicable, payment notice data must include the sum considered due and the basis of calculation. A Pay Less Notice must state the sum considered due at the relevant date and the basis of calculation, and be served by the applicable contractual/statutory deadline. If no compliant contractual period is agreed, the Scheme default is not later than seven days before the final date for payment. The payment notice deadline is generally no later than five days after the payment due date. Do not hard-code these dates without validating the contract and statutory regime.

If no effective Pay Less Notice is served, do not mark a disputed amount as lawfully withheld merely because an internal complaint is open. Escalate to an authorised admin and solicitor. Preserve the statutory notified-sum position and any adjudication rights.

8. Employment / worker safeguard
If an engagement is classified or suspected as worker/employee, disable subcontractor-only deduction/set-off controls. Route payment to a wage-compliance review. Never allow the system to reduce legally payable wages below applicable minimum wage or bypass Employment Rights Act 1996 section 13. Keep hours, pay, deductions and consent/contract authority records where relevant. Do not assume a signed contractor label resolves status.

9. Audit, permissions and privacy
Use role-based permissions. Restrict customer and painter evidence to those who need it. Timestamp every notice, upload, decision and appeal. Preserve the exact accepted job specification. Provide exportable audit bundles. Set retention periods and deletion rules. Do not expose customer private information to other painters.

10. Acceptance tests
■ Customer refund does not automatically create a painter deduction.

■ Painter can view complaint evidence and submit a response.

■ Rectification opportunity can be offered and accepted with a booked appointment.

■ Urgent exception requires a reason and supporting record.

■ Independent quote does not automatically establish liability or amount.

■ Undisputed painter amount can be paid while a separate claim is disputed.

■ No automatic deduction, strike, fine or hidden rating penalty is created.

■ Construction Act module cannot be activated without payment dates and notice configuration.

■ Payment notice and Pay Less Notice are generated with required amount, basis and service timestamp.

■ Missed statutory notice deadline triggers escalation and cannot be silently backdated.

■ Worker/employee route blocks unauthorised wage deduction logic.

■ Every case decision and appeal is exportable with an audit trail.

11. Copy/paste instruction for the coding agent
Inspect the current Tyne & Tees Painting codebase and implement this specification without rebuilding unrelated features.

Before coding, identify the current job, painter, complaint, refund, payment, deduction, status-label and audit-log flows. Propose a safe migration plan.

Implement:
- Company / Principal and Painter / Subcontractor labels for the independent-business route; no Employer / Employee labels there.
- A structured complaint case with evidence and painter response.
- A rectification offer and appointment workflow.
- Documented urgent exceptions for replacement work.
- Independent inspection and itemised loss assessment.
- Separate customer remedies from painter recovery claims.
- Payment of undisputed sums when due.
- No automatic deductions, fixed defect fines or automatic forfeiture.
- A conditional Construction Act payment calendar with payment notice and Pay Less Notice deadlines, recipient, amount, calculation basis, service evidence and immutable timestamps.
- A worker/employee safeguard that disables unlawful wage deductions.
- Role-based access, audit history, export and retention controls.

Do not treat an internal dispute as extending a statutory payment deadline.
Do not mark a sum as lawfully withheld merely because a complaint is open.
Do not infer legal status from a UI label or checkbox.

Deliver schema migrations, server-side validation, test results, rollback instructions and screenshots of the admin and painter workflows. Flag all legal classification decisions for solicitor approval.

Developer launch gate: no live payment withholding/set-off feature until the construction solicitor has approved the exact payment calendar and notice wording for the actual subcontract. No employee/worker route until payroll and employment advice are in place.$doc$, 'Supplied PDF pages 1–2. NOTE: the ''Final App Developer Specification v3.0'' named in the build brief was NOT in the supplied PDF.', 'awaiting_company_approval', '7f9c31833dd9c67200d414a94e93ca266f76010333fee9ef294a64929293a775' from public.legal_documents where slug = 'developer-amendment-spec'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('legal-corrections-addendum', 'Legal Corrections & Contract Addendum v3.1', 'Agreement', 'admin', false, 17)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.1-draft', $doc$TYNE & TEES PAINTING
LEGAL CORRECTIONS & CONTRACT ADDENDUM
Version 3.1 • 23 November 2026 • England & Wales

Draft for specialist solicitor review. Not legal advice and not ready for signature.
This addendum responds to the Justee screenshots and is intended to amend the Painter Independent Business Services
Agreement v3.0. It does not make an employee self-employed or authorise deductions that employment or construction payment law prohibits.

A. Decisions required before this can be used
1. Choose the real engagement model. This draft assumes a genuine independent painting business engaged job by job. In the agreement and app, use 'Company' or 'Principal' and 'Painter' or 'Subcontractor' — not 'Employer' and 'Employee'. This is not a cosmetic fix: the Painter must genuinely be able to reject offers, negotiate, work for others, use a real substitute where appropriate and control how the work is organised. If the real arrangement is employment or worker engagement, use the correct employment/worker contract, payroll, holiday pay and other rights instead.

2. Confirm the contracting chain. This draft assumes Tyne & Tees Painting contracts with the homeowner as principal supplier and separately subcontracts the work. The Company remains responsible to the customer for its own consumer-law obligations. A
painter's liability to the Company is a separate question.

3. Do not use automatic deductions. The Company may pursue a properly evidenced contractual damages claim, but it must not automatically deduct a customer refund, repair quote, low rating or alleged loss from painter earnings. If the Painter is a worker/employee, Employment Rights Act 1996 section 13 can apply to deductions from wages. A contractual term does not override mandatory protections.

4. Construction Act classification. Painting/decorating may be a construction operation. The residential-occupier exception in section 106 applies to the construction contract with the qualifying residential occupier; it does not automatically exempt the
Company's separate subcontract with the Painter. A solicitor must classify each contract and payment arrangement.

B. Replacement contract clauses — insert into Agreement v3.0
Replace clauses 6 and 8 of Agreement v3.0 with the following. Renumber consequential cross-references and have the full contract checked for consistency.

6. QUALITY, COMPLAINTS AND RECTIFICATION
6.1 Standard of work. The Painter must carry out the accepted job with reasonable care and skill, in accordance with the accepted job specification, relevant product instructions and applicable law. The Painter must promptly notify the Company of any condition or instruction that may materially affect the result, price, timing or safety.

6.2 Customer complaint. The Company will record the complaint, identify the job and alleged defect, and provide the Painter with the material particulars and available evidence as soon as reasonably practicable. The Company will distinguish alleged defects from matters outside the accepted scope, customer changes, pre-existing conditions, wear and tear, product failure or other possible causes.

6.3 Painter response. Unless urgency or the circumstances reasonably require a shorter period, the Painter will be given five working days from receipt of the complaint details to respond, request relevant information, and propose an inspection or rectification plan. This is an internal response target only and does not limit any customer's statutory rights or any legal deadline.

6.4 Opportunity to inspect and rectify. Where the Painter appears responsible for a defect, the Company will normally offer a reasonable opportunity to inspect and, where appropriate, rectify it at the Painter's own cost within a reasonable period agreed in writing. The opportunity must be practical having regard to the defect, access, customer availability, safety and the urgency of the work. The Company must not require the Painter to carry out work outside the accepted scope without agreeing the terms.

6.5 When the Company may arrange other work. The Company may arrange an alternative contractor without first allowing rectification where reasonably necessary because of an urgent safety issue, risk of further property damage, customer protection, abandonment, refusal to engage, failure to respond within a reasonable period, or where a further visit would be unreasonable or disproportionate. The Company will record the reason and take reasonable steps to mitigate cost.

6.6 Independent assessment. If responsibility, scope or the proposed remedy is disputed, the Company may obtain an independent inspection, report or itemised quotation from a suitably competent person. The Painter will be given a reasonable

opportunity to comment on the material relied upon, unless urgent action makes prior consultation impracticable. The Company will consider alternative causes and whether the proposed remedial work is reasonably necessary.

6.7 Customer remedies are separate. The Company remains responsible for any remedy legally due to the customer under the customer contract and applicable consumer law. A customer refund, price reduction or goodwill payment does not automatically establish that the Painter owes the same amount. Any recovery from the Painter must be established separately under clause 8.

6.8 No waiver. Customer inspection, sign-off, payment or a rating does not waive statutory rights or prevent a later complaint about a hidden or subsequently discovered defect.

8. PAYMENT DISPUTES, RECOVERY AND SET-OFF
8.1 No automatic penalty or deduction. The Company will not impose an automatic fine, fixed defect charge, automatic forfeiture of earned fees, or automatic deduction because of a customer complaint, refund, low rating, alleged defect or replacement contractor invoice.

8.2 Separate claim. The Company may bring a claim against the Painter for loss caused by a proven breach of the accepted job subcontract, but only to the extent the loss is legally recoverable, sufficiently evidenced, caused by the breach, reasonably foreseeable where required, and reasonably mitigated. The Company must not recover twice for the same loss.

8.3 Evidence and calculation. Before seeking payment or proposing a contractual set-off, the Company will give the Painter a written case summary identifying: (a) the job and accepted specification; (b) the alleged breach; (c) the evidence relied on; (d) the causal link to the claimed loss; (e) the calculation and supporting invoices/quotes; (f) mitigation steps; and (g) the proposed contractual/legal basis. A quote is evidence of a possible cost, not conclusive proof that the amount is payable.

8.4 Response and review. The Painter will normally have five working days to respond to a proposed recovery, unless a different reasonable period is justified. The Company will consider the response and issue a reasoned written decision. The Painter may request an internal appeal within ten calendar days. Where practicable, a different reviewer will consider the appeal.

8.5 Undisputed sums. The Company will pay undisputed sums when due. A complaint or separate damages claim does not by itself justify an indefinite hold of all amounts otherwise payable.

8.6 Set-off only where lawful. A sum may be set off only where there is a clear contractual and legal basis and the required notice and procedure have been followed. Nothing authorises a deduction from wages contrary to the Employment Rights Act 1996 or other mandatory law. If the Painter's status is uncertain, the Company must not make a unilateral deduction and must obtain legal advice.

8.7 Construction payment legislation. Where the accepted subcontract is a construction contract to which Part II of the Housing
Grants, Construction and Regeneration Act 1996 applies, the statutory payment regime takes priority over any inconsistent internal complaint process. The Company must issue any required payment notice within the applicable period, identifying the sum considered due and the basis of calculation. If the Company intends to pay less than the notified sum, it must serve an effective notice of intention to pay less than the notified sum (commonly called a Pay Less Notice) by the contractual/statutory deadline, stating the sum considered due at the relevant date and the basis of calculation. A dispute investigation or app status does not extend those deadlines.

8.8 Statutory timing fallback. If the parties have not agreed a compliant Pay Less Notice period under the Act, the Scheme for
Construction Contracts (England and Wales) provides a default of not later than seven days before the final date for payment. The payment notice regime generally requires a notice no later than five days after the payment due date. The precise dates, payer/payee roles, payment cycles and notice recipients must be completed by a construction solicitor; do not use this clause as a substitute for a compliant payment schedule.

8.9 No contracting out. Nothing in this agreement excludes adjudication rights or any other statutory right that applies to the subcontract, or any non-excludable employment or consumer protection.

C. Correct the labels and statements in the Justee memo
Replace the Parties table as follows:

Company: [Full legal entity name] — role: Principal / contracting company.
Painter: [Painter's legal business name] — role: Independent subcontracting business (only if that status reflects reality).

Delete 'Employer' and 'Employee' from the independent-subcontractor document. Do not use 'employee' as a synonym for painter.
If the company actually controls personal service, hours, work allocation and working methods to an extent consistent with worker/employee status, stop using the subcontractor version and obtain employment advice.

D. What to do with the 200% warning
The 200% figure in the Employment Rights Act 2025 relates to a statutory civil penalty in specified underpayment enforcement cases, including minimum-wage underpayment. It is not a universal multiplier for every unlawful deduction. The practical safeguard is to correctly classify the Painter, calculate and pay all sums legally due, keep accurate records, and never use a deduction mechanism to reduce a worker's pay below the applicable legal minimum. Do not describe the 200% penalty as a guaranteed

consequence of every wage dispute.

E. Required app changes
The app must: (1) remove Employer/Employee labels for genuine subcontractors; (2) show a complaint evidence pack to the
Painter; (3) provide a response and appeal facility; (4) create rectification appointments and deadlines; (5) allow an independent inspection/quote attachment; (6) calculate claimed loss with itemised evidence; (7) keep customer refunds separate from painter recovery; (8) pay undisputed sums when due; (9) prohibit automatic deductions; (10) implement a payment calendar with payment notices and Pay Less Notice deadlines where the Act applies; and (11) retain a full timestamped audit trail.

F. Launch checklist
■ Confirm the real legal status of each painter model with an employment solicitor.
■ Confirm whether each painter subcontract is covered by the Construction Act.
■ Complete payment due dates, final dates and notice periods in the contract and app.
■ Confirm company and painter insurance and responsibility for remedial work.
■ Complete all legal entity, address, email, VAT and insurance placeholders.
■ Test notice generation, service, timestamps and evidence export.
■ Review customer terms separately so the homeowner's Consumer Rights Act rights are preserved.

G. Primary legislation and official guidance
Employment Rights Act 1996, section 13 — unauthorised deductions from wages. Housing Grants, Construction and Regeneration
Act 1996, sections 106, 110, 110A, 110B and 111 — residential occupier exclusion, payment notices and notices of intention to pay less. Scheme for Construction Contracts (England and Wales) Regulations 1998, Schedule Part II paragraphs 9 and 10 — payment notice and default Pay Less Notice timing. Employment Rights Act 2025, section 107 — civil penalties for specified underpayment cases.
Final warning: This addendum is a drafting proposal, not a certification of legality. The construction payment clauses are deliberately conditional because the legal classification depends on the actual contract chain and work. Have a UK construction solicitor and employment solicitor approve the final contract before it is issued.$doc$, 'Replacement clauses 6 and 8 for the painter agreement. Not merged into the agreement – solicitor to decide.', 'awaiting_solicitor_review', '6a23f544089139335fa653ae097b0eb3775744a9f8937c3aeb275c52685b7c6a' from public.legal_documents where slug = 'legal-corrections-addendum'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('liability-limitation-addendum', 'Liability Limitation Addendum (clauses 20–22)', 'Agreement', 'admin', false, 18)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$TYNE & TEES PAINTING — LIABILITY LIMITATION ADDENDUM
Supplement to Revised Legal & Compliance Draft Pack v2.0
This addendum is intended to be inserted into Document 3 (Painter Independent Business Services Agreement)
and checked by a solicitor. It does not create a cap until the blanks and cap structure are completed and agreed.

20. Liability and allocation of responsibility
Each party is responsible for loss to the extent caused by its own breach of this agreement, negligence or other legally actionable act or omission. The Painter is not responsible for a customer refund merely because the
Company has paid it. The Company must establish the Painter's breach, causation and recoverable loss under
Document 7. Neither party may recover twice for the same loss. The Company remains responsible to the customer under the customer contract and applicable consumer law.

21. Limitation of the Painter's liability
Subject to the exclusions below, the Painter's total aggregate liability to the Company arising out of or in connection with a particular accepted job shall not exceed the greater of (a) the fee payable to the Painter for that job multiplied by [INSERT MULTIPLIER], and (b) the insurance proceeds actually recoverable under the Painter's relevant policy for that claim, subject to an overall aggregate cap of £[INSERT AMOUNT]. The cap, multiplier and insurance interaction must be set after broker and solicitor advice and must be commercially reasonable for the likely risk.

The cap does not apply to liability to the extent it arises from fraud or fraudulent misrepresentation, deliberate wrongdoing, death or personal injury caused by negligence, or any liability that cannot lawfully be limited. The parties must obtain specific advice on whether confidentiality, data protection, intellectual property, unpaid fees, property damage and insurance-related liabilities should have separate caps or exclusions. No term in this agreement limits the Company's liability to a consumer where that limitation would be unlawful or unfair.

22. Governing law and jurisdiction
This agreement and any non-contractual obligations arising from it are governed by the law of England and Wales.
The courts of England and Wales have jurisdiction, subject to any mandatory statutory rights and the jurisdiction of any court or tribunal that has authority over a claim.

Critical completion note

Do not leave the cap blank or assume that an insurance policy automatically covers contractual liability. A solicitor and insurance broker must set the cap, exclusions, insurance requirements and claims procedure together. The customer-facing terms must separately preserve all non-excludable consumer rights. This addendum is not a blanket limitation of the Company's liability.$doc$, 'Written for v2.0 Document 3. Cap amount and multiplier are blank. Not in Master v3.0 – solicitor and broker to decide whether to include.', 'awaiting_solicitor_review', '12f93056e7c5989d3e4987f43715238934cb2b07ad8d2d7e22238d65d88967bb' from public.legal_documents where slug = 'liability-limitation-addendum'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('app-operating-rules', 'App Operating Rules Required for the Contract to Match Reality', 'Compliance', 'admin', false, 19)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 19 — APP OPERATING RULES REQUIRED FOR
THE CONTRACT TO MATCH REALITY
These are not just drafting suggestions. If the app behaves differently, the independent-business wording may not reflect the real relationship.

Job offers
Show the complete scope, date, location, fee and materials responsibility. Allow accept, decline and counter-fee. Do not penalise a Painter for declining an offer.

Substitution
Build a genuine route for a Painter business to nominate a competent and insured substitute/team member. Use objective verification criteria and do not require the named individual to personally attend every job.

No employee-style strike system
Remove three-strike counters, automatic warnings, rating-based penalties and automatic permanent bans. Use documented incident review and proportionate access restrictions only.

No unilateral wage deduction
Do not automatically reduce a painter's payment because of a customer refund, low rating or complaint. Keep customer refunds and painter recovery as separate case workflows.

Payment transparency
Show the accepted job fee, invoice/payment date, gross amount, any agreed adjustment, disputed amount and written reason. Pay undisputed sums when due.

Choice and independence
Do not impose exclusivity, minimum hours, fixed availability, compulsory future jobs or ongoing supervision of working methods. The Painter must be able to serve other customers.

Records
Store job-specific acceptances, counteroffers, substitution notices, evidence, complaint responses, payment statements and appeal decisions with timestamps and document versions.$doc$, 'Revised Pack v2.0 Document 19. The app is built to follow these rules – see docs/COMPLIANCE-DESIGN.md.', 'awaiting_solicitor_review', '4cfad598b6f7cc21318fcb731d3eaa6c600483b699cf343c1b165e1ca274373c' from public.legal_documents where slug = 'app-operating-rules'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('construction-act-classification', 'Construction Act Classification and Payment Notice Procedure', 'Payments', 'admin', false, 20)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$8. Construction payment legislation — mandatory classification step
Painting and decorating may fall within the construction operations regime. The Housing Grants, Construction and Regeneration Act
1996 excludes a qualifying construction contract with a residential occupier from Part II, but that exclusion does not automatically extend to a separate subcontract between the Company and the Painter. A construction solicitor must confirm whether Part II applies to each subcontract and complete the payment mechanism, due dates, final date for payment, payment notice and Pay Less Notice periods. Do not assume the customer contract's residential-occupier status exempts the painter subcontract.

Where Part II applies, the contract must provide an adequate payment mechanism and final date for payment. Payment notices and any notice of intention to pay less must state the relevant sum and basis of calculation and be served within the applicable statutory/contractual timetable. The Scheme for Construction Contracts may supply default terms where the contract does not comply.
An internal app complaint does not extend a statutory notice deadline. The app must not mark an amount as lawfully withheld simply because a complaint is open.$doc$, 'Master Legal Pack v3.0 section 8. Payment calendar and notice wording must be completed by a construction solicitor.', 'awaiting_solicitor_review', 'd50af2fe87517f3056bcb80d3630b0cc2021b8c7ea2ae11f309e4589cb5e0273' from public.legal_documents where slug = 'construction-act-classification'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('data-retention-security', 'Data Protection, Retention and Security Schedule', 'Privacy', 'admin', false, 21)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 17 — DATA RETENTION & SECURITY SCHEDULE
These are categories to assess, not fixed universal retention periods. The controller must approve and document actual periods.

Customer quotes, bookings and contracts
Set a period with the accountant/solicitor considering limitation, tax, insurance and dispute needs.

Invoices and accounting
Follow applicable HMRC and Companies House recordkeeping requirements.

Painter identity and address documents
Keep only while necessary for verification, insurance or legal purposes; restrict access and delete when no longer needed.

Insurance certificates
Keep current evidence and relevant historic evidence for justified coverage/claims periods.

Attendance and app activity
Keep only as long as necessary for job administration, disputes and compliance. Do not collect continuous location data without a documented need and assessment.

Job photographs and signatures
Set a documented quality/claims period; minimise unrelated personal imagery.

Incidents and appeals
Set proportionate periods and review stale records. Preserve only where needed for legal claims or justified compliance.

Security controls
Use private storage, least-privilege roles, row-level access controls, MFA for administrators where available, encryption in transit, server-side secrets, audit logging, processor agreements, backups and a breach response plan.$doc$, 'Revised Pack v2.0 Document 17. The app''s retention_rules table mirrors this and needs adviser confirmation.', 'awaiting_solicitor_review', '8e03a0c2859f771d700812a0dde914696c8228f48a73ffddd2690bf4433d3308' from public.legal_documents where slug = 'data-retention-security'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('publication-checklist', 'App & Website Publication Checklist', 'Compliance', 'admin', false, 22)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 18 — APP & WEBSITE PUBLICATION CHECKLIST
Website — customer-facing
Publish Customer Terms, Customer Privacy Notice, Cookie Notice and Cancellation Information at stable URLs. Link them before checkout. Show full job specification, labour/materials split, total price, VAT treatment, deposit and balance dates. Include a separate early-start request where relevant. Send order confirmation and a copy of the accepted terms.

Painter app — authenticated area
Display the Painter Agreement and require affirmative e-signature before job offers are accepted. Provide the
Professional Standards, Rectification Policy, Incident/Access Review Policy, Painter Privacy Notice, Health & Safety
Policy and Payment Dispute Procedure. Provide access to each Painter's own job records, invoices, payment statements, reviews and open disputes.

Admin-only area

Store master versions, signed agreements, verification status, insurance evidence, complaints, incident records, decision records, access logs, retention controls and data breach records.

Never public
Do not publish passports, driving licences, proof of address, bank details, Stripe secret keys, private customer addresses, signatures, unredacted complaints, legal advice or insurer correspondence.$doc$, 'Revised Pack v2.0 Document 18.', 'awaiting_company_approval', '34598bead0801244a630069e8f808e2f0feede5478327e86337077e7ea7d3b56' from public.legal_documents where slug = 'publication-checklist'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('adviser-review-checklist', 'Solicitor & Insurance Broker Review Checklist (incl. employment status review)', 'Compliance', 'admin', false, 23)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 20 — SOLICITOR & INSURANCE BROKER
REVIEW CHECKLIST
Employment solicitor
Assess each real painter relationship. Review personal service, substitution in practice, control, fee-setting, ability to reject work, financial risk, equipment, integration, ratings, monitoring and any restrictions. Confirm whether self-employed, worker or employee treatment is correct. Do not rely on this contract label.

Commercial/consumer solicitor
Confirm whether the Company is principal supplier to the customer; approve customer terms, cancellation checkout, deposit arrangements, Consumer Rights Act remedies, complaints and liability wording.

Payment and recovery
Confirm whether the proposed painter recovery clause is enforceable for the actual status and payment arrangement.
Review Employment Rights Act 1996 section 13 where worker/employee status may apply. Confirm how disputed sums and agreed settlements should be handled.

Insurance broker
Confirm in writing that the Company's policy covers painting work carried out by subcontractors and the Company's contractual liability. Confirm appropriate public liability, employers' liability where required, tools/materials, accidental damage, work at height and completed-operations cover. Set proportionate painter insurance requirements.

Tax/accountant
Check VAT status, invoicing, CIS applicability and accounting/payment flows for the actual contracting structure.

Privacy adviser
Map all data flows and processors; confirm UK GDPR lawful bases, cookie consent, retention periods, data sharing, international transfers, security, rights handling and whether a DPIA is required.

LEGAL SOURCES — PRIMARY / OFFICIAL
Employment status guidance: GOV.UK explains that status follows the real relationship, not the label in the contract. It identifies control, personal service, substitution, integration, ratings and penalties as relevant factors. Employment status and employment rights guidance.

Employment Rights Act 1996, section 13: restrictions on unauthorised deductions from wages where the individual is a worker. Section 13.

Consumer Rights Act 2015, sections 54–57: remedies for services that do not conform, including repeat performance and price reduction, and restrictions on excluding liability. Consumer Rights Act — services.

Consumer Contracts Regulations 2013: cancellation information and rights for covered distance/off-premises contracts.
Consumer Contracts Regulations 2013.

GOV.UK checklist for engagers: Employment status checklist.

Important: The sources above support the legal principles but do not certify that this particular business model or any clause is enforceable. A solicitor must review the final completed pack against the actual app and operations.

FINAL LAUNCH GATE
Do not publish or ask anyone to sign this pack until: (1) all placeholders are completed; (2) a solicitor has assessed the actual painter status and approved the operating model; (3) the app has been changed to match the agreement; (4)
insurance is confirmed in writing; (5) consumer checkout and cancellation flows are tested; (6) privacy notices and processor arrangements match the real technology; and (7) the signed versions and audit trail have been tested.

Version: 2.0 — Draft only. Business: Tyne & Tees Painting. Website: tyneandteespainting.com. Territory: England &
Wales.$doc$, 'Revised Pack v2.0 Document 20.', 'awaiting_company_approval', '4f7bf1997b5786dcc22ddf00544ffb9be2a916a012dd0793886c45cab6e9b9a5' from public.legal_documents where slug = 'adviser-review-checklist'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('launch-compliance-checklist', 'Company Launch Compliance Checklist', 'Compliance', 'admin', false, 24)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '3.0-draft', $doc$12. Launch checklist — must complete
■ Confirm exact legal entity, address, company number, contact details and VAT position.
■ Employment solicitor reviews real working practices, substitution, fee negotiation, platform control and job allocation.
■ Construction solicitor confirms Construction Act application to painter subcontract and completes payment calendar/notices.
■ Accountant/CIS specialist confirms CIS contractor status, registration, verification, deductions, returns and statements.
■ Insurance broker confirms Company and Painter cover and limits.
■ Complete payment due dates, final dates and invoice rules in every job offer.
■ Publish customer and Painter privacy notices, retention schedule and cookie notice.
■ Test all app workflows and preserve accepted job records and audit logs.
■ Complete customer cancellation/early-start checkout review.
■ Do not launch automatic repair-cost deductions or set-off.

Official sources to be checked by your advisers
GOV.UK employment status checklist and guidance; Employment Rights Act 1996; Housing Grants, Construction and Regeneration
Act 1996 Part II, including sections 106, 110, 110A, 110B and 111; Scheme for Construction Contracts (England and Wales)
Regulations 1998; Construction Industry Scheme guidance; Consumer Rights Act 2015; Consumer Contracts (Information,
Cancellation and Additional Charges) Regulations 2013; UK GDPR and Data Protection Act 2018.
Important: This master pack is a structured draft, not a guarantee that Model A will be legally recognised. Have a UK employment solicitor review the actual relationship and a construction solicitor/accountant confirm the construction payment and CIS requirements before use.$doc$, 'Master Legal Pack v3.0 section 12.', 'awaiting_company_approval', '32026f4d7ed6d3e042e95a5defd5667e6116e0346dd73e3a89c08c68ef401561' from public.legal_documents where slug = 'launch-compliance-checklist'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('quality-control-call', 'Customer Quality-Control Call Script', 'Quality', 'admin', false, 25)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 6 — CUSTOMER QUALITY-CONTROL CALL
RECORD
Internal use only. Do not record audio unless a lawful, transparent recording process and notice are in place.

Call record fields
Job reference; customer; painter/business; date/time; administrator; call outcome; whether the agreed scope was completed; any visible concern; any damage report; whether the customer requests contact or rectification; factual notes; evidence references.

Decision options
No concern currently reported; complaint opened; further information required; customer unavailable; scope/price dispute; damage incident; follow-up scheduled. A customer's satisfaction response is evidence, not a waiver of legal rights.

Approval
Record who reviewed the case, what action was authorised and why. Do not decide a painter payment dispute solely from a telephone score.$doc$, 'Revised Pack v2.0 Document 6.', 'awaiting_solicitor_review', 'fed0a06e06045a858c2792c0509c459e990236ae0d9b2c373f4b35c8834d1599' from public.legal_documents where slug = 'quality-control-call'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('incident-damage-report', 'Incident / Property Damage Report', 'Operations', 'admin', false, 26)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 15 — INCIDENT / PROPERTY DAMAGE REPORT
Required fields
Incident reference; job reference; date/time/location; reporter; people involved; incident type; factual description; immediate action; evidence references; insurer/legal/privacy notifications; follow-up owner; decision and date.

Incident types
Injury/near miss; property damage; product spill/exposure; unsafe condition; missed appointment; workmanship concern; data/privacy incident; suspected fraud; other.

Recordkeeping
Separate fact from opinion. Record source and date of each photograph, message or witness statement. Restrict access to those who need it.$doc$, 'Revised Pack v2.0 Document 15.', 'awaiting_solicitor_review', '3e392e3e5f0211f94c7d2a2f8a47dc252696eb78400304df76045848c9d3d723' from public.legal_documents where slug = 'incident-damage-report'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('digital-acceptance-signature', 'Digital Acceptance & Signature Rules', 'Compliance', 'admin', false, 27)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 16 — DIGITAL ACCEPTANCE & SIGNATURE
RECORD
Required audit fields
User ID; verified email/phone; document title and immutable version/hash; archived copy; date/time in UTC; authentication method; affirmative acceptance action; signature/acceptance ID; proportionate device/IP metadata; copy sent to signer.

Suggested wording
“I confirm I have been given access to the document identified above, have had an opportunity to read it and ask questions, and agree to it to the extent it is legally effective. I understand this does not remove rights that cannot lawfully

be excluded.”

App safeguards
No pre-ticked boxes. Require a deliberate action. Do not silently replace signed terms. Material changes require a new version and fresh acceptance where legally required. Make a copy available to the signer.$doc$, 'Revised Pack v2.0 Document 16.', 'awaiting_solicitor_review', '483f0b77aad550dcf7611d5960cfdd45ec8a19b1dab6635988e40fa7140bfad1' from public.legal_documents where slug = 'digital-acceptance-signature'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('internal-complaint-handling', 'Internal Complaint Handling Procedure', 'Quality', 'admin', false, 28)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'internal-complaint-handling'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('internal-recovery-claim', 'Internal Recovery Claim Procedure', 'Payments', 'admin', false, 29)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Use Master v3.0 clause 3.13 meanwhile. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'internal-recovery-claim'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('cis-contractor-compliance', 'CIS Contractor Compliance Procedure', 'Tax', 'admin', false, 30)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Accountant to write. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'cis-contractor-compliance'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('cis-monthly-reconciliation', 'CIS Monthly Reconciliation Checklist', 'Tax', 'admin', false, 31)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Accountant to write; the app''s CIS dashboard supports it. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'cis-monthly-reconciliation'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('data-breach-response', 'Data Breach Response Procedure', 'Privacy', 'admin', false, 32)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'data-breach-response'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('insurance-verification-checklist', 'Insurance Verification Checklist', 'Insurance', 'admin', false, 33)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'insurance-verification-checklist'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('painter-onboarding-checklist', 'Painter Onboarding Checklist', 'Operations', 'admin', false, 34)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'The app''s onboarding steps follow Master v3.0 Schedule A. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'painter-onboarding-checklist'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('refund-approval-procedure', 'Refund Approval Procedure', 'Payments', 'admin', false, 35)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'refund-approval-procedure'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('customer-terms', 'Customer Terms and Conditions', 'Customer', 'public', false, 36)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 1 — CUSTOMER TERMS & CONDITIONS
These terms are for the website and must be shown before a customer places an order or pays. The accepted quotation and job specification form part of the customer contract.

1. Supplier and contact details
The supplier is [FULL LEGAL ENTITY NAME], trading as Tyne & Tees Painting, of [ADDRESS] (we/us). Contact:
[EMAIL] and [PHONE]. We provide residential painting and decorating services in the service areas stated on our website.

2. Contract formation and documents
A contract is formed when we send written confirmation that we have accepted your booking. The contract consists of these terms, the accepted quotation, the job specification and any written variation agreed later. If documents conflict,

the specific job specification and later agreed written variation take priority over general descriptions.

3. Job specification
The quotation or job record will identify the rooms and surfaces, preparation included, repairs excluded or included, number of coats where agreed, finish, colour/product details supplied by you, access arrangements, dates, labour price, materials responsibility and any exclusions. Work not listed is not included.

4. Price and payment
The total customer price, any VAT treatment and payment dates will be displayed before you accept. We will state clearly whether the price is labour-only or includes paint/materials. No extra charge is payable unless you agree it in writing before the extra work is done, except where the law permits otherwise.

5. Booking payment / deposit
If a deposit is requested, the amount and due date will be shown before payment. The balance due date will be shown in the booking confirmation. A deposit is not automatically forfeited if a customer cancels; any amount retained must be permitted by the contract and applicable law.

6. Customer responsibilities
You must provide safe access at the agreed time, electricity/water where reasonably required, and tell us about known hazards, damp, leaks, fragile items, restricted access or suspected asbestos-containing materials. You should move or protect personal items as agreed. We will not disturb suspected asbestos-containing materials.

7. Materials and changes
The quotation must say who supplies paint and materials. If hidden damage, damp, unsuitable surfaces or other unforeseen conditions affect the work, we will explain the issue and any proposed price/time variation. We will not carry out chargeable additional work without your agreement.

8. Performance standard
We will provide the service with reasonable care and skill and in accordance with the agreed specification. Nothing in these terms excludes or limits rights that consumers have under the Consumer Rights Act 2015 or other mandatory law.

9. Subcontractors
We may use appropriately selected independent painters or painting businesses to carry out the work. We remain your contracting supplier and remain responsible to you for the service and any remedy legally due. We may share the information reasonably needed to arrange and perform your job.

10. Inspection and completion record
We may invite you to inspect the work and record visible concerns. Your signature confirms only that the work was presented for inspection and records your comments at that time. It does not waive statutory rights or prevent you reporting a later-discovered or hidden defect.

11. Complaints and remedies
Please contact [COMPLAINTS EMAIL/PHONE] with your job reference and details. We will investigate fairly. Where the service does not conform to the contract, the Consumer Rights Act 2015 may provide a right to repeat performance and, where statutory conditions are met, an appropriate price reduction. We will apply the law to the facts; a refund is not automatically equal to the painter's fee.

12. Cancellation
If you made the contract online, by telephone or away from our business premises, you may have a statutory 14-day cancellation right under the Consumer Contracts Regulations 2013. See the separate Cancellation Information. If you ask us to start during that period, we will obtain the legally required separate express request and provide the required information.

13. Refunds

Where a refund is due, we will make it within the applicable legal period and normally by the original payment method unless you expressly agree otherwise. We will not charge a prohibited refund fee. Your refund is not conditional on any separate dispute between us and a painter.

14. Damage and liability
Tell us promptly about alleged property damage so that we can investigate and notify insurers where appropriate.
Nothing in these terms excludes or restricts liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or mandatory consumer rights.

15. Privacy
We use personal information to quote, book, perform and administer the service, process payments, communicate, handle complaints and meet legal obligations. See our Customer Privacy Notice and Cookie Notice.

16. Governing law and courts
These terms are governed by the law of England and Wales. A consumer may bring proceedings in any court that has jurisdiction under applicable consumer law. Nothing in this clause removes mandatory consumer protections.$doc$, 'Revised Pack v2.0 Document 1 (kept by Master v3.0 section 11). CONFLICT: its booking deposit clause does not match the current website policy of 100% payment after agreeing the price – solicitor and owner to decide.', 'awaiting_solicitor_review', 'f4c234fa12ca0aad7b74530a0a734952a30b72294e33f51ba6153fed2347655d' from public.legal_documents where slug = 'customer-terms'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('cancellation-information', 'Cancellation Information and Model Cancellation Form', 'Customer', 'public', false, 37)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 2 — CANCELLATION INFORMATION & MODEL
FORM
Provide this information with the customer terms and booking confirmation. Configure the checkout so that any early-start request is separate, optional and unticked by default.

Your cancellation right
For a covered distance or off-premises service contract, a consumer generally has 14 days from the day after the contract is made to cancel without giving a reason. Exceptions and special rules may apply. The precise start date and any exception must be checked for the particular booking.

How to cancel
Tell [FULL LEGAL ENTITY NAME] trading as Tyne & Tees Painting, [POSTAL ADDRESS], [EMAIL] or [PHONE]. You may use the form below, but you do not have to. A clear statement that you wish to cancel is sufficient.

Separate early-start request
Checkbox label: “I expressly request that Tyne & Tees Painting begins the services described in my order before the end of the 14-day cancellation period.” This must be a separate, unticked-by-default choice. The customer must also be given the statutory information about proportionate payment if they cancel after work has begun and the conditions for loss of the cancellation right after full performance. Have the exact checkout flow approved by a solicitor.

Model cancellation form
To: [FULL LEGAL ENTITY NAME], trading as Tyne & Tees Painting, [ADDRESS], [EMAIL]. I/We give notice that I/We cancel the contract for the following service: [DESCRIPTION]. Customer name: [ ]. Address: [ ]. Job reference: [ ]. Date contract made: [ ]. Date of notice: [ ]. Signature (only if sent on paper): [ ].

Refund administration
Record the cancellation date, contract date, whether the early-start request was made, work performed before cancellation, calculation of any legally permitted proportionate amount, and refund amount/date. Do not treat the deposit as automatically non-refundable.$doc$, 'Revised Pack v2.0 Document 2.', 'awaiting_solicitor_review', '4a4c4036ccc1c8332ebfb37b2a14575377e56f9c97e6b6416bf3f710302de71d' from public.legal_documents where slug = 'cancellation-information'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('workmanship-defects-policy', 'Workmanship, Defects and Rectification Policy (customers)', 'Customer', 'public', false, 38)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 4 — WORKMANSHIP, DEFECTS &
RECTIFICATION POLICY
Use a customer-facing summary on the website and the full procedure internally and in the painter app.

1. Scope
This policy applies to concerns about work included in the accepted job specification, including incomplete areas, missed surfaces, visible runs or drips, poor preparation where preparation was included, overspray or paint on protected surfaces, and damage allegedly caused during the job.

2. Report a concern
Contact [EMAIL/PHONE] with the job reference, description, date noticed and photographs if reasonably available.
Please allow a reasonable opportunity to inspect before altering or repairing the area, unless urgent action is needed to prevent further damage.

3. Investigation
We review the quotation, specification, photographs, customer account, painter response, site conditions, product information and any relevant inspection. We distinguish workmanship failures from pre-existing defects, damp, substrate/product issues, customer changes, normal wear or work outside the agreed scope.

4. Repeat performance
Where the service fails to conform and repeat performance is the applicable statutory remedy, we will arrange it within a reasonable time, without significant inconvenience and at no necessary cost to the consumer, as required by law.

5. Price reduction/refund
Where repeat performance is impossible or the legal conditions for price reduction are met, we will provide an appropriate price reduction/refund. The amount is assessed by reference to the statutory test and facts, not an arbitrary percentage or the Painter's fee.

6. Painter involvement
The Painter will receive relevant particulars and a reasonable opportunity to respond, inspect and propose rectification.
The Company may arrange an alternative remedy where appropriate to meet its customer obligations. Any recovery from the Painter is a separate decision under the Painter Agreement.

7. Completion record

A customer signature or positive rating is evidence of the inspection or feedback at that time only. It does not waive statutory rights or rule out a later-discovered defect.$doc$, 'Revised Pack v2.0 Document 4.', 'awaiting_solicitor_review', 'f5624ab902cec992b764bf30ef3b1e1acee99666ee4040cfab48c8976b3d7d8c' from public.legal_documents where slug = 'workmanship-defects-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('customer-ratings-policy', 'Customer Ratings and Review Policy', 'Customer', 'public', false, 39)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 10 — CUSTOMER RATINGS & REVIEW POLICY

DOCUMENT 10 — CUSTOMER RATINGS & REVIEW POLICY
Eligibility
Only a customer connected to a genuine job may submit feedback for that job. Prevent fabricated or duplicate reviews.

Use of ratings
Ratings are feedback, not conclusive proof of misconduct, and must not automatically reduce fees, create strikes or suspend a Painter. Use specific evidence and the incident process for material allegations.

Painter response
Allow a Painter to challenge a review believed to be false, abusive, discriminatory, irrelevant or linked to the wrong job.
Record the moderation decision and reason.

Display and privacy
State whether ratings are public, customer-visible or painter-only. Do not expose unnecessary customer personal information. Explain rating purposes, recipients and retention in the relevant privacy notices.$doc$, 'Revised Pack v2.0 Document 10 (appears twice in the PDF; one copy used).', 'awaiting_solicitor_review', '0c25d35a8aa7c7758c2a044d338e89a3a25bf82d8f00dd6cd11f12c476c690dc' from public.legal_documents where slug = 'customer-ratings-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('customer-privacy-notice', 'Customer Privacy Notice', 'Privacy', 'public', false, 40)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 11 — CUSTOMER PRIVACY NOTICE
Controller
[FULL LEGAL ENTITY NAME] trading as Tyne & Tees Painting, [ADDRESS], is the controller. Contact: [EMAIL].
Privacy contact: [EMAIL/ROLE].

Information
We may process names, contact details, property address, quote details, room dimensions, photographs, booking and payment references, messages, complaints, signatures and feedback.

Purposes and lawful bases
We use information to respond to enquiries, prepare quotes, form and perform contracts, arrange access, process payments, administer jobs, handle complaints, protect property and comply with law. Identify and document the lawful basis for each purpose, such as contract, legal obligation or legitimate interests. Use consent only where it is appropriate and freely given.

Sharing
We may share necessary job information with the assigned Painter, payment providers, hosting/database, email/SMS, insurers, professional advisers and authorities where lawful. Identify actual providers and put appropriate processor contracts and safeguards in place.

Photographs and signatures
Job images and completion records document the work and may be used for quality and dispute handling. Avoid unnecessary images of people, personal documents or unrelated belongings.

Retention
Insert the actual schedule at [URL]. Keep information only as long as necessary for the stated purposes and legal, tax, insurance or claims requirements. Apply separate periods to identity documents, photographs, payment records and complaints.

Rights and complaints
Explain rights to access, rectify, erase, restrict, object and data portability where applicable, and the right to complain to the ICO. Rights are subject to legal conditions and exemptions.

Cookies and transfers

Publish a separate cookie notice and obtain consent before non-essential cookies/advertising technologies run where required. Identify international transfers and safeguards if providers process data outside the UK.$doc$, 'Revised Pack v2.0 Document 11. The website currently shows its own /privacy page – they must be aligned before either is published.', 'awaiting_solicitor_review', 'd7bb85143480ea518104b2e90ed7922379b537d5cae0ced368a9a9d6913e5714' from public.legal_documents where slug = 'customer-privacy-notice'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('complaints-information', 'Customer Complaints Procedure', 'Customer', 'public', false, 41)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '2.0-draft', $doc$DOCUMENT 14 — CUSTOMER COMPLAINTS PROCEDURE
How to complain
Contact [EMAIL/PHONE/POSTAL ADDRESS] with your name, job reference, description and relevant photographs.

Acknowledgement
We aim to acknowledge within [3] working days. This is a service target, not a restriction on statutory rights.

Investigation
Review the quote, specification, booking records, photographs, customer and Painter accounts and relevant site information. Arrange an inspection where proportionate.

Outcome
Explain findings and, where appropriate, offer repeat performance, an appropriate price reduction/refund or another lawful solution. Explain the reasons and next steps.

Timescale and escalation
Aim to provide a substantive response within [10] working days or explain why more time is needed. Escalate to
[MANAGER/OWNER EMAIL]. Statutory deadlines take priority.$doc$, 'Revised Pack v2.0 Document 14.', 'awaiting_solicitor_review', 'd074ed9f8b6440c8fa58cd4a0d0624876a8caa820a8e02a53a992607511e39b9' from public.legal_documents where slug = 'complaints-information'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('cookie-policy', 'Cookie Policy', 'Privacy', 'public', false, 42)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'cookie-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('refund-policy', 'Refund Policy', 'Customer', 'public', false, 43)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Refunds are covered in Customer Terms clause 13; a separate policy has not been drafted. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'refund-policy'
on conflict (document_id, version_label) do nothing;

insert into public.legal_documents (slug, title, category, sector, requires_acceptance, sort_order)
values ('deposit-payment-policy', 'Deposit and Payment Policy', 'Customer', 'public', false, 44)
on conflict (slug) do nothing;
insert into public.legal_document_versions (document_id, version_label, body_markdown, source_note, status, content_sha256)
select id, '0.1', null, 'Customer Terms clauses 4–5 cover price and deposit, but the website now takes 100% payment after the price is agreed. NOT DRAFTED – this document is not in the supplied legal pack. It must be written and approved by the right adviser; nothing has been invented here.', 'draft', null from public.legal_documents where slug = 'deposit-payment-policy'
on conflict (document_id, version_label) do nothing;
