import type { CustomPart, CustomStep } from "../types";
import { billyFrame, kallaxGrid } from "@/data/hacks/parts";
import { LIMITS, PART_ID, boundsMm, freeId, type HackDraft } from "./draft";

/**
 * Edits the editor makes to a draft. Each returns a new draft, or null when it would break one of the limits
 * an import is read with (./draft.ts LIMITS, checked in ./sanitize.ts): what the editor makes always reads back.
 * A part arrives in one step at most: moving it to a step takes it out of any other, so "added twice" can only
 * come from an imported file.
 */

/** Every centre within the bounds a part's position is read with. */
const inBounds = (parts: CustomPart[]) => parts.every((p) => p.pos.every((n) => Math.abs(n) <= LIMITS.pos));

const mapSteps = (d: HackDraft, f: (s: CustomStep, i: number) => CustomStep): HackDraft => ({ ...d, steps: d.steps.map(f) });

/** The step a part arrives in, or -1. */
export function stepOf(d: HackDraft, id: string): number {
  return d.steps.findIndex((s) => s.add?.includes(id));
}

export function setPartStep(d: HackDraft, id: string, step: number): HackDraft {
  return mapSteps(d, (s, i) => {
    const add = (s.add ?? []).filter((x) => x !== id);
    if (i === step) add.push(id);
    // no empty list: the file has none either, so the draft reads back as it is
    return { ...s, add: add.length ? add : undefined };
  });
}

/** A new id for a part, carried into every step that names it. */
export function renamePart(d: HackDraft, from: string, to: string): HackDraft {
  if (!PART_ID.test(to) || from === to || d.parts.some((p) => p.id === to)) return d;
  const swap = (ids?: string[]) => ids?.map((x) => (x === from ? to : x));
  return {
    ...mapSteps(d, (s) => ({ ...s, add: swap(s.add), fix: s.fix?.map((f) => ({ ...f, to: swap(f.to) })) })),
    parts: d.parts.map((p) => (p.id === from ? { ...p, id: to } : p)),
  };
}

export function removePart(d: HackDraft, id: string): HackDraft {
  const drop = (ids?: string[]) => ids?.filter((x) => x !== id);
  return {
    ...mapSteps(d, (s) => {
      const add = drop(s.add);
      return { ...s, add: add?.length ? add : undefined, fix: s.fix?.map((f) => ({ ...f, to: drop(f.to) })) };
    }),
    parts: d.parts.filter((p) => p.id !== id),
  };
}

