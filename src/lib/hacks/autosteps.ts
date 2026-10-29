import type { CustomFix, CustomPart, CustomStep } from "../types";
import { boxOf } from "../plan/custom";
import { LIMITS, type HackDraft } from "./draft";
import { groupsOf } from "./edit";

/**
 * The assembly steps of a build placed in the workspace, worked out from where the parts are. A piece from the
 * library keeps the steps it came with (they say how that piece goes together); every loose part (a board or a
 * block put there by hand) gets one: parts are brought in from the underside up, each layer is one step, and a
 * layer that touches what is already there is held with fittings fit for its material.
 */

/** Parts whose undersides are this close (mm) arrive together. */
const LAYER = 20;
/** Faces this close (mm) are touching, as the plan engine reads them. */
const TOUCH = 4;
/** Longer than this (mm), a part wants two people. */
const BIG = 1800;

type Box = ReturnType<typeof boxOf>;

function touches(a: Box, b: Box): boolean {
  const ov = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
  return [0, 1, 2].some((k) => Math.abs(ov[k]) <= TOUCH && [0, 1, 2].filter((j) => j !== k).every((j) => ov[j] > 2));
}

function fittingsFor(fresh: CustomPart[], held: number): CustomFix[] {
  if (!held) return [];
  const to = fresh.map((p) => p.id).slice(0, LIMITS.targets);
  const count = Math.min(LIMITS.fixCount, Math.max(2, held * 2));
  const board = fresh.filter((p) => !p.material || p.material === "board" || p.material === "fiber");
  // boards are doweled and screwed, anything else is only screwed
  return board.length === fresh.length ? [{ kind: "dowel", count, to }, { kind: "screw", count: Math.max(2, held), to }] : [{ kind: "screw", count, to }];
}

function title(fresh: CustomPart[]): string {
  const names = [...new Set(fresh.map((p) => p.name.toLowerCase()))];
  const text = fresh.length === 1 ? `Add the ${names[0]}` : names.length <= 2 ? `Add the ${names.join(" and the ")}` : `Add ${fresh.length} parts`;
  return text.slice(0, LIMITS.title);
}

export function autoSteps(d: HackDraft): HackDraft {
  if (!d.parts.length) return { ...d, steps: [] };
  const pieces = new Set(groupsOf(d).flatMap((g) => g.ids));
  // what a library piece came with, as long as it brings in only parts of pieces
  const kept = d.steps.filter((s) => s.add?.length && s.add.every((id) => pieces.has(id)) || (!s.add?.length && s.fix?.length && s.fix.every((f) => f.to?.every((id) => pieces.has(id)) ?? false)));
  const placed = new Set(kept.flatMap((s) => s.add ?? []));
  const loose = d.parts.filter((p) => !placed.has(p.id));
  const by = new Map(d.parts.map((p) => [p.id, boxOf(p)]));
  const order = [...loose].sort((a, b) => by.get(a.id)!.min[1] - by.get(b.id)!.min[1] || by.get(a.id)!.min[0] - by.get(b.id)!.min[0]);
  const layers: CustomPart[][] = [];
  for (const p of order) {
    const last = layers[layers.length - 1];
    if (last && by.get(p.id)!.min[1] - by.get(last[0].id)!.min[1] <= LAYER) last.push(p);
    else layers.push([p]);
  }
  const room = Math.max(0, LIMITS.steps - kept.length);
  // more layers than steps left: the last step takes the rest
  const grouped = layers.length > room ? [...layers.slice(0, Math.max(0, room - 1)), layers.slice(Math.max(0, room - 1)).flat()].filter((l) => l.length) : layers;
  const there = new Set(placed);
  const steps: CustomStep[] = [...kept];
  for (const fresh of grouped) {
    const held = fresh.filter((f) => [...there].some((id) => touches(by.get(f.id)!, by.get(id)!))).length;
    const step: CustomStep = { title: title(fresh), add: fresh.map((p) => p.id).slice(0, LIMITS.parts) };
    const fix = fittingsFor(fresh, held);
    if (fix.length) step.fix = fix;
    if (fresh.some((p) => Math.max(...p.size) > BIG)) step.people = 2;
    steps.push(step);
    for (const p of fresh) there.add(p.id);
  }
  return { ...d, steps };
}
