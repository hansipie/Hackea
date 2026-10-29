import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { individualPartData } from "@/lib/part-connections";
import IndividualParts from "@/components/IndividualParts";

export const metadata: Metadata = {
  title: "Individual parts library | Hackea",
  description: "Browse individual panels, shelves, legs and other parts. Open a part to see every furniture plan that uses it.",
  alternates: { canonical: "/library" },
};

export default function Page() {
  const data = individualPartData();
  const parts = data.elements.map((p) => ({ key: p.key, name: p.name, names: p.names, size: p.size, material: p.material, count: p.products.length }))
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.size[0] - b.size[0] || a.size[1] - b.size[1] || a.size[2] - b.size[2] || a.key.localeCompare(b.key));
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse library">
        <header className="page-head">
          <h1>Individual parts library</h1>
          <p className="lead">
            Panels, shelves, legs and other individual parts from {data.products.length.toLocaleString("en-US")} furniture plans. Pick a part to see every piece of furniture that uses it.
          </p>
        </header>
        <IndividualParts parts={parts} />
        <p className="cg-method">Parts are grouped by dimensions, shape and material in our generated plans, including parts used in just one furniture piece. Matching geometry does not confirm compatible drilling or fittings. Hardware and extra items are excluded.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
