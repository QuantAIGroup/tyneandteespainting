import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, LogOut } from "lucide-react";
import { getAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOut } from "../actions";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Enquiries" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Prices & details" },
  { href: "/admin/gallery", label: "Gallery" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-50/60">
      <Suspense fallback={<p className="p-10 text-navy-600">Loading…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}

/** Only renders the dashboard for logged-in admins. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection(); // always check at request time, never at build time
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl">Admin not set up yet</h1>
        <p className="mt-3 text-navy-700">Add your Supabase keys to the environment variables and run the database migration. Full steps are in README.md.</p>
      </div>
    );
  }
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <header className="bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-4 font-serif text-lg">Admin</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-navy-100 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" target="_blank" className="flex items-center gap-1 text-navy-100 hover:text-white">
              View website <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <span className="hidden text-navy-100/60 sm:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-navy-100 hover:bg-white/10 hover:text-white">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </>
  );
}
