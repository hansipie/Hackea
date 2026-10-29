import type { CustomFix, CustomPart, CustomStep, HwKind, PartMaterial, Pose, ToolId, Vec3, WarnId } from "../types";
import { FIX_KINDS, LIMITS, MATERIALS, PART_ID, POSES, TOOLS, WARNINGS, type HackDraft } from "./draft";

/**
 * Reads a hack from somewhere we don't control: an imported file, a share link, or this browser's own storage.
 * Strict on purpose: a wrong type, a number out of bounds, too many parts or a text too long rejects the whole thing
 * with a reason, instead of guessing. Only known fields are copied into fresh objects, and every text is plain text:
 * nothing from here is ever rendered as HTML.
 *
 * These are also the rules the editor checks while you type (checkDraft in ./check.ts), so the editor can never
 * keep something this would refuse. With `repair`, the same reading fills blanks and clamps numbers instead of
 * refusing, so a saved hack that breaks a rule can still be opened and fixed rather than lost.
 */

export const FORMAT = "hackea-hack";
export const VERSION = 1;
/** An imported file larger than this is refused before it is parsed. */
export const MAX_FILE = 300_000;

/** One rule broken, and where: `part` and `step` point the editor at the field. */
export interface Problem {
  text: string;
  part?: string;
  step?: number;
}

export interface Sanitized {
  /** Null when a rule is broken, unless reading with `repair`. */
  draft: HackDraft | null;
  errors: string[];
  problems: Problem[];
}

const SLUG = /^[a-z0-9-]{1,80}$/;
const KINDS = new Set<string>(FIX_KINDS.map((k) => k.id));
const MATS = new Set<string>(MATERIALS.map((m) => m.id));
const POSE_IDS = new Set<string>(POSES.map((p) => p.id));
const TOOL_IDS = new Set<string>(TOOLS);
const WARN_IDS = new Set<string>(WARNINGS);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** One line of plain text: no control characters, no long dashes (house style), single spaces. */
export function plain(s: string) {
  return s
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s*[\u2012-\u2015]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

class Reader {
  problems: Problem[] = [];
  /** Where the next problem points: the part or step being read. */
  at: { part?: string; step?: number } = {};
  repair: boolean;
  constructor(repair: boolean) {
    this.repair = repair;
  }
  fail(where: string, what: string) {
    if (this.problems.length < 40) this.problems.push({ text: `${where}: ${what}`, ...this.at });
  }
  /** Text is checked as typed (the editor's own limit), then cleaned; cleaning never makes it too long. */
  text(v: unknown, max: number, where: string, fallback?: string): string {
    const required = fallback !== undefined;
    const fill = () => (this.repair && fallback ? fallback : "");
    if (v === undefined || v === null) {
      if (required) this.fail(where, "missing");
      return fill();
    }
    if (typeof v !== "string") {
      this.fail(where, "should be text");
      return fill();
    }
    if (v.length > max) this.fail(where, `longer than ${max} characters`);
    const s = plain(v).slice(0, max).trim();
    if (required && !s) {
      this.fail(where, "is empty");
      return fill();
    }
    return s;
  }
  num(v: unknown, min: number, max: number, where: string, int = false, fallback = min): number {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.fail(where, "should be a number");
      return fallback;
    }
    if (v < min || v > max) this.fail(where, `should be between ${min} and ${max}`);
    if (int && !Number.isInteger(v)) this.fail(where, "should be a whole number");
    const n = Math.min(max, Math.max(min, v));
    return int ? Math.round(n) : n;
  }
  list(v: unknown, max: number, where: string): unknown[] {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      this.fail(where, "should be a list");
      return [];
    }
    if (v.length > max) {
      this.fail(where, `more than ${max}`);
      return v.slice(0, max);
    }
    return v;
  }
  oneOf<T extends string>(v: unknown, set: Set<string>, where: string): T | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string" || !set.has(v)) {
      this.fail(where, `unknown value ${JSON.stringify(String(v).slice(0, 20))}`);
      return undefined;
    }
    return v as T;
  }
  vec(v: unknown, min: number, max: number, where: string, fallback: number): Vec3 {
    if (!Array.isArray(v) || v.length !== 3) {
      this.fail(where, "should be three numbers");
      return [fallback, fallback, fallback];
    }
    return [this.num(v[0], min, max, where, false, fallback), this.num(v[1], min, max, where, false, fallback), this.num(v[2], min, max, where, false, fallback)];
  }
  ids(v: unknown, max: number, where: string): string[] {
    const out: string[] = [];
    for (const x of this.list(v, max, where)) {
      if (typeof x !== "string" || !PART_ID.test(x)) this.fail(where, "a part id should be letters, digits, - or _");
      else if (out.includes(x)) this.fail(where, `lists ${x} twice`);
      else out.push(x);
    }
    return out;
  }
}

