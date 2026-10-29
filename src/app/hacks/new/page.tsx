import { Suspense } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HackStudio from "@/components/hacks/HackStudio";

export const metadata: Metadata = {
  title: "Make a hack | Hackea",
  description: "Upload an IKEA hack photo, confirm matching catalogue pieces, and generate an editable assembly guide with a parts list and 3D steps.",
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
