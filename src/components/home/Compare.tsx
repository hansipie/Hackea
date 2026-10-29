"use client";

import { useState } from "react";
import Link from "next/link";
import { PRODUCT_COUNT } from "@/lib/search";
import { HwArt } from "../art/Hardware";
import { IArrowRight, IBox, ICheck, ISound } from "../art/Icons";

/*
 * One real step (KALLAX 2 × 2, step 2: stand the divider on the dowels),
 * drawn twice from the same geometry: as the booklet in the box prints it,
 * and as Hackea shows it. Numbered pins pair each question the paper leaves
 * open with the part of Hackea's drawing that answers it.
 */

const C = Math.cos(Math.PI / 6);
const S = 0.5;
const OX = 500;
const OY = 384;
type V = [number, number, number];
const P = ([x, y, z]: V): [number, number] => [OX + (x - z) * C, OY + (x + z) * S - y];
const poly = (...pts: V[]) => "M" + pts.map((p) => P(p).map((n) => n.toFixed(1)).join(" ")).join(" L") + " Z";

/** The three faces of a box we see from the front corner. */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return {
    top: poly([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]),
    right: poly([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]),
    left: poly([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]),
  };
}

/** An upright dowel standing on a surface: sides, then the top ellipse. */
function dowel([x, y, z]: V, h: number, r = 6.5) {
  const [cx, top] = P([x, y + h, z]);
  const [, bot] = P([x, y, z]);
  const rx = r * 1.22;
  const ry = r * 0.7;
  return {
    body: `M${cx - rx} ${top} L${cx - rx} ${bot} A${rx} ${ry} 0 0 0 ${cx + rx} ${bot} L${cx + rx} ${top} Z`,
    cap: { cx, cy: top, rx, ry },
  };
}

const BOARD = box(-170, 170, 0, 26, -80, 80);
const DIVIDER = box(-8, 8, 112, 262, -80, 80);
const DOWELS = [dowel([0, 26, -48], 24), dowel([0, 26, 48], 24)];
// fitted in the step before: the end dowels and cam bolts, drawn quieter
const DONE = [dowel([-152, 26, -48], 14), dowel([-152, 26, 48], 14), dowel([152, 26, -48], 14), dowel([152, 26, 48], 14)];
const ARROW = { top: P([0, 344, 0]), tip: P([0, 280, 0]) };
const ZOOM_AT = P([0, 50, -48]);
const ZOOM = { cx: 790, cy: 168, r: 92 };
const LETTER_A = P([96, 26, 30]);
const LETTER_B = P([8, 200, 30]);

/* each side's frame, in the drawing's own units: Hackea's is wider to fit the close-up */
type Box = { x: number; y: number; w: number; h: number };
const VB: Record<"paper" | "bygga", Box> = { paper: { x: 196, y: 16, w: 600, h: 524 }, bygga: { x: 206, y: 16, w: 712, h: 524 } };
const PAPER_NUM = { x: 216, y: 40 };
const PAPER_HW = { x: 216, y: 86 };

/** The three questions, where they sit on each drawing, and Hackea's answer. */
const QA: { q: string; a: string; paper: [number, number]; bygga: [number, number] | null }[] = [
  { q: "Two of which piece?", a: "Every part is lettered and counted.", paper: [PAPER_HW.x + 92, PAPER_HW.y], bygga: null },
  { q: "Which way round?", a: "Drag the step to see any side.", paper: [548, 132], bygga: [548, 132] },
  { q: "Tapped in how far?", a: "A close-up shows how far it goes in.", paper: P([0, 30, 70]), bygga: [ZOOM.cx - ZOOM.r * 0.71, ZOOM.cy + ZOOM.r * 0.71] },
];

const at = (vb: Box, [x, y]: [number, number]) => ({ left: `${((x - vb.x) / vb.w) * 100}%`, top: `${((y - vb.y) / vb.h) * 100}%` });