/**
 * One part. Ids are unique: a second part with an id already used is refused, and with `repair` it gets a free id,
 * as does a part whose id isn't valid. `reserved` holds every valid id in the list, so a repaired id never takes
 * one that a later part has.
 */
function part(r: Reader, v: unknown, i: number, taken: Set<string>, reserved: Set<string>): CustomPart | null {
  if (!isObj(v)) {
    r.at = {};
    r.fail(`Part ${i + 1}`, "should be an object");
    return null;
  }
  let id = typeof v.id === "string" && PART_ID.test(v.id) ? v.id : "";
  r.at = id ? { part: id } : {};
  if (id && taken.has(id)) {
    r.fail(`Part ${id}`, "another part has this id already: each part needs its own");
    if (!r.repair) return null;
    id = "";
  } else if (!id) {
    r.fail(`Part ${i + 1}`, "its id should be 1 to 32 letters, digits, - or _");
    if (!r.repair) return null;
  }
  if (!id) for (let k = i + 1; !id || taken.has(id) || reserved.has(id); k++) id = `part-${k}`;
  taken.add(id);
  const at = `Part ${id}`;
  const p: CustomPart = {
    id,
    name: r.text(v.name, LIMITS.partName, `${at} name`, "Part"),
    size: r.vec(v.size, LIMITS.size[0], LIMITS.size[1], `${at} size (mm)`, 100),
    pos: r.vec(v.pos, -LIMITS.pos, LIMITS.pos, `${at} position (mm)`, 0),
  };
  const label = r.text(v.label, LIMITS.label, `${at} letter`);
  if (label) p.label = label;
  const shape = r.oneOf<"box" | "cyl">(v.shape, new Set(["box", "cyl"]), `${at} shape`);
  if (shape) p.shape = shape;
  const material = r.oneOf<PartMaterial>(v.material, MATS, `${at} material`);
  if (material) p.material = material;
  return p;
}

function fix(r: Reader, v: unknown, at: string): CustomFix | null {
  if (!isObj(v)) {
    r.fail(at, "should be an object");
    return null;
  }
  const kind = r.oneOf<HwKind>(v.kind, KINDS, `${at} kind`);
  if (!kind) {
    if (v.kind === undefined) r.fail(at, "has no kind");
    return null;
  }
  const f: CustomFix = { kind, count: r.num(v.count, 1, LIMITS.fixCount, `${at} count`, true, 1) };
  if (v.len !== undefined) f.len = r.num(v.len, LIMITS.len[0], LIMITS.len[1], `${at} length (mm)`);
  if (v.dia !== undefined) f.dia = r.num(v.dia, LIMITS.dia[0], LIMITS.dia[1], `${at} diameter (mm)`);
  // an empty list is kept: the editor's "only into some parts" is ticked, with none picked yet
  if (v.to !== undefined) f.to = r.ids(v.to, LIMITS.targets, `${at} parts`);
  return f;
}

function step(r: Reader, v: unknown, i: number): CustomStep | null {
  const at = `Step ${i + 1}`;
  r.at = { step: i };
  if (!isObj(v)) {
    r.fail(at, "should be an object");
    return null;
  }
  const s: CustomStep = { title: r.text(v.title, LIMITS.title, `${at} title`, `Step ${i + 1}`) };
  const detail = r.text(v.detail, LIMITS.detail, `${at} detail`);
  if (detail) s.detail = detail;
  const add = r.ids(v.add, LIMITS.parts, `${at} parts`);
  if (add.length) s.add = add;
  const fixes = r
    .list(v.fix, LIMITS.fixes, `${at} fittings`)
    .map((f, j) => fix(r, f, `${at} fitting ${j + 1}`))
    .filter((f): f is CustomFix => !!f);
  if (fixes.length) s.fix = fixes;
  const tools = [...new Set(r.list(v.tools, TOOLS.length, `${at} tools`).map((t) => r.oneOf<ToolId>(t, TOOL_IDS, `${at} tool`)).filter((t): t is ToolId => !!t))];
  if (tools.length) s.tools = tools;
  if (v.people !== undefined) s.people = r.num(v.people, 1, 2, `${at} people`, true) === 2 ? 2 : 1;
  const pose = r.oneOf<Pose>(v.pose, POSE_IDS, `${at} pose`);
  if (pose) s.pose = pose;
  const warnings = [...new Set(r.list(v.warnings, LIMITS.warnings, `${at} warnings`).map((w) => r.oneOf<WarnId>(w, WARN_IDS, `${at} warning`)).filter((w): w is WarnId => !!w))];
  if (warnings.length) s.warnings = warnings;
  return s;
}

const refuse = (text: string): Sanitized => ({ draft: null, errors: [text], problems: [{ text }] });

/**
 * A draft from any of the shapes people have: an exported file ({ format, version, hack }), a bare draft,
 * or a ProductSpec like the curated hacks (hack and custom nested). `knownSlug` says which product links to keep.
 * With `repair`, it always returns a draft: blanks filled, numbers clamped, what can't be read left out, and the
 * problems it found listed.
 */
