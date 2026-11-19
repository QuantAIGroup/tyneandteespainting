import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * A read-only client for PUBLIC data (prices, business details, gallery).
 * It never reads cookies, so pages using it can be cached and served fast.
 * Returns null when Supabase isn't configured yet.
 */
export function createPublicClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
