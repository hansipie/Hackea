import { z } from "zod";
import type { CustomFix, CustomPart, CustomStep, HwKind, PartMaterial, Pose, ProductSpec, ToolId, Vec3, WarnId } from "../types";
import { parseSpec } from "../spec";
import { boxOf } from "../plan/custom";

/* ---------- lenient schema: models drift, so coerce what we can and drop the rest ---------- */

const str = (max: number) => z.coerce.string().transform((s) => clean(s).slice(0, max));
const vec = z
  .array(z.coerce.number())
  .min(3)
  .transform((a) => [a[0], a[1], a[2]] as Vec3)
  .refine((a) => a.every((n) => Number.isFinite(n)));

const Part = z.object({
  id: z.coerce.string(),
  label: z.coerce.string().optional().catch(undefined),
  name: str(40).catch("Part"),
  size: vec,
  pos: vec,
  shape: z.enum(["box", "cyl"]).optional().catch(undefined),
  material: z.enum(["board", "fiber", "wood", "metal", "soft"]).optional().catch(undefined),
});

const Fix = z.object({
  kind: z.coerce.string(),
  count: z.coerce.number().catch(1),
  len: z.coerce.number().optional().catch(undefined),
  dia: z.coerce.number().optional().catch(undefined),
  to: z.array(z.coerce.string()).optional().catch(undefined),
});

const Step = z.object({
  title: str(80).catch("Next step"),
  detail: str(240).optional().catch(undefined),
  add: z.array(z.coerce.string()).optional().catch(undefined),
  fix: z.array(z.unknown()).optional().catch(undefined),
  tools: z.array(z.coerce.string()).optional().catch(undefined),
  people: z.coerce.number().optional().catch(undefined),
  pose: z.coerce.string().optional().catch(undefined),
  warnings: z.array(z.coerce.string()).optional().catch(undefined),
});

const Root = z.object({
  name: str(40),
  brand: str(40).optional().catch(undefined),
  variant: str(60).optional().catch(undefined),
  category: str(40).optional().catch(undefined),
  size: z.object({ w: z.coerce.number(), h: z.coerce.number(), d: z.coerce.number() }).optional().catch(undefined),
  minutes: z.coerce.number().optional().catch(undefined),
  people: z.coerce.number().optional().catch(undefined),
  difficulty: z.coerce.number().optional().catch(undefined),
  archetype: z.coerce.string().optional().catch(undefined),
  fromCover: z.coerce.boolean().optional().catch(undefined),
  parts: z.array(z.unknown()),
  steps: z.array(z.unknown()),
  watchOut: z.array(z.coerce.string()).optional().catch(undefined),
});

