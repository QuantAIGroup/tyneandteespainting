"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export function MobileNav({ links, phone }: { links: { href: string; label: string }[]; phone: string | null }) {
  const pathname = usePathname();
  // The menu remembers which page it was opened on, so it closes automatically after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((v: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(open) : value;
    setOpenOn(next ? pathname : null);
  };

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
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid size-11 place-items-center rounded-md text-navy-900 hover:bg-sand-50"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 top-18 bottom-0 z-50 overflow-y-auto border-t border-navy-900/8 bg-white px-5 pb-10 pt-4">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="border-b border-navy-900/6 py-4 font-serif text-xl text-navy-950">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/quote" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg", "w-full")}>
              Calculate your painting price
            </Link>
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className={buttonClasses("outline", "lg", "w-full")}>
                <Phone className="size-4" /> Call {phone}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
