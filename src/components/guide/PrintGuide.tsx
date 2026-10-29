"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Plan } from "@/lib/types";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { stepContents, totals } from "@/lib/plan/contents";
import { localSpec } from "@/lib/hacks/store";
import { mineId } from "@/lib/hacks/draft";
import { useMounted } from "@/lib/useMounted";
import Thumb from "../Thumb";
import { LogoMark } from "../Logo";
import { HwArt } from "../art/Hardware";
import { TOOL_INFO, ToolArt } from "../art/Tools";
import { IArrowLeft, IPeople, IPrint } from "../art/Icons";
import { fmtMin } from "./CoverPanel";
import { SITE_URL } from "@/lib/site";

const PER_PAGE = 6;

/** The whole guide on A4: what's in the box first, then six steps to a page, like the paper manual. */
export default function PrintGuide({ slug }: { slug: string }) {
  const mounted = useMounted();
  // resolved exactly as the guide resolves it: an own hack that needs fixing prints nothing older instead
  const found = useMemo(() => (mounted && !catalogSpec(slug) ? localSpec(slug) : null), [slug, mounted]);
  const plan = useMemo(() => {
    const spec = catalogSpec(slug) ?? found?.spec ?? null;
    if (!spec) return null;
    try {
      return buildPlan({ ...spec, slug });
    } catch {
      return null;
    }
  }, [slug, found]);

  if (!plan && found?.own)
    return (
      <div className="print-doc">
        <div className="print-bar">
          <Link href={`/hacks/new?id=${mineId(slug)}`} className="btn ghost">
            <IArrowLeft size={18} /> This hack needs fixing first: open it in the editor
          </Link>
        </div>
      </div>
    );
  if (!plan)
    return (
      <div className="print-doc">
        <div className="print-bar">
          <Link href={`/build/${slug}`} className="btn ghost">
            <IArrowLeft size={18} /> Open the guide first
          </Link>
        </div>
      </div>
    );
  return <Doc plan={plan} slug={slug} />;
}

function Doc({ plan, slug }: { plan: Plan; slug: string }) {
  const s = plan.spec;
  const t = totals(plan);
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const count = () => setReady(el.querySelectorAll(".print-step .thumb.ready").length);
    const mo = new MutationObserver(count);
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ["class"] });
    count();
    return () => mo.disconnect();
  }, []);
  const pages: number[][] = [];
  for (let i = 0; i < plan.steps.length; i += PER_PAGE) pages.push(plan.steps.slice(i, i + PER_PAGE).map((_, j) => i + j));
  const total = plan.steps.length;
  const done = ready >= total;
  const tools = plan.tools.filter((x) => !x.included);
  const url = `${SITE_URL.replace(/^https?:\/\//, "")}/build/${slug}`;
  const id = "print:" + s.name + s.variant;

  return (
    <div className="print-doc" ref={root}>
      <div className="print-bar">
        <Link href={`/build/${slug}`} className="btn round small" aria-label="Back to the guide">
          <IArrowLeft size={18} />
        </Link>
        <span className="print-status">{done ? `${pages.length + 1} pages, ready to print` : `Drawing step ${Math.min(total, ready + 1)} of ${total}`}</span>
        <button className="btn primary" onClick={() => window.print()} disabled={!done}>
          <IPrint size={18} /> Print
        </button>
      </div>

      <section className="print-page cover-page">
        <header className="pp-head">
          <LogoMark size={28} />
          <span>Assembly guide</span>
        </header>
        <h1>{s.name}</h1>
        <p className="pp-variant">{s.variant}</p>
        <p className="pp-facts">
          {fmtMin(s.minutes)} &middot; {s.people === 2 ? "two people" : "one person"} &middot; {total} steps &middot; {t.panels} panels &middot; {t.fittings} fittings
        </p>
        {s.source === "mine" && <p className="pp-facts">Yours, unverified: made in the Hackea editor and not checked. Dimensions are approximate: measure before you drill or cut.</p>}
        <div className="pp-hero">
          <Thumb id={id} plan={plan} mode={{ kind: "assembled" }} w={640} h={420} />
        </div>
        {tools.length > 0 && (
          <>
            <h2>Tools</h2>
            <ul className="pp-tools">
              {tools.map((x) => (
                <li key={x.id}>
                  <ToolArt id={x.id} size={44} />
                  <span>
                    {TOOL_INFO[x.id].name}
                    {x.optional ? " (nice to have)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="pp-cols">
          <div>
            <h2>Panels</h2>
            <ul className="pp-parts">
              {plan.parts
                .filter((p) => !p.extra)
                .map((p) => (
                  <li key={p.id}>
                    <b className="pp-label">{p.label}</b>
                    <span>{p.name}</span>
                    <em>{p.qty}&times;</em>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2>Fittings</h2>
            <ul className="pp-hw">
              {plan.hardware.map((h) => (
                <li key={h.id}>
                  <span className="pp-hw-art">
                    <HwArt kind={h.kind} len={h.len} dia={h.dia} fit={36} />
                  </span>
                  <span>
                    {h.name} <small>{h.spec}</small>
                    {h.notIncluded ? <small> (not in the box)</small> : null}
                  </span>
                  <em>{h.qty}&times;</em>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <footer className="pp-foot">
          <span>Follow it in 3D, read out loud: {url}</span>
          <span>Not affiliated with IKEA. Check each step against the paper manual.</span>
        </footer>
      </section>

      {pages.map((idx, p) => (
        <section key={p} className="print-page steps-page">
          <div className="pp-grid">
            {idx.map((i) => {
              const st = plan.steps[i];
              const c = stepContents(plan, i);
              return (
                <article key={i} className="print-step">
                  <div className="ps-top">
                    <b className="ps-n">{i + 1}</b>
                    {c.hardware.length > 0 && (
                      <span className="ps-hw">
                        {c.hardware.slice(0, 4).map(({ type, count }) => (
                          <span key={type.id}>
                            <HwArt kind={type.kind} len={type.len} dia={type.dia} fit={26} />
                            <b>{count}&times;</b>
                          </span>
                        ))}
                      </span>
                    )}
                    {st.people === 2 && (
                      <span className="ps-two" title="Two people">
                        <IPeople size={18} />
                      </span>
                    )}
                  </div>
                  <Thumb id={id} plan={plan} mode={{ kind: "step", index: i }} w={520} h={360} className="ps-art" />
                  <p className="ps-title">
                    {st.title}
                    {st.repeat && st.repeat > 1 ? ` (do this ${st.repeat} times)` : ""}
                  </p>
                </article>
              );
            })}
          </div>
          <footer className="pp-foot">
            <span>
              {s.name}, {s.variant}
            </span>
            <span>
              {p + 2} / {pages.length + 1}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
}
