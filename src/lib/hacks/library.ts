import type { CustomPart, CustomStep, PartMaterial, PartType, Vec3 } from "../types";
import { catalogSpec } from "../catalog";
import { buildPlan } from "../plan";
import { LIMITS } from "./draft";

/**
 * Library pieces as material for a build: a whole piece of furniture as the parts it is made of, standing where
 * they stand when it is finished, or one part of it on its own (a side panel, a shelf, a leg). Both come from the
 * same generated plans as the library pages. They follow the library's approximate drawings, not IKEA's data.
 */

type M = number[][];
const rx = (a: number): M => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const ry = (a: number): M => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const rz = (a: number): M => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const mul = (a: M, b: M): M => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
/** Euler angles in the order three.js turns them: X, then Y, then Z. */
const euler = ([x, y, z]: Vec3): M => mul(rx(x), mul(ry(y), rz(z)));
const apply = (m: M, v: Vec3): Vec3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec3;
/** The box that holds a box once turned: exact for quarter turns, which is what these pieces use. */
const reach = (m: M, v: Vec3): Vec3 => [0, 1, 2].map((i) => Math.abs(m[i][0]) * v[0] + Math.abs(m[i][1]) * v[1] + Math.abs(m[i][2]) * v[2]) as Vec3;

const round = (n: number) => Math.round(n * 10) / 10;
const slim = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "").toLowerCase().slice(0, 8) || "piece";

export interface Furniture {
  slug: string;
  /** "BILLY bookcase, 80 × 202 cm", as the list of what a build starts from names it. */
  label: string;
  /** "BILLY", for part names and the list of what it starts from. */
  short: string;
  name: string;
  /** cm, as the library draws it. */
  size: { w: number; h: number; d: number };
  parts: CustomPart[];
  steps: CustomStep[];
}

/** One part a piece is made of, to pick on its own. */
export interface LibraryPart {
  ref: string;
  label: string;
  name: string;
  size: Vec3;
  shape: "box" | "cyl";
  material: PartMaterial;
  qty: number;
}

const shortName = (name: string) => name.split(/\s+/)[0] || name;

/**
 * A piece of furniture as parts, centred on x = 0 and z = 0 with its feet on the floor, each id starting with `stem`.
 * A piece too big to keep as parts (the limits of a hack) stays a single block of its overall size.
 */
export function furniture(slug: string, stem?: string): Furniture | null {
  const spec = catalogSpec(slug);
  if (!spec) return null;
  let plan;
  try {
    plan = buildPlan(spec);
  } catch {
    return null;
  }
  const short = shortName(spec.name);
  const pre = `${stem ?? slim(short)}-`;
  const kinds = new Map<string, PartType>(plan.parts.map((p) => [p.id, p]));
  const parts: CustomPart[] = [];
  const seen = new Map<string, number>();
  for (const it of plan.items) {
    if (it.kind !== "part") continue;
    const t = kinds.get(it.ref);
    if (!t || t.extra) continue;
    const n = (seen.get(it.ref) ?? 0) + 1;
    seen.set(it.ref, n);
    const turn = euler(it.final.rot);
    // a part made of boxes and rods becomes those boxes and rods, each placed through the part's own turn
    const pieces = t.pieces?.length ? t.pieces : [{ shape: t.shape, size: t.size, pos: [0, 0, 0] as Vec3, rot: undefined, material: t.material }];
    pieces.forEach((pc, k) => {
      const m = mul(turn, euler(pc.rot ?? [0, 0, 0]));
      const c = apply(turn, pc.pos);
      parts.push({
        id: `${pre}${it.ref}-${n}${pieces.length > 1 ? `-${k + 1}` : ""}`.slice(0, LIMITS.id),
        label: pieces.length > 1 ? undefined : t.label.slice(0, LIMITS.label),
        name: `${short}: ${t.name}`.slice(0, LIMITS.partName),
        size: reach(m, pc.size).map(round) as Vec3,
        pos: [it.final.pos[0] + c[0], it.final.pos[1] + c[1], it.final.pos[2] + c[2]].map(round) as Vec3,
        shape: pc.shape === "cyl" ? "cyl" : "box",
        material: pc.material ?? t.material,
      });
    });
  }
  const whole = parts.length === 0 || parts.length > LIMITS.parts - 1 || parts.some((p) => p.size.some((n) => !(n >= LIMITS.size[0] && n <= LIMITS.size[1])));
  const block: CustomPart[] = [{ id: `${pre}block`, name: `${spec.name}`.slice(0, LIMITS.partName), size: [spec.size.w, spec.size.h, spec.size.d].map((cm) => Math.round(cm * 10)) as Vec3, pos: [0, spec.size.h * 5, 0], material: "board" }];
  const out = whole ? block : parts;
  // feet on the floor, centred
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of out)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2);
      hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2);
    }
  const shift: Vec3 = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
  const placed = out.map((p) => ({ ...p, pos: p.pos.map((n, k) => round(n + shift[k])) as Vec3 }));
  return {
    slug,
    label: `${spec.name} ${spec.variant.charAt(0).toLowerCase()}${spec.variant.slice(1)}${/\bcm\b/.test(spec.variant) ? "" : `, ${spec.size.w} × ${spec.size.h} cm`}`.slice(0, LIMITS.variant),
    short,
    name: spec.name,
    size: { w: round((hi[0] - lo[0]) / 10), h: round((hi[1] - lo[1]) / 10), d: round((hi[2] - lo[2]) / 10) },
    parts: placed,
    steps: [{ title: `Bring in the ${spec.name}`.slice(0, LIMITS.title), detail: "Built as its own guide says, then put where it stands in the build.", add: placed.map((p) => p.id) }],
  };
}

/** A stem for the ids of a piece's parts that no part in `ids` starts with yet: "billy1", "billy2"... */
export function freeStem(slug: string, ids: string[]): string | null {
  const spec = catalogSpec(slug);
  if (!spec) return null;
  const s = slim(shortName(spec.name));
  for (let i = 1; i < 100; i++) if (!ids.some((id) => id.startsWith(`${s}${i}-`))) return `${s}${i}`;
  return null;
}

/** The parts a piece is made of, one line each, to pick from. */
export function libraryParts(slug: string): LibraryPart[] {
  const spec = catalogSpec(slug);
  if (!spec) return [];
  try {
    return buildPlan(spec)
      .parts.filter((p) => !p.extra)
      .map((p) => ({ ref: p.id, label: p.label, name: p.name, size: p.size, shape: p.shape, material: p.material, qty: p.qty }));
  } catch {
    return [];
  }
}
