import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PartViewer from "@/components/PartViewer";
import { catalogSpec } from "@/lib/catalog";
import { library, libraryKind } from "@/lib/library";

type Props = { params: Promise<{ kind: string; slug: string }> };

export function generateStaticParams() {
  return library().flatMap((k) => k.families.flatMap((f) => f.pieces.map((p) => ({ kind: k.kind, slug: p.slug }))));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, slug } = await params;
  const s = catalogSpec(slug);
  if (!s) return {};
  return {
    title: `${s.name} ${s.variant.toLowerCase()}: parts | Hackea`,
    description: `Every part of the IKEA ${s.name} ${s.variant.toLowerCase()}, each shown in 3D on the finished piece.`,
    alternates: { canonical: `/library/${kind}/${slug}` },
  };
}

export default async function Page({ params }: Props) {
  const { kind, slug } = await params;
  const k = libraryKind(kind);
  const spec = catalogSpec(slug);
  if (!k || !spec) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse library">
        <header className="page-head">
          <p className="lib-back">
            <Link href="/library">Piece library</Link> / <Link href={`/library/${k.kind}`}>{k.label}</Link>
          </p>
          <h1>
            {spec.name} <span className="lib-variant">{spec.variant}</span>
          </h1>
          <p className="lead">
            Pick a part to see where it sits. <Link href={`/build/${slug}`}>Open the assembly guide</Link>
          </p>
        </header>
        <PartViewer spec={spec} />
      </main>
      <SiteFooter />
    </div>
  );
}
