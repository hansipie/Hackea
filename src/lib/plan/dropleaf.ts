import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * Drop-leaf tables: a fixed top on four legs with an apron, and one or two leaves hinged to its ends,
 * held up by supports that swing out from under the top. size.w is the width with the leaves up.
 * Built upside down like the other tables; turned over, the leaves hang down until you raise them.
 */
export function buildDropLeaf(b: PlanBuilder, s: ProductSpec) {
  const p = s.table ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const nL = p.leaves === 1 ? 1 : 2;
  const leaf = clamp((p.leaf ?? 30) * 10, 150, Math.min(600, (W - 400) / nL));
  const Wc = W - nL * leaf;
  const cx = nL === 1 ? -leaf / 2 : 0; // centre of the fixed top
  const tt = 25, ls = 45, inset = 45;
  const Lh = H - tt;
  const big = W > 1000;

  const topT = b.part("Table top", [Wc, tt, D]);
  const top = b.place(topT, [cx, H - tt / 2, 0]);
  const leafT = b.part("Leaf", [leaf - 2, tt, D]);
  // leaves on the right (+x) first; a single leaf is always on the right
  const sides = nL === 1 ? [1] : [1, -1];
  const hinge = (sgn: number) => cx + sgn * (Wc / 2);
  const leaves = sides.map((sgn) => ({ sgn, key: b.place(leafT, [hinge(sgn) + sgn * (leaf / 2 + 1), H - tt / 2, 0]) }));

  // apron and legs under the fixed top, as on a dining table
  const lx = Wc / 2 - ls / 2 - inset, lz = D / 2 - ls / 2 - inset;
  const legT = b.part("Leg", [ls, Lh, ls], { material: "wood" });
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const legs = corners.map(([sx, sz]) => b.place(legT, [cx + sx * lx, Lh / 2, sz * lz]));
  const rh = 80, rt = 20;
  const ry = H - tt - rh / 2;
  const longT = b.part("Long rail", [Wc - 2 * inset - 2 * ls, rh, rt], { material: "wood" });
  const shortT = b.part("Short rail", [rt, rh, D - 2 * inset - 2 * ls], { material: "wood" });
  const rails = [
    b.place(longT, [cx, ry, lz + ls / 2 - rt / 2]),
    b.place(longT, [cx, ry, -(lz + ls / 2 - rt / 2)]),
    b.place(shortT, [cx + lx + ls / 2 - rt / 2, ry, 0]),
    b.place(shortT, [cx - (lx + ls / 2 - rt / 2), ry, 0]),
  ];

  // a support for each leaf, pivoting on the outside of a short rail: folded along it, or swung out under the leaf
  const armL = Math.min(leaf + inset - 10, D / 2 - 20);
  const armT = b.part("Leaf support", [armL, 22, 36], { material: "wood" });
  const armY = H - tt - 11;
  const supports = sides.map((sgn) => {
    const px = cx + sgn * (lx + ls / 2 + 18); // pivot, just outside the short rail
    const open: Vec3 = [px + sgn * (armL / 2 - 18), armY, 0];
    const folded: Vec3 = [px, armY, armL / 2 - 18];
    return { sgn, px, folded, key: b.place(armT, open) };
  });

  b.step(
    {
      title: "Lay the top upside down",
      detail: "The leaves come hinged on. Keep them flat on the box while you work.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
      people: big ? 2 : 1,
    },
    () => {
      b.stagger(0);
      b.add(top, [0, 200, 0]);
      leaves.forEach((l) => b.add(l.key, [0, 200, 0]));
    },
  );

  b.step(
    {
      title: "Screw the rails under the top",
      detail: "They frame the fixed middle, set in from the edge.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      rails.forEach((r) => b.add(r, [0, -260, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const r of rails) {
        const pos = b.partItem(r).final.pos;
        const alongX = Math.abs(pos[2]) > 1;
        const len = alongX ? Wc - 2 * inset - 2 * ls : D - 2 * inset - 2 * ls;
        for (const f of [-0.33, 0.33]) sc.push({ on: r, at: [pos[0] + (alongX ? f * len : 0), H - tt - rh, pos[2] + (alongX ? 0 : f * len)], dir: [0, 1, 0], hole: false });
      }
      b.fits(HW.screwL, sc, 0.06);
    },
  );

  b.step(
    {
      title: "Bolt the legs into the corners",
      detail: "Hand tight for now. Tighten them all once every leg is on.",
      tools: ["allen"],
      pose: "-y",
      kind: "legs",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0.3);
      legs.forEach((l) => b.add(l, [0, -360, 0]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      const y = H - tt - 40;
      const off = ls / 2 - 10;
      corners.forEach(([sx, sz], i) => {
        bolts.push({ on: legs[i], at: [cx + sx * (lx + ls / 2), y, sz * (lz + off)], dir: [-sx, 0, 0] });
        bolts.push({ on: legs[i], at: [cx + sx * (lx + off), y, sz * (lz + ls / 2)], dir: [0, 0, -sz] });
      });
      b.fits(HW.boltL, bolts, 0.08);
    },
  );

  b.step(
    {
      title: nL > 1 ? "Screw on the leaf supports" : "Screw on the leaf support",
      detail: "Fold them in along the rails for now.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      supports.forEach((sp) => b.stage(sp.key, sp.folded, [0, -sp.sgn * (Math.PI / 2), 0], [0, -200, 0]));
      b.then(0.1);
      b.fits(
        HW.screwM,
        supports.map((sp) => ({ on: sp.key, at: [sp.px, armY - 11, 0] as Vec3, dir: [0, 1, 0] as Vec3, hole: false })),
        0.12,
      );
    },
  );

  b.step(
    {
      title: big ? "Turn it over together" : "Turn it over",
      detail: "Lift it by the top, not the legs. The leaves drop down.",
      pose: "+y",
      kind: "flip",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {
      // each leaf hangs from its hinge at the edge of the top
      for (const l of leaves) {
        const hx = hinge(l.sgn);
        b.stage(l.key, [hx + l.sgn * (tt / 2), H - tt - leaf / 2, 0], [0, 0, -l.sgn * (Math.PI / 2)]);
      }
    },
  );

  b.step(
    {
      title: nL > 1 ? "Raise the leaves and swing out the supports" : "Raise the leaf and swing out the support",
      detail: "Each support turns out under its leaf. Fold them back in to drop the leaves.",
      kind: "general",
    },
    () => {
      b.stagger(0);
      leaves.forEach((l) => b.add(l.key));
      b.then(0.05);
      supports.forEach((sp) => b.add(sp.key));
    },
  );
}
