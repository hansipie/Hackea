import type { CustomPart, CustomStep, Vec3 } from "../types";
import { billyFrame, kallaxGrid } from "@/data/hacks/parts";
import { LIMITS, PART_ID, boundsMm, freeId, type HackDraft, type PartGroup } from "./draft";
import { freeStem, furniture, libraryParts } from "./library";

/**
 * Edits the editor makes to a draft. Each returns a new draft, or null when it would break one of the limits
 * an import is read with (./draft.ts LIMITS, checked in ./sanitize.ts): what the editor makes always reads back.
 * A part arrives in one step at most: moving it to a step takes it out of any other, so "added twice" can only
 * come from an imported file.
 */

/** Every centre within the bounds a part's position is read with. */
const inBounds = (parts: CustomPart[]) => parts.every((p) => p.pos.every((n) => Math.abs(n) <= LIMITS.pos));

const mapSteps = (d: HackDraft, f: (s: CustomStep, i: number) => CustomStep): HackDraft => ({ ...d, steps: d.steps.map(f) });

/** A group of one part is no group: it goes. */
const tidy = (groups: PartGroup[]) => groups.filter((g) => g.ids.length > 1);

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
    ...(d.groups && { groups: d.groups.map((g) => ({ ...g, ids: swap(g.ids)! })) }),
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
    ...(d.groups && { groups: tidy(d.groups.map((g) => ({ ...g, ids: g.ids.filter((x) => x !== id) }))) }),
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

/** Where a new piece goes: to the right of what is there, or standing on top of it. */
export type Place = "beside" | "on-top";

