"use client";

import { useMemo, useState } from "react";
import { FIX_KINDS, LIMITS } from "@/lib/hacks/draft";
import type { Place, ShapePreset } from "@/lib/hacks/edit";
import { libraryParts } from "@/lib/hacks/library";
import { searchCatalog } from "@/lib/search";
import { PRODUCTS } from "@/lib/catalog";
import { parseSizeText, searchBySize } from "@/lib/dimensions";
import { IHelp, IPlus, ISearch } from "../../art/Icons";
import { Pick } from "../fields";
import PartsPane from "./PartsPane";

type Tab = "furniture" | "parts" | "fittings";

const POPULAR = ["KALLAX", "BILLY", "LACK", "PAX", "ALEX", "BESTA", "HEMNES", "IVAR", "EKET", "TROFAST"];

interface Props {
  full: boolean;
  onAddFurniture: (slug: string, place: Place) => void;
  onAddPart: (slug: string, ref: string, place: Place) => void;
  onAddShape: (preset: ShapePreset) => void;
}

/** The library of supplies: furniture and its parts, boards and blocks, and the fittings the guide can place. */
export default function LibraryPanel({ full, onAddFurniture, onAddPart, onAddShape }: Props) {
  const [tab, setTab] = useState<Tab>("furniture");
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<Place>("beside");
  const [parts, setParts] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  // "80x40x100" or "h100 w80": sizes in cm, closest first, instead of a name
  const size = useMemo(() => parseSizeText(q), [q]);
  const sized = useMemo(() => (size ? searchBySize(PRODUCTS, size) : []), [size]);
  const hits = useMemo(() => (size ? sized.slice(0, 12) : q.trim().length >= 2 ? searchCatalog(q, 12) : []), [q, size, sized]);
  return (
    <section className="wk-panel wk-library" aria-label="Library">
      <div className="wk-tabs" role="tablist" aria-label="Library">
        {(["furniture", "parts", "fittings"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={"wk-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "furniture" ? "Furniture" : t === "parts" ? "Parts" : "Fittings"}
          </button>
        ))}
      </div>

      {tab === "furniture" && (
        <div className="wk-pane">
          <div className="hx-search-box">
            <ISearch size={18} />
            <input type="search" aria-label="Find furniture or a part" value={q} maxLength={60} placeholder="KALLAX, BILLY, a leg..." autoComplete="off" disabled={full} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="cat-clear" onClick={() => setHelp(!help)} aria-label="How to search" aria-expanded={help} aria-controls="wk-search-help">
              <IHelp size={16} />
            </button>
          </div>
          {help && (
            <div id="wk-search-help" className="cat-help">
              <p><b>By name</b>: <button type="button" onClick={() => setQ("kallax")}>kallax</button>, <button type="button" onClick={() => setQ("billy")}>billy</button>.</p>
              <p><b>By size</b> in centimetres, in any order: <button type="button" onClick={() => setQ("80x40x100")}>80x40x100</button> or <button type="button" onClick={() => setQ("80 x 40")}>80 x 40</button>.</p>
              <p>Or name each size: <button type="button" onClick={() => setQ("h100 w80")}>h100 w80</button> (h height, w width, d depth). A single size needs its unit: <button type="button" onClick={() => setQ("100 cm")}>100 cm</button>. Sizes match within 5 cm, closest first.</p>
            </div>
          )}
          <Pick label="Where it goes" value={place} options={[{ id: "beside", label: "Beside what is there" }, { id: "on-top", label: "On top of it" }]} onChange={(v) => setPlace(v as Place)} />
          {full && <p className="hx-hint">{LIMITS.parts} parts at most.</p>}
          {!q.trim() && (
            <div className="wk-chips" aria-label="Popular">
              {POPULAR.map((n) => (
                <button key={n} type="button" className="chip" onClick={() => setQ(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
          <p className="hx-hint" aria-live="polite">
            {size
              ? !sized.length
                ? "No furniture is that size."
                : sized.length > hits.length
                  ? `${sized.length.toLocaleString("en-US")} match, showing ${hits.length}. Add another size to narrow it.`
                  : ""
              : q.trim().length >= 2 && !hits.length
                ? "Nothing found. Type the name as IKEA writes it."
                : ""}
          </p>
          <ul className="wk-hits">
            {hits.map(({ entry: e }) => (
              <li key={e.slug}>
                <div className="wk-hit">
                  <span className="wk-hit-name">
                    <b>{e.name}</b> {e.variant}
                    {size && <span className="hx-hint"> {e.size.w} w × {e.size.h} h × {e.size.d} d cm</span>}
                  </span>
                  <span className="wk-hit-add">
                    <button type="button" className="btn link inline" aria-expanded={parts === e.slug} onClick={() => setParts(parts === e.slug ? null : e.slug)}>
                      Parts
                    </button>
                    <button type="button" className="btn link inline" disabled={full} onClick={() => onAddFurniture(e.slug, place)}>
                      <IPlus size={15} /> Add
                    </button>
                  </span>
                </div>
                {parts === e.slug && (
                  <ul className="wk-hits sub">
                    {libraryParts(e.slug).map((p) => (
                      <li key={p.ref} className="wk-hit">
                        <span className="wk-hit-name">
                          {p.name} <span className="hx-hint">{p.size.map((n) => Math.round(n)).join(" × ")} mm, {p.qty} in the box</span>
                        </span>
                        <button type="button" className="btn link inline" disabled={full} onClick={() => onAddPart(e.slug, p.ref, place)}>
                          <IPlus size={15} /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "parts" && (
        <PartsPane full={full} place={place} onPlace={setPlace} onAddPart={(slug, ref) => onAddPart(slug, ref, place)} onAddShape={onAddShape} />
      )}

      {tab === "fittings" && (
        <div className="wk-pane">
          <p className="hx-hint">You don&apos;t place these: the guide puts the right ones where your parts meet. This is what it can use.</p>
          <ul className="wk-hits">
            {FIX_KINDS.map((k) => (
              <li key={k.id} className="wk-hit">
                <span className="wk-hit-name">
                  <b>{k.label}</b> <span className="hx-hint">{k.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
