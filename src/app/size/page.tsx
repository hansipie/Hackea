import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SizeSearch from "@/components/home/SizeSearch";
import { sizeFromParams } from "@/lib/dimensions";

export const metadata: Metadata = { title: "Find by size | Hackea", alternates: { canonical: "/size" } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// a link from the home search ("80x40x100") arrives with its sizes already filled in
export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const initial = sizeFromParams((k) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]));
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse">
        <header className="page-head">
          <h1>Find by size</h1>
          <p className="lead">Give the height, width and depth you have room for, or any one of them, and see the IKEA pieces that match.</p>
        </header>
        <SizeSearch initial={initial} />
      </main>
      <SiteFooter />
    </div>
  );
}
