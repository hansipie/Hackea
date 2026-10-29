import { Suspense } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HackStudio from "@/components/hacks/HackStudio";

export const metadata: Metadata = {
  title: "Make one | Hackea",
  description: "Design your own furniture from the library: combine one or several IKEA pieces and their parts, side by side or stacked, and see it in 3D.",
  alternates: { canonical: "/hacks/new" },
};

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse hx-main">
        {/* it reads ?id= from the URL, which the prerendered shell doesn't know yet */}
        <Suspense fallback={<p className="hx-loading">Opening the editor</p>}>
          <HackStudio />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