/** Parts and steps from a starter (a KALLAX grid, a BILLY frame), with ids made unique, set to the right of what is there. */
function append(d: HackDraft, parts: CustomPart[], steps: CustomStep[], stem: string, at: Place = "beside"): HackDraft | null {
  if (d.parts.length + parts.length > LIMITS.parts || d.steps.length + steps.length > LIMITS.steps) return null;
  const taken = new Set(d.parts.map((p) => p.id));
  let prefix = "";
  for (let i = 1; parts.some((p) => taken.has(prefix + p.id)); i++) prefix = `${stem}${i}-`;
  const re = (id: string) => prefix + id;
  const there = boundsMm(d.parts);
  const here = boundsMm(parts);
  let dx = 0;
  let dy = 0;
  if (d.parts.length && at === "on-top") {
    // centred over what is there, resting on its top
    dx = (there.lo[0] + there.hi[0]) / 2 - (here.lo[0] + here.hi[0]) / 2;
    dy = there.hi[1] - here.lo[1];
  } else if (d.parts.length) dx = there.hi[0] - here.lo[0] + 20;
  const moved = parts.map((p) => ({ ...p, id: re(p.id), pos: [p.pos[0] + dx, p.pos[1] + dy, p.pos[2]] as CustomPart["pos"] }));
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

/* ---------- pieces from the library ---------- */

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** One more of something in "Started from": counted, not listed twice. */
function withBase(d: HackDraft, item: HackDraft["base"][number]): HackDraft | null {
  const i = d.base.findIndex((b) => (item.slug ? b.slug === item.slug : !b.slug && sameName(b.name, item.name)));
  if (i >= 0) return { ...d, base: d.base.map((b, j) => (j === i ? { ...b, qty: Math.min(LIMITS.qty, b.qty + item.qty) } : b)) };
  return addBase(d, item);
}

/** A summary this file wrote ("Made from ...") is kept up to date; one the maker wrote or edited is left alone. */
const AUTO = /^Made from .*\.$/;

/** A build with nothing written yet says what it is made of, so the guide has a summary to open with. */
function withSummary(d: HackDraft): HackDraft {
  if ((d.summary.trim() && !AUTO.test(d.summary)) || !d.base.length) return d;
  const list = d.base.map((b) => (b.qty > 1 ? `${b.qty} × ${b.name}` : b.name)).join(", ");
  return { ...d, summary: `Made from ${list}.`.slice(0, LIMITS.summary) };
}

/** A piece of furniture from the library, as the parts it is made of: beside what is there or on top of it. */
export function addFurniture(d: HackDraft, slug: string, at: Place = "beside"): HackDraft | null {
  const stem = freeStem(slug, d.parts.map((p) => p.id));
  const f = stem && furniture(slug, stem);
  if (!f) return null;
  const next = append(d, f.parts, f.steps, stem, at);
  // a piece arrives as one group: its parts select, move and go together until they are ungrouped
  const had = new Set(d.parts.map((p) => p.id));
  const ids = next ? next.parts.filter((p) => !had.has(p.id)).map((p) => p.id) : [];
  if (next && ids.length > 1 && groupsOf(d).length < LIMITS.groups) next.groups = [...groupsOf(d), { id: freeGroupId(d, stem), name: f.short.slice(0, LIMITS.groupName), ids }];
  const based = next && withBase(next, { name: f.label, slug, qty: 1 });
  return based && withSummary(based);
}

/** One part of a library piece on its own (a side panel, a shelf, a leg), set beside or on top of what is there. */
export function addLibraryPart(d: HackDraft, slug: string, ref: string, at: Place = "beside"): HackDraft | null {
  const f = furniture(slug);
  const t = libraryParts(slug).find((p) => p.ref === ref);
  if (!f || !t) return null;
  const id = freeId(d.parts, `${f.short}-${t.label || t.name}`);
  const part: CustomPart = {
    id,
    label: t.label.slice(0, LIMITS.label) || undefined,
    name: `${f.short}: ${t.name}`.slice(0, LIMITS.partName),
    size: t.size.map((n) => Math.min(LIMITS.size[1], Math.max(LIMITS.size[0], Math.round(n * 10) / 10))) as Vec3,
    pos: [0, 0, 0],
    shape: t.shape,
    material: t.material,
  };
  part.pos[1] = part.size[1] / 2;
  const step: CustomStep = { title: `Add the ${t.name.toLowerCase()}`.slice(0, LIMITS.title), add: [id] };
  const next = append(d, [part], [step], "x", at);
  if (!next) return null;
  const based = withBase(next, { name: `${f.short} ${t.name.toLowerCase()}, one part`.slice(0, LIMITS.variant), qty: 1 });
  return based && withSummary(based);
}

/* A piece added from the library keeps one stem on all its ids ("billy1-"): that is what its own steps are kept by (./autosteps.ts). */

export interface Group {
  stem: string;
  label: string;
  ids: string[];
}

/** The pieces of the build: parts that share a stem, in the order they were added. */
export function piecesOf(d: HackDraft): Group[] {
  const by = new Map<string, Group>();
  for (const p of d.parts) {
    const stem = p.id.split("-")[0];
    if (!/^[a-z]+\d+$/.test(stem) || !p.id.includes("-")) continue;
    const g = by.get(stem) ?? { stem, label: p.name.includes(": ") ? p.name.split(": ")[0] : stem.replace(/\d+$/, "").toUpperCase(), ids: [] };
    g.ids.push(p.id);
    by.set(stem, g);
  }
  return [...by.values()];
}

/* ---------- groups: what the workspace selects, moves and deletes together ---------- */

/** The groups of the build. A hack saved before groups existed has its library pieces as groups. */
export function groupsOf(d: HackDraft): PartGroup[] {
  return d.groups ?? piecesOf(d).map((g) => ({ id: g.stem, name: g.label.slice(0, LIMITS.groupName), ids: g.ids }));
}

/** The group a part is in. */
export const groupOf = (d: HackDraft, id: string) => groupsOf(d).find((g) => g.ids.includes(id));

/** Every part that goes with this one: its group, or itself alone. */
export const withGroup = (d: HackDraft, id: string): string[] => groupOf(d, id)?.ids ?? [id];

function freeGroupId(d: HackDraft, stem: string): string {
  const used = new Set(groupsOf(d).map((g) => g.id));
  if (!used.has(stem)) return stem;
  for (let i = 2; ; i++) if (!used.has(`${stem}-${i}`)) return `${stem}-${i}`;
}

/**
 * Puts the parts in one group. Parts of one group already join it (the others are added to it); otherwise a new
 * group takes them, and any group they leave behind keeps what is left of it. Null when it changes nothing.
 */
export function groupParts(d: HackDraft, ids: string[]): { draft: HackDraft; group: PartGroup } | null {
  const picked = d.parts.filter((p) => ids.includes(p.id)).map((p) => p.id);
  const all = groupsOf(d);
  if (picked.length < 2) return null;
  const touched = all.filter((g) => g.ids.some((x) => picked.includes(x)));
  const into = touched.length === 1 ? touched[0] : null;
  if (into && picked.every((x) => into.ids.includes(x))) return null;
  if (!into && all.length >= LIMITS.groups) return null;
  const group: PartGroup = into
    ? { ...into, ids: [...into.ids, ...picked.filter((x) => !into.ids.includes(x))] }
    : { id: freeGroupId(d, "group"), name: `Group ${all.length + 1}`.slice(0, LIMITS.groupName), ids: picked };
  const without = (g: PartGroup) => ({ ...g, ids: g.ids.filter((x) => !picked.includes(x)) });
  const groups = into ? all.map((g) => (g === into ? group : without(g))) : [...all.map(without), group];
  return { draft: { ...d, groups: tidy(groups) }, group };
}

/** Takes the parts out of their groups: a group wholly picked is undone, one partly picked keeps the others. */
export function ungroupParts(d: HackDraft, ids: string[]): HackDraft | null {
  const all = groupsOf(d);
  if (!all.some((g) => g.ids.some((x) => ids.includes(x)))) return null;
  return { ...d, groups: tidy(all.map((g) => ({ ...g, ids: g.ids.filter((x) => !ids.includes(x)) }))) };
}

export function renameGroup(d: HackDraft, id: string, name: string): HackDraft {
  return { ...d, groups: groupsOf(d).map((g) => (g.id === id ? { ...g, name: name.slice(0, LIMITS.groupName) } : g)) };
}

/** Where a piece is: the middle of its footprint, its height off the floor. */
export function groupAt(d: HackDraft, g: Group): { size: Vec3; at: Vec3 } {
  const { lo, hi, size } = boundsMm(d.parts.filter((p) => g.ids.includes(p.id)));
  return { size, at: [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2] };
}

/** Moves a piece so the middle of its footprint is at x and z, and its underside at y (mm). */
export function moveGroup(d: HackDraft, g: Group, to: Vec3): HackDraft | null {
  const from = groupAt(d, g).at;
  const by = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const parts = d.parts.map((p) => (g.ids.includes(p.id) ? { ...p, pos: [p.pos[0] + by[0], p.pos[1] + by[1], p.pos[2] + by[2]] as Vec3 } : p));
  return inBounds(parts) ? { ...d, parts } : null;
}

/** Takes a piece out with its parts and steps, and one off the count of what it came from. */
export function removeGroup(d: HackDraft, g: Group): HackDraft {
  const out = g.ids.reduce(removePart, d);
  const i = out.base.findIndex((b) => b.slug && b.name.toUpperCase().startsWith(g.label.toUpperCase()));
  if (i < 0) return out;
  const base = out.base.flatMap((b, j) => (j !== i ? [b] : b.qty > 1 ? [{ ...b, qty: b.qty - 1 }] : []));
  return withSummary({ ...out, base });
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

/* ---------- placing parts by hand (the workspace): move, turn, resize ---------- */

/** One part's centre, or null when it would leave the bounds an import is read with. */
export function movePart(d: HackDraft, id: string, pos: Vec3): HackDraft | null {
  const parts = d.parts.map((p) => (p.id === id ? { ...p, pos } : p));
  return inBounds(parts) ? { ...d, parts } : null;
}

/** Several parts moved by the same amount (mm). */
export function moveParts(d: HackDraft, ids: string[], by: Vec3): HackDraft | null {
  const set = new Set(ids);
  const parts = d.parts.map((p) => (set.has(p.id) ? { ...p, pos: [p.pos[0] + by[0], p.pos[1] + by[1], p.pos[2] + by[2]] as Vec3 } : p));
  return inBounds(parts) ? { ...d, parts } : null;
}

/** One part's size (mm), kept within the sides an import is read with. */
export function resizePart(d: HackDraft, id: string, size: Vec3): HackDraft {
  const [lo, hi] = LIMITS.size;
  const clamped = size.map((n) => Math.min(hi, Math.max(lo, Math.round(n * 10) / 10))) as Vec3;
  return updatePart(d, id, { size: clamped });
}

/** A part's turn set outright (radians), with zeros stored as no turn at all, like a file without one. */
export function setRotation(d: HackDraft, id: string, rot: Vec3): HackDraft {
  const r = rot.map((n) => Math.max(-LIMITS.rot, Math.min(LIMITS.rot, n))) as Vec3;
  return updatePart(d, id, { rot: r.some((n) => n) ? r : undefined });
}

/** Turns the parts a quarter (or any angle) around one axis, each about its own centre. */
export function turnParts(d: HackDraft, ids: string[], axis: 0 | 1 | 2, by: number): HackDraft {
  const set = new Set(ids);
  return ids.reduce((acc, id) => {
    const p = d.parts.find((x) => x.id === id);
    if (!p || !set.has(id)) return acc;
    const rot: Vec3 = [...(p.rot ?? [0, 0, 0])];
    rot[axis] = wrapAngle(rot[axis] + by);
    return setRotation(acc, id, rot);
  }, d);
}

/** An angle brought back into half a turn either side of zero. */
export const wrapAngle = (a: number) => {
  const t = Math.PI * 2;
  const r = ((((a + Math.PI) % t) + t) % t) - Math.PI;
  return Math.abs(r) < 1e-9 ? 0 : r;
};

/** Takes several parts out, with their place in the steps. */
export function removeParts(d: HackDraft, ids: string[]): HackDraft {
  return ids.reduce(removePart, d);
}

/** A copy of several parts, set a little to the right of where they were (or back on the left), each keeping its step. */
export function duplicateParts(d: HackDraft, ids: string[]): { draft: HackDraft; ids: string[] } | null {
  if (!ids.length || d.parts.length + ids.length > LIMITS.parts) return null;
  const picked = d.parts.filter((p) => ids.includes(p.id));
  const { lo, hi } = boundsMm(picked);
  const gap = hi[0] - lo[0] + 20;
  for (const dx of [gap, -gap]) {
    let next = d;
    const made: string[] = [];
    for (const p of picked) {
      const id = freeId(next.parts, p.id.replace(/-\d+$/, ""));
      const at = stepOf(d, p.id);
      next = { ...next, parts: [...next.parts, { ...p, id, size: [...p.size] as Vec3, pos: [p.pos[0] + dx, p.pos[1], p.pos[2]] as Vec3 }] };
      if (at >= 0) next = setPartStep(next, id, at);
      made.push(id);
    }
    if (inBounds(next.parts)) {
      // a group copied whole is a group of its own; parts copied from part of one are loose
      const copies = new Map(picked.map((p, i) => [p.id, made[i]]));
      let groups = groupsOf(d);
      for (const g of groups.filter((x) => x.ids.every((id) => copies.has(id)))) {
        if (groups.length >= LIMITS.groups) break;
        groups = [...groups, { id: freeGroupId({ ...next, groups }, g.id.replace(/-\d+$/, "")), name: g.name, ids: g.ids.map((id) => copies.get(id)!) }];
      }
      next = { ...next, groups };
      return { draft: next, ids: made };
    }
  }
  return null;
}

/* ---------- shapes from the library's "Boards and blocks" ---------- */

export interface ShapePreset {
  id: string;
  label: string;
  name: string;
  size: Vec3;
  shape: "box" | "cyl";
  material: NonNullable<CustomPart["material"]>;
}

export const SHAPES: ShapePreset[] = [
  { id: "board", label: "Board", name: "Board", size: [600, 18, 300], shape: "box", material: "board" },
  { id: "panel", label: "Tall panel", name: "Panel", size: [18, 800, 300], shape: "box", material: "board" },
  { id: "shelf", label: "Long shelf", name: "Shelf", size: [1000, 18, 300], shape: "box", material: "board" },
  { id: "block", label: "Block", name: "Block", size: [200, 200, 200], shape: "box", material: "wood" },
  { id: "leg", label: "Square leg", name: "Leg", size: [40, 400, 40], shape: "box", material: "wood" },
  { id: "post", label: "Round post", name: "Post", size: [50, 700, 50], shape: "cyl", material: "wood" },
  { id: "disc", label: "Round top", name: "Round top", size: [600, 18, 600], shape: "cyl", material: "board" },
];

/** A new part from a preset, standing on the floor to the right of what is there (the steps are worked out afterwards). */
export function addShape(d: HackDraft, preset: ShapePreset, at: Vec3 | null = null): { draft: HackDraft; id: string } | null {
  if (d.parts.length >= LIMITS.parts) return null;
  const id = freeId(d.parts, preset.id);
  const { hi } = boundsMm(d.parts);
  const x = at ? at[0] : d.parts.length ? hi[0] + 20 + preset.size[0] / 2 : 0;
  const part: CustomPart = { id, name: preset.name, size: [...preset.size], pos: [x, at ? at[1] : preset.size[1] / 2, at ? at[2] : 0], shape: preset.shape === "cyl" ? "cyl" : undefined, material: preset.material };
  if (!inBounds([part])) return null;
  return { draft: { ...d, parts: [...d.parts, part], steps: d.steps.length ? d.steps : [{ title: "Put it together" }] }, id };
}
