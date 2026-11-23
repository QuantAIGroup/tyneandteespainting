-- =====================================================================
-- ROLLBACK for the painter platform migrations:
--   20261124000000_painter_platform_operations.sql
--   20261124000100_painter_platform_finance.sql
--   20261124000200_legal_document_register.sql
--
-- ⚠️  THIS DELETES ALL PAINTER, JOB, CIS, PAYMENT AND DOCUMENT RECORDS.
-- Only run it if the new features were never used for real, or after you
-- have exported everything (Supabase → Database → Backups, or the
-- /admin/audit export). It does NOT touch the website tables (enquiries,
-- payments, gallery, settings...) except removing three added columns from
-- public.payments and two from public.admin_users.
--
-- Storage buckets are not deleted automatically: empty and delete
-- painter-documents, job-photos, case-evidence and legal-documents in
-- Supabase → Storage if you want them gone.
-- =====================================================================
begin;

drop view if exists public.cis_monthly_summary;

drop table if exists
  public.payment_notices, public.construction_act_configs, public.reconciliation_flags, public.sage_sync_records,
  public.stripe_refunds, public.hmrc_payments, public.hmrc_cis_returns, public.cis_reserve_movements,
  public.cis_ledger_entries, public.painter_payments, public.painter_invoices, public.cis_verifications,
  public.compliance_gates, public.retention_rules,
  public.appeals, public.recovery_claims, public.customer_remedies, public.independent_assessments,
  public.rectifications, public.complaint_evidence, public.complaints, public.customer_feedback,
  public.customer_inspections, public.job_photos, public.emergency_notices, public.substitutes,
  public.job_variations, public.job_offer_versions, public.job_offers, public.job_site_details, public.jobs,
  public.document_acceptances, public.legal_document_versions, public.legal_documents,
  public.access_restrictions, public.painter_evidence, public.painter_private_details, public.painter_users,
  public.painter_businesses, public.audit_events
cascade;

drop function if exists
  public.gate_approved(text), public.cis_tax_month_start(date), public.check_painter_payment(),
  public.write_cis_ledger_entry(), public.cis_ledger_protect(), public.check_payment_notice(),
  public.has_admin_role(text[]), public.current_painter_business_id(), public.add_working_days(timestamptz, integer),
  public.freeze_approved_document_versions(), public.only_accept_approved_versions(), public.guard_offer_versions(),
  public.check_new_offer_version(), public.agree_job_on_mutual_acceptance(), public.audit_events_append_only(),
  public.audit_row_change(), public.audit_private_details_change();

alter table public.payments
  drop column if exists stripe_fee_pence,
  drop column if exists stripe_balance_transaction_id,
  drop column if exists net_received_pence;

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users drop column if exists role, drop column if exists display_name;

commit;
