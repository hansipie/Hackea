import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Figure } from "@/components/art/Figure";
import { HeroSearch } from "@/components/home/HomeClient";

export const metadata: Metadata = { title: "Page not found | Hackea", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="lost">
        <Figure pose="think" bubble="?" size={120} />
        <h1>This page isn&apos;t in the box</h1>
        <p className="lead">The link may be old. Type the name from your box instead, or browse every guide.</p>
        <div className="lost-search">
          <HeroSearch />
        </div>
        <Link href="/browse" className="sec-link">
          All guides
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