export function clean(s: string) {
  return s
    .replace(/[<>]/g, "")
    .replace(/\s*[‒-―]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- synonyms ---------- */

const HW_WORDS: [RegExp, HwKind | null][] = [
  [/cam\s*(bolt|screw)|connect(ing|or)\s*(bolt|screw)|camscrew|minifix bolt/, "camScrew"],
  [/cam|minifix|lock disc|eccentric/, "cam"],
  [/dowel|wood pin|peg/, "dowel"],
  [/shelf\s*(pin|support|peg)|^pin$|support pin/, "pin"],
  [/leg\s*(bolt|screw)|hanger bolt|double.?ended|legscrew/, "legScrew"],
  [/hinge/, "hinge"],
  [/knob/, "knob"],
  [/handle|pull/, "handle"],
  [/bracket|wall|anchor|anti.?tip|strap/, "bracket"],
  [/felt|glide|pad|foot/, "glide"],
  [/plate/, "plate"],
  [/nail|tack|staple/, "nail"],
  [/bolt|machine screw|allen|hex|connector/, "bolt"],
  [/nut|washer|insert|cap|cover|sticker|label/, null],
  [/screw|runner|slide/, "screw"],
];

export function hwKind(raw: string): HwKind | null {
  const s = raw.toLowerCase().trim();
  const direct: Record<string, HwKind> = { camscrew: "camScrew", legscrew: "legScrew" };
  if (direct[s]) return direct[s];
  for (const [re, k] of HW_WORDS) if (re.test(s)) return k;
  return "screw";
}

const TOOL_WORDS: [RegExp, ToolId][] = [
  [/allen|hex key|hex wrench|l.?key/, "allen"],
  [/flat|slotted/, "flathead"],
  [/screwdriver|phillips|cross|pozi/, "screwdriver"],
  [/hammer|mallet/, "hammer"],
  [/drill/, "drill"],
  [/spanner|wrench/, "wrench"],
  [/level/, "level"],
  [/tape|measure|ruler/, "tape"],
  [/pencil|marker/, "pencil"],
  [/knife|cutter|scissors/, "knife"],
];
function tool(raw: string): ToolId | null {
  const s = raw.toLowerCase();
  for (const [re, t] of TOOL_WORDS) if (re.test(s)) return t;
  return null;
}

const POSES: [RegExp, Pose][] = [
  [/upside|^-y$|inverted/, "-y"],
  [/on[ _]?(its |the )?back|front (facing )?up|^\+z$/, "+z"],
  [/face[ _]?down|front down|back (facing )?up|^-z$/, "-z"],
  [/left[ _]?side|on (its|the) left|^\+x$/, "+x"],
  [/right[ _]?side|on (its|the) right|on (its|the) side|^-x$/, "-x"],
  [/upright|standing|^\+y$|normal/, "+y"],
];
function pose(raw?: string): Pose | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [re, p] of POSES) if (re.test(s)) return p;
  return undefined;
}

const WARN_WORDS: [RegExp, WarnId][] = [
  [/two|2 people|second person|helper/, "two"],
  [/wall|anchor/, "wall"],
  [/tip/, "tip"],
  [/floor|soft surface|scratch|carpet|blanket/, "floor"],
  [/loose|don.?t tighten|not fully/, "loose"],
  [/hand/, "hand"],
  [/square|diagonal/, "square"],
  [/face|finished side|direction|orientation/, "face"],
];
function warn(raw: string): WarnId | null {
  const s = raw.toLowerCase();
  for (const [re, w] of WARN_WORDS) if (re.test(s)) return w;
  return null;
}

/* ---------- geometry clean up ---------- */

export interface ScanCheck {
  ok: boolean;
  issues: string[];
}

function scaleFix(parts: CustomPart[], size?: { w: number; h: number; d: number }) {
  const boxes = parts.map(boxOf);
  const H = Math.max(...boxes.map((b) => b.max[1])) - Math.min(...boxes.map((b) => b.min[1]));
  const W = Math.max(...boxes.map((b) => b.max[0])) - Math.min(...boxes.map((b) => b.min[0]));
  const big = Math.max(H, W);
  let k = 1;
  if (size && size.h > 0) {
    const r = (size.h * 10) / Math.max(1, H);
    if (r > 6 && r < 16) k = 10;
    else if (r > 0.06 && r < 0.16) k = 0.1;
  } else if (big < 300 && parts.some((p) => Math.min(...p.size) < 3)) k = 10;
  if (k !== 1) for (const p of parts) {
    p.size = p.size.map((n) => n * k) as Vec3;
    p.pos = p.pos.map((n) => n * k) as Vec3;
  }
}

