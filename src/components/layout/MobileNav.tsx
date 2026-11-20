"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { isActive } from "./NavLinks";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The menu remembers which page it was opened on, so it closes automatically after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid size-11 place-items-center rounded-md text-ink-950 hover:bg-grey-50"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 top-20 bottom-[72px] sm:top-24 z-50 overflow-y-auto border-t border-ink-950/8 bg-white px-5 pb-10 pt-2">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpenOn(null)}
                  aria-current={active ? "page" : undefined}
                  className={`border-b border-ink-950/6 py-4 text-xl font-bold ${active ? "text-brand-600" : "text-ink-950"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
