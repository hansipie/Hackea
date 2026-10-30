"use client";

import { useEffect, useMemo, useState } from "react";
import { LIMITS } from "@/lib/hacks/draft";
import { SHAPES, type Place, type ShapePreset } from "@/lib/hacks/edit";
import { partGaps, searchParts, type PartRow } from "@/lib/part-search";
import { IHelp, IPlus, ISearch } from "../../art/Icons";
import { Pick } from "../fields";
import { PreviewCard, usePreview } from "./HitPreview";

const POPULAR = ["shelf", "leg", "side panel", "door", "drawer front"];
const PAGE = 30;

// the parts list is the same for everyone: fetched once, kept for the next time the tab opens
let loaded: Promise<PartRow[]> | null = null;
function loadParts() {
  loaded ??= fetch("/api/parts")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<PartRow[]>;
    })
    .catch((e) => {
      loaded = null;
      throw e;
    });
  return loaded;
}

interface Props {
  full: boolean;
  place: Place;
  onPlace: (place: Place) => void;
  onAddPart: (slug: string, ref: string) => void;
  onAddShape: (preset: ShapePreset) => void;
}

/** Individual parts from the library, found by name or by size, plus plain boards and blocks cut to size. */
export default function PartsPane({ full, place, onPlace, onAddPart, onAddShape }: Props) {
  const [rows, setRows] = useState<PartRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [help, setHelp] = useState(false);
  const [n, setN] = useState(PAGE);
  const { tip, on } = usePreview();

  useEffect(() => {
    let live = true;
    loadParts().then(
      (r) => live && setRows(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  const found = useMemo(() => (rows && q.trim() ? searchParts(rows, q) : []), [rows, q]);
  const sized = useMemo(() => !!rows && partGaps(rows, q) !== null, [rows, q]);
  const shown = found.slice(0, n);
  const cm = (p: PartRow) => p.size.map((v) => Number((v / 10).toFixed(2))).join(" × ");

  return (
    <div className="wk-pane">
      <div className="hx-search-box">
        <ISearch size={18} />
        <input
          type="search"
          aria-label="Find an individual part"
          value={q}
          maxLength={60}
          placeholder="Shelf, leg, 40x18x2..."
          autoComplete="off"
          disabled={full}
          onChange={(e) => {
            setQ(e.target.value);
            setN(PAGE);
          }}
        />
        <button type="button" className="cat-clear" onClick={() => setHelp(!help)} aria-label="How to search" aria-expanded={help} aria-controls="wk-parts-help">
          <IHelp size={16} />
        </button>
      </div>
      {help && (
        <div id="wk-parts-help" className="cat-help">
          <p><b>By name</b> or material: <button type="button" onClick={() => setQ("shelf")}>shelf</button>, <button type="button" onClick={() => setQ("leg")}>leg</button>.</p>
          <p><b>By size</b> in centimetres, in any order: <button type="button" onClick={() => setQ("40x18x2")}>40x18x2</button> or <button type="button" onClick={() => setQ("80 x 30")}>80 x 30</button>. A part has no top or front, so each size can match any of its three.</p>
          <p>A single size needs its unit: <button type="button" onClick={() => setQ("75 cm")}>75 cm</button>. Sizes match within 1 cm, closest first.</p>
        </div>
      )}
      <Pick label="Where it goes" value={place} options={[{ id: "beside", label: "Beside what is there" }, { id: "on-top", label: "On top of it" }]} onChange={(v) => onPlace(v as Place)} />
      {full && <p className="hx-hint">{LIMITS.parts} parts at most.</p>}
      {!q.trim() && (
        <div className="wk-chips" aria-label="Popular">
          {POPULAR.map((w) => (
            <button key={w} type="button" className="chip" onClick={() => setQ(w)}>
              {w}
            </button>
          ))}
        </div>
      )}
      <p className="hx-hint" aria-live="polite">
        {failed
          ? "The parts could not be loaded. Try again in a moment."
          : !rows
            ? "Loading the parts..."
            : q.trim() && !found.length
              ? sized
                ? "No part is that size."
                : "Nothing found. Try another word, or a size like 40x18x2."
              : found.length > shown.length
                ? `${found.length.toLocaleString("en-US")} parts, showing ${shown.length}.`
                : ""}
      </p>
      <ul className="wk-hits">
        {shown.map((p) => (
          <li key={p.key} className="wk-hit" tabIndex={0} {...on(p.slug, p.ref)}>
            <span className="wk-hit-name">
              <b>{p.name}</b> <span className="hx-hint">{cm(p)} cm, {p.material}</span>
            </span>
            <button type="button" className="btn link inline" disabled={full} onClick={() => onAddPart(p.slug, p.ref)}>
              <IPlus size={15} /> Add
            </button>
          </li>
        ))}
      </ul>
      <PreviewCard tip={tip} />
      {found.length > shown.length && (
        <button type="button" className="btn link inline" onClick={() => setN(n + PAGE)}>
          Show more parts
        </button>
      )}

      <details className="wk-boards">
        <summary>Plain boards and blocks</summary>
        <p className="hx-hint">Cut to size. Add one, then drag it or type its size.</p>
        <ul className="wk-hits">
          {SHAPES.map((s) => (
            <li key={s.id} className="wk-hit">
              <span className="wk-hit-name">
                <b>{s.label}</b> <span className="hx-hint">{s.size.join(" × ")} mm</span>
              </span>
              <button type="button" className="btn link inline" disabled={full} onClick={() => onAddShape(s)}>
                <IPlus size={15} /> Add
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
