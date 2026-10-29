import { z } from "zod";
import type { ProductSpec } from "./types";

// the site's CSP allows no eval, so zod shouldn't probe for it (the probe logs a violation on every guide)
z.config({ jitless: true });

const num = (lo: number, hi: number) => z.coerce.number().transform((n) => Math.min(hi, Math.max(lo, n)));
const optNum = (lo: number, hi: number) => num(lo, hi).optional().catch(undefined);
const optBool = z.coerce.boolean().optional().catch(undefined);
const optEnum = <T extends [string, ...string[]]>(v: T) => z.enum(v).optional().catch(undefined);

const Spec = z.object({
  found: z.boolean().optional(),
  name: z.string().min(1).max(40),
  variant: z.string().max(60).catch(""),
  category: z.string().max(40).catch("Furniture"),
  archetype: z.enum(["shelf", "drawers", "table", "bed", "cabinet", "seat", "sofa"]),
  size: z.object({ w: num(20, 320), h: num(20, 260), d: num(15, 240) }),
  minutes: num(5, 360).catch(45),
  people: z.coerce.number().transform((n) => (n >= 2 ? 2 : 1)).catch(1),
  difficulty: z.coerce.number().transform((n) => (n >= 3 ? 3 : n <= 1 ? 1 : 2)).catch(2),
  material: z.string().max(80).optional().catch(undefined),
  shelf: z
    .object({
      style: optEnum(["grid", "bookcase"]),
      cols: optNum(1, 5),
      rows: optNum(1, 5),
      shelves: optNum(0, 6),
      fixedShelf: optBool,
      back: optBool,
      plinth: optBool,
      outer: optNum(12, 50),
      inner: optNum(12, 30),
    })
    .partial()
    .optional()
    .catch(undefined),
  drawers: z
    .object({
      cols: z.coerce.number().transform((n) => (n >= 2 ? 2 : 1)).optional().catch(undefined),
      rows: optNum(1, 6),
      knobs: optEnum(["none", "knob", "bar"]),
      plinth: optBool,
      thickness: optNum(12, 24),
    })
    .partial()
    .optional()
    .catch(undefined),
  table: z
    .object({
      topThickness: optNum(15, 60),
      legs: optEnum(["square", "round"]),
      legSize: optNum(25, 90),
      shelf: optBool,
      attach: optEnum(["screw", "plate", "apron"]),
    })
    .partial()
    .optional()
    .catch(undefined),
  bed: z
    .object({
      mattressW: optNum(70, 200),
      mattressL: optNum(180, 220),
      headH: optNum(40, 140),
      footH: optNum(0, 100),
      slats: optNum(8, 30),
      centerBeam: optBool,
    })
    .partial()
    .optional()
    .catch(undefined),
  cabinet: z
    .object({
      fronts: optEnum(["doors", "tilt"]),
      compartments: optNum(1, 5),
      doors: z.coerce.number().transform((n) => (n >= 2 ? 2 : n <= 0 ? 0 : 1)).optional().catch(undefined),
      shelves: optNum(0, 5),
      rail: optBool,
      plinth: optBool,
      handles: optEnum(["knob", "bar", "none"]),
      thickness: optNum(12, 25),
    })
    .partial()
    .optional()
    .catch(undefined),
  seat: z
    .object({
      kind: optEnum(["stool", "chair", "bench"]),
      seat: optEnum(["round", "square"]),
      seatH: optNum(25, 85),
      backH: optNum(60, 120),
      stretchers: optBool,
      splay: optBool,
    })
    .partial()
    .optional()
    .catch(undefined),
  sofa: z
    .object({
      seats: optNum(1, 4),
      arms: optEnum(["wide", "slim", "none"]),
      legs: optEnum(["round", "block"]),
    })
    .partial()
    .optional()
    .catch(undefined),
  tips: z.record(z.string(), z.string().max(220)).optional().catch(undefined),
  watchOut: z.array(z.string().max(200)).max(4).optional().catch(undefined),
});

