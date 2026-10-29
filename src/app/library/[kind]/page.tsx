import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { formatArticle, library, libraryKind } from "@/lib/library";

type Props = { params: Promise<{ kind: string }> };

export function generateStaticParams() {
  return library().map((k) => ({ kind: k.kind }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  const k = libraryKind(kind);
  if (!k) return {};
  return {
    title: `${k.label}: piece library | Hackea`,
    description: `${k.count} IKEA ${k.label.toLowerCase()} pieces with sizes and article numbers, each linked to its assembly guide.`,
    alternates: { canonical: `/library/${k.kind}` },
  };
}

export default async function Page({ params }: Props) {
  const { kind } = await params;
  const k = libraryKind(kind);
  if (!k) notFound();
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse library">
        <header className="page-head">
          <p className="lib-back">
            <Link href="/library">Piece library</Link>
          </p>
          <h1>{k.label}</h1>
          <p className="lead">
            {k.count.toLocaleString("en-US")} pieces in {k.families.length} names.
          </p>
        </header>
        {k.families.map((f) => (
          <section key={f.name} className="lib-family" aria-label={f.name}>
            <h2>{f.name}</h2>
            <table className="lib-table">
              <thead>
                <tr>
                  <th scope="col">Piece</th>
                  <th scope="col">W × H × D (cm)</th>
                  <th scope="col">Article numbers</th>
                </tr>
              </thead>
              <tbody>
                {f.pieces.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <Link href={`/library/${k.kind}/${p.slug}`}>{p.variant}</Link>
                    </td>
                    <td>
                      {p.size.w} × {p.size.h} × {p.size.d}
                    </td>
                    <td>{p.articles.length ? p.articles.map(formatArticle).join(", ") : "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
