/**
 * Runs before every /admin and /painter request. It keeps the Supabase login
 * session fresh and sends logged-out visitors to the right login page. (The
 * pages also check properly on the server – this is just the first line of
 * defence.)
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Painter pages anyone can open (sign in, apply, password links). */
const PUBLIC_PAINTER_PATHS = ["/painter/login", "/painter/apply", "/painter/auth", "/painter/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPainterArea = path === "/painter" || path.startsWith("/painter/");
  const isPublic = isPainterArea ? PUBLIC_PAINTER_PATHS.some((p) => path.startsWith(p)) : path.startsWith("/admin/login");

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = isPainterArea ? "/painter/login" : "/admin/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/painter", "/painter/:path*"],
};
