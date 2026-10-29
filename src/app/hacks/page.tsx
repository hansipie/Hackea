import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import HackCards from "@/components/home/HackCards";
import MyHacks from "@/components/hacks/MyHacks";
import { IArrowRight } from "@/components/art/Icons";
import { HACKS } from "@/data/hacks";

export const metadata: Metadata = { title: "Hacks | Hackea", alternates: { canonical: "/hacks" } };

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse">
        <header className="page-head">
          <h1>Hacks</h1>
          <p className="lead">
            {HACKS.length} ways to turn IKEA furniture into something new, each with the parts to buy, what to change, and every step in 3D.
          </p>
        </header>
        <HackCards />
        <Link href="/hacks/new" className="hx-cta">
          <span>
            <b>Make your own hack</b>
            <span>Upload a hack photo to find its IKEA pieces and generate a guide, or start from a KALLAX or BILLY.</span>
          </span>
          <IArrowRight size={20} />
        </Link>
        <MyHacks />
      </main>
      <SiteFooter />
    </div>
  );
}