export function sanitizeDraft(raw: unknown, knownSlug: (slug: string) => boolean = () => true, o: { repair?: boolean } = {}): Sanitized {
  const r = new Reader(!!o.repair);
  let v: unknown = raw;
  if (isObj(v) && v.format !== undefined) {
    if (v.format !== FORMAT) return refuse("This is not a Hackea hack file.");
    if (v.version !== VERSION) return refuse(`This file is version ${String(v.version).slice(0, 8)}; this version of Hackea reads version ${VERSION}.`);
    v = v.hack;
  }
  if (!isObj(v)) {
    if (!r.repair) return refuse("A hack should be a JSON object.");
    r.fail("Hack", "should be an object");
    v = {};
  }
  const h = v as Record<string, unknown>;
  // the curated hacks keep their details under `hack` and their parts under `custom`
  const meta = isObj(h.hack) ? h.hack : h;
  const body = isObj(h.custom) ? h.custom : h;

  const rawParts = r.list(body.parts, LIMITS.parts, "Parts");
  const reserved = new Set(rawParts.flatMap((p) => (isObj(p) && typeof p.id === "string" && PART_ID.test(p.id) ? [p.id] : [])));
  const taken = new Set<string>();
  const parts = rawParts
    .map((p, i) => part(r, p, i, taken, reserved))
    .filter((p): p is CustomPart => !!p);
  const steps = r
    .list(body.steps, LIMITS.steps, "Steps")
    .map((s, i) => step(r, s, i))
    .filter((s): s is CustomStep => !!s);
  r.at = {};

  const base = r.list(meta.base, LIMITS.base, "Start from").flatMap((b, i) => {
    const at = `Start from ${i + 1}`;
    if (!isObj(b)) {
      r.fail(at, "should be an object");
      return [];
    }
    const item: HackDraft["base"][number] = { name: r.text(b.name, LIMITS.variant, `${at} name`, "IKEA piece"), qty: r.num(b.qty ?? 1, 1, LIMITS.qty, `${at} quantity`, true, 1) };
    // a link to a product's own guide only when it is a product we have
    if (typeof b.slug === "string" && SLUG.test(b.slug) && knownSlug(b.slug)) item.slug = b.slug;
    return [item];
  });
  const buy = r.list(meta.buy, LIMITS.buy, "Also buy").flatMap((b, i) => {
    const at = `Also buy ${i + 1}`;
    if (!isObj(b)) {
      r.fail(at, "should be an object");
      return [];
    }
    const item: HackDraft["buy"][number] = { name: r.text(b.name, LIMITS.variant, `${at} name`, "Item"), qty: r.num(b.qty ?? 1, 1, LIMITS.qty, `${at} quantity`, true, 1) };
    const note = r.text(b.note, LIMITS.line, `${at} note`);
    if (note) item.note = note;
    return [item];
  });
  // empty lines are kept (one just added in the editor); the guide leaves them out
  const lines = (x: unknown, max: number, where: string) =>
    r
      .list(x, max, where)
      .map((s, i) => r.text(s, LIMITS.line, `${where} ${i + 1}`));

  const draft: HackDraft = {
    name: r.text(h.name, LIMITS.name, "Name", "Untitled hack"),
    variant: r.text(h.variant, LIMITS.variant, "Subtitle"),
    category: r.text(h.category, LIMITS.category, "Category"),
    summary: r.text(meta.summary, LIMITS.summary, "Summary"),
    minutes: h.minutes === undefined ? 60 : r.num(h.minutes, LIMITS.minutes[0], LIMITS.minutes[1], "Time (minutes)", true, 60),
    people: h.people === undefined ? 1 : r.num(h.people, 1, 2, "People", true, 1) === 2 ? 2 : 1,
    difficulty: h.difficulty === undefined ? 2 : (r.num(h.difficulty, 1, 3, "Level", true, 2) as 1 | 2 | 3),
    base,
    buy,
    mods: lines(meta.mods, LIMITS.mods, "What you change"),
    watchOut: lines(h.watchOut, LIMITS.watchOut, "Watch out"),
    parts,
    steps,
  };
  const errors = r.problems.map((p) => p.text);
  return { draft: errors.length && !r.repair ? null : draft, errors, problems: r.problems };
}

/** The JSON file a hack is exported as. */
export function exportHack(d: HackDraft): string {
  return JSON.stringify({ format: FORMAT, version: VERSION, hack: d }, null, 2);
}

/** Text from a file or the clipboard, read as a hack. */
export function parseHackText(text: string, knownSlug?: (slug: string) => boolean): Sanitized {
  if (text.length > MAX_FILE) return refuse(`The file is larger than ${Math.round(MAX_FILE / 1000)} kB.`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return refuse("This is not valid JSON.");
  }
  return sanitizeDraft(raw, knownSlug);
}
