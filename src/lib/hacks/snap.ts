import type { CustomPart, Vec3 } from "../types";
import { boxOf } from "../plan/custom";

/** A line the workspace draws while a drag is held to it: an axis (0 x, 1 y, 2 z) and where, in mm. */
export interface Guide {
  axis: 0 | 1 | 2;
  at: number;
}

export interface SnapOptions {
  /** mm; 0 leaves the grid off */
  grid: number;
  /** mm, how close counts as touching */
  reach: number;
  /** whether to hold to other parts' faces and middles */
  parts: boolean;
}

export const SNAP: SnapOptions = { grid: 10, reach: 15, parts: true };

/**
 * Takes a move of some parts (by `delta`, mm) and returns the nearest one that lines up: on the floor, flush with
 * another part's face or middle, or on the grid. Each axis snaps on its own.
 */
export function snapMove(parts: CustomPart[], moving: string[], delta: Vec3, opts: SnapOptions = SNAP): { delta: Vec3; guides: Guide[] } {
  const set = new Set(moving);
  const mine = parts.filter((p) => set.has(p.id)).map((p) => boxOf(p));
  const rest = parts.filter((p) => !set.has(p.id)).map((p) => boxOf(p));
  if (!mine.length) return { delta, guides: [] };
  const lo: Vec3 = [0, 1, 2].map((k) => Math.min(...mine.map((b) => b.min[k]))) as Vec3;
  const hi: Vec3 = [0, 1, 2].map((k) => Math.max(...mine.map((b) => b.max[k]))) as Vec3;
  const out: Vec3 = [...delta];
  const guides: Guide[] = [];
  for (const k of [0, 1, 2] as const) {
    const edges = [lo[k] + delta[k], (lo[k] + hi[k]) / 2 + delta[k], hi[k] + delta[k]];
    let best: { shift: number; at: number } | null = null;
    const offer = (target: number, only = edges) => {
      for (const e of only) {
        const shift = target - e;
        if (Math.abs(shift) <= opts.reach && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, at: target };
      }
    };
    // the floor holds the underside only, never a middle or the top
    if (k === 1) offer(0, [edges[0]]);
    if (opts.parts) for (const b of rest) for (const t of [b.min[k], (b.min[k] + b.max[k]) / 2, b.max[k]]) offer(t);
    if (best) {
      const hit: { shift: number; at: number } = best;
      out[k] = delta[k] + hit.shift;
      guides.push({ axis: k, at: hit.at });
    } else if (opts.grid > 0) {
      const snapped = Math.round((lo[k] + delta[k]) / opts.grid) * opts.grid;
      out[k] = delta[k] + (snapped - (lo[k] + delta[k]));
    }
  }
  return { delta: out, guides };
}