function ground(parts: CustomPart[]) {
  const boxes = parts.map(boxOf);
  const minY = Math.min(...boxes.map((b) => b.min[1]));
  const cx = (Math.min(...boxes.map((b) => b.min[0])) + Math.max(...boxes.map((b) => b.max[0]))) / 2;
  const cz = (Math.min(...boxes.map((b) => b.min[2])) + Math.max(...boxes.map((b) => b.max[2]))) / 2;
  for (const p of parts) p.pos = [round1(p.pos[0] - cx), round1(p.pos[1] - minY), round1(p.pos[2] - cz)];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Close small gaps and overlaps between parts that are clearly meant to touch. Earlier parts stay put. */
function snap(parts: CustomPart[], order: string[]) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const seq = [...order.map((id) => byId.get(id)).filter(Boolean), ...parts.filter((p) => !order.includes(p.id))] as CustomPart[];
  const done: CustomPart[] = [];
  for (const p of seq) {
    for (let k = 0; k < 3; k++) {
      const a = boxOf(p);
      let best: number | null = null;
      for (const q of done) {
        const b = boxOf(q);
        const others = [0, 1, 2].filter((j) => j !== k);
        if (!others.every((j) => Math.min(a.max[j], b.max[j]) - Math.max(a.min[j], b.min[j]) > 5)) continue;
        const aAbove = a.min[k] + a.max[k] > b.min[k] + b.max[k];
        const gap = aAbove ? a.min[k] - b.max[k] : b.min[k] - a.max[k];
        if (gap > 0.5 && gap < 25) {
          const move = aAbove ? -gap : gap;
          if (best === null || Math.abs(move) < Math.abs(best)) best = move;
        } else if (gap < -0.5 && gap > -12) {
          const move = aAbove ? -gap : gap;
          if (best === null || Math.abs(move) < Math.abs(best)) best = move;
        }
      }
      if (best !== null) p.pos[k] = round1(p.pos[k] + best);
    }
    done.push(p);
  }
}

/** Is this something we can draw with a straight face? */
export function checkScan(parts: CustomPart[]): ScanCheck {
  const issues: string[] = [];
  if (parts.length < 2) issues.push("There are fewer than two parts.");
  const boxes = parts.map(boxOf);
  const touching = (i: number, j: number, tol = 3) => {
    const a = boxes[i], b = boxes[j];
    const ov = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
    return ov.every((o) => o > -tol) && ov.filter((o) => o > 2).length >= 2;
  };
  let floating = 0;
  parts.forEach((p, i) => {
    const onFloor = boxes[i].min[1] < 3;
    if (!onFloor && !parts.some((_, j) => j !== i && touching(i, j))) {
      floating++;
      if (issues.length < 8) issues.push(`Part ${p.id} (${p.name}) doesn't touch any other part or the floor.`);
    }
  });
  let clashes = 0;
  for (let i = 0; i < parts.length; i++)
    for (let j = 0; j < i; j++) {
      const a = boxes[i], b = boxes[j];
      const ov = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
      if (ov.every((o) => o > 8)) {
        const vol = ov[0] * ov[1] * ov[2];
        const small = Math.min(...[a, b].map((x) => (x.max[0] - x.min[0]) * (x.max[1] - x.min[1]) * (x.max[2] - x.min[2])));
        if (vol > small * 0.3) {
          clashes++;
          if (issues.length < 8) issues.push(`Parts ${parts[i].id} and ${parts[j].id} sit inside each other.`);
        }
      }
    }
  const bad = floating > Math.max(1, parts.length * 0.25) || clashes > Math.max(1, parts.length * 0.2);
  return { ok: !bad && parts.length >= 2, issues };
}

/* ---------- entry ---------- */

export interface ScanResult {
  spec: ProductSpec | null;
  check: ScanCheck;
  raw?: unknown;
}

