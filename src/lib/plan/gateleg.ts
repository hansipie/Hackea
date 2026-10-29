import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp, rotate } from "./math";

/**
 * Gateleg tables: a narrow fixed top on four legs, one or two leaves hinged to its sides, and for each leaf
 * a gate (a frame with a leg of its own) hinged to the frame that swings out under the leaf to hold it up.
 * size.w is the width with the leaves up. Built upside down, then turned over: the leaves hang down
 * until you raise them and swing the gates out.
 */
export function buildGateleg(b: PlanBuilder, s: ProductSpec) {
  const p = s.table ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const nL = p.leaves === 1 ? 1 : 2;
  const leaf = clamp((p.leaf ?? 50) * 10, 300, Math.min(700, (W - 250) / nL));
  const Wc = W - nL * leaf;
  const cx = nL === 1 ? -leaf / 2 : 0; // centre of the fixed top
  const tt = 22, ls = 40;
  const Lh = H - tt;
  const big = W > 1000;
  const sides = nL === 1 ? [1] : [1, -1];

  /* ---------- top and leaves ---------- */
  const topT = b.part("Table top", [Wc, tt, D]);
  const top = b.place(topT, [cx, H - tt / 2, 0]);
  const leafT = b.part("Leaf", [leaf - 2, tt, D]);
  const hinge = (sgn: number) => cx + sgn * (Wc / 2);
  const leaves = sides.map((sgn) => ({ sgn, key: b.place(leafT, [hinge(sgn) + sgn * (leaf / 2 + 1), H - tt / 2, 0]) }));

  /* ---------- the frame: legs at the corners of the fixed top, rails under it, stretchers low down ---------- */
  const inset = 20;
  const lx = Wc / 2 - ls / 2 - inset, lz = D / 2 - ls / 2 - 40;
  const legT = b.part("Leg", [ls, Lh, ls], { material: "wood" });
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const legs = corners.map(([sx, sz]) => b.place(legT, [cx + sx * lx, Lh / 2, sz * lz]));
  const rh = 70, rt = 20;
  const ry = H - tt - rh / 2;
  const shortT = b.part("Short rail", [2 * lx - ls, rh, rt], { material: "wood" });
  const longT = b.part("Long rail", [rt, rh, 2 * lz - ls], { material: "wood" });
  const rails = [
    b.place(shortT, [cx, ry, lz]),
    b.place(shortT, [cx, ry, -lz]),
    b.place(longT, [cx + lx, ry, 0]),
    b.place(longT, [cx - lx, ry, 0]),
  ];
  const sy = 160;
  const stretchT = b.part("Stretcher", [rt, 50, 2 * lz - ls], { material: "wood" });
  const stretchers = [-1, 1].map((sx) => b.place(stretchT, [cx + sx * lx, sy, 0]));
  const shelf = p.shelf ? b.place(b.part("Shelf", [2 * lx + ls - 4, 18, 2 * lz - ls], { material: "board" }), [cx, sy + 25 + 9, 0]) : undefined;

  /* ---------- gates: hinged at a front or back leg, folded along the frame or swung out under the leaf ---------- */
  const Lg = clamp(leaf * 0.72, 250, 2 * lz - 60);
  const gTop = H - tt - 30, gH = gTop - 10;
  const gatePieces: PartPiece[] = [
    { shape: "box", size: [ls, gH, ls], pos: [Lg - ls / 2, 10 + gH / 2, 0] },
    { shape: "box", size: [30, gTop - 150, 30], pos: [15, 150 + (gTop - 150) / 2, 0] },
    { shape: "box", size: [Lg, 50, 25], pos: [Lg / 2, gTop - 25, 0] },
    { shape: "box", size: [Lg, 40, 25], pos: [Lg / 2, 190, 0] },
  ];
  const gateC = b.compound("Gate leg", gatePieces, { material: "wood" });
  const gates = sides.map((sgn) => {
    // the right gate hangs on the front leg and folds back along the frame; the left one the other way round
    const pivot: Vec3 = [cx + sgn * (lx + ls / 2 + 8), 0, sgn * lz];
    const open = sgn > 0 ? 0 : Math.PI;
    const fold = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
    const at = (a: number): Vec3 => {
      const m = rotate(gateC.mid, [0, a, 0]);
      return [pivot[0] + m[0], pivot[1] + m[1], pivot[2] + m[2]];
    };
    return { sgn, pivot, folded: { pos: at(fold), rot: [0, fold, 0] as Vec3 }, key: b.place(gateC.type, at(open), [0, open, 0]) };
  });

  /* ---------- steps ---------- */
  const loose = !!p.hinges;
  b.step(
    {
      title: "Lay the top upside down",
      detail: loose ? "Put the leaves at its sides, on the flattened box." : "The leaves come hinged on. Keep them flat on the box while you work.",
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

  if (loose) {
    b.step(
      {
        title: nL > 1 ? "Screw the leaves on with the hinges" : "Screw the leaf on with the hinges",
        detail: "Two hinges across each joint, the pin right on the line.",
        tools: ["screwdriver"],
        pose: "-y",
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = [];
        const screws: FitOpts[] = [];
        for (const l of leaves) {
          const x = hinge(l.sgn);
          for (const z of [-D / 3, D / 3]) {
            list.push({ on: l.key, at: [x, H - tt, z], dir: [0, 1, 0], hole: false, mate: top });
            for (const dx of [-16, 16]) screws.push({ on: dx * l.sgn > 0 ? l.key : top, at: [x + dx, H - tt - 2, z], dir: [0, 1, 0], hole: false });
          }
        }
        b.fits(HW.flatHinge, list, 0.12);
        b.then(0.1);
        b.fits(HW.screwS, screws, 0.04);
      },
    );
  }

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
        const len = alongX ? 2 * lx - ls : 2 * lz - ls;
        for (const f of [-0.3, 0.3]) sc.push({ on: r, at: [pos[0] + (alongX ? f * len : 0), H - tt - rh, pos[2] + (alongX ? 0 : f * len)], dir: [0, 1, 0], hole: false });
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
      corners.forEach(([sx, sz], i) => {
        bolts.push({ on: legs[i], at: [cx + sx * (lx + ls / 2), H - tt - 35, sz * (lz - 10)], dir: [-sx, 0, 0] });
        bolts.push({ on: legs[i], at: [cx + sx * (lx - 10), H - tt - 35, sz * (lz + ls / 2)], dir: [0, 0, -sz] });
      });
      b.fits(HW.boltL, bolts, 0.08);
    },
  );

  b.step(
    {
      title: shelf ? "Screw in the stretchers and the shelf" : "Screw in the stretchers",
      detail: shelf ? "One low down between each pair of legs. The shelf rests on them." : "One low down between each pair of legs. Then tighten every bolt.",
      tools: ["allen"],
      pose: "-y",
      kind: "bolts",
    },
    () => {
      b.stagger(0.3);
      stretchers.forEach((k) => b.add(k, [0, -300, 0]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const [i, k] of stretchers.entries()) {
        const sx = i === 0 ? -1 : 1;
        for (const sz of [-1, 1]) bolts.push({ on: legs[corners.findIndex(([a, c]) => a === sx && c === sz)], at: [cx + sx * lx, sy, sz * (lz + ls / 2)], dir: [0, 0, -sz], mate: k });
      }
      b.fits(HW.boltL, bolts, 0.1);
      if (shelf) {
        b.then(0.1);
        b.add(shelf, [0, -240, 0]);
      }
    },
  );

  b.step(
    {
      title: nL > 1 ? "Hinge the gate legs onto the frame" : "Hinge the gate leg onto the frame",
      detail: nL > 1 ? "One at each end, folded flat along the frame for now." : "Folded flat along the frame for now.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      gates.forEach((g) => b.stage(g.key, g.folded.pos, g.folded.rot, [0, -280, 0]));
      b.then(0.1);
      const list: FitOpts[] = [];
      for (const g of gates) for (const y of [260, gTop - 120]) list.push({ on: g.key, at: [g.pivot[0], y, g.pivot[2]], dir: [-g.sgn, 0, 0], twist: Math.PI / 2, hole: false });
      b.fits(HW.flatHinge, list, 0.12);
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
      for (const l of leaves) b.stage(l.key, [hinge(l.sgn) + l.sgn * (tt / 2), H - tt - leaf / 2, 0], [0, 0, -l.sgn * (Math.PI / 2)]);
    },
  );

  b.step(
    {
      title: nL > 1 ? "Raise the leaves and swing out the gate legs" : "Raise the leaf and swing out the gate leg",
      detail: "Each gate turns out under its leaf. Fold it back in to drop the leaf.",
      kind: "general",
    },
    () => {
      b.stagger(0);
      leaves.forEach((l) => b.add(l.key));
      b.then(0.05);
      gates.forEach((g) => b.add(g.key));
    },
  );
}
