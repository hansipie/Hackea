import type { ProductSpec } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp, rotate, toWorld } from "./math";

/**
 * Folding room dividers (RISÖR, TOLKNING): three or four panels laid face down side by side, hinges screwed across
 * each join, then stood up and opened out into a zigzag so it stands on its own. size.w is the width laid out flat.
 */
export function buildScreen(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10;
  const n = clamp(Math.round(W / 550), 2, 6);
  const pw = W / n, pt = 25;
  const fold = 0.42; // radians each panel turns away from the line
  const dx = pw * Math.cos(fold), dz = pw * Math.sin(fold);
  const x0 = -(n * dx) / 2;
  const panelT = b.part("Panel", [pw - 4, H - 20, pt], { material: "wood" });
  const panels = Array.from({ length: n }, (_, i) => {
    const sz = i % 2 === 0 ? 1 : -1; // every other panel turns back towards the wall
    const xa = x0 + i * dx, za = i % 2 === 0 ? 0 : dz;
    const xb = xa + dx, zb = za + sz * dz;
    return { key: b.place(panelT, [(xa + xb) / 2, 10 + (H - 20) / 2, (za + zb) / 2], [0, Math.atan2(-(zb - za), xb - xa), 0]), xa, za, xb, zb };
  });
  const hingeYs = [0.15, 0.5, 0.85].map((k) => 10 + (H - 20) * k);
  const big = H > 1600;

  b.step(
    {
      title: "Lay the panels face down, side by side",
      detail: "On a soft floor or the flattened box, with their edges touching.",
      scene: "flat",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.25);
      panels.forEach((p, i) => b.stage(p.key, [(i - (n - 1) / 2) * pw, pt / 2, 0], [Math.PI / 2, 0, 0], [0, 200, 0]));
    },
  );
  b.step(
    {
      title: "Screw the hinges across each join",
      detail: "Three on each join: at the top, in the middle and at the bottom.",
      tools: ["screwdriver"],
      scene: "flat",
      kind: "hinges",
      warnings: ["floor"],
    },
    () => {
      // on the back of the panels, which faces up while they lie face down
      const onBack = (k: string, x: number, y: number): FitOpts => {
        const it = b.partItem(k);
        return { on: k, at: toWorld([x, y - it.final.pos[1], -pt / 2], it.final.pos, it.final.rot), dir: rotate([0, 0, 1], it.final.rot), hole: false };
      };
      const hinges: FitOpts[] = [];
      const screws: FitOpts[] = [];
      for (let i = 0; i < n - 1; i++)
        for (const y of hingeYs) {
          hinges.push(onBack(panels[i].key, pw / 2, y));
          screws.push(onBack(panels[i].key, pw / 2 - 16, y), onBack(panels[i + 1].key, -pw / 2 + 16, y));
        }
      b.fits(HW.flatHinge, hinges, 0.12);
      b.then(0.1);
      b.fits(HW.screwS, screws, 0.03);
    },
  );
  b.step(
    {
      title: big ? "Stand it up together and open it out" : "Stand it up and open it out",
      detail: "Fold it into a zigzag, so it stands steady on its own.",
      kind: "standup",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {
      b.stagger(0.12);
      panels.forEach((p) => b.add(p.key, [0, 260, 0]));
    },
  );
}
