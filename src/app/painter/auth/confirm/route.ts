/**
 * Handles the links in "set your password" and "reset your password" emails.
 * Verifies the one-time token with Supabase, signs the painter in, then sends
 * them to choose a password.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  if (!tokenHash || (type !== "invite" && type !== "recovery")) {
    redirectTo.pathname = "/painter/login";
    redirectTo.searchParams.set("error", "link");
    return NextResponse.redirect(redirectTo);
  }
  const supabase = await createSessionClient();
  const { error } = supabase ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash }) : { error: new Error("not configured") };
  if (error) {
    redirectTo.pathname = "/painter/login";
    redirectTo.searchParams.set("error", "link");
    return NextResponse.redirect(redirectTo);
  }
  redirectTo.pathname = "/painter/set-password";
  return NextResponse.redirect(redirectTo);
}
