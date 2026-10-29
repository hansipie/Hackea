import type { CustomFix, CustomPart, CustomStep, HackMeta, HwKind, PartMaterial, Pose, ProductSpec, ToolId, WarnId } from "../types";

/**
 * A hack someone makes in the editor (/hacks/new). It holds what a curated hack in src/data/hacks says,
 * minus what the editor works out itself: the overall size comes from the parts, the slug from the id.
 * Parts are in mm, y up from the floor, x left to right, z back to front, like every custom spec.
 */
export interface HackDraft {
  name: string;
  variant: string;
  category: string;
  summary: string;
  minutes: number;
  people: 1 | 2;
  difficulty: 1 | 2 | 3;
  base: HackMeta["base"];
  buy: HackMeta["buy"];
  mods: string[];
  watchOut: string[];
  parts: CustomPart[];
  steps: CustomStep[];
}

/** Bounds for everything a draft holds. Imported files and share links are checked against them. */
export const LIMITS = {
  name: 60,
  variant: 80,
  category: 40,
  summary: 300,
  line: 200, // a modification, a note, a watch-out
  title: 80,
  detail: 400,
  partName: 40,
  label: 3,
  id: 32,
  base: 8,
  buy: 20,
  mods: 12,
  watchOut: 6,
  parts: 120,
  steps: 40, // the engine follows 40 steps at most
  fixes: 6, // fittings per step the engine places
  fixCount: 48,
  targets: 20, // parts a fitting is narrowed to
  warnings: 3, // per step, as the guide shows them
  dia: [1, 60], // mm, a fitting's diameter
  qty: 50,
  minutes: [5, 1440],
  size: [1, 4000], // mm, each side of a part
  pos: 6000, // mm, how far a part's centre sits from the origin
  len: [3, 400], // mm, a screw or bolt
} as const;

export const MATERIALS: { id: PartMaterial; label: string }[] = [
  { id: "board", label: "Board" },
  { id: "fiber", label: "Fibreboard" },
  { id: "wood", label: "Solid wood" },
  { id: "metal", label: "Metal" },
  { id: "soft", label: "Soft (cushion)" },
];

/** The fittings the hack engine (src/lib/plan/custom.ts) knows where to put. */
export const FIX_KINDS: { id: HwKind; label: string; hint: string }[] = [
  { id: "dowel", label: "Wooden dowel", hint: "Into the joint between two parts" },
  { id: "camScrew", label: "Cam bolt", hint: "Screwed into a face, before the cam" },
  { id: "cam", label: "Cam lock", hint: "Locks a cam bolt in the edge of a panel" },
  { id: "screw", label: "Screw", hint: "Through the thinner part into the other" },
  { id: "nail", label: "Nail", hint: "Through the thinner part (a back panel)" },
  { id: "bolt", label: "Allen bolt", hint: "Through the thinner part into the other" },
  { id: "pin", label: "Shelf pin", hint: "Under a shelf, into the side it rests on" },
  { id: "legScrew", label: "Leg bolt", hint: "A leg screwed into the part above" },
  { id: "plate", label: "Leg plate", hint: "On the part a leg screws into" },
  { id: "hinge", label: "Hinge", hint: "On a door, where it meets the frame" },
  { id: "knob", label: "Knob", hint: "On a front" },
  { id: "handle", label: "Handle", hint: "On a front" },
  { id: "glide", label: "Felt pad", hint: "Under the corners" },
  { id: "bracket", label: "Wall bracket", hint: "On the top part, against the wall" },
];

export const TOOLS: ToolId[] = ["screwdriver", "allen", "flathead", "hammer", "drill", "level", "tape", "pencil", "wrench", "knife"];
export const WARNINGS: WarnId[] = ["two", "loose", "hand", "wall", "square", "floor", "face", "tip"];
export const POSES: { id: Pose; label: string }[] = [
  { id: "+y", label: "Standing up" },
  { id: "-y", label: "Upside down" },
  { id: "+z", label: "On its back" },
  { id: "-z", label: "Face down" },
  { id: "+x", label: "On its left side" },
  { id: "-x", label: "On its right side" },
];

/** Overall size in mm of a set of parts, or zeros when there are none. */
export function boundsMm(parts: CustomPart[]): { lo: [number, number, number]; hi: [number, number, number]; size: [number, number, number] } {
  if (!parts.length) return { lo: [0, 0, 0], hi: [0, 0, 0], size: [0, 0, 0] };
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2);
      hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2);
    }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

/** The slug of a hack made in the editor: the guide viewer treats `mine-` like `scan-`, a guide that lives in the browser. */
export const MINE = "mine-";
export const mineSlug = (id: string) => MINE + id;
export const mineId = (slug: string) => (slug.startsWith(MINE) ? slug.slice(MINE.length) : null);
export const ID_RE = /^[a-z0-9]{6,16}$/;
/** A part's own id, the one steps refer to it by. */
export const PART_ID = /^[A-Za-z0-9_-]{1,32}$/;

export function newHackId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** The spec the guide viewer and the engine read. The size is always the parts' own bounds, never typed. */
export function draftToSpec(id: string, d: HackDraft): ProductSpec {
  const [w, h, dd] = boundsMm(d.parts).size;
  const cm = (mm: number) => Math.round(mm) / 10;
  return {
    slug: mineSlug(id),
    name: d.name || "Untitled hack",
    variant: d.variant || "Your own hack",
    category: d.category || "Hack",
    archetype: "custom",
    size: { w: cm(w), h: cm(h), d: cm(dd) },
    minutes: d.minutes,
    people: d.people,
    difficulty: d.difficulty,
    source: "mine",
    // a line just added and not written yet stays out of the guide
    watchOut: d.watchOut.some(Boolean) ? d.watchOut.filter(Boolean) : undefined,
    hack: { summary: d.summary, base: clone(d.base), buy: clone(d.buy), mods: d.mods.filter(Boolean) },
    custom: { parts: clone(d.parts), steps: clone(d.steps).map((s) => (s.fix ? { ...s, fix: s.fix.map((f) => (f.to && !f.to.length ? { ...f, to: undefined } : f)) } : s)) },
  };
}

/** A curated hack (or a shared one) as a draft to edit. */
export function specToDraft(s: ProductSpec): HackDraft {
  return {
    name: s.name,
    variant: s.variant,
    category: s.category,
    summary: s.hack?.summary ?? "",
    minutes: s.minutes,
    people: s.people,
    difficulty: s.difficulty,
    base: clone(s.hack?.base ?? []),
    buy: clone(s.hack?.buy ?? []),
    mods: [...(s.hack?.mods ?? [])],
    watchOut: [...(s.watchOut ?? [])],
    parts: clone(s.custom?.parts ?? []),
    steps: clone(s.custom?.steps ?? []),
  };
}

/** A part id not used yet, from a readable stem ("shelf", "shelf-2", ...). */
export function freeId(parts: CustomPart[], stem = "part"): string {
  const base = stem.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, LIMITS.id - 4) || "part";
  const used = new Set(parts.map((p) => p.id));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const emptyFix = (): CustomFix => ({ kind: "screw", count: 4 });
