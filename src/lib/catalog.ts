import type { ProductSpec } from "./types";
import { ROWS, specFor, type Kind } from "./products";
import { fold } from "./fold";
import { decodeRows } from "./ikea";
import { IKEA_ROWS } from "@/data/ikea-rows";
import { HACKS } from "@/data/hacks";

type Entry = Omit<ProductSpec, "source" | "slug" | "variants" | "siblings"> & {
  slug: string;
  family: string;
  kind?: Kind;
  keywords?: string[];
  featured?: boolean;
  checked?: boolean;
  /** drawn later than the family's other pieces under IKEA's own name for it: comes after them in search */
  late?: boolean;
  /** sold in the US and not in the UK: comes after the family's UK pieces, even when the query has its US words */
  us?: boolean;
};

/** Hand-checked starting points for popular flat packs. Dimensions in cm. */
export const CATALOG: Entry[] = [
  {
    slug: "kallax-2x2",
    family: "kallax",
    featured: true,
    name: "KALLAX",
    variant: "Shelving unit, 2 × 2",
    category: "Shelving unit",
    archetype: "shelf",
    size: { w: 77, h: 77, d: 39 },
    minutes: 40,
    people: 1,
    difficulty: 1,
    material: "Particleboard",
    shelf: { style: "grid", cols: 2, rows: 2, outer: 40, inner: 16, back: false },
    keywords: ["2x2", "4 cube", "cube", "77x77"],
    tips: { frame: "The thick outer panels are hollow. Tap dowels in gently or they can split the edge." },
  },
  {
    slug: "kallax-2x4",
    family: "kallax",
    name: "KALLAX",
    variant: "Shelving unit, 2 × 4",
    category: "Shelving unit",
    archetype: "shelf",
    size: { w: 77, h: 147, d: 39 },
    minutes: 70,
    people: 2,
    difficulty: 2,
    shelf: { style: "grid", cols: 2, rows: 4, outer: 40, inner: 16, back: false },
    keywords: ["2x4", "4x2", "8 cube", "77x147"],
  },
  {
    slug: "kallax-4x4",
    family: "kallax",
    name: "KALLAX",
    variant: "Shelving unit, 4 × 4",
    category: "Shelving unit",
    archetype: "shelf",
    size: { w: 147, h: 147, d: 39 },
    minutes: 120,
    people: 2,
    difficulty: 2,
    shelf: { style: "grid", cols: 4, rows: 4, outer: 40, inner: 16, back: false },
    keywords: ["4x4", "16 cube", "147x147"],
  },
  {
    slug: "kallax-1x4",
    family: "kallax",
    name: "KALLAX",
    variant: "Shelving unit, 1 × 4",
    category: "Shelving unit",
    archetype: "shelf",
    size: { w: 42, h: 147, d: 39 },
    minutes: 45,
    people: 1,
    difficulty: 1,
    shelf: { style: "grid", cols: 1, rows: 4, outer: 40, inner: 16, back: false },
    keywords: ["1x4", "4x1", "42x147"],
  },
  {
    slug: "billy-80x202",
    family: "billy",
    featured: true,
    name: "BILLY",
    variant: "Bookcase, 80 × 202 cm",
    category: "Bookcase",
    archetype: "shelf",
    size: { w: 80, h: 202, d: 28 },
    minutes: 60,
    people: 2,
    difficulty: 2,
    material: "Particleboard, fibreboard back",
    shelf: { style: "bookcase", shelves: 4, fixedShelf: true, back: true, plinth: true, outer: 15 },
    keywords: ["80x202", "tall", "bookshelf"],
    tips: { back: "Keep the back panel square while nailing. It is what stops the bookcase from wobbling." },
  },
  {
    slug: "billy-40x202",
    family: "billy",
    name: "BILLY",
    variant: "Bookcase, 40 × 202 cm",
    category: "Bookcase",
    archetype: "shelf",
    size: { w: 40, h: 202, d: 28 },
    minutes: 45,
    people: 2,
    difficulty: 2,
    shelf: { style: "bookcase", shelves: 4, fixedShelf: true, back: true, plinth: true, outer: 15 },
    keywords: ["40x202", "narrow"],
  },
  {
    slug: "billy-80x106",
    family: "billy",
    name: "BILLY",
    variant: "Bookcase, 80 × 106 cm",
    category: "Bookcase",
    archetype: "shelf",
    size: { w: 80, h: 106, d: 28 },
    minutes: 35,
    people: 1,
    difficulty: 1,
    shelf: { style: "bookcase", shelves: 2, fixedShelf: false, back: true, plinth: true, outer: 15 },
    keywords: ["80x106", "low", "short"],
  },
  {
    slug: "malm-3-drawers",
    family: "malm",
    featured: true,
    name: "MALM",
    variant: "Chest of 3 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 80, h: 78, d: 48 },
    minutes: 90,
    people: 1,
    difficulty: 3,
    drawers: { cols: 1, rows: 3, knobs: "none", plinth: false, thickness: 16 },
    keywords: ["3 drawer", "three", "dresser", "chest"],
    tips: { drawers: "Build one drawer completely before starting the next. It is much easier to spot mistakes." },
  },
  {
    slug: "malm-6-drawers",
    family: "malm",
    name: "MALM",
    variant: "Chest of 6 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 160, h: 78, d: 48 },
    minutes: 180,
    people: 2,
    difficulty: 3,
    drawers: { cols: 2, rows: 3, knobs: "none", plinth: false, thickness: 16 },
    keywords: ["6 drawer", "six", "wide", "dresser"],
  },
  {
    slug: "malm-4-drawers",
    family: "malm",
    name: "MALM",
    variant: "Chest of 4 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 80, h: 100, d: 48 },
    minutes: 120,
    people: 1,
    difficulty: 3,
    drawers: { cols: 1, rows: 4, knobs: "none", plinth: false, thickness: 16 },
    keywords: ["4 drawer", "four", "tall dresser"],
  },
  {
    slug: "malm-2-drawers",
    family: "malm",
    name: "MALM",
    variant: "Chest of 2 drawers",
    category: "Nightstand",
    archetype: "drawers",
    size: { w: 40, h: 55, d: 48 },
    minutes: 45,
    people: 1,
    difficulty: 2,
    drawers: { cols: 1, rows: 2, knobs: "none", plinth: false, thickness: 16 },
    keywords: ["2 drawer", "two", "nightstand", "bedside"],
  },
  {
    slug: "malm-bed-160",
    family: "malm",
    name: "MALM",
    variant: "Bed frame, 160 × 200 cm",
    category: "Bed frame",
    archetype: "bed",
    size: { w: 176, h: 100, d: 209 },
    minutes: 120,
    people: 2,
    difficulty: 2,
    bed: { mattressW: 160, mattressL: 200, headH: 100, footH: 38, slats: 17, centerBeam: true },
    keywords: ["bed", "queen", "double", "160"],
  },
  {
    slug: "hemnes-3-drawers",
    family: "hemnes",
    name: "HEMNES",
    variant: "Chest of 3 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 108, h: 96, d: 50 },
    minutes: 150,
    people: 1,
    difficulty: 3,
    material: "Solid pine",
    drawers: { cols: 1, rows: 3, knobs: "knob", plinth: true, thickness: 20 },
    keywords: ["3 drawer", "dresser", "chest"],
  },
  {
    slug: "rast-3-drawers",
    family: "rast",
    name: "RAST",
    variant: "Chest of 3 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 62, h: 70, d: 30 },
    minutes: 45,
    people: 1,
    difficulty: 2,
    material: "Solid pine",
    drawers: { cols: 1, rows: 3, knobs: "knob", plinth: false, thickness: 18 },
    keywords: ["3 drawer", "pine"],
  },
  {
    slug: "kullen-3-drawers",
    family: "kullen",
    name: "KULLEN",
    variant: "Chest of 3 drawers",
    category: "Chest of drawers",
    archetype: "drawers",
    size: { w: 70, h: 72, d: 40 },
    minutes: 60,
    people: 1,
    difficulty: 2,
    drawers: { cols: 1, rows: 3, knobs: "knob", plinth: false, thickness: 15 },
    keywords: ["3 drawer"],
  },
  {
    slug: "alex-drawer-unit",
    family: "alex",
    name: "ALEX",
    variant: "Drawer unit, 5 drawers",
    category: "Drawer unit",
    archetype: "drawers",
    size: { w: 36, h: 70, d: 58 },
    minutes: 60,
    people: 1,
    difficulty: 2,
    drawers: { cols: 1, rows: 5, knobs: "none", plinth: false, thickness: 16 },
    keywords: ["5 drawer", "desk drawers"],
  },
  {
    slug: "lack-side-table",
    family: "lack",
    featured: true,
    name: "LACK",
    variant: "Side table, 55 × 55 cm",
    category: "Side table",
    archetype: "table",
    size: { w: 55, h: 45, d: 55 },
    minutes: 10,
    people: 1,
    difficulty: 1,
    material: "Particleboard, honeycomb paper filling",
    table: { topThickness: 50, legs: "square", legSize: 50, shelf: false, attach: "screw" },
    keywords: ["side table", "end table", "55x55"],
  },
  {
    slug: "lack-coffee-table",
    family: "lack",
    name: "LACK",
    variant: "Coffee table, 118 × 78 cm",
    category: "Coffee table",
    archetype: "table",
    size: { w: 118, h: 45, d: 78 },
    minutes: 20,
    people: 1,
    difficulty: 1,
    table: { topThickness: 50, legs: "square", legSize: 50, shelf: true, attach: "screw" },
    keywords: ["coffee table", "118"],
  },
  {
    slug: "lack-tv-bench",
    family: "lack",
    name: "LACK",
    variant: "TV bench, 90 × 26 cm",
    category: "TV bench",
    archetype: "table",
    size: { w: 90, h: 45, d: 26 },
    minutes: 15,
    people: 1,
    difficulty: 1,
    table: { topThickness: 50, legs: "square", legSize: 50, shelf: true, attach: "screw" },
    keywords: ["tv", "bench", "media"],
  },
  {
    slug: "linnmon-adils-desk",
    family: "linnmon",
    featured: true,
    name: "LINNMON / ADILS",
    variant: "Desk, 100 × 60 cm",
    category: "Desk",
    archetype: "table",
    size: { w: 100, h: 74, d: 60 },
    minutes: 15,
    people: 1,
    difficulty: 1,
    table: { topThickness: 34, legs: "round", legSize: 34, shelf: false, attach: "plate" },
    keywords: ["desk", "adils", "table top", "100x60"],
  },
  {
    slug: "melltorp-table",
    family: "melltorp",
    name: "MELLTORP",
    variant: "Table, 125 × 75 cm",
    category: "Dining table",
    archetype: "table",
    size: { w: 125, h: 74, d: 75 },
    minutes: 30,
    people: 2,
    difficulty: 2,
    table: { topThickness: 22, legs: "square", legSize: 45, shelf: false, attach: "apron" },
    keywords: ["dining", "kitchen table"],
  },
  {
    slug: "brimnes-wardrobe",
    family: "brimnes",
    name: "BRIMNES",
    variant: "Wardrobe with 2 doors",
    category: "Wardrobe",
    archetype: "cabinet",
    size: { w: 78, h: 190, d: 50 },
    minutes: 120,
    people: 2,
    difficulty: 3,
    cabinet: { doors: 2, shelves: 1, rail: true, plinth: true, handles: "knob", thickness: 18 },
    keywords: ["wardrobe", "closet", "armoire"],
  },
  {
    slug: "pax-frame",
    family: "pax",
    name: "PAX",
    variant: "Wardrobe frame, 100 × 201 cm",
    category: "Wardrobe frame",
    archetype: "cabinet",
    size: { w: 100, h: 201, d: 58 },
    minutes: 90,
    people: 2,
    difficulty: 3,
    cabinet: { doors: 0, shelves: 2, rail: true, plinth: true, handles: "none", thickness: 18 },
    keywords: ["wardrobe", "frame", "closet", "201"],
    tips: { anchor: "PAX must be fixed to the wall. Its frame is tall and narrow front to back." },
  },
  {
    slug: "eket-cabinet",
    family: "eket",
    name: "EKET",
    variant: "Cabinet with door, 35 × 35 cm",
    category: "Cabinet",
    archetype: "cabinet",
    size: { w: 35, h: 35, d: 35 },
    minutes: 20,
    people: 1,
    difficulty: 1,
    cabinet: { doors: 1, shelves: 0, rail: false, plinth: false, handles: "none", thickness: 16 },
    keywords: ["cube", "small cabinet"],
  },
  {
    slug: "frosta-stool",
    family: "frosta",
    name: "FROSTA",
    variant: "Stool",
    category: "Stool",
    archetype: "seat",
    size: { w: 35, h: 45, d: 35 },
    minutes: 10,
    people: 1,
    difficulty: 1,
    seat: { kind: "stool", seat: "round", seatH: 45, splay: true },
    keywords: ["stool"],
  },
  {
    slug: "marius-stool",
    family: "marius",
    name: "MARIUS",
    variant: "Stool",
    category: "Stool",
    archetype: "seat",
    size: { w: 32, h: 45, d: 32 },
    minutes: 10,
    people: 1,
    difficulty: 1,
    seat: { kind: "stool", seat: "round", seatH: 45, splay: true, stretchers: true },
    keywords: ["stool", "metal"],
  },
  {
    slug: "ingolf-chair",
    family: "ingolf",
    name: "INGOLF",
    variant: "Chair",
    category: "Chair",
    archetype: "seat",
    size: { w: 43, h: 91, d: 52 },
    minutes: 30,
    people: 1,
    difficulty: 2,
    seat: { kind: "chair", seat: "square", seatH: 45, backH: 91 },
    keywords: ["chair", "dining chair"],
  },
];

