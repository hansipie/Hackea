import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * Freestanding clothes racks (MULIG, RIGGA, GRÅFJÄLLET): a foot at each end, an upright bolted onto each foot,
 * a shoe shelf or a lower rail between the uprights, and the rail across the top. Built standing, from the floor up.
 */
export function buildRack(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const shoes = !!s.shelf?.shoes;
  const tube = 30, footH = 40, footW = 50;
  const ux = W / 2 - footW / 2;
  const railY = H - tube / 2;
  const lowY = clamp(H * 0.12, 140, 260);

  const footT = b.part("Foot", [footW, footH, D], { material: "metal" });
  const feet = [-1, 1].map((sx) => b.place(footT, [sx * ux, footH / 2, 0]));
  const upT = b.part("Upright", [tube, H - footH, tube], { shape: "cyl", material: "metal" });
  const ups = [-1, 1].map((sx) => b.place(upT, [sx * ux, footH + (H - footH) / 2, 0]));
  const span = 2 * ux - tube;
  const railT = b.part("Top rail", [tube - 4, span, tube - 4], { shape: "cyl", material: "metal" });
  const rail = b.place(railT, [0, railY, 0], [0, 0, Math.PI / 2]);
  const shelfD = Math.min(D - 40, 330);
  const lowT = shoes ? b.part("Shoe shelf", [span, 18, shelfD], { material: "wood" }) : b.part("Lower rail", [24, span, 24], { shape: "cyl", material: "metal" });
  const low = shoes ? b.place(lowT, [0, lowY, 0]) : b.place(lowT, [0, lowY, 0], [0, 0, Math.PI / 2]);
  const tall = H > 1500;

  b.step(
    {
      title: "Bolt an upright onto each foot",
      detail: "Stand each upright in the hole in the middle of its foot, then tighten the bolt from underneath.",
      tools: ["allen"],
      kind: "bolts",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0.25);
      feet.forEach((k, i) => b.add(k, [(i === 0 ? -1 : 1) * 180, 0, 0]));
      b.then(0.1);
      ups.forEach((k) => b.add(k, [0, 360, 0]));
      b.then(0.1);
      b.fits(
        HW.boltS,
        feet.map((k, i) => ({ on: k, at: [(i === 0 ? -1 : 1) * ux, 0, 0] as Vec3, dir: [0, 1, 0] as Vec3, mate: ups[i] })),
        0.15,
      );
    },
  );

  b.step(
    {
      title: shoes ? "Fit the shoe shelf between the uprights" : "Fit the lower rail between the uprights",
      detail: "Low down, at the same height on both sides. Leave the bolts a little loose for now.",
      tools: ["allen"],
      kind: "bolts",
      people: shoes && W > 800 ? 2 : 1,
      warnings: ["loose"],
    },
    () => {
      b.add(low, [0, 0, 300]);
      b.then(0.1);
      const list: FitOpts[] = [];
      for (const [i, sx] of [-1, 1].entries())
        for (const z of shoes ? [-shelfD / 4, shelfD / 4] : [0]) list.push({ on: ups[i], at: [sx * (ux + tube / 2), lowY, z], dir: [-sx, 0, 0], mate: low });
      b.fits(HW.boltS, list, 0.12);
    },
  );

  b.step(
    {
      title: "Put the top rail on",
      detail: "It slots into the top of both uprights. One bolt holds each end.",
      tools: ["allen"],
      kind: "bolts",
      people: tall ? 2 : 1,
      warnings: tall ? ["two"] : [],
    },
    () => {
      b.add(rail, [0, 300, 0]);
      b.then(0.1);
      b.fits(
        HW.boltS,
        [-1, 1].map((sx, i) => ({ on: ups[i], at: [sx * (ux + tube / 2), railY, 0] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: rail })),
        0.15,
      );
    },
  );

  b.step(
    {
      title: "Tighten every bolt",
      detail: "Check that it stands steady and doesn't lean, then tighten them all firmly.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {},
  );
}
