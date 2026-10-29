import { PRODUCTS, type CatalogEntry } from "./catalog";
import { KIND_LABELS } from "./products";
import { IKEA_ITEMS } from "@/data/ikea-items";

/**
 * Every piece in the data, grouped by kind of furniture then by family (the IKEA name).
 * Server only: it reads the article number index, which the browser never loads in full.
 */

export interface LibraryPiece {
  slug: string;
  name: string;
  variant: string;
  size: { w: number; h: number; d: number };
  articles: string[];
  checked: boolean;
}

export interface LibraryFamily {
  name: string;
  pieces: LibraryPiece[];
}

export interface LibraryKind {
  kind: string;
  label: string;
  count: number;
  families: LibraryFamily[];
}

const LABELS = new Map<string, string>(KIND_LABELS.map((k) => [k.kind, k.label]));

function articleIndex() {
  const map = new Map<string, string[]>();
  for (const line of IKEA_ITEMS.split("\n")) {
    const [slug, list] = line.split("|");
    if (slug && list) map.set(slug, list.split(" "));
  }
  return map;
}

/** 80275887 as IKEA prints it: 802.758.87 */
export function formatArticle(no: string) {
  return no.length === 8 ? `${no.slice(0, 3)}.${no.slice(3, 6)}.${no.slice(6)}` : no;
}

function build(): LibraryKind[] {
  const articles = articleIndex();
  const kinds = new Map<string, { entries: CatalogEntry[]; label: string }>();
  for (const e of PRODUCTS) {
    const kind = e.kind ?? "other";
    const g = kinds.get(kind) ?? { entries: [], label: LABELS.get(kind) ?? e.category };
    g.entries.push(e);
    kinds.set(kind, g);
  }
  const out: LibraryKind[] = [];
  for (const [kind, { entries, label }] of kinds) {
    const families = new Map<string, LibraryPiece[]>();
    for (const e of entries) {
      const list = families.get(e.family) ?? [];
      list.push({ slug: e.slug, name: e.name, variant: e.variant, size: e.size, articles: articles.get(e.slug) ?? [], checked: !!e.checked });
      families.set(e.family, list);
    }
    out.push({
      kind,
      label,
      count: entries.length,
      families: [...families.values()]
        .map((pieces) => ({ name: pieces[0].name, pieces: pieces.sort((a, b) => a.size.w * a.size.h - b.size.w * b.size.h || a.size.d - b.size.d) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

let cache: LibraryKind[] | null = null;

export function library(): LibraryKind[] {
  cache ??= build();
  return cache;
}

export function libraryKind(kind: string): LibraryKind | null {
  return library().find((k) => k.kind === kind) ?? null;
}
