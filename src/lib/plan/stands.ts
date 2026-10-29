import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { anchorStep } from "./frame";
import { clamp } from "./math";

/**
 * A hat rack on the wall (TJUSIG, KALLSÖ): a back rail with a row of hooks, an end screwed onto each end of it,
 * and a shelf on top for hats. Built on the floor, hung on the wall last.
 */
export function buildHatRack(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = 18, rh = 90;
  const railT = b.part("Back rail", [W - 2 * t, rh, t], { material: "wood" });
  const rail = b.place(railT, [0, rh / 2, -D / 2 + t / 2]);
  const endT = b.part("End", [t, H - t, D], { material: "wood" });
  const ends = [-1, 1].map((sx) => b.place(endT, [sx * (W / 2 - t / 2), (H - t) / 2, 0]));
  const shelfT = b.part("Shelf", [W, t, D], { material: "wood" });
  const shelf = b.place(shelfT, [0, H - t / 2, 0]);
  const nh = clamp(Math.round(W / 160), 3, 8);
  const hx = (i: number) => -W / 2 + t + ((W - 2 * t) * (i + 0.5)) / nh;

  b.step(
    {
      title: "Screw the ends onto the back rail",
      detail: "One at each end, flush with the back. Two screws through each end into the rail.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.add(rail, [0, 0, -200]);
      b.then(0.1);
      b.stagger(0.25);
      ends.forEach((k, i) => b.add(k, [(i === 0 ? -1 : 1) * 220, 0, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const [i, k] of ends.entries()) for (const y of [rh * 0.3, rh * 0.7]) sc.push({ on: k, at: [(i === 0 ? -1 : 1) * (W / 2), y, -D / 2 + t / 2], dir: [i === 0 ? 1 : -1, 0, 0], mate: rail });
      b.fits(HW.screwM, sc, 0.1);
    },
  );

  b.step(
    {
      title: "Screw the shelf on top",
      detail: "Line it up with the back, then screw down into both ends.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.add(shelf, [0, 240, 0]);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const sx of [-1, 1]) for (const z of [-D / 4, D / 4]) sc.push({ on: shelf, at: [sx * (W / 2 - t / 2), H, z], dir: [0, -1, 0], mate: ends[sx < 0 ? 0 : 1] });
      b.fits(HW.screwM, sc, 0.08);
    },
  );

  b.step(
    {
      title: "Screw in the hooks",
      detail: "Into the holes along the front of the back rail. Hand tight is enough.",
      kind: "screws",
      warnings: ["hand"],
    },
    () => {
      const list: FitOpts[] = Array.from({ length: nh }, (_, i) => ({ on: rail, at: [hx(i), rh / 2, -D / 2 + t] as Vec3, dir: [0, 0, -1] as Vec3 }));
      b.fits(HW.hook, list, 0.1);
    },
  );

  anchorStep(b, { W, D, top: shelf, y: H, backZ: -D / 2, tools: ["drill", "screwdriver", "pencil", "level"], hang: true });
}

/**
 * A hat and coat stand (EKRAR, NIPÅSEN, GREJSIMOJS): two feet that slot together in a cross, a pole in sections
 * screwed end to end on top of them, and hooks around the top.
 */
export function buildCoatStand(b: PlanBuilder, s: ProductSpec) {
  const H = s.size.h * 10;
  const B = clamp(Math.max(s.size.w, s.size.d) * 10, 300, 700);
  const fh = 40, fd = 50, pd = 38;
  const nSec = H > 1500 ? 3 : 2;
  const secL = (H - fh) / nSec;

  const footT = b.part("Foot", [B, fh, fd], { material: "wood" });
  const feet = [b.place(footT, [0, fh / 2, 0]), b.place(footT, [0, fh / 2, 0], [0, Math.PI / 2, 0])];
  const secT = b.part("Pole section", [pd, secL, pd], { shape: "cyl", material: "wood" });
  const secs = Array.from({ length: nSec }, (_, i) => b.place(secT, [0, fh + secL * (i + 0.5), 0]));
  const capPieces: PartPiece[] = [{ shape: "cyl", size: [pd + 14, 30, pd + 14], pos: [0, 0, 0] }];
  const cap = b.compound("Top cap", capPieces, { material: "wood" });
  const top = b.place(cap.type, [0, H - 15, 0]);
  const hooks = H > 1300 ? 8 : 6;
  const tall = H > 1500;

  b.step(
    {
      title: "Slot the feet together",
      detail: "One fits down into the notch in the other, in a cross. Then bolt the bottom of the pole on from underneath.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.stagger(0.3);
      b.add(feet[0], [0, 0, 220]);
      b.add(feet[1], [0, 220, 0]);
      b.then(0.1);
      b.add(secs[0], [0, 320, 0]);
      b.then(0.1);
      b.fit(HW.boltL, { on: feet[0], at: [0, 0, 0], dir: [0, 1, 0], mate: secs[0] });
    },
  );

  b.step(
    {
      title: nSec > 2 ? "Screw the other pole sections on" : "Screw the top section on",
      detail: "Each one screws onto the one below. Turn by hand until it's tight and the pole is straight.",
      kind: "join",
      people: tall ? 2 : 1,
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.4);
      secs.slice(1).forEach((k) => b.add(k, [0, 300, 0], { spin: 2 }));
    },
  );

  b.step(
    {
      title: "Screw in the hooks",
      detail: "Into the holes around the top of the pole, then press the cap on.",
      kind: "screws",
      warnings: ["hand"],
    },
    () => {
      const list: FitOpts[] = Array.from({ length: hooks }, (_, i) => {
        const a = (i / hooks) * Math.PI * 2;
        const y = H - 60 - (i % 2) * 140;
        return { on: secs[nSec - 1], at: [Math.cos(a) * (pd / 2), y, Math.sin(a) * (pd / 2)] as Vec3, dir: [-Math.cos(a), 0, -Math.sin(a)] as Vec3 };
      });
      b.fits(HW.hook, list, 0.1);
      b.then(0.1);
      b.add(top, [0, 200, 0]);
    },
  );

  b.step(
    {
      title: "Check that it stands straight",
      detail: "On a flat floor. If it leans, tighten the bolt under the feet a little more.",
      tools: ["allen"],
      kind: "general",
    },
    () => {},
  );
}
