"use client";

import { useMemo, useState } from "react";
import { FIX_KINDS, LIMITS } from "@/lib/hacks/draft";
import { SHAPES, type Place, type ShapePreset } from "@/lib/hacks/edit";
import { libraryParts } from "@/lib/hacks/library";
import { searchCatalog } from "@/lib/search";
import { IPlus, ISearch } from "../../art/Icons";
import { Pick } from "../fields";

type Tab = "furniture" | "shapes" | "fittings";

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
  const hits = useMemo(() => (q.trim().length >= 2 ? searchCatalog(q, 12) : []), [q]);
  return (
    <section className="wk-panel wk-library" aria-label="Library">
      <div className="wk-tabs" role="tablist" aria-label="Library">
        {(["furniture", "shapes", "fittings"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={"wk-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "furniture" ? "Furniture" : t === "shapes" ? "Boards" : "Fittings"}
          </button>
        ))}
      </div>

      {tab === "furniture" && (
        <div className="wk-pane">
          <div className="hx-search-box">
            <ISearch size={18} />
            <input type="search" aria-label="Find furniture or a part" value={q} maxLength={60} placeholder="KALLAX, BILLY, a leg..." autoComplete="off" disabled={full} onChange={(e) => setQ(e.target.value)} />
          </div>
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
            {q.trim().length >= 2 && !hits.length ? "Nothing found. Type the name as IKEA writes it." : ""}
          </p>
          <ul className="wk-hits">
            {hits.map(({ entry: e }) => (
              <li key={e.slug}>
                <div className="wk-hit">
                  <span className="wk-hit-name">
                    <b>{e.name}</b> {e.variant}
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

      {tab === "shapes" && (
        <div className="wk-pane">
          <p className="hx-hint">Boards and blocks cut to size. Add one, then drag it or type its size.</p>
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
        </div>
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
