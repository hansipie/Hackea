import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";

/**
 * Cabinets with doors and drawers: a carcass split by a fixed shelf, with full-width drawers under the doors
 * (HEMNES, IDANÄS, VILHATTEN) or one drawer above them (a kitchen base cabinet).
 * Built like a cabinet: runners onto the sides while they lie flat, the carcass, the back, then the shelves
 * behind the doors, the doors, the drawers and last the knobs.
 */
export function buildMixed(b: PlanBuilder, s: ProductSpec) {
  const c = s.cabinet ?? {};
  const p = {
    doors: c.doors === 0 ? 0 : c.doors === 1 ? 1 : 2,
    shelves: clamp(Math.round(c.shelves ?? 1), 0, 4),
    rail: !!c.rail,
    plinth: c.plinth ?? s.size.h > 100,
    handles: c.handles ?? "knob",
    thickness: clamp(c.thickness ?? 18, 12, 25),
  };
  const n = clamp(Math.round(c.drawers ?? 1), 1, 4);
  const top = c.drawerAt === "top";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = p.thickness;
  const base = p.plinth ? 70 : 0;
  const lying = H > 1100;
  const dh = top && H < 1000 ? 200 : clamp(H * 0.11, 150, 220); // one drawer, front to front
  const Hd = n * dh; // the drawers' opening
  const yDiv = top ? H - t - Hd - t / 2 : base + t + Hd + t / 2; // the fixed shelf between drawers and doors
  const f = new FrameKit(b, { W, H, D, t, base, plinth: p.plinth, fixed: [yDiv], back: true, pinRows: false, lying, names: { fixed: "Middle shelf" } });

  // the drawers' opening and the doors' opening, inside the carcass
  const dLo = top ? yDiv + t / 2 : base + t;
  const oLo = top ? base + t : yDiv + t / 2, oHi = top ? yDiv - t / 2 : H - t;
  const slotH = Hd / n;

  /* ---------- drawers ---------- */
  const runLen = Math.round((D - 60) / 10) * 10;
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };
  const fz = D / 2 + t / 2; // fronts sit on the front edge of the carcass
  const frontLo = top ? yDiv : base, frontHi = top ? H : yDiv;
  const fh = (frontHi - frontLo) / n - 4, fw = W - 4;
  const bw = W - 2 * t - 26;
  const sh = Math.min(slotH - 46, 170);
  const dd = D - 50;
  const frT = b.part("Drawer front", [fw, fh, t]);
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const dbT = b.part("Drawer back", [bw - 24, sh - 22, 12]);
  const dbtT = b.part("Drawer bottom", [bw - 10, 3, dd - 8], { material: "fiber" });
  interface Drawer {
    front: string;
    sides: [string, string];
    back: string;
    bottom: string;
    ys: number;
  }
  const drawers: Drawer[] = [];
  for (let r = 0; r < n; r++) {
    const ys = dLo + r * slotH; // bottom of its slot
    const sy = ys + 24 + sh / 2;
    const zBox = D / 2 - dd / 2;
    drawers.push({
      ys,
      front: b.place(frT, [0, frontLo + 2 + r * (fh + 4) + fh / 2, fz]),
      sides: [b.place(dsT, [-bw / 2 + 6, sy, zBox]), b.place(dsT, [bw / 2 - 6, sy, zBox])],
      back: b.place(dbT, [0, ys + 24 + 22 + (sh - 22) / 2, D / 2 - dd + 6]),
      bottom: b.place(dbtT, [0, ys + 24 + 9, zBox - 2]),
    });
  }

  /* ---------- steps: the carcass ---------- */
  f.prepSides();
  b.step(
    {
      title: n > 1 ? "Screw the drawer runners onto the sides" : "Screw the drawer runner onto each side",
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
        const into: Vec3 = [i === 0 ? -1 : 1, 0, 0];
        for (const d of drawers) {
          const y = d.ys + 14;
          list.push({ on: side, at: [xi, y, D / 2 - runLen / 2 - 8], dir: into, hole: false });
          for (const dz of [-runLen / 2 + 30, runLen / 2 - 30]) screws.push({ on: side, at: [xi + (i === 0 ? 12 : -12), y, D / 2 - runLen / 2 - 8 + dz], dir: into, hole: false });
        }
      });
      b.fits(runner, list, 0.12);
      b.then(0.1);
      b.fits(HW.screwS, screws, 0.04);
    },
  );
  f.join();
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  f.standUp();

  /* ---------- shelves and clothes rail behind the doors ---------- */
  const inner = W - 2 * t;
  if (p.rail) {
    // a wardrobe: one shelf up high, the rail under it
    const shY = oHi - 320;
    shelfStep([shY], "Add the shelf pins and the top shelf");
    const rT = b.part("Clothes rail", [24, inner - 2, 24], { shape: "cyl", material: "metal" });
    const ry = shY - 80;
    const rail = b.place(rT, [0, ry, 0], [0, 0, Math.PI / 2]);
    b.step(
      {
        title: "Fit the clothes rail",
        detail: "Clip the holders on first, then drop the rail in.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.fits(
          HW.screwS,
          f.sides.map((sd, i) => ({ on: sd, at: [(i === 0 ? -1 : 1) * (W / 2 - t), ry, 0] as Vec3, dir: [i === 0 ? -1 : 1, 0, 0] as Vec3, hole: false })),
          0.1,
        );
        b.then(0.1);
        b.add(rail, [0, -180, 260]);
      },
    );
  } else if (p.shelves > 0) {
    const ys = Array.from({ length: p.shelves }, (_, i) => Math.round((oLo + ((oHi - oLo) * (i + 1)) / (p.shelves + 1)) / 32) * 32);
    shelfStep(ys, p.shelves > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf");
  }

  function shelfStep(ys: number[], title: string) {
    const shT = b.part("Shelf", [inner - 3, t, D - 26]);
    const shelves = ys.map((y) => b.place(shT, [0, y + 3 + t / 2, 11]));
    // a row of holes above and below, so the shelf can move
    for (const y0 of ys)
      for (const dy of [-64, 0, 64])
        for (const [i, side] of f.sides.entries()) {
          const xi = i === 0 ? -W / 2 + t : W / 2 - t;
          for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(side, [xi, y0 + dy, z], [i === 0 ? 1 : -1, 0, 0], 2.5);
        }
    b.step(
      {
        title,
        detail: "Pick any height you like. Use the same hole on all four corners.",
        kind: "shelves",
      },
      () => {
        const pins: FitOpts[] = [];
        for (const y of ys)
          for (const [i, sd] of f.sides.entries()) {
            const x = i === 0 ? -W / 2 + t : W / 2 - t;
            for (const z of [D / 2 - 40, -D / 2 + 40]) pins.push({ on: sd, at: [x, y, z], dir: [i === 0 ? -1 : 1, 0, 0], hole: false });
          }
        b.fits(HW.pin, pins, 0.05);
        b.then(0.2);
        b.stagger(0.25);
        shelves.forEach((k) => b.add(k, [0, 0, 420]));
      },
    );
  }

  /* ---------- doors ---------- */
  const nd = p.doors;
  const doorLo = top ? base : yDiv, doorHi = top ? yDiv : H;
  const dwid = nd === 2 ? W / 2 - 3 : W - 4;
  const dht = doorHi - doorLo - 4;
  const dy = doorLo + 2 + dht / 2;
  const doorT = b.part("Door", [dwid, dht, t]);
  const doors = Array.from({ length: nd }, (_, i) => b.place(doorT, [nd === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0, dy, fz]));
  const hn = dht > 1500 ? 4 : dht > 900 ? 3 : 2;
  const hingeYs = Array.from({ length: hn }, (_, i) => doorLo + 110 + (i * (dht - 220)) / (hn - 1));
  const hingeX = (i: number) => {
    const sgn = nd === 2 && i === 1 ? 1 : -1;
    return { x: sgn * (W / 2 - 22), sgn };
  };
  // a bookcase with a drawer: open shelves above it, no doors
  if (nd > 0) {
    b.step(
      {
        title: nd > 1 ? "Press the hinges into the doors" : "Press the hinges into the door",
        detail: "Two small screws hold each one.",
        tools: ["screwdriver"],
        scene: "doors",
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        doors.forEach((d, i) => b.stage(d, [(i - (nd - 1) / 2) * (dwid + 80), t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
        b.then(0.1);
        const hinges: FitOpts[] = [];
        const screws: FitOpts[] = [];
        doors.forEach((d, i) => {
          const { x, sgn } = hingeX(i);
          for (const y of hingeYs) {
            hinges.push({ on: d, at: [x, y, D / 2], dir: [0, 0, 1], twist: sgn > 0 ? Math.PI : 0 });
            for (const dy2 of [-24, 24]) screws.push({ on: d, at: [x + sgn * 4, y + dy2, D / 2], dir: [0, 0, 1], hole: false });
          }
        });
        b.fits(HW.hinge, hinges, 0.1);
        b.then(0.05);
        b.fits(HW.screwS, screws, 0.03);
      },
    );
    b.step(
      {
        title: nd > 1 ? "Hang the doors" : "Hang the door",
        detail: "Slide each hinge arm onto its plate until it clicks.",
        kind: "doors",
        people: dht > 1500 ? 2 : 1,
        warnings: dht > 1500 ? ["two"] : [],
      },
      () => {
        b.stagger(0.35);
        doors.forEach((d) => b.add(d, [0, 0, 380]));
      },
    );
    b.step(
      {
        title: "Line up the doors",
        detail: "Turn the hinge screws a little until the gaps look even.",
        tools: ["screwdriver"],
        kind: "doors",
      },
      () => {},
    );
  }

  /* ---------- steps: the drawers ---------- */
  const d0 = drawers[0];
  const c0: Vec3 = [0, d0.ys + slotH / 2, D / 2 - dd / 2];
  const at = (k: string) => b.partItem(k).final.pos;
  const rel = (k: string): Vec3 => [at(k)[0] - c0[0], at(k)[1] - c0[1], at(k)[2] - c0[2]];
  const backScrews = (d: Drawer): FitOpts[] => {
    const bp = at(d.back);
    return d.sides.flatMap((sd, i) => {
      const xo = at(sd)[0] + (i === 0 ? -6 : 6);
      return [-(sh - 22) / 4, (sh - 22) / 4].map((dy2) => ({ on: sd, at: [xo, bp[1] + dy2, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
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
      weight: 0.8 + 0.5 * n,
    },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(k, [0, 0, 520]);
        if (i > 0) for (const o of backScrews(d)) b.preset(HW.screwM, o);
        b.wait(0.22);
      }
    },
  );

  /* ---------- knobs or handles on every front ---------- */
  if (p.handles !== "none") {
    const bar = p.handles === "bar";
    const def = bar ? HW.handle : HW.knob;
    b.step(
      {
        title: bar ? "Screw on the handles" : "Screw on the knobs",
        detail: nd > 0 ? "Screw from the inside of each door and drawer. Snug is enough." : "Screw from inside the drawer. Snug is enough.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = doors.map((d, i) => {
          const { sgn } = hingeX(i);
          const x = at(d)[0] - sgn * (dwid / 2 - 40);
          const y = top ? doorHi - 80 : Math.min(dy, Math.max(doorLo + 150, 1050));
          return { on: d, at: [x, y, D / 2 + t], dir: [0, 0, -1], hole: false, twist: bar ? Math.PI / 2 : 0 };
        });
        for (const d of drawers) list.push({ on: d.front, at: [0, at(d.front)[1], D / 2 + t], dir: [0, 0, -1], hole: false });
        b.fits(def, list, 0.1);
      },
    );
  }

  if (H >= 800) f.anchor();
}