/** The slug a name and variant give before any "-2" suffix. Existing slugs depend on this staying the same. */
export function baseSlug(name: string, variant: string) {
  return (fold(name) + " " + fold(variant).replace(/\b(cm|with|of)\b/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-")
    .slice(0, 48)
    .replace(/-+$/, "");
}

function rowSlug(name: string, variant: string, used: Set<string>) {
  const base = baseSlug(name, variant);
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

const used = new Set(CATALOG.map((c) => c.slug));
const GENERATED: Entry[] = ROWS.map(([name, kind, variant, w, h, d, x, kw]) => ({
  ...specFor(kind, name, variant, w, h, d, x),
  slug: rowSlug(name, variant, used),
  family: fold(name),
  kind,
  keywords: kw ? kw.split(" ") : undefined,
}));

/** The hand made part of the catalog. Its slugs never change: people have progress saved under them. */
/** What kind of furniture each hand-checked entry is, for grouping (its archetype params stay as written). */
const CATEGORY_KIND: Record<string, Kind> = {
  "Shelving unit": "cube", Bookcase: "bookcase", "Chest of drawers": "chest", Nightstand: "nightstand", "Drawer unit": "chest", "Bed frame": "bed",
  "Side table": "side", "Coffee table": "coffee", Desk: "desk", "Dining table": "dining", Wardrobe: "wardrobe", "Wardrobe frame": "wardrobe",
  Cabinet: "cabinet", Stool: "stool", Chair: "chair", "TV bench": "tv",
};

export const BASE: Entry[] = [...CATALOG.map((c) => ({ ...c, checked: true, kind: CATEGORY_KIND[c.category] })), ...GENERATED];

/** Rows generated from IKEA's product data (scripts/ikea/build.ts). Hand made entries always win. */
const IKEA: Entry[] = [];
for (const r of decodeRows(IKEA_ROWS)) {
  const slug = r.slug ?? baseSlug(r.name, r.variant);
  if (used.has(slug)) continue;
  used.add(slug);
  IKEA.push({ ...specFor(r.kind, r.name, r.variant, r.w, r.h, r.d, r.x), slug, family: fold(r.name), kind: r.kind, keywords: r.keywords, ...(r.x.us ? { us: true } : r.x.cat ? { late: true } : {}) });
}

/** Every product we can draw offline: hand-checked entries first, then the wider index, then IKEA's catalog. */
export const PRODUCTS: Entry[] = [...BASE, ...IKEA];

const BY_SLUG = new Map(PRODUCTS.map((e) => [e.slug, e]));
const BY_FAMILY = new Map<string, Entry[]>();
for (const e of PRODUCTS) {
  const list = BY_FAMILY.get(e.family);
  if (list) list.push(e);
  else BY_FAMILY.set(e.family, [e]);
}

export function catalogEntry(slug: string): Entry | null {
  return BY_SLUG.get(slug) ?? null;
}

const HACK_BY_SLUG = new Map(HACKS.map((h) => [h.slug!, h]));

export function catalogSpec(slug: string): ProductSpec | null {
  const hack = HACK_BY_SLUG.get(slug);
  if (hack) return hack;
  const e = BY_SLUG.get(slug);
  if (!e) return null;
  return toSpec(e);
}

/** One way of naming sizes per family: grids as columns × rows, shelves and cabinets as width × height (and depth when two share those). */
function sizeLabel(x: Entry, same: Entry[]) {
  const head = x.variant.split(",")[0];
  if (x.shelf?.style === "grid" && x.shelf.cols && x.shelf.rows) return `${head}, ${x.shelf.cols} × ${x.shelf.rows}`;
  // a corner cabinet or wardrobe goes by IKEA's own measure, leg by leg
  if (x.cabinet?.corner || x.kind === "cornerrobe") return x.variant;
  if ((x.archetype === "shelf" || x.archetype === "cabinet") && /\d+ × \d+/.test(x.variant)) {
    const twin = same.some((o) => o !== x && o.size.w === x.size.w && o.size.h === x.size.h);
    return `${head}, ${x.size.w} × ${x.size.h} cm${twin ? `, ${x.size.d} deep` : ""}`;
  }
  return x.variant;
}

export function toSpec(e: Entry): ProductSpec {
  const { family, kind, keywords, featured, checked, late, us, ...rest } = e;
  void late;
  void us;
  void kind;
  void keywords;
  void featured;
  void checked;
  const kin = BY_FAMILY.get(family) ?? [e];
  const same = kin.filter((x) => x.category === e.category);
  // smallest first, and a cube grid always reads as columns × rows, like the labels on the box
  const variants = [...same]
    .sort((a, b) => a.size.w * a.size.h - b.size.w * b.size.h || a.size.d - b.size.d)
    .map((x) => ({ label: sizeLabel(x, same), slug: x.slug }))
    .filter((v, i, all) => all.findIndex((o) => o.label === v.label) === i || v.slug === e.slug);
  const seen = new Set<string>([e.category]);
  const siblings: { label: string; slug: string }[] = [];
  for (const x of kin) {
    if (seen.has(x.category)) continue;
    seen.add(x.category);
    siblings.push({ label: x.category, slug: x.slug });
  }
  return { ...rest, source: "catalog", variants: variants.length > 1 ? variants : undefined, siblings: siblings.length ? siblings : undefined };
}

export type CatalogEntry = Entry;
