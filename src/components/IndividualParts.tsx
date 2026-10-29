"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fold } from "@/lib/fold";
import { PART_FILTERS, partGroups } from "@/lib/part-filters";

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
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const materials = useMemo(() => [...new Set(parts.map((p) => p.material))].sort(), [parts]);
  const groups = useMemo(() => new Map(parts.map((p) => [p.key, partGroups(p.names)])), [parts]);
  const matching = useMemo(() => {
    const words = fold(query).split(" ").filter(Boolean);
    return parts.filter((p) => {
      const text = fold(`${p.names.join(" ")} ${p.size.map((n) => n / 10).join(" ")} ${p.material}`);
      return (!material || material === p.material) && words.every((word) => text.includes(word));
    });
  }, [parts, query, material]);
  const counts = useMemo(() => new Map(PART_FILTERS.map(({ id }) => [id, id === "all" ? matching.length : matching.filter((p) => groups.get(p.key)?.includes(id)).length])), [matching, groups]);
  const found = useMemo(() => category === "all" ? matching : matching.filter((p) => groups.get(p.key)?.includes(category)), [matching, groups, category]);
  const sorted = useMemo(() => [...found].sort((a, b) => sort.dir * compareParts(a, b, sort.key) || a.name.localeCompare(b.name, "en") || a.key.localeCompare(b.key)), [found, sort]);
  const sortBy = (key: SortKey) => { setSort((s) => ({ key, dir: s.key === key && s.dir === 1 ? -1 : 1 })); setLimit(100); };
  return (
    <div>
      <div className="individual-filters connections">
        <label>Find a part
          <input type="search" placeholder="Shelf, leg, panel, dimensions..." value={query} onChange={(e) => { setQuery(e.target.value); setLimit(100); }} />
        </label>
        <label>Material
          <select value={material} onChange={(e) => { setMaterial(e.target.value); setLimit(100); }}>
            <option value="">All materials</option>
            {materials.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
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
