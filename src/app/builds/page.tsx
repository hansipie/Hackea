import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Workshop from "@/components/workshop/Workshop";
import SiteFooter from "@/components/SiteFooter";

// your own builds, kept in this browser: nothing for a search engine to index
export const metadata: Metadata = { title: "Your workshop | Hackea", robots: { index: false } };

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main>
        <Workshop />
      </main>
      <SiteFooter />
    </div>
  );
}
