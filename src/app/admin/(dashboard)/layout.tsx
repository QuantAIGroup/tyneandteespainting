import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, LogOut } from "lucide-react";
import { getAdminUser } from "@/lib/auth";
import { can, ROLE_LABELS, type Permission } from "@/lib/platform/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOut } from "../actions";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV: { href: string; label: string; permission?: Permission }[] = [
  { href: "/admin", label: "Enquiries" },
  { href: "/admin/jobs", label: "Jobs", permission: "jobs.manage" },
  { href: "/admin/painters", label: "Painters", permission: "painters.view" },
  { href: "/admin/finance", label: "Payments & CIS", permission: "finance.view" },
  { href: "/admin/documents", label: "Legal documents", permission: "documents.view" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Prices & details" },
  { href: "/admin/gallery", label: "Gallery" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-50/60">
      <Suspense fallback={<p className="p-10 text-ink-600">Loading…</p>}>
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
        <p className="mt-3 text-ink-700">Add your Supabase keys to the environment variables and run the database migration. Full steps are in README.md.</p>
      </div>
    );
  }
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  return (
    <>
      <header className="bg-ink-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-4 font-bold tracking-tight text-lg">Admin</span>
            {NAV.filter((n) => !n.permission || can(user.role, n.permission)).map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-ink-100 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" target="_blank" className="flex items-center gap-1 text-ink-100 hover:text-white">
              View website <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <span className="hidden text-ink-100/60 sm:inline">
              {user.email} · {ROLE_LABELS[user.role]}
            </span>
            <form action={signOut}>
              <button type="submit" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-ink-100 hover:bg-white/10 hover:text-white">
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
