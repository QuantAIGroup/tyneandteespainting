import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY client using the SECRET key. It bypasses database security rules,
 * so it is only used in server code for things customers are allowed to do
 * (submit an enquiry, upload photos via one-time links).
 * The "server-only" import above makes the build fail if this is ever imported
 * into browser code – so the secret key can never leak to visitors.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
