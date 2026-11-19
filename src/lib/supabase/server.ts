import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for the ADMIN area, acting as the logged-in user.
 * Database security rules (RLS) decide what that user may read or change.
 */
export async function createSessionClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies can't be set.
          // The proxy (src/proxy.ts) refreshes the session instead.
        }
      },
    },
  });
}
