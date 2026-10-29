import type { DrawersParams, ProductSpec } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";
import { buildChanging } from "./changing";
import { CASTOR_H, castorStep, liftOntoCastors } from "./castors";
import { buildModular } from "./modular";

export function defaultsDrawers(s: ProductSpec): DrawersParams {
  const p = s.drawers ?? {};
  return {
    cols: p.cols === 2 ? 2 : 1,
    rows: clamp(Math.round(p.rows ?? 3), 1, 10),
    knobs: p.knobs ?? "none",
    plinth: p.plinth ?? false,
    thickness: clamp(p.thickness ?? 16, 12, 24),
  };
}

export function buildDrawers(b: PlanBuilder, s: ProductSpec) {
  if (s.drawers?.changing) return buildChanging(b, s, buildDrawers);
  if (s.drawers?.modules) return buildModular(b, s);
  const p = defaultsDrawers(s);
  // on castors: the carcass is built on the floor, then lifted onto them
  const ch = s.drawers?.castors ? CASTOR_H : 0;
  const W = s.size.w * 10, H = s.size.h * 10 - ch, D = s.size.d * 10;
  const t = p.thickness;
  const base = p.plinth ? 70 : 0;
  const f = new FrameKit(b, { W, H, D, t, base, plinth: p.plinth, fixed: [], back: true, pinRows: false, lying: false });
  const { cols, rows } = p;

  // divider for two columns
  const innerH = H - 2 * t - base;
  let divider: string | undefined;
  if (cols === 2) {
    const dT = b.part("Middle panel", [t, innerH, D - 4]);
    divider = b.place(dT, [0, base + t + innerH / 2, -2]);
  }
  const colW = cols === 2 ? (W - 3 * t) / 2 : W - 2 * t;
  const colX = (c: number) => (cols === 2 ? (c === 0 ? -1 : 1) * (t / 2 + colW / 2) : 0);
  const slotH = innerH / rows;
  const runLen = Math.round((D - 60) / 10) * 10;
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };

  // drawer geometry
  const fw = colW - 4, fh = slotH - 4;
  const bw = colW - 26; // box width between runners
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
  const drawers: Drawer[] = [];
  for (let c = 0; c < cols; c++)
    for (let r = rows - 1; r >= 0; r--) {
      const ys = base + t + r * slotH;
      const x = colX(c);
      const zBack = D / 2 - t - dd;
      const sy = ys + 24 + sh / 2;
      drawers.push({
        x,
        ys,
        front: b.place(frT, [x, ys + slotH / 2, D / 2 - t / 2]),
        sides: [b.place(dsT, [x - bw / 2 + 6, sy, D / 2 - t - dd / 2]), b.place(dsT, [x + bw / 2 - 6, sy, D / 2 - t - dd / 2])],
        back: b.place(dbT, [x, ys + 24 + 22 + (sh - 22) / 2, zBack + 6]),
        bottom: b.place(dbtT, [x, ys + 24 + 9, D / 2 - t - dd / 2 - 2]),
      });
    }
  // top row first reads naturally, but build the bottom one first so later drawers are hidden by it
  drawers.sort((a, b2) => a.ys - b2.ys || a.x - b2.x);

  f.prepSides();

  // runners on the sides while they lie flat
  b.step(
    {
      title: "Screw the runners onto the sides",
      detail: "The open end of each runner points to the front.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "runners",
      warnings: ["face"],
    },
    () => {
      const list: FitOpts[] = [];
      const screws: FitOpts[] = [];
      f.sides.forEach((side, i) => {
        const xi = i === 0 ? -W / 2 + t : W / 2 - t;
        const into: [number, number, number] = [i === 0 ? -1 : 1, 0, 0];
        for (let r = 0; r < rows; r++) {
          const y = base + t + r * slotH + 14;
          list.push({ on: side, at: [xi, y, D / 2 - t - runLen / 2 - 8], dir: into, hole: false });
          for (const dz of [-runLen / 2 + 30, runLen / 2 - 30])
            screws.push({ on: side, at: [xi + (i === 0 ? 12 : -12), y, D / 2 - t - runLen / 2 - 8 + dz], dir: into, hole: false });
        }
      });
      b.fits(runner, list, 0.12);
      b.then(0.1);
      b.fits(HW.screwS, screws, 0.04);
    },
  );

  f.join();
  if (divider) {
    b.step(
      {
        title: "Slide in the middle panel",
        detail: "Its runners face both columns.",
        tools: ["screwdriver"],
        kind: "join",
      },
      () => {
        b.add(divider!, [0, 0, 420]);
        b.then(0.1);
        const list: FitOpts[] = [];
        for (const sgn of [-1, 1])
          for (let r = 0; r < rows; r++) {
            const y = base + t + r * slotH + 14;
            list.push({ on: divider!, at: [sgn * (t / 2), y, D / 2 - t - runLen / 2 - 8], dir: [-sgn, 0, 0], hole: false });
          }
        b.fits(runner, list, 0.08);
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const y of [base + t, H - t])
          for (const z of [-D / 4, D / 4]) sc.push({ on: divider!, at: [0, y === base + t ? base : H, z], dir: [0, y === base + t ? 1 : -1, 0], hole: false });
        b.fits(HW.screwM, sc, 0.08);
      },
    );
  }
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  if (ch) castorStep(b, { bottom: f.bottom, W, D, y: base, big: H > 1000 });
  f.standUp();

  // build the first drawer in its own scene, front face down
  const n = drawers.length;
  const d0 = drawers[0];
  const c0: [number, number, number] = [d0.x, d0.ys + slotH / 2, D / 2 - t - dd / 2];
  const rel = (k: string) => {
    const it = b.partItem(k);
    return [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]] as [number, number, number];
  };
  const rep = n > 1 ? n : undefined;
  b.step(
    {
      title: "Push the dowels into the drawer front",
      detail: "Lay the front face down on something soft.",
      tools: ["hammer"],
      scene: "drawer",
      pose: "-z",
      repeat: rep,
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.stage(d0.front, rel(d0.front), [0, 0, 0], [0, 0, -160]);
      b.then(0.1);
      const list: FitOpts[] = [];
      for (const sd of d0.sides) {
        const x = b.partItem(sd).final.pos[0];
        const sy = b.partItem(sd).final.pos[1];
        for (const dy of [-sh / 4, sh / 4]) list.push({ on: d0.front, at: [x, sy + dy, D / 2 - t], dir: [0, 0, 1], mate: sd });
      }
      b.fits(HW.dowel, list, 0.08);
    },
  );
  b.step(
    {
      title: "Attach the drawer sides",
      detail: "Grooves face inwards and down, ready for the bottom.",
      scene: "drawer",
      pose: "-z",
      repeat: rep,
      kind: "drawer",
      warnings: ["face"],
    },
    () => {
      b.stagger(0.25);
      for (const sd of d0.sides) b.stage(sd, rel(sd), [0, 0, 0], [0, 0, -300]);
    },
  );
  b.step(
    {
      title: "Slide in the drawer bottom",
      detail: "Smooth side up. It runs along the grooves until it stops.",
      scene: "drawer",
      pose: "-z",
      repeat: rep,
      kind: "drawer",
    },
    () => b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, -420]),
  );
  const backScrews = (d: Drawer): FitOpts[] => {
    const by = b.partItem(d.back).final.pos[1];
    const bz = b.partItem(d.back).final.pos[2];
    const out: FitOpts[] = [];
    d.sides.forEach((sd, i) => {
      const xo = b.partItem(sd).final.pos[0] + (i === 0 ? -6 : 6);
      for (const dy of [-(sh - 22) / 4, (sh - 22) / 4]) out.push({ on: sd, at: [xo, by + dy, bz], dir: [i === 0 ? 1 : -1, 0, 0] });
    });
    return out;
  };
  b.step(
    {
      title: "Screw on the drawer back",
      detail: "Check the bottom sits in the back's groove before you tighten.",
      tools: ["screwdriver"],
      scene: "drawer",
      pose: "-z",
      repeat: rep,
      kind: "screws",
    },
    () => {
      b.stage(d0.back, rel(d0.back), [0, 0, 0], [0, 0, -260]);
      b.then(0.15);
      b.fits(HW.screwM, backScrews(d0), 0.12);
    },
  );

  // insert all drawers
  b.step(
    {
      title: n > 1 ? `Slide in all ${n} drawers` : "Slide in the drawer",
      detail: "Rest the back on the runners, then push until it clicks closed.",
      kind: "drawer",
    },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(k, [0, 0, 520]);
        if (i > 0) {
          for (const sd of d.sides) {
            const x = b.partItem(sd).final.pos[0];
            const sy = b.partItem(sd).final.pos[1];
            for (const dy of [-sh / 4, sh / 4]) b.preset(HW.dowel, { on: d.front, at: [x, sy + dy, D / 2 - t], dir: [0, 0, 1], mate: sd });
          }
          for (const o of backScrews(d)) b.preset(HW.screwM, o);
        }
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;

  if (p.knobs !== "none") {
    const def = p.knobs === "bar" ? HW.handle : HW.knob;
    b.step(
      {
        title: p.knobs === "bar" ? "Screw on the handles" : "Screw on the knobs",
        detail: "Screw from inside the drawer. Snug is enough.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = drawers.map((d) => ({
          on: d.front,
          at: [d.x, b.partItem(d.front).final.pos[1] + (fh > 220 ? fh * 0.22 : 0), D / 2],
          dir: [0, 0, -1],
          hole: false,
        }));
        b.fits(def, list, 0.1);
      },
    );
  }

  // a drawer unit on castors rolls about: nothing to fix to the wall
  if (ch) return liftOntoCastors(b);
  if (s.drawers?.free) return;
  f.anchor(f.top, H);
  const last = b.steps[b.steps.length - 1];
  last.detail = "Chests of drawers can tip over if they're not fixed. Wall screws aren't included: pick ones made for your wall.";
}
