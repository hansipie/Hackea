import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A laptop or monitor stand (BOLLSIDAN, VATTENKAR, YXSTABY): a top on two side panels, put together upside down,
 * felt pads under the sides so it doesn't scratch the desk, then turned over.
 */
export function buildRiser(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tt = clamp(H * 0.12, 15, 22), st = clamp(W * 0.03, 15, 20);
  const topT = b.part("Top", [W, tt, D], { material: "wood" });
  const top = b.place(topT, [0, H - tt / 2, 0]);
  const sideT = b.part("Side", [st, H - tt, D], { material: "wood" });
  const sx = W / 2 - st / 2 - (H > 400 ? 0 : 20);
  const sides = [-1, 1].map((k) => b.place(sideT, [k * sx, (H - tt) / 2, 0]));

  b.step(
    {
      title: "Lay the top upside down",
      detail: "On the flattened box, so the surface stays scratch free.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
    },
    () => b.add(top, [0, 160, 0]),
  );
  b.step(
    {
      title: "Screw on the sides",
      detail: "Two screws through the top into each side. Snug is enough.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.25);
      sides.forEach((k, i) => b.add(k, [(i === 0 ? -1 : 1) * 160, -200, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const [i, k] of sides.entries()) for (const z of [-D / 4, D / 4]) sc.push({ on: top, at: [(i === 0 ? -1 : 1) * sx, H, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: k });
      b.fits(HW.screwM, sc, 0.1);
    },
  );
  b.step(
    {
      title: "Stick a felt pad under each corner",
      detail: "Peel off the backing and press them on firmly.",
      pose: "-y",
      kind: "general",
    },
    () => {
      const list: FitOpts[] = [];
      for (const k of sides) for (const z of [-D / 2 + 25, D / 2 - 25]) list.push({ on: k, at: [b.partItem(k).final.pos[0], 0, z], dir: [0, 1, 0], hole: false });
      b.fits(HW.glide, list, 0.1);
    },
  );
  b.step(
    {
      title: "Turn it over",
      detail: "Stand it on the desk and check it doesn't rock.",
      pose: "+y",
      kind: "flip",
    },
    () => {},
  );
}
