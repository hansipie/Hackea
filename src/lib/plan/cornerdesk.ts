import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A corner desk: an L-shaped top, its corner at the back left, on five legs: one under the corner and two at the end of
 * each leg of the L. The top lies upside down for the leg plates and the legs, then it's turned over.
 */
export function buildCornerDesk(b: PlanBuilder, s: ProductSpec) {
  const p = s.table ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, L = s.size.d * 10;
  const tt = clamp(p.topThickness ?? 28, 15, 50);
  const ls = clamp(p.legSize ?? 40, 25, 70);
  const dp = clamp((p.ell ?? 60) * 10, 400, Math.min(W, L) - 200);
  const x0 = -W / 2, z0 = -L / 2;
  const Lh = H - tt;
  const y = H - tt / 2;

  const topC = b.compound("Desk top", [
    { shape: "box", size: [W, tt, dp], pos: [0, y, z0 + dp / 2] },
    { shape: "box", size: [dp, tt, L - dp], pos: [x0 + dp / 2, y, z0 + dp + (L - dp) / 2] },
  ]);
  const top = b.place(topC.type, topC.mid);
  const legT = b.part("Leg", [ls, Lh, ls], { shape: p.legs === "square" ? "box" : "cyl", material: p.legs === "square" ? "wood" : "metal" });
  const inset = 30 + ls / 2;
  const spots: [number, number][] = [
    [x0 + inset, z0 + inset],
    [W / 2 - inset, z0 + inset],
    [W / 2 - inset, z0 + dp - inset],
    [x0 + inset, L / 2 - inset],
    [x0 + dp - inset, L / 2 - inset],
  ];
  const legs = spots.map(([x, z]) => b.place(legT, [x, Lh / 2, z]));

  b.step(
    {
      title: "Lay the top upside down",
      detail: "Put the flattened box under it so the surface stays scratch free.",
      pose: "-y",
      kind: "general",
      people: 2,
      warnings: ["two", "floor"],
    },
    () => b.add(top, [0, 200, 0]),
  );
  b.step(
    {
      title: "Screw on the leg plates",
      detail: "One under the corner and two at the end of each side. Four screws per plate.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.fits(HW.plate, spots.map(([x, z]) => ({ on: top, at: [x, H - tt, z] as Vec3, dir: [0, 1, 0] as Vec3, hole: false })), 0.15);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const [x, z] of spots)
        for (const [dx, dz] of [[-28, -28], [28, -28], [28, 28], [-28, 28]]) sc.push({ on: top, at: [x + dx, H - tt - 3, z + dz], dir: [0, 1, 0], hole: false });
      b.fits(HW.screwM, sc, 0.03);
    },
  );
  b.step(
    {
      title: "Screw in the legs",
      detail: "Turn each one clockwise by hand. Hand tight is enough.",
      pose: "-y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.25);
      legs.forEach((l) => b.add(l, [0, -360, 0], { spin: 2 }));
    },
  );
  b.step(
    {
      title: "Turn it over together",
      detail: "Lift it by the top, not the legs, and stand it in the corner.",
      pose: "+y",
      kind: "flip",
      people: 2,
      warnings: ["two"],
    },
    () => {},
  );
}
