"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation – the current page is highlighted in royal blue. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${active ? "bg-brand-50 text-brand-600" : "text-ink-900 hover:text-brand-600"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
