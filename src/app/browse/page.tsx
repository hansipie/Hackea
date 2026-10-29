import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Catalog } from "@/components/home/Sections";
import { PRODUCT_COUNT } from "@/lib/search";
import { PRODUCTS } from "@/lib/catalog";

export const metadata: Metadata = { title: "All guides | Hackea", alternates: { canonical: "/browse" } };

export default function Page() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse">
        <header className="page-head">
          <h1>All guides</h1>
          <p className="lead">
            {PRODUCT_COUNT.toLocaleString("en-US")} IKEA products in {PRODUCTS.length.toLocaleString("en-US")} sizes, drawn and ready to build.
          </p>
        </header>
        <Catalog search />
      </main>
      <SiteFooter />
    </div>
  );
}
