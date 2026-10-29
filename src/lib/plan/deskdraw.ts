import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A desk or table with drawers under its top (HEMNES, BROR's work bench), and a dressing table with a mirror on it.
 * Built upside down like a table: rails along the back and sides, guides with runners for the drawers between them,
 * the legs bolted into the corners; then it's turned over, the mirror goes on, and the drawers slide in last.
 */
export function buildDeskDrawers(b: PlanBuilder, s: ProductSpec) {
  const tp = s.table ?? {};
  const n = clamp(Math.round(tp.drawers ?? 2), 1, 4);
  const W = s.size.w * 10, D = s.size.d * 10;
  const mirrorH = tp.mirror ? clamp(tp.mirror * 10, 300, 1000) : 0;
  const H = s.size.h * 10 - mirrorH; // the top's height
  const tt = 25, ls = clamp(tp.legSize ?? 50, 40, 70), inset = 20;
  const lx = W / 2 - inset - ls / 2, lz = D / 2 - inset - ls / 2;
  const dh = 150, rt = 20;
  const yr = H - tt - dh / 2; // middle of the rails and the drawer fronts
  const big = W > 1000;
  const knobs = tp.knobs ?? "knob";

  const topT = b.part(/dressing|desk/i.test(s.category) ? "Desk top" : "Table top", [W, tt, D]);
  const top = b.place(topT, [0, H - tt / 2, 0]);
  const legT = b.part("Leg", [ls, H - tt, ls], { material: "wood" });
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const legs = corners.map(([sx, sz]) => b.place(legT, [sx * lx, (H - tt) / 2, sz * lz]));
  const backT = b.part("Back rail", [2 * lx - ls, dh, rt], { material: "wood" });
  const back = b.place(backT, [0, yr, -(lz + ls / 2 - rt / 2)]);
  const sideT = b.part("Side rail", [rt, dh, 2 * lz - ls], { material: "wood" });
  const sides = [-1, 1].map((sx) => b.place(sideT, [sx * (lx + ls / 2 - rt / 2), yr, 0]));

  // guides between the legs, one each side of every drawer, runners on their faces
  const gt = 16;
  const span = 2 * (lx - ls / 2);
  const cw = (span - (n + 1) * gt) / n;
  const gx = (k: number) => -span / 2 + gt / 2 + k * (cw + gt);
  const cx = (i: number) => gx(i) + gt / 2 + cw / 2;
  const zFront = lz + ls / 2; // the fronts line up with the front of the legs
  const zBack = -(lz + ls / 2 - rt);
  const gd = zFront - 20 - zBack;
  const guideT = b.part("Drawer guide", [gt, dh - 10, gd]);
  const guides = Array.from({ length: n + 1 }, (_, k) => b.place(guideT, [gx(k), yr + 5, zBack + gd / 2]));
  const runLen = Math.max(200, Math.round((gd - 40) / 10) * 10);
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };
  const ry = H - tt - dh + 24;
  const rz = zFront - 20 - runLen / 2 - 10;

  // the drawers
  const ft = 18;
  const fw = cw + gt - 4, fh = dh - 6;
  const bw = cw - 26, sh = dh - 60, dd = runLen;
  const frT = b.part("Drawer front", [fw, fh, ft]);
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const dbT = b.part("Drawer back", [bw - 24, sh - 22, 12]);
  const dbtT = b.part("Drawer bottom", [bw - 10, 3, dd - 8], { material: "fiber" });
  const zBox = zFront - ft - dd / 2;
  const drawers = Array.from({ length: n }, (_, i) => {
    const x = cx(i), sy = ry - 10 + sh / 2;
    return {
      x,
      front: b.place(frT, [x, yr, zFront - ft / 2]),
      sides: [b.place(dsT, [x - bw / 2 + 6, sy, zBox]), b.place(dsT, [x + bw / 2 - 6, sy, zBox])] as [string, string],
      back: b.place(dbT, [x, sy + 11, zBox - dd / 2 + 6]),
      bottom: b.place(dbtT, [x, ry - 10 + 9, zBox - 2]),
    };
  });

  b.step(
    {
      title: "Lay the top upside down",
      detail: "Put the flattened box under it so the surface stays scratch free.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
      people: big ? 2 : 1,
    },
    () => b.add(top, [0, 200, 0]),
  );

  b.step(
    {
      title: "Screw the rails under the top",
      detail: "One along the back and one down each side, set in from the edge.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      [back, ...sides].forEach((k) => b.add(k, [0, -260, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const f of [-0.33, 0.33]) sc.push({ on: back, at: [f * (2 * lx - ls), H - tt - dh, -(lz + ls / 2 - rt / 2)], dir: [0, 1, 0], hole: false });
      for (const [i, k] of sides.entries()) for (const f of [-0.33, 0.33]) sc.push({ on: k, at: [(i === 0 ? -1 : 1) * (lx + ls / 2 - rt / 2), H - tt - dh, f * (2 * lz - ls)], dir: [0, 1, 0], hole: false });
      b.fits(HW.screwL, sc, 0.06);
    },
  );

  b.step(
    {
      title: n > 1 ? "Screw the drawer guides under the top" : "Screw both drawer guides under the top",
      detail: "Runners on them first, open ends to the front. Then screw each guide down between the rails.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "runners",
    },
    () => {
      b.stagger(0.18);
      guides.forEach((k) => b.add(k, [0, -240, 0]));
      b.then(0.1);
      const runs: FitOpts[] = [];
      for (let i = 0; i < n; i++)
        for (const [k, sgn] of [[guides[i], 1], [guides[i + 1], -1]] as const) runs.push({ on: k, at: [gx(i + (sgn > 0 ? 0 : 1)) + (sgn * gt) / 2, ry, rz], dir: [-sgn, 0, 0], hole: false });
      b.fits(runner, runs, 0.08);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (let k = 0; k <= n; k++) for (const dz of [-gd / 3, gd / 3]) sc.push({ on: guides[k], at: [gx(k), H - tt - dh + 10, zBack + gd / 2 + dz], dir: [0, 1, 0], hole: false });
      b.fits(HW.screwM, sc, 0.05);
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
        bolts.push({ on: legs[i], at: [sx * (lx + ls / 2), yr, sz * (lz - ls / 4)], dir: [-sx, 0, 0] });
        if (sz < 0) bolts.push({ on: legs[i], at: [sx * (lx - ls / 4), yr, sz * (lz + ls / 2)], dir: [0, 0, -sz] });
      });
      b.fits(HW.boltL, bolts, 0.08);
    },
  );

  b.step(
    {
      title: big ? "Turn it over together" : "Turn it over",
      detail: "Lift it by the top, not the legs. Then tighten every bolt.",
      tools: ["allen"],
      pose: "+y",
      kind: "flip",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {},
  );

  if (mirrorH) {
    const mw = clamp(W * 0.6, 400, 900), post = 40;
    const pieces: PartPiece[] = [
      { shape: "box", size: [mw, mirrorH - 60, 6], pos: [0, 60 + (mirrorH - 60) / 2, 0], material: "metal" },
      { shape: "box", size: [mw + 2 * post, 30, 30], pos: [0, mirrorH - 15, 0], material: "wood" },
    ];
    for (const sx of [-1, 1]) pieces.push({ shape: "box", size: [post, mirrorH, 30], pos: [sx * (mw / 2 + post / 2), mirrorH / 2, 0], material: "wood" });
    const c = b.compound("Mirror", pieces);
    const zm = -D / 2 + 40;
    const mirror = b.place(c.type, [c.mid[0], H + c.mid[1], zm + c.mid[2]]);
    b.step(
      {
        title: "Fix the mirror to the back of the top",
        detail: "Stand it in place, then screw its posts down through the holes in the top.",
        tools: ["screwdriver"],
        kind: "screws",
        people: 2,
        warnings: ["two"],
      },
      () => {
        b.add(mirror, [0, 300, 0]);
        b.then(0.15);
        const sc: FitOpts[] = [-1, 1].map((sx) => ({ on: top, at: [sx * (mw / 2 + post / 2), H - tt, zm] as Vec3, dir: [0, 1, 0] as Vec3, hole: false }));
        b.fits(HW.screwL, sc, 0.12);
      },
    );
  }

  const d0 = drawers[0];
  const c0: Vec3 = [d0.x, yr, zBox];
  const at = (k: string) => b.partItem(k).final.pos;
  const rel = (k: string): Vec3 => [at(k)[0] - c0[0], at(k)[1] - c0[1], at(k)[2] - c0[2]];
  const backScrews = (d: (typeof drawers)[number]): FitOpts[] => {
    const bp = at(d.back);
    return d.sides.flatMap((sd, i) => [-(sh - 22) / 4, (sh - 22) / 4].map((dy) => ({ on: sd, at: [at(sd)[0] + (i === 0 ? -6 : 6), bp[1] + dy, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 })));
  };
  b.step(
    {
      title: n > 1 ? "Put the drawers together" : "Put the drawer together",
      detail: "Sides onto the front, slide the bottom in along the grooves, then screw on the back.",
      tools: ["screwdriver"],
      scene: "drawer",
      pose: "-z",
      repeat: n > 1 ? n : undefined,
      kind: "drawer",
      warnings: ["floor"],
    },
    () => {
      b.stage(d0.front, rel(d0.front), [0, 0, 0], [0, 0, -160]);
      b.then(0.1);
      b.stagger(0.25);
      for (const sd of d0.sides) b.stage(sd, rel(sd), [0, 0, 0], [0, 0, -300]);
      b.then(0.1);
      b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, -420]);
      b.then(0.1);
      b.stage(d0.back, rel(d0.back), [0, 0, 0], [0, 0, -260]);
      b.then(0.15);
      b.fits(HW.screwM, backScrews(d0), 0.12);
    },
  );
  b.step(
    {
      title: n > 1 ? `Slide in all ${n} drawers` : "Slide in the drawer",
      detail: "Rest the back on the runners, then push until it clicks closed.",
      kind: "drawer",
      weight: 0.8 + 0.5 * n,
    },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(k, [0, 0, 480]);
        if (i > 0) for (const o of backScrews(d)) b.preset(HW.screwM, o);
        b.wait(0.22);
      }
    },
  );
  if (knobs !== "none") {
    const def = knobs === "bar" ? HW.handle : HW.knob;
    b.step(
      {
        title: knobs === "bar" ? "Screw on the handles" : "Screw on the knobs",
        detail: "Screw from inside the drawer. Snug is enough.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => b.fits(def, drawers.map((d) => ({ on: d.front, at: [d.x, yr, zFront] as Vec3, dir: [0, 0, -1] as Vec3, hole: false })), 0.1),
    );
  }
}