export default function Compare() {
  // a question and its answer light up together, from either side
  const [lit, setLit] = useState<number | null>(null);
  const hover = (i: number) => ({ onPointerEnter: () => setLit(i), onPointerLeave: () => setLit(null) });
  const pin = (side: "paper" | "bygga", i: number) => (
    <span className={"cmp-pin " + side + (lit === i ? " lit" : "")} aria-hidden="true">
      {i + 1}
    </span>
  );

  return (
    <section className="compare" aria-labelledby="compare-title">
      <div className="cmp-head">
        <h2 className="sec-title" id="compare-title">
          The paper manual, explained
        </h2>
        <p className="cmp-sub">A KALLAX step redrawn in the style of the paper booklet, next to the same step on Hackea.</p>
      </div>

      <div className="cmp-pair" style={{ gridTemplateColumns: `${VB.paper.w}fr ${VB.bygga.w}fr` }}>
        <figure className="cmp-card paper">
          <figcaption className="cmp-tag paper">Booklet style</figcaption>
          <div className="cmp-art" style={{ aspectRatio: `${VB.paper.w} / ${VB.paper.h}` }}>
            <svg viewBox={`${VB.paper.x} ${VB.paper.y} ${VB.paper.w} ${VB.paper.h}`} aria-hidden="true">
              <PaperPage vb={VB.paper} />
              <Scene style="paper" />
            </svg>
            {QA.map((n, i) => (
              <span key={i} className="cmp-spot" style={at(VB.paper, n.paper)} {...hover(i)}>
                {pin("paper", i)}
              </span>
            ))}
          </div>
        </figure>

        <figure className="cmp-card bygga">
          <figcaption className="cmp-tag bygga">On Hackea</figcaption>
          <div className="cmp-art" style={{ aspectRatio: `${VB.bygga.w} / ${VB.bygga.h}` }}>
            <svg viewBox={`${VB.bygga.x} ${VB.bygga.y} ${VB.bygga.w} ${VB.bygga.h}`} aria-hidden="true">
              <Scene style="bygga" />
              <Zoom />
            </svg>
            <span className="cmp-num" style={at(VB.bygga, [226, 44])} aria-hidden="true">
              2
            </span>
            <span className="cmp-hw" style={at(VB.bygga, [226, 136])} {...hover(0)}>
              <HwArt kind="dowel" len={30} dia={8} fit={36} />
              <b>2&times;</b>
              {pin("bygga", 0)}
            </span>
            {QA.map((n, i) =>
              n.bygga ? (
                <span key={i} className="cmp-spot" style={at(VB.bygga, n.bygga)} {...hover(i)}>
                  {pin("bygga", i)}
                </span>
              ) : null,
            )}
          </div>
        </figure>
      </div>

      <ol className="cmp-qa">
        {QA.map((n, i) => (
          <li key={i} className={lit === i ? "lit" : undefined} {...hover(i)}>
            <span className="cmp-qa-n" aria-hidden="true">
              {i + 1}
            </span>
            <p className="cmp-q">&ldquo;{n.q}&rdquo;</p>
            <p className="cmp-a">{n.a}</p>
          </li>
        ))}
      </ol>

      <div className="cmp-foot">
        <ul className="cmp-facts">
          <li>
            <IBox size={18} />
            {PRODUCT_COUNT.toLocaleString("en-US")} IKEA products
          </li>
          <li>
            <ISound size={18} />
            Read out loud, hands free
          </li>
          <li>
            <ICheck size={18} />
            Free, no account
          </li>
        </ul>
        <Link href="/build/kallax-2x2" className="cmp-cta">
          Try it on KALLAX <IArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

/* ---------- the drawing ---------- */

function Scene({ style }: { style: "paper" | "bygga" }) {
  const paper = style === "paper";
  const ink = paper ? "#5d5a53" : "var(--ink)";
  const w = paper ? 1.2 : 2.4;
  const face = (shade: "top" | "left" | "right", tint?: boolean) => {
    if (paper) return "#fbf8f0";
    if (tint) return shade === "right" ? "#f1e4b0" : shade === "left" ? "#fff2c2" : "#fff8dc";
    return shade === "right" ? "#efede7" : "#fff";
  };
  return (
    <g strokeLinejoin="round" stroke={ink} strokeWidth={w} className={paper ? "sc-paper" : "sc-bygga"}>
      {!paper && <ellipse cx={P([0, 0, 0])[0] + 6} cy={P([0, 0, 0])[1] + 16} rx={250} ry={44} fill="#f1efe9" stroke="none" />}
      {/* the bottom panel */}
      <path d={BOARD.left} fill={face("left")} />
      <path d={BOARD.right} fill={face("right")} />
      <path d={BOARD.top} fill={face("top")} />
      {DONE.map((d, i) => (
        <g key={i} opacity={paper ? 1 : 0.55}>
          <path d={d.body} fill={paper ? "#fbf8f0" : "#f1e2c3"} />
          <ellipse {...d.cap} fill={paper ? "#fbf8f0" : "#f7edd6"} />
        </g>
      ))}
      {/* the two new dowels */}
      <g className="sc-new">
        {DOWELS.map((d, i) => (
          <g key={i}>
            <path d={d.body} fill={paper ? "#fbf8f0" : "#f1e2c3"} />
            <ellipse {...d.cap} fill={paper ? "#fbf8f0" : "#f7edd6"} />
          </g>
        ))}
      </g>
      {/* the divider, coming down onto them */}
      <g className="sc-drop">
        <path d={DIVIDER.left} fill={face("left", true)} />
        <path d={DIVIDER.right} fill={face("right", true)} />
        <path d={DIVIDER.top} fill={face("top", true)} />
        {paper ? (
          <path d={`M${ARROW.top[0]} ${ARROW.top[1]} V${ARROW.tip[1]} M${ARROW.top[0] - 6} ${ARROW.tip[1] - 10} L${ARROW.top[0]} ${ARROW.tip[1]} L${ARROW.top[0] + 6} ${ARROW.tip[1] - 10}`} fill="none" />
        ) : (
          <path
            d={`M${ARROW.top[0] - 7} ${ARROW.top[1]} h14 v${ARROW.tip[1] - ARROW.top[1] - 22} h10 l-17 22 l-17 -22 h10 z`}
            fill="var(--ink)"
            stroke="#fff"
            strokeWidth={2.4}
          />
        )}
      </g>
      {/* part letters, like the panels' labels in the box */}
      {[
        { p: LETTER_A, t: "A" },
        { p: LETTER_B, t: "B" },
      ].map(({ p, t }) =>
        paper ? (
          <text key={t} x={p[0]} y={p[1] + 4} fontSize={11} textAnchor="middle" fill={ink} stroke="none" fontFamily="var(--font)">
            {t}
          </text>
        ) : (
          <g key={t}>
            <circle cx={p[0]} cy={p[1]} r={15} fill="#fff" strokeWidth={2} />
            <text x={p[0]} y={p[1] + 5.5} fontSize={15} fontWeight={800} textAnchor="middle" fill="var(--ink)" stroke="none" fontFamily="var(--font)">
              {t}
            </text>
          </g>
        ),
      )}
    </g>
  );
}

/** The magnified circle: the divider's hole lined up over a dowel, with a line to where it happens. */
function Zoom() {
  const { cx, cy, r } = ZOOM;
  const edge = Math.atan2(ZOOM_AT[1] - cy, ZOOM_AT[0] - cx);
  const top = cy - 4; // the dowel's tip
  const face = cy + 46; // the board's top face
  const under = cy - 22; // the divider's bottom edge
  return (
    <g className="cmp-zoom">
      <path d={`M${cx + Math.cos(edge) * r} ${cy + Math.sin(edge) * r} L${ZOOM_AT[0]} ${ZOOM_AT[1]}`} stroke="var(--ink)" strokeWidth={1.6} fill="none" />
      <circle cx={ZOOM_AT[0]} cy={ZOOM_AT[1]} r={4} fill="var(--ink)" />
      <clipPath id="cmp-zoom-clip">
        <circle cx={cx} cy={cy} r={r - 1.4} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <g clipPath="url(#cmp-zoom-clip)" stroke="var(--ink)" strokeLinejoin="round">
        {/* the divider coming down, with the hole the dowel goes into */}
        <rect x={cx - 130} y={cy - 140} width={260} height={under - (cy - 140)} fill="#fff2c2" strokeWidth={0} />
        <rect x={cx - 15} y={under - 44} width={30} height={44} fill="#e8d38e" strokeWidth={1.4} strokeDasharray="4 3" />
        <path d={`M${cx - 130} ${under} H${cx - 15} M${cx + 15} ${under} H${cx + 130}`} strokeWidth={2.6} fill="none" />
        {/* the board, cut through */}
        <rect x={cx - 130} y={face} width={260} height={90} fill="#fff" strokeWidth={0} />
        <path d={`M${cx - 130} ${face} H${cx + 130}`} strokeWidth={2.6} fill="none" />
        {/* the dowel: half in the board, half waiting for the hole */}
        <path d={`M${cx - 13} ${face} V${top + 8} Q${cx - 13} ${top} ${cx - 5} ${top} H${cx + 5} Q${cx + 13} ${top} ${cx + 13} ${top + 8} V${face} Z`} fill="#f1e2c3" strokeWidth={2.4} />
        <path d={`M${cx - 13} ${face} V${face + 40} M${cx + 13} ${face} V${face + 40} M${cx - 13} ${face + 40} H${cx + 13}`} strokeWidth={1.4} strokeDasharray="4 3" fill="none" />
        <path d={`M${cx - 4.5} ${top + 10} V${face - 6} M${cx + 4.5} ${top + 10} V${face - 6}`} stroke="#c9b48a" strokeWidth={1.6} fill="none" />
      </g>
      <path d={`M${cx + 46} ${under - 46} v30 m-7.5 -9 l7.5 9 l7.5 -9`} stroke="var(--ink)" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink)" strokeWidth={2.6} />
    </g>
  );
}

/** The paper side's page: cream stock, the small boxed step number and a part number nobody can find. */
function PaperPage({ vb }: { vb: Box }) {
  const n = PAPER_NUM;
  const hw = PAPER_HW;
  return (
    <g>
      <rect x={vb.x - 2} y={vb.y - 2} width={vb.w + 4} height={vb.h + 4} fill="url(#cmp-paper)" />
      <defs>
        <linearGradient id="cmp-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5f1e6" />
          <stop offset="1" stopColor="#ece7da" />
        </linearGradient>
      </defs>
      <rect x={n.x} y={n.y} width={30} height={30} fill="none" stroke="#5d5a53" strokeWidth={1.2} />
      <text x={n.x + 15} y={n.y + 21} fontSize={17} textAnchor="middle" fill="#5d5a53" fontFamily="var(--font)">
        2
      </text>
      <g transform={`translate(${hw.x} ${hw.y})`} stroke="#5d5a53" strokeWidth={1.1} fill="none">
        <rect x={0} y={0} width={92} height={46} rx={4} />
        <rect x={10} y={18} width={22} height={8} rx={3} fill="#fbf8f0" />
        <text x={40} y={26} fontSize={11} fill="#5d5a53" stroke="none" fontFamily="var(--font)">
          2x
        </text>
        <text x={10} y={40} fontSize={8.5} fill="#8a857a" stroke="none" fontFamily="var(--font)">
          101351
        </text>
      </g>
      <text x={vb.x + vb.w - 26} y={vb.y + vb.h - 18} fontSize={12} textAnchor="end" fill="#8a857a" fontFamily="var(--font)">
        7
      </text>
    </g>
  );
}