export function parseSpec(raw: unknown): ProductSpec | null {
  const r = Spec.safeParse(raw);
  if (!r.success) return null;
  const v = r.data;
  const clean = (s: string) => s.replace(/\s*[\u2012-\u2015]\s*/g, ", ").replace(/\s+,/g, ",").trim();
  const spec: ProductSpec = {
    name: clean(v.name).toUpperCase(),
    variant: clean(v.variant || v.category),
    category: clean(v.category),
    archetype: v.archetype,
    size: v.size,
    minutes: Math.round(v.minutes),
    people: v.people as 1 | 2,
    difficulty: v.difficulty as 1 | 2 | 3,
    material: v.material ? clean(v.material) : undefined,
    source: "ai",
  };
  const key = v.archetype;
  const params = (v as Record<string, unknown>)[key];
  if (params && typeof params === "object") (spec as unknown as Record<string, unknown>)[key] = stripUndefined(params as Record<string, unknown>);
  if (v.tips) {
    const allowed = ["general", "frame", "back", "shelves", "drawers", "doors", "legs", "slats", "anchor"];
    spec.tips = Object.fromEntries(Object.entries(v.tips).filter(([k]) => allowed.includes(k)).map(([k, t]) => [k, clean(t)]));
  }
  if (v.watchOut) spec.watchOut = v.watchOut.map(clean).filter(Boolean).slice(0, 3);
  return spec;
}

function stripUndefined(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined));
}

export const SPEC_PROMPT = `You help people assemble IKEA flat pack furniture. Given what a person typed (usually a product name, sometimes with a size), identify the product and describe it so our generator can draw an assembly guide.

Reply with JSON only, no prose. Shape:
{
  "found": true,
  "name": "KALLAX",                       // product name in capitals as printed on the box
  "variant": "Shelving unit, 2 x 4",      // short, human readable
  "category": "Shelving unit",
  "archetype": "shelf" | "drawers" | "table" | "bed" | "cabinet" | "seat" | "sofa",
  "size": { "w": 77, "h": 147, "d": 39 }, // outer size in centimetres (for beds: d = length)
  "minutes": 60,                          // realistic assembly time for one person
  "people": 1 | 2,                        // 2 if lifting or holding needs a second person
  "difficulty": 1 | 2 | 3,
  "material": "Particleboard",
  // exactly ONE of these objects, matching the archetype:
  "shelf":   { "style": "grid" | "bookcase", "cols": 2, "rows": 4, "shelves": 3, "fixedShelf": true, "back": true, "plinth": true, "outer": 16, "inner": 16 },
  "drawers": { "cols": 1 | 2, "rows": 3, "knobs": "none" | "knob" | "bar", "plinth": false, "thickness": 16 },
  "table":   { "topThickness": 30, "legs": "square" | "round", "legSize": 50, "shelf": false, "attach": "screw" | "plate" | "apron" },
  "bed":     { "mattressW": 160, "mattressL": 200, "headH": 100, "footH": 38, "slats": 17, "centerBeam": true },
  "cabinet": { "fronts": "doors" | "tilt", "compartments": 2, "doors": 0 | 1 | 2, "shelves": 2, "rail": true, "plinth": true, "handles": "knob" | "bar" | "none", "thickness": 18 },
  "seat":    { "kind": "stool" | "chair" | "bench", "seat": "round" | "square", "seatH": 45, "backH": 90, "stretchers": false, "splay": true },
  "sofa":    { "seats": 3, "arms": "wide" | "slim" | "none", "legs": "round" | "block" },
  "tips": { "frame": "...", "back": "...", "drawers": "...", "anchor": "..." },   // optional, 1 short practical sentence each, only if you are confident
  "watchOut": ["..."]                                                             // optional, max 2 common mistakes people make with THIS product
}

Rules:
- grid = cube shelving like KALLAX or EKET walls. bookcase = sides with shelves like BILLY or HEMNES bookcase.
- Wardrobes, sideboards, TV units with doors and cabinets are "cabinet". Shoe cabinets with fronts that tip open (BISSA, HEMNES, STÄLL, TRONES) are "cabinet" with "fronts": "tilt" and one compartment per front.
- Desks and TV benches without doors are "table". Nightstands with drawers are "drawers". Sofas and upholstered armchairs are "sofa".
- Use the most common size if the person didn't give one.
- If it is not an IKEA product that needs assembly (lamps, textiles, plants, food, or unknown), reply {"found": false, "suggestions": ["NAME", "NAME"]} with up to 3 real product names they might mean.
- Never use em dashes or en dashes. Keep every sentence short and plain.`;
