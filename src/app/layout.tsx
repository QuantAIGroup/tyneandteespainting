import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Tyne & Tees Painting | Bedroom & Living Room Painters Newcastle",
    template: "%s",
  },
  description:
    "Interior painters in Newcastle upon Tyne specialising in bedrooms, living rooms and skirting boards. Straightforward room-by-room labour prices – no hourly rates. Get an instant online estimate.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Tyne & Tees Painting",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
