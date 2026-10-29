import { Suspense } from "react";
import type { Metadata } from "next";
import GuideApp from "@/components/guide/GuideApp";
import { catalogSpec } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug.startsWith("scan-")) return { title: "Scanned guide | Hackea", robots: { index: false } };
  if (slug.startsWith("mine-")) return { title: "Your hack | Hackea", robots: { index: false } };
  const s = catalogSpec(decodeURIComponent(slug));
  const name = s ? `${s.name} ${s.variant.toLowerCase()}` : decodeURIComponent(slug).replace(/-/g, " ").toUpperCase();
  const title = `${name}: assembly step by step | Hackea`;
  const description = s
    ? `How to assemble the IKEA ${s.name} ${s.variant.toLowerCase()}, one step at a time in 3D: every panel, screw and tool, about ${s.minutes} minutes${s.people === 2 ? " with two people" : ""}.`
    : `Assemble ${name} step by step in 3D, with the parts, screws and tools for each step.`;
  const url = `/build/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "Hackea", title, description, url },
    twitter: { card: "summary_large_image", title, description },
    // drafts for names we don't know shouldn't fill search results
    robots: s ? undefined : { index: false },
  };
}

export default function Page(props: Props) {
  return (
    <Suspense fallback={<div className="guide shell" />}>
      <Inner {...props} />
    </Suspense>
  );
}

async function Inner({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const step = typeof sp.step === "string" ? Number(sp.step) : undefined;
  const kind = typeof sp.kind === "string" ? sp.kind : undefined;
  return <GuideApp slug={decodeURIComponent(slug)} query={q} kind={kind} step={step && step > 0 ? Math.floor(step) : undefined} />;
}
