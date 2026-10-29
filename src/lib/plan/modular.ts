import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";

/**
 * A modular chest (NORDLI): one carcass split into columns by dividers, every column the same grid of drawer slots.
 * Drawers fill the slots from the bottom row up, a short top row centred; whatever is left above stays open, with a
 * shelf on pins over the drawers and every two slots higher up. Built like a chest of drawers: runners on the sides
 * while they lie flat, the carcass with its dividers, the back, then the shelves and the drawers.
 */
export function buildModular(b: PlanBuilder, s: ProductSpec) {
  const p = s.drawers ?? {};
  const cols = clamp(Math.round(p.modules ?? 2), 1, 4);
  const rows = clamp(Math.round(p.rows ?? 4), 1, 8);
  const n = clamp(Math.round(p.count ?? cols * rows), 1, cols * rows);
  const knobs = p.knobs ?? "none";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = clamp(p.thickness ?? 16, 12, 24);
  const base = 0;
  const f = new FrameKit(b, { W, H, D, t, base, plinth: false, fixed: [], back: true, pinRows: false, lying: H > 1100 });
  const innerH = H - 2 * t;
  const colW = (W - (cols + 1) * t) / cols;
  const colX = (c: number) => -W / 2 + t + colW / 2 + c * (colW + t);
  const slotH = innerH / rows;
  const slotY = (r: number) => t + r * slotH; // bottom of slot r

  // which slots hold a drawer: full rows from the bottom, the last row's drawers in the middle
  const full = Math.floor(n / cols), rest = n % cols;
  const slots: [number, number][] = [];
  for (let r = 0; r < full; r++) for (let c = 0; c < cols; c++) slots.push([c, r]);
  const first = Math.floor((cols - rest) / 2);
  for (let c = first; c < first + rest; c++) slots.push([c, full]);
  const drawersIn = (c: number) => slots.filter(([cc]) => cc === c).length;

  /* ---------- dividers ---------- */
  const divT = cols > 1 ? b.part("Divider", [t, innerH, D - 4]) : "";
  const divX = (c: number) => -W / 2 + t + (c + 1) * colW + c * t + t / 2;
  const dividers = Array.from({ length: cols - 1 }, (_, c) => b.place(divT, [divX(c), t + innerH / 2, -2]));

  /* ---------- drawers ---------- */
  const runLen = Math.round((D - 60) / 10) * 10;
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };
  const fw = colW - 4, fh = slotH - 4;
  const bw = colW - 26;
  const sh = Math.min(fh - 46, 170);
  const dd = D - t - 50;
  const frT = b.part("Drawer front", [fw, fh, t]);
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const dbT = b.part("Drawer back", [bw - 24, sh - 22, 12]);
  const dbtT = b.part("Drawer bottom", [bw - 10, 3, dd - 8], { material: "fiber" });
  interface Drawer {
    front: string;
    sides: [string, string];
    back: string;
    bottom: string;
    x: number;
    ys: number;
  }
  const drawers: Drawer[] = slots.map(([c, r]) => {
    const ys = slotY(r), x = colX(c);
    const sy = ys + 24 + sh / 2;
    return {
      x,
      ys,
      front: b.place(frT, [x, ys + slotH / 2, D / 2 - t / 2]),
      sides: [b.place(dsT, [x - bw / 2 + 6, sy, D / 2 - t - dd / 2]), b.place(dsT, [x + bw / 2 - 6, sy, D / 2 - t - dd / 2])],
      back: b.place(dbT, [x, ys + 24 + 22 + (sh - 22) / 2, D / 2 - t - dd + 6]),
      bottom: b.place(dbtT, [x, ys + 24 + 9, D / 2 - t - dd / 2 - 2]),
    };
  });
  const runnerY = (ys: number) => ys + 14;
  const runnerZ = D / 2 - t - runLen / 2 - 8;

  /* ---------- shelves in the open sections ---------- */
  const shT = b.part("Shelf", [colW - 3, t, D - 26]);
  const shelfYs: [number, number][] = []; // column, height of the pins
  for (let c = 0; c < cols; c++) {
    const lo = slotY(drawersIn(c)), hi = H - t;
    if (hi - lo < slotH * 0.9) continue;
    const ys: number[] = drawersIn(c) ? [lo + 3] : [];
    for (let y = lo + 2 * slotH; y < hi - slotH * 0.9; y += 2 * slotH) ys.push(y);
    for (const y of ys) shelfYs.push([c, y]);
  }
  const shelves = shelfYs.map(([c, y]) => b.place(shT, [colX(c), y + 3 + t / 2, 11]));
  // the faces either side of a column, where its pins and runners go
  const facesOf = (c: number) => {
    const out: { key: string; x: number; into: Vec3 }[] = [];
    out.push(c === 0 ? { key: f.sides[0], x: -W / 2 + t, into: [-1, 0, 0] } : { key: dividers[c - 1], x: divX(c - 1) + t / 2, into: [-1, 0, 0] });
    out.push(c === cols - 1 ? { key: f.sides[1], x: W / 2 - t, into: [1, 0, 0] } : { key: dividers[c], x: divX(c) - t / 2, into: [1, 0, 0] });
    return out;
  };
  for (const [c, y0] of shelfYs)
    for (const dy of [-64, 0, 64])
      for (const fc of facesOf(c)) for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(fc.key, [fc.x, y0 + dy, z], [-fc.into[0], 0, 0], 2.5);

  /* ---------- steps: the carcass ---------- */
  f.prepSides();
  const edgeSlots = slots.filter(([c]) => c === 0 || c === cols - 1);
  if (edgeSlots.length) {
    b.step(
      {
        title: "Screw the runners onto the sides",
        detail: "Only where the drawers go. The open end of each runner points to the front.",
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
        warnings: ["face"],
      },
      () => {
        const list: FitOpts[] = [];
        const screws: FitOpts[] = [];
        for (const [c, r] of edgeSlots)
          for (const fc of facesOf(c)) {
            if (fc.key !== f.sides[0] && fc.key !== f.sides[1]) continue;
            const y = runnerY(slotY(r));
            list.push({ on: fc.key, at: [fc.x, y, runnerZ], dir: fc.into, hole: false });
            for (const dz of [-runLen / 2 + 30, runLen / 2 - 30]) screws.push({ on: fc.key, at: [fc.x - fc.into[0] * 12, y, runnerZ + dz], dir: fc.into, hole: false });
          }
        b.fits(runner, list, 0.1);
        b.then(0.1);
        b.fits(HW.screwS, screws, 0.04);
      },
    );
  }
  f.join();
  if (dividers.length) {
    b.step(
      {
        title: dividers.length > 1 ? "Slide in the dividers" : "Slide in the divider",
        detail: "Screw each one to the top and bottom, then fit its runners on both faces, level with the ones on the sides.",
        tools: ["screwdriver"],
        pose: f.pose,
        kind: "join",
      },
      () => {
        b.stagger(0.25);
        dividers.forEach((k) => b.add(k, [0, 0, 420]));
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const [i, k] of dividers.entries())
          for (const y of [t, H - t]) for (const z of [-D / 4, D / 4]) sc.push({ on: k, at: [divX(i), y === t ? 0 : H, z], dir: [0, y === t ? 1 : -1, 0], hole: false });
        b.fits(HW.screwM, sc, 0.05);
        b.then(0.1);
        const list: FitOpts[] = [];
        for (const [c, r] of slots)
          for (const fc of facesOf(c)) {
            if (fc.key === f.sides[0] || fc.key === f.sides[1]) continue;
            list.push({ on: fc.key, at: [fc.x, runnerY(slotY(r)), runnerZ], dir: fc.into, hole: false });
          }
        b.fits(runner, list, 0.06);
      },
    );
  }
  f.otherSide();
  f.cams();
  f.backSteps();
  f.standUp();

  if (shelves.length) {
    b.step(
      {
        title: shelves.length > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf",
        detail: "Into the open sections, above the drawers. Use the same hole on all four corners.",
        kind: "shelves",
      },
      () => {
        const pins: FitOpts[] = [];
        for (const [c, y] of shelfYs) for (const fc of facesOf(c)) for (const z of [D / 2 - 40, -D / 2 + 40]) pins.push({ on: fc.key, at: [fc.x, y, z], dir: fc.into, hole: false });
        b.fits(HW.pin, pins, Math.min(0.05, 2 / pins.length));
        b.then(0.2);
        b.stagger(0.2);
        shelves.forEach((k) => b.add(k, [0, 0, 420]));
      },
    );
  }

  /* ---------- steps: the drawers ---------- */
  const d0 = drawers[0];
  const c0: Vec3 = [d0.x, d0.ys + slotH / 2, D / 2 - t - dd / 2];
  const at = (k: string) => b.partItem(k).final.pos;
  const rel = (k: string): Vec3 => [at(k)[0] - c0[0], at(k)[1] - c0[1], at(k)[2] - c0[2]];
  const backScrews = (d: Drawer): FitOpts[] => {
    const bp = at(d.back);
    return d.sides.flatMap((sd, i) => {
      const xo = at(sd)[0] + (i === 0 ? -6 : 6);
      return [-(sh - 22) / 4, (sh - 22) / 4].map((dy) => ({ on: sd, at: [xo, bp[1] + dy, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
    });
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
      weight: 0.8 + 0.4 * n,
    },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(k, [0, 0, 520]);
        if (i > 0) for (const o of backScrews(d)) b.preset(HW.screwM, o);
        b.wait(0.18);
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
      () => b.fits(def, drawers.map((d) => ({ on: d.front, at: [d.x, at(d.front)[1], D / 2] as Vec3, dir: [0, 0, -1] as Vec3, hole: false })), 0.08),
    );
  }

  f.anchor(f.top, H);
  const last = b.steps[b.steps.length - 1];
  last.detail = "Chests of drawers can tip over if they're not fixed. Wall screws aren't included: pick ones made for your wall.";
}
