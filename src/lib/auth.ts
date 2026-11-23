import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { can, type AdminRole, type Permission } from "@/lib/platform/permissions";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
}

/**
 * Returns the logged-in admin, or null. Checks BOTH that the user is logged in
 * (verified with Supabase, not just trusting the cookie) AND that they are in
 * the admin_users table.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return null;
  // "role" is added by the painter platform migration; before it runs every admin is the owner.
  const { data: row } = await supabase.from("admin_users").select("role").eq("user_id", data.user.id).maybeSingle();
  const role = ((row as { role?: string } | null)?.role ?? "owner") as AdminRole;
  return { id: data.user.id, email: data.user.email ?? "", role };
}

/** Use at the top of every admin page and server action. Redirects to login if not an admin. */
export async function requireAdmin(permission?: Permission): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  if (permission && !can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

// ---------------------------------------------------------------------
// Independent painter logins (the painter portal at /painter)
// ---------------------------------------------------------------------
export interface PainterUser {
  id: string;
  email: string;
  fullName: string;
  painterBusinessId: string;
  businessName: string;
  onboardingStatus: string;
  engagementRoute: string;
}

export async function getPainterUser(): Promise<PainterUser | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await supabase
    .from("painter_users")
    .select("full_name, painter_business_id, painter_businesses(legal_name, trading_name, onboarding_status, engagement_route)")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return null;
  const r = row as unknown as {
    full_name: string;
    painter_business_id: string;
    painter_businesses: { legal_name: string; trading_name: string | null; onboarding_status: string; engagement_route: string };
  };
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: r.full_name,
    painterBusinessId: r.painter_business_id,
    businessName: r.painter_businesses.trading_name || r.painter_businesses.legal_name,
    onboardingStatus: r.painter_businesses.onboarding_status,
    engagementRoute: r.painter_businesses.engagement_route,
  };
}

export async function requirePainter(): Promise<PainterUser> {
  const user = await getPainterUser();
  if (!user) redirect("/painter/login");
  return user;
}
