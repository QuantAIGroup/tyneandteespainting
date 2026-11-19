import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/700.css";
import "./globals.css";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Bedroom & Living Room Painters Newcastle | Fixed Room Prices",
    template: "%s",
  },
  description:
    "Interior painters in Newcastle upon Tyne specialising in bedrooms, living rooms and skirting boards. Straightforward room-by-room labour prices – no hourly rates. Get an instant online estimate.",
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Room painting in Newcastle",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#13223a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