export function updatePart(d: HackDraft, id: string, patch: Partial<CustomPart>): HackDraft {
  return { ...d, parts: d.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/** A new board, resting on top of everything there is, arriving in the last step. */
export function addPart(d: HackDraft): { draft: HackDraft; id: string } | null {
  if (d.parts.length >= LIMITS.parts) return null;
  const id = freeId(d.parts, "board");
  const { hi } = boundsMm(d.parts);
  const part: CustomPart = { id, name: "Board", size: [600, 18, 300], pos: [0, d.parts.length ? hi[1] + 9 : 9, 0], material: "board" };
  if (!inBounds([part])) return null;
  let next: HackDraft = { ...d, parts: [...d.parts, part] };
  if (!next.steps.length) next = { ...next, steps: [{ title: "Put it together" }] };
  return { draft: setPartStep(next, id, next.steps.length - 1), id };
}

export function duplicatePart(d: HackDraft, id: string): { draft: HackDraft; id: string } | null {
  const p = d.parts.find((x) => x.id === id);
  if (!p || d.parts.length >= LIMITS.parts) return null;
  const nid = freeId(d.parts, id.replace(/-\d+$/, ""));
  // beside it on the right, or on the left when that is past the edge
  const right: CustomPart = { ...p, id: nid, size: [...p.size], pos: [p.pos[0] + p.size[0] + 20, p.pos[1], p.pos[2]] };
  const left: CustomPart = { ...right, pos: [p.pos[0] - p.size[0] - 20, p.pos[1], p.pos[2]] };
  const copy = inBounds([right]) ? right : inBounds([left]) ? left : null;
  if (!copy) return null;
  const at = stepOf(d, id);
  const next = { ...d, parts: [...d.parts.slice(0, d.parts.indexOf(p) + 1), copy, ...d.parts.slice(d.parts.indexOf(p) + 1)] };
  return { draft: at >= 0 ? setPartStep(next, nid, at) : next, id: nid };
}

/** Parts and steps from a starter (a KALLAX grid, a BILLY frame), with ids made unique, set to the right of what is there. */
function append(d: HackDraft, parts: CustomPart[], steps: CustomStep[], stem: string): HackDraft | null {
  if (d.parts.length + parts.length > LIMITS.parts || d.steps.length + steps.length > LIMITS.steps) return null;
  const taken = new Set(d.parts.map((p) => p.id));
  let prefix = "";
  for (let i = 1; parts.some((p) => taken.has(prefix + p.id)); i++) prefix = `${stem}${i}-`;
  const re = (id: string) => prefix + id;
  const dx = d.parts.length ? boundsMm(d.parts).hi[0] - boundsMm(parts).lo[0] + 20 : 0;
  const moved = parts.map((p) => ({ ...p, id: re(p.id), pos: [p.pos[0] + dx, p.pos[1], p.pos[2]] as CustomPart["pos"] }));
  if (!inBounds(moved)) return null;
  return {
    ...d,
    parts: [...d.parts, ...moved],
    steps: [...d.steps, ...steps.map((s) => ({ ...s, add: s.add?.map(re), fix: s.fix?.map((f) => ({ ...f, to: f.to?.map(re) })) }))],
  };
}

export function addKallax(d: HackDraft, cols: number, rows: number): HackDraft | null {
  const g = kallaxGrid(Math.min(5, Math.max(1, Math.round(cols))), Math.min(5, Math.max(1, Math.round(rows))));
  return append(d, g.parts, g.steps, "kallax");
}

export function addBilly(d: HackDraft): HackDraft | null {
  const f = billyFrame("billy", 0);
  const steps: CustomStep[] = [
    { title: "Build the BILLY frame", detail: "Follow the BILLY manual for the frame, and leave the back in the box for now.", add: f.ids.frame, fix: [{ kind: "dowel", count: 8 }, { kind: "camScrew", count: 4 }], people: 2 },
    { title: "Fit the BILLY shelves", add: f.ids.shelves, fix: [{ kind: "pin", count: 16 }] },
    { title: "Nail on the BILLY back", detail: "Square the frame with the back panel as you nail it.", add: [f.back.id], fix: [{ kind: "nail", count: 18 }], tools: ["hammer"], warnings: ["square"] },
  ];
  return append(d, [...f.frame, ...f.shelves, f.back], steps, "billy");
}

export function addStep(d: HackDraft): HackDraft | null {
  if (d.steps.length >= LIMITS.steps) return null;
  return { ...d, steps: [...d.steps, { title: `Step ${d.steps.length + 1}` }] };
}

export function moveStep(d: HackDraft, i: number, by: -1 | 1): HackDraft {
  const j = i + by;
  if (j < 0 || j >= d.steps.length) return d;
  const steps = [...d.steps];
  [steps[i], steps[j]] = [steps[j], steps[i]];
  return { ...d, steps };
}

/** A copy of a step: same words and fittings, but no parts (each part arrives once). */
export function duplicateStep(d: HackDraft, i: number): HackDraft | null {
  if (d.steps.length >= LIMITS.steps) return null;
  const s = d.steps[i];
  const copy: CustomStep = JSON.parse(JSON.stringify({ ...s, add: undefined }));
  return { ...d, steps: [...d.steps.slice(0, i + 1), copy, ...d.steps.slice(i + 1)] };
}

export function removeStep(d: HackDraft, i: number): HackDraft {
  return { ...d, steps: d.steps.filter((_, j) => j !== i) };
}

export function updateStep(d: HackDraft, i: number, patch: Partial<CustomStep>): HackDraft {
  return mapSteps(d, (s, j) => (j === i ? { ...s, ...patch } : s));
}

/* ---------- the lists: never an empty name on a new entry, never past the limit ---------- */

export function addBase(d: HackDraft, item: HackDraft["base"][number] = { name: "IKEA piece", qty: 1 }): HackDraft | null {
  if (d.base.length >= LIMITS.base || !item.name.trim()) return null;
  return { ...d, base: [...d.base, { ...item, name: item.name.slice(0, LIMITS.variant) }] };
}

export function addBuy(d: HackDraft): HackDraft | null {
  if (d.buy.length >= LIMITS.buy) return null;
  return { ...d, buy: [...d.buy, { name: "Something to buy", qty: 1 }] };
}

/** A new line under "What you change" or "Watch out", empty until written (the guide leaves empty ones out). */
export function addLine(d: HackDraft, list: "mods" | "watchOut"): HackDraft | null {
  if (d[list].length >= (list === "mods" ? LIMITS.mods : LIMITS.watchOut)) return null;
  return { ...d, [list]: [...d[list], ""] };
}
