"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PRODUCTS } from "@/lib/catalog";
import { DEFAULT_TOLERANCE, hasSize, parseCm, searchBySize, type SizeQuery } from "@/lib/dimensions";
import { ProductCard } from "./Sections";

const PAGE = 24;
const FIELDS = [
  { key: "h", label: "Height" },
  { key: "w", label: "Width" },
  { key: "d", label: "Depth" },
] as const;
const TOLERANCES = [2, 5, 10, 20];

const show = (n: number | undefined) => (n === undefined ? "" : String(n));

export default function SizeSearch({ initial }: { initial?: SizeQuery }) {
  const [text, setText] = useState({ h: show(initial?.h), w: show(initial?.w), d: show(initial?.d), any: initial?.any?.join(" x ") ?? "" });
  const [mode, setMode] = useState<"about" | "within">(initial?.mode ?? "about");
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [n, setN] = useState(PAGE);

  const any = text.any.split(/[x×*,\s]+/).map(parseCm).filter((n): n is number => n !== undefined).slice(0, 3);
  const query: SizeQuery = { h: parseCm(text.h), w: parseCm(text.w), d: parseCm(text.d), ...(any.length ? { any } : {}), mode, tolerance };
  const typed = [text.h, text.w, text.d, text.any].some((t) => t.trim());
  const results = useMemo(
    () => searchBySize(PRODUCTS, query),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.h, query.w, query.d, text.any, mode, tolerance],
  );
  const shown = results.slice(0, n);

  return (
    <div className="catalog">
      <form className="size-form" onSubmit={(e) => e.preventDefault()}>
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="size-field">
            <span>{label} (cm)</span>
            <input
              type="text"
              inputMode="decimal"
              value={text[key]}
              onChange={(e) => { setText({ ...text, [key]: e.target.value }); setN(PAGE); }}
              aria-label={`${label} in centimetres`}
              autoComplete="off"
            />
          </label>
        ))}
        <label className="size-field">
          <span>Any order (cm)</span>
          <input
            type="text"
            value={text.any}
            onChange={(e) => { setText({ ...text, any: e.target.value }); setN(PAGE); }}
            placeholder="80 x 40"
            aria-label="Sizes in any order, in centimetres"
            autoComplete="off"
          />
        </label>
        <fieldset className="size-mode">
          <legend className="sr-only">How to match</legend>
          <label>
            <input type="radio" name="mode" checked={mode === "about"} onChange={() => { setMode("about"); setN(PAGE); }} /> About this size
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === "within"} onChange={() => { setMode("within"); setN(PAGE); }} /> Fits in this space
          </label>
        </fieldset>
        {mode === "about" && (
          <label className="size-field">
            <span>Give or take</span>
            <select value={tolerance} onChange={(e) => { setTolerance(Number(e.target.value)); setN(PAGE); }}>
              {TOLERANCES.map((t) => <option key={t} value={t}>{t} cm</option>)}
            </select>
          </label>
        )}
      </form>

      {!hasSize(query) ? (
        <p className="size-hint">{typed ? "Type sizes in centimetres, like 80 or 77.5." : "Fill in at least one size."}</p>
      ) : (
        <>
          <p className="size-hint" role="status">
            {results.length.toLocaleString("en-US")} {results.length === 1 ? "size matches" : "sizes match"}, closest first.
          </p>
          <motion.div layout className="pgrid">
            <AnimatePresence initial={false}>
              {shown.map(({ entry }, i) => <ProductCard key={entry.slug} e={entry} i={i} />)}
            </AnimatePresence>
          </motion.div>
          {results.length > shown.length && (
            <div className="cat-more">
              <button type="button" className="cat-more-btn" onClick={() => setN(n + PAGE)}>
                Show {Math.min(PAGE, results.length - shown.length)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
