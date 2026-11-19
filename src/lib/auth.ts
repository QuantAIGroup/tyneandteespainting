import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
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
  return { id: data.user.id, email: data.user.email ?? "" };
}

/** Use at the top of every admin page and server action. Redirects to login if not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
