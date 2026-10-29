import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Display } from "next/font/google";
import "./globals.css";
import "./guide.css";
import "./home.css";
import "./scan.css";
import "./editor.css";
import { Analytics } from "@vercel/analytics/next";
import Offline from "@/components/Offline";
import { SITE_URL } from "@/lib/site";

const noto = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto",
  display: "swap",
});

const display = Noto_Sans_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const description = "Hack IKEA furniture into something new. Hackea shows what to buy, what to change and every step in 3D, with the parts, screws and tools for each one, and reads it out loud.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Hackea: hack IKEA furniture, step by step",
  description,
  applicationName: "Hackea",
  appleWebApp: { capable: true, title: "Hackea", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Hackea", title: "Hackea: hack IKEA furniture, step by step", description, url: "/" },
  twitter: { card: "summary_large_image", title: "Hackea: hack IKEA furniture, step by step", description },
};

export const viewport: Viewport = {
  themeColor: "#f5f4f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${noto.variable} ${display.variable}`}>
      <body>
        {children}
        <Analytics />
        {/* it reads the path, which the prerendered shell doesn't know yet */}
        <Suspense fallback={null}>
          <Offline />
        </Suspense>
      </body>
    </html>
  );
}
