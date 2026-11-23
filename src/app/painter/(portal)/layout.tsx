import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Briefcase, FileText, Home, LogOut, User } from "lucide-react";
import { getAdminUser, getPainterUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOutPainter } from "../actions";

const NAV = [
  { href: "/painter", label: "Home", icon: Home },
  { href: "/painter/profile", label: "My business", icon: User },
  { href: "/painter/documents", label: "Documents", icon: FileText },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-10 text-ink-600">Loading…</p>}>
      <PainterGate>{children}</PainterGate>
    </Suspense>
  );
}

async function PainterGate({ children }: { children: React.ReactNode }) {
  await connection();
  if (!isSupabaseConfigured()) return <p className="p-10">The painter portal isn&apos;t set up yet.</p>;
  const painter = await getPainterUser();
  if (!painter) {
    // An admin who opens /painter is sent back to their own dashboard
    if (await getAdminUser()) redirect("/admin");
    redirect("/painter/login");
  }
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ink-900/10 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/painter" className="flex items-center gap-2 font-extrabold tracking-tight">
            <Briefcase className="size-5 text-brand-600" aria-hidden />
            <span className="leading-tight">
              {painter.businessName}
              <span className="block text-xs font-medium text-ink-600">Tyne &amp; Tees Painting – independent painter portal</span>
            </span>
          </Link>
          <form action={signOutPainter}>
            <button type="submit" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
              <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
        <nav aria-label="Painter portal" className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700">
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">{children}</main>
    </>
  );
}
