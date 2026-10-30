"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fold } from "@/lib/fold";
import { PART_FILTERS, partGroups } from "@/lib/part-filters";
import { partGaps } from "@/lib/part-search";
import { IHelp } from "@/components/art/Icons";

export interface IndividualPartRow {
  key: string;
  name: string;
  names: string[];
  size: number[];
  material: string;
  count: number;
}

type SortKey = "name" | "size" | "material" | "count";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Individual part" },
  { key: "size", label: "Dimensions (cm)" },
  { key: "material", label: "Material" },
  { key: "count", label: "Used in" },
];

function compareParts(a: IndividualPartRow, b: IndividualPartRow, key: SortKey) {
  if (key === "count") return a.count - b.count;
  if (key === "size") return a.size[0] - b.size[0] || a.size[1] - b.size[1] || a.size[2] - b.size[2];
  return a[key].localeCompare(b[key], "en");
}

export default function IndividualParts({ parts }: { parts: IndividualPartRow[] }) {
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(100);
  const [help, setHelp] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const materials = useMemo(() => [...new Set(parts.map((p) => p.material))].sort(), [parts]);
  const groups = useMemo(() => new Map(parts.map((p) => [p.key, partGroups(p.names)])), [parts]);
  // "40x18x2" or "h100 w80": sizes in cm, in any order, closest first until a column is chosen
  const gaps = useMemo(() => partGaps(parts, query), [parts, query]);
  const matching = useMemo(() => {
    if (gaps) return parts.filter((p) => gaps.has(p.key) && (!material || material === p.material));
    const words = fold(query).split(" ").filter(Boolean);
    return parts.filter((p) => {
      const text = fold(`${p.names.join(" ")} ${p.size.map((n) => n / 10).join(" ")} ${p.material}`);
      return (!material || material === p.material) && words.every((word) => text.includes(word));
    });
  }, [parts, query, material, gaps]);
  const counts = useMemo(() => new Map(PART_FILTERS.map(({ id }) => [id, id === "all" ? matching.length : matching.filter((p) => groups.get(p.key)?.includes(id)).length])), [matching, groups]);
  const found = useMemo(() => category === "all" ? matching : matching.filter((p) => groups.get(p.key)?.includes(category)), [matching, groups, category]);
  const sorted = useMemo(() => [...found].sort((a, b) => (gaps && !chosen ? (gaps.get(a.key) ?? 0) - (gaps.get(b.key) ?? 0) : sort.dir * compareParts(a, b, sort.key)) || a.name.localeCompare(b.name, "en") || a.key.localeCompare(b.key)), [found, sort, gaps, chosen]);
  const sortBy = (key: SortKey) => { setChosen(true); setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 })); setLimit(100); };
  return (
    <div>
      <div className="individual-filters connections">
        <label>Find a part
          <span className="parts-search">
          <input type="search" placeholder="Shelf, leg, panel, size (40x18x2)..." value={query} onChange={(e) => { setQuery(e.target.value); setChosen(false); setLimit(100); }} />
          <button type="button" className="cat-clear" onClick={() => setHelp(!help)} aria-label="How to search" aria-expanded={help} aria-controls="parts-help">
            <IHelp size={16} />
          </button>
        </span>
        </label>
        <label>Material
          <select value={material} onChange={(e) => { setMaterial(e.target.value); setLimit(100); }}>
            <option value="">All materials</option>
            {materials.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      {help && (
        <div id="parts-help" className="cat-help">
          <p><b>Search by name</b> or material: <button type="button" onClick={() => setQuery("shelf")}>shelf</button>, <button type="button" onClick={() => setQuery("leg")}>leg</button>.</p>
          <p><b>Search by size</b> in centimetres, in any order: <button type="button" onClick={() => setQuery("40x18x2")}>40x18x2</button> or <button type="button" onClick={() => setQuery("80 x 30")}>80 x 30</button>. A part has no top or front, so each size can match any of its three.</p>
          <p>A single size needs its unit: <button type="button" onClick={() => setQuery("75 cm")}>75 cm</button>. Sizes match within 1 cm, closest first until you sort a column.</p>
        </div>
      )}
      <div className="cat-bar individual-categories">
        <div className="cat-tabs" role="group" aria-label="Filter by individual part type">
          {PART_FILTERS.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} className={"cat-tab" + (category === c.id ? " on" : "")} onClick={() => { setCategory(c.id); setLimit(100); }}>
              {category === c.id && <i className="cat-bg" aria-hidden="true" />}
              <span>{c.label}</span><small className="cat-n">{counts.get(c.id)}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="cg-method" role="status">{found.length.toLocaleString("en-US")} individual part types{found.length > limit ? `, showing ${limit}` : ""}.</p>
      <table className="lib-table">
        <thead><tr>{COLUMNS.map((c) => (
          <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
            <button type="button" className="lib-sort" onClick={() => sortBy(c.key)}>
              {c.label}<span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
            </button>
          </th>
        ))}</tr></thead>
        <tbody>{sorted.slice(0, limit).map((p) => <tr key={p.key}>
          <td><Link href={`/library/parts/${p.key}`} prefetch={false}><b>{p.name}</b></Link>{p.names.length > 1 && <span className="individual-aliases">Also named: {p.names.filter((name) => name !== p.name).join(", ")}</span>}</td>
          <td>{p.size.map((n) => Number((n / 10).toFixed(3))).join(" × ")}</td>
          <td>{p.material}</td>
          <td>{p.count} {p.count === 1 ? "furniture piece" : "furniture pieces"}</td>
        </tr>)}</tbody>
      </table>
      {!found.length && <p className="lead">No parts match your search.</p>}
      {found.length > limit && <button type="button" className="individual-more" onClick={() => setLimit((n) => n + 100)}>Show more parts</button>}
    </div>
  );
}