/** Turn model output into a product spec with a custom plan. Returns the problems found so the model can fix them. */
export function parseScan(raw: unknown): ScanResult {
  const r = Root.safeParse(raw);
  if (!r.success) return { spec: null, check: { ok: false, issues: ["The reply didn't match the JSON shape: it needs name, parts and steps."] } };
  const v = r.data;

  const parts: CustomPart[] = [];
  const ids = new Set<string>();
  for (const x of v.parts.slice(0, 80)) {
    const p = Part.safeParse(x);
    if (!p.success) continue;
    let id = p.data.id.trim() || `P${parts.length + 1}`;
    while (ids.has(id)) id += "'";
    ids.add(id);
    const size = p.data.size.map((n) => Math.min(3200, Math.max(0.1, Math.abs(n)))) as Vec3;
    const label = p.data.label?.trim();
    parts.push({ id, label: label && label.length <= 3 ? label : undefined, name: p.data.name || "Part", size, pos: p.data.pos, shape: p.data.shape, material: p.data.material as PartMaterial | undefined });
  }
  if (!parts.length) return { spec: null, check: { ok: false, issues: ["No usable parts: each needs id, name, size [w,h,d] and pos [x,y,z] in mm."] } };

  const idMap = new Map<string, string>();
  for (const p of parts) idMap.set(p.id.toLowerCase(), p.id);
  const ref = (s: string) => idMap.get(s.trim().toLowerCase());

  const steps: CustomStep[] = [];
  for (const x of v.steps.slice(0, 40)) {
    const st = Step.safeParse(x);
    if (!st.success) continue;
    const fixes: CustomFix[] = [];
    for (const f of st.data.fix ?? []) {
      const ff = Fix.safeParse(f);
      if (!ff.success) continue;
      const kind = hwKind(ff.data.kind);
      if (!kind) continue;
      const count = Math.round(ff.data.count);
      if (!(count > 0)) continue;
      fixes.push({ kind, count: Math.min(48, count), len: ff.data.len, dia: ff.data.dia, to: (ff.data.to ?? []).map(ref).filter((id): id is string => !!id) });
    }
    steps.push({
      title: st.data.title,
      detail: st.data.detail || undefined,
      add: (st.data.add ?? []).map(ref).filter((id): id is string => !!id),
      fix: fixes,
      tools: [...new Set((st.data.tools ?? []).map(tool).filter((t): t is ToolId => !!t))],
      people: (st.data.people ?? 1) >= 2 ? 2 : 1,
      pose: pose(st.data.pose),
      warnings: [...new Set((st.data.warnings ?? []).map(warn).filter((w): w is WarnId => !!w))],
    });
  }

  scaleFix(parts, v.size);
  for (const p of parts) p.size = p.size.map((n) => Math.min(3200, Math.max(2, round1(n)))) as Vec3;
  ground(parts);
  snap(parts, steps.flatMap((s) => s.add ?? []));
  ground(parts);
  const check = checkScan(parts);

  const boxes = parts.map(boxOf);
  const span = (k: number) => Math.max(...boxes.map((b) => b.max[k])) - Math.min(...boxes.map((b) => b.min[k]));
  const size = { w: Math.max(5, Math.round(span(0) / 10)), h: Math.max(5, Math.round(span(1) / 10)), d: Math.max(5, Math.round(span(2) / 10)) };
  const name = v.name || "My build";
  const spec: ProductSpec = {
    name: name.slice(0, 40),
    brand: v.brand || undefined,
    variant: v.variant || v.category || "Your build",
    category: v.category || "Furniture",
    archetype: "custom",
    size,
    minutes: Math.round(Math.min(480, Math.max(5, v.minutes ?? 30 + steps.length * 4))),
    people: (v.people ?? 1) >= 2 || steps.some((s) => s.people === 2) ? 2 : 1,
    difficulty: (v.difficulty ?? 2) >= 3 ? 3 : (v.difficulty ?? 2) <= 1 ? 1 : 2,
    source: "scan",
    custom: { parts, steps, fromCover: v.fromCover || undefined },
    watchOut: v.watchOut?.map(clean).filter(Boolean).slice(0, 2),
  };
  return { spec, check, raw };
}

/** When the model's geometry can't be saved, fall back to the closest simple type with the same name and size. */
export function fallbackSpec(raw: unknown): ProductSpec | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const arch = String(r.archetype ?? "");
  const archetype = ["shelf", "drawers", "table", "bed", "cabinet", "seat", "sofa"].includes(arch) ? arch : "shelf";
  const spec = parseSpec({ ...r, archetype, size: r.size ?? { w: 60, h: 80, d: 40 }, name: String(r.name ?? "My build") });
  if (!spec) return null;
  return { ...spec, source: "scan", brand: typeof r.brand === "string" ? clean(r.brand) : undefined };
}
