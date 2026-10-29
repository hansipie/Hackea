import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";

/**
 * A box with a lid on hinges: storage benches (GULLABERG, KALLSÖ), a storage table (HOL), footstools and
 * pouffes with storage. Two ends stand on the floor; the front and back go between them, a bottom slides into
 * their grooves, and the lid is hinged along the back. A padded lid when it's a footstool or a pouffe.
 */
export function buildLidBox(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const soft = !!s.cabinet?.lid?.soft;
  const t = 18;
  const lt = soft ? Math.min(90, H * 0.2) : 20; // the lid, padded on a footstool
  const Hb = H - lt; // top of the box
  const foot = Math.min(60, Hb * 0.12); // the ends reach down to the floor, the front and back stop short
  const iw = W - 2 * t;
  const big = W > 1200;
  const sx = W / 2 - t / 2;
  const zp = D / 2 - t / 2;

  const endT = b.part("End panel", [t, Hb, D]);
  const ends = [b.place(endT, [-sx, Hb / 2, 0]), b.place(endT, [sx, Hb / 2, 0], [0, Math.PI, 0])];
  const fbT = b.part("Front and back panel", [iw, Hb - foot, t]);
  const yPanel = foot + (Hb - foot) / 2;
  const back = b.place(fbT, [0, yPanel, -zp]);
  const front = b.place(fbT, [0, yPanel, zp], [0, Math.PI, 0]);
  const botT = b.part("Bottom panel", [iw - 2, 6, D - 2 * t + 16], { material: "fiber" });
  const yBot = foot + 30;
  const bottom = b.place(botT, [0, yBot, 0]);
  const lidT = b.part(soft ? "Padded lid" : "Lid", [W, lt, D], { material: soft ? "soft" : "board" });
  const lid = b.place(lidT, [0, Hb + lt / 2, 0]);

  // where the front and back meet the ends: a dowel and a bolt at each corner, top and bottom
  const ys = [foot + 50, Hb - 50];
  const joints = (side: number) => {
    const xi = side < 0 ? -W / 2 + t : W / 2 - t;
    const into: Vec3 = [side < 0 ? -1 : 1, 0, 0];
    const dowels: FitOpts[] = [], bolts: FitOpts[] = [];
    for (const [k, z] of [[back, -zp], [front, zp]] as const)
      for (const y of ys) {
        dowels.push({ on: ends[side < 0 ? 0 : 1], at: [xi, y, z + (z < 0 ? 4 : -4)], dir: into, mate: k });
        bolts.push({ on: ends[side < 0 ? 0 : 1], at: [xi, y + (y < Hb / 2 ? 30 : -30), z], dir: into, mate: k, mateHole: 4 });
      }
    return { dowels, bolts };
  };

  b.step(
    {
      title: "Fit the dowels and bolts into both ends",
      detail: "Tap the dowels in gently. Twist the bolts in by hand until they stop.",
      tools: ["hammer", "screwdriver"],
      scene: "prep",
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.18);
      ends.forEach((k, i) => b.stage(k, [0, t / 2, (i === 0 ? -1 : 1) * (Hb / 2 + 60)], [0, 0, Math.PI / 2], [0, 120, 0]));
      b.then(0.2);
      const l = joints(-1), r = joints(1);
      b.fits(HW.dowel, [...l.dowels, ...r.dowels], 0.06);
      b.then(0.15);
      b.fits(HW.camScrew, [...l.bolts, ...r.bolts], 0.06);
    },
  );

  b.step(
    {
      title: "Push the front and back onto one end",
      detail: "Their grooves face each other, inside and low down, ready for the bottom.",
      kind: "join",
      warnings: ["face"],
    },
    () => {
      b.add(ends[0], [-260, 0, 0]);
      b.then(0.1);
      b.stagger(0.25);
      b.add(back, [300, 0, 0]);
      b.add(front, [300, 0, 0]);
    },
  );

  b.step(
    {
      title: "Slide in the bottom",
      detail: "Smooth side up. It runs along both grooves until it meets the end.",
      kind: "join",
    },
    () => b.add(bottom, [W * 0.7, 0, 0]),
  );

  b.step(
    {
      title: "Add the other end",
      detail: "Line up the bolts with the holes, then press it on evenly.",
      kind: "join",
      people: big ? 2 : 1,
    },
    () => b.add(ends[1], [320, 0, 0]),
  );

  b.step(
    {
      title: "Lock the cam locks",
      detail: "Drop each one in with the arrow pointing at the bolt, then turn clockwise until it bites.",
      tools: ["screwdriver"],
      kind: "cams",
    },
    () => {
      const list: FitOpts[] = [];
      for (const [k, z] of [[back, -zp + t / 2], [front, zp - t / 2]] as const)
        for (const x of [-W / 2 + t + 30, W / 2 - t - 30]) for (const y of ys) list.push({ on: k, at: [x, y + (y < Hb / 2 ? 30 : -30), z], dir: [0, 0, z < 0 ? -1 : 1] });
      b.fits(HW.cam, list, 0.07);
    },
  );

  // two hinges along the back edge
  const hx = W > 900 ? [-W / 3, W / 3] : [-W / 4, W / 4];
  const hingeAt = (x: number): FitOpts => ({ on: lid, at: [x, Hb, -D / 2 + t + 2], dir: [0, 1, 0], hole: false });
  b.step(
    {
      title: "Screw the hinges onto the lid",
      detail: soft ? "Lay it padded side down. The hinges go along its back edge." : "Lay it face down on the flattened box. The hinges go along its back edge.",
      tools: ["screwdriver"],
      scene: "lid",
      kind: "hinges",
      warnings: ["floor"],
    },
    () => {
      b.stage(lid, [0, lt / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
      b.then(0.1);
      b.fits(HW.flatHinge, hx.map(hingeAt), 0.15);
      b.then(0.05);
      const sc: FitOpts[] = [];
      for (const x of hx) for (const dx of [-18, 18]) sc.push({ on: lid, at: [x + dx, Hb, -D / 2 + t + 12], dir: [0, 1, 0], hole: false });
      b.fits(HW.screwS, sc, 0.05);
    },
  );

  b.step(
    {
      title: "Put the lid on",
      detail: "Screw the other half of each hinge to the top of the back. Check the lid opens and closes freely.",
      tools: ["screwdriver"],
      kind: "hinges",
      people: big ? 2 : 1,
    },
    () => {
      b.add(lid, [0, 260, 0]);
      b.then(0.15);
      const sc: FitOpts[] = [];
      for (const x of hx) for (const dx of [-18, 18]) sc.push({ on: back, at: [x + dx, Hb, -zp], dir: [0, -1, 0], hole: false });
      b.fits(HW.screwS, sc, 0.06);
    },
  );
}
