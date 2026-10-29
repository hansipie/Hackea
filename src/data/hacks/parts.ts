import type { CustomPart, CustomStep, Vec3 } from "@/lib/types";

// The IKEA pieces hacks start from, as parts. Sizes in mm, y up from the floor, x left to right, z back to front.
// They follow the catalog's own drawings of these products (src/lib/catalog.ts), which are approximate:
// check them against the manuals before relying on a fit to the millimetre.

/** A KALLAX grid: 350 mm per cell plus 70 mm of frame (2 × 2 = 77 × 77 cm, 2 × 4 = 77 × 147 cm). */
export function kallaxGrid(cols: number, rows: number, o: { y0?: number } = {}) {
  const T = 40; // outer panels
  const TI = 16; // dividers
  const D = 390;
  const W = cols * 350 + 70;
  const H = rows * 350 + 70;
  const IN = W - 2 * T;
  const cw = (IN - (cols - 1) * TI) / cols;
  const ch = (H - 2 * T - (rows - 1) * TI) / rows;
  const y0 = o.y0 ?? 0;
  const left = -IN / 2;

  const parts: CustomPart[] = [
    { id: "left", label: "A", name: "Side panel", size: [T, H, D], pos: [-(W - T) / 2, y0 + H / 2, 0], material: "board" },
    { id: "right", label: "A", name: "Side panel", size: [T, H, D], pos: [(W - T) / 2, y0 + H / 2, 0], material: "board" },
    { id: "bottom", label: "B", name: "Top or bottom panel", size: [IN, T, D], pos: [0, y0 + T / 2, 0], material: "board" },
    { id: "top", label: "B", name: "Top or bottom panel", size: [IN, T, D], pos: [0, y0 + H - T / 2, 0], material: "board" },
  ];
  const inner: string[] = [];
  for (let i = 1; i < cols; i++) {
    const id = `div-${i}`;
    parts.push({ id, label: "C", name: "Vertical divider", size: [TI, H - 2 * T, D], pos: [left + i * cw + (i - 1) * TI + TI / 2, y0 + H / 2, 0], material: "board" });
    inner.push(id);
  }
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const id = `shelf-${r}-${c}`;
      parts.push({ id, label: "D", name: "Half shelf", size: [cw, TI, D], pos: [left + c * (cw + TI) + cw / 2, y0 + T + r * ch + (r - 1) * TI + TI / 2, 0], material: "board" });
      inner.push(id);
    }

  const steps: CustomStep[] = [
    { title: "Join the left side and the bottom", detail: "Build the KALLAX as its own manual says, but leave the back off if there is one.", add: ["left", "bottom"], fix: [{ kind: "dowel", count: 2 * cols }] },
    ...(inner.length ? [{ title: "Add the dividers", add: inner, fix: [{ kind: "dowel" as const, count: Math.min(48, 4 * inner.length) }] }] : []),
    { title: "Close the frame", add: ["right", "top"], fix: [{ kind: "dowel", count: 4 * cols }], people: cols > 2 ? (2 as const) : (1 as const), warnings: ["square"] },
  ];
  return { parts, steps, size: [W, H, D] as Vec3 };
}

/** One BILLY, 80 cm wide and 202 cm tall, without its back panel (fit that last: it keeps the unit square). */
export function billyFrame(prefix: string, cx: number, shelves = 4) {
  const T = 15;
  const W = 800;
  const H = 2020;
  const D = 280;
  const IN = W - 2 * T;
  const p = (id: string) => `${prefix}-${id}`;
  const floor = 75; // top of the fixed bottom shelf
  const cell = (H - T - floor - shelves * T) / (shelves + 1);

  const frame: CustomPart[] = [
    { id: p("left"), label: "A", name: "Side panel", size: [T, H, D], pos: [cx - (W - T) / 2, H / 2, 0], material: "board" },
    { id: p("right"), label: "A", name: "Side panel", size: [T, H, D], pos: [cx + (W - T) / 2, H / 2, 0], material: "board" },
    { id: p("top"), label: "B", name: "Top or fixed shelf", size: [IN, T, D], pos: [cx, H - T / 2, 0], material: "board" },
    { id: p("bottom"), label: "B", name: "Top or fixed shelf", size: [IN, T, D], pos: [cx, floor - T / 2, 0], material: "board" },
  ];
  const shelfParts: CustomPart[] = Array.from({ length: shelves }, (_, i) => ({
    id: p(`shelf-${i + 1}`),
    label: "C",
    name: "Adjustable shelf",
    size: [IN, T, D - 20] as Vec3,
    pos: [cx, floor + (i + 1) * cell + i * T + T / 2, -10] as Vec3,
    material: "board" as const,
  }));
  // narrower than the unit, so that neighbouring backs don't touch each other
  const back: CustomPart = { id: p("back"), label: "D", name: "Back panel", size: [W - 12, H, 3], pos: [cx, H / 2, -(D / 2 + 1.5)], material: "fiber" };

  return { frame, shelves: shelfParts, back, ids: { frame: frame.map((x) => x.id), shelves: shelfParts.map((x) => x.id) } };
}

/** Overall size in cm of a set of parts, for ProductSpec.size. */
export function boundsCm(parts: CustomPart[]) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2);
      hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2);
    }
  const cm = (k: number) => Math.round(hi[k] - lo[k]) / 10;
  return { w: cm(0), h: cm(1), d: cm(2) };
}
