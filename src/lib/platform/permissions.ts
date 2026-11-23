/**
 * ADMIN ROLES – who can do what in the admin dashboard.
 * Mirrors the database function has_admin_role(): the database enforces it
 * for reading data; the app uses this table to show/hide screens and to check
 * every server action.
 *
 *  owner       – everything (existing admin logins became "owner")
 *  operations  – painters, jobs, offers, complaints, emergencies
 *  finance     – invoices, painter payments, bank details, CIS, HMRC, Sage
 *  compliance  – onboarding verification, legal documents, audit log
 */
export type AdminRole = "owner" | "operations" | "finance" | "compliance";

export type Permission =
  | "jobs.manage"
  | "painters.view"
  | "painters.approve"
  | "evidence.verify"
  | "complaints.manage"
  | "emergencies.view"
  | "finance.view"
  | "finance.approve_payments"
  | "finance.bank_details"
  | "cis.manage"
  | "documents.view"
  | "documents.manage"
  | "gates.approve"
  | "audit.view"
  | "roles.manage";

const MATRIX: Record<Exclude<AdminRole, "owner">, Permission[]> = {
  operations: ["jobs.manage", "painters.view", "complaints.manage", "emergencies.view", "documents.view"],
  finance: ["painters.view", "finance.view", "finance.approve_payments", "finance.bank_details", "cis.manage", "documents.view"],
  compliance: ["painters.view", "painters.approve", "evidence.verify", "documents.view", "documents.manage", "audit.view"],
};

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return MATRIX[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner (full access)",
  operations: "Operations",
  finance: "Finance",
  compliance: "Compliance",
};
