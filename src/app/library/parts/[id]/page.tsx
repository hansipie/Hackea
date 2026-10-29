import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PartUsageViewer from "@/components/PartUsageViewer";
import { individualPartData, elementSignature } from "@/lib/part-connections";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ furniture?: string | string[] }>;
};

export function generateStaticParams() {
  return individualPartData().elements.slice(0, 1).map((p) => ({ id: p.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const part = individualPartData().elements.find((p) => p.key === id);
  if (!part) return {};
  return {
    title: `${part.name}: all furniture using this part | Hackea`,
    description: `${part.name}, ${part.size.map((n) => n / 10).join(" × ")} cm. See all ${part.products.length} furniture plans containing this individual part.`,
    alternates: { canonical: `/library/parts/${id}` },
  };
}

export default function Page(props: Props) {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse library">
        <Suspense fallback={<p className="lead" role="status">Loading the part and its furniture...</p>}>
          <PartContent {...props} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function PartContent({ params, searchParams }: Props) {
  const { id } = await params;
  const data = individualPartData();
  const partIndex = data.elements.findIndex((p) => p.key === id);
  if (partIndex < 0) notFound();
  const part = data.elements[partIndex];
  const furniture = part.products.map((index) => data.products[index])
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.variant.localeCompare(b.variant, "en", { numeric: true }) || a.slug.localeCompare(b.slug));
  const { furniture: requested } = await searchParams;
  const selected = furniture.find((p) => p.slug === requested) ?? furniture[0];
  const spec = catalogSpec(selected.slug);
  if (!spec) notFound();
  const refs = buildPlan(spec).parts.filter((p) => !p.extra && elementSignature(p) === part.signature).map((p) => p.id);
  return <>
    <header className="page-head">
      <p className="lib-back"><Link href="/library">Individual parts library</Link></p>
      <h1>{part.name}</h1>
      <p className="lead">{part.size.map((n) => Number((n / 10).toFixed(3))).join(" × ")} cm · {part.material} · {part.shape === "cyl" ? "Cylinder" : "Panel / box"}</p>
      {part.names.length > 1 && <p className="cg-method">Also named: {part.names.filter((name) => name !== part.name).join(", ")}</p>}
    </header>
    <div className="individual-usage">
      <section aria-labelledby="using-part">
        <h2 id="using-part">All furniture using this part ({furniture.length})</h2>
        <p className="cg-method">Select a furniture name to locate the part in 3D.</p>
        <ul className="individual-furniture">{furniture.map((p) => <li key={p.slug} className={p.slug === selected.slug ? "selected" : ""}>
          <Link href={`/library/parts/${id}?furniture=${encodeURIComponent(p.slug)}`} scroll={false} prefetch={false} aria-current={p.slug === selected.slug ? "true" : undefined}>
            <span><b>{p.name}</b><span>{p.variant}</span></span>
            <span className="individual-qty">{p.parts.find((p) => p.id === partIndex)?.qty}×</span>
          </Link>
        </li>)}</ul>
      </section>
      <section className="individual-preview" aria-labelledby="selected-furniture">
        <h2 id="selected-furniture">{selected.name}</h2>
        <p className="cg-method">{selected.variant}. This part is shown in green.</p>
        <PartUsageViewer key={selected.slug} spec={spec} refs={refs} />
        <p className="cg-method"><Link href={`/library/${selected.kind}/${selected.slug}`}>Explore all its parts</Link> · <Link href={`/build/${selected.slug}`}>Assembly guide</Link></p>
      </section>
    </div>
    <p className="cg-method">This is the complete list of furniture plans in our catalog with a part of the same dimensions, shape and material. Matching geometry does not confirm identical IKEA part numbers, drilling or fittings.</p>
  </>;
}
