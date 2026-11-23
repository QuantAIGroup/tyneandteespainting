import type { ReactNode } from "react";
import Link from "next/link";

/** Centred card used by the painter sign-in, registration and password pages. */
export function PublicShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-sm font-bold uppercase tracking-wider text-brand-600">
          <Link href="/">Tyne &amp; Tees Painting</Link> · Painter portal
        </p>
        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-ink-900/10 sm:p-8">
          <h1 className="text-2xl">{title}</h1>
          {intro && <div className="mt-2 text-sm text-ink-700">{intro}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-ink-700">{footer}</div>}
      </div>
    </div>
  );
}
