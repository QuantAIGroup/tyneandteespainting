import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Painter portal", template: "%s · Painter portal" },
  robots: { index: false, follow: false },
  // Lets painters "Add to Home Screen" on iPhone and open it like an app
  appleWebApp: { capable: true, title: "T&T Painters", statusBarStyle: "default" },
  manifest: "/painter-manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0012DA", width: "device-width", initialScale: 1, viewportFit: "cover" };

/** Independent painter portal – separate from the customer website. */
export default function PainterRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ink-50/60 font-sans text-ink-950">{children}</div>;
}
