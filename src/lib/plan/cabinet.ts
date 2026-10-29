import type { CabinetParams, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";
import { buildFitted } from "./fitted";
import { buildMixed } from "./mixed";
import { buildSliding } from "./sliding";
import { buildCornerCabinet } from "./cornercab";
import { buildLidBox } from "./lidbox";
import { CASTOR_H, castorStep, liftOntoCastors } from "./castors";
import { buildShelfCab } from "./shelfcab";

export function defaultsCabinet(s: ProductSpec): CabinetParams {
  const p = s.cabinet ?? {};
  const tilt = p.fronts === "tilt";
  return {
    fronts: tilt ? "tilt" : "doors",
    compartments: clamp(Math.round(p.compartments ?? 2), 1, 5),
    doors: tilt ? 0 : p.doors === 0 || p.doors === 1 || p.doors === 2 ? p.doors : s.size.w > 60 ? 2 : 1,
    shelves: clamp(Math.round(p.shelves ?? 1), 0, 5),
    rail: p.rail ?? s.size.h > 160,
    plinth: p.plinth ?? s.size.h > 120,
    handles: p.handles ?? "knob",
    thickness: clamp(p.thickness ?? 18, 12, 25),
  };
}

export function buildCabinet(b: PlanBuilder, s: ProductSpec) {
  if (s.cabinet?.lid) return buildLidBox(b, s);
  if (s.cabinet?.low) return buildShelfCab(b, s);
  if (s.cabinet?.corner) return buildCornerCabinet(b, s);
  if (s.cabinet?.fit) return buildFitted(b, s);
  if (s.cabinet?.drawers) return buildMixed(b, s);
  if (s.cabinet?.fronts === "sliding") return buildSliding(b, s);
  const p = defaultsCabinet(s);
  if (p.fronts === "tilt") return tiltCabinet(b, s, p);
  // on castors: the carcass is built on the floor, then lifted onto them
  const ch = s.cabinet?.castors ? CASTOR_H : 0;
  const up = (s.cabinet?.upstand ?? 0) * 10;
  const W = s.size.w * 10, H = s.size.h * 10 - ch - up, D = s.size.d * 10;
  const t = p.thickness;
  const wall = !!s.cabinet?.wall;
  if (wall || ch) p.plinth = false;
  const base = p.plinth ? 70 : 0;
  const lying = H > 1100;
  const f = new FrameKit(b, {
    W, H, D, t, base,
    plinth: p.plinth,
    fixed: [],
    back: true,
    pinRows: p.shelves > 0,
    lying,
  });

  f.prepSides();
  f.join(lying ? 1 : 1);
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  if (ch) castorStep(b, { bottom: f.bottom, W, D, y: base, big: H > 1000 });
  f.standUp();

  // shelves sit lower when there is a rail
  if (p.shelves > 0) f.shelves(p.shelves);

  if (p.rail) {
    const rT = b.part("Clothes rail", [24, W - 2 * t - 2, 24], { shape: "cyl", material: "metal" });
    const ry = H - t - 70;
    const rail = b.place(rT, [0, ry, 0], [0, 0, Math.PI / 2]);
    b.step(
      {
        title: "Fit the clothes rail",
        detail: "Clip the holders on first, then drop the rail in.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const holders: FitOpts[] = f.sides.map((sd, i) => ({
          on: sd,
          at: [(i === 0 ? -1 : 1) * (W / 2 - t), ry, 0] as Vec3,
          dir: [i === 0 ? -1 : 1, 0, 0] as Vec3,
          hole: false,
        }));
        b.fits(HW.screwS, holders, 0.1);
        b.then(0.1);
        b.add(rail, [0, -180, 260]);
      },
    );
  }

  doorSteps(b, p, W, H, D, base, t);

  // a cabinet on castors rolls about: nothing to fix to the wall
  if (ch) liftOntoCastors(b);
  else if (s.cabinet?.onTop) onTopStep(b, s.cabinet.onTop, f.bottom, W, D, t);
  else if (up) {
    upstandStep(b, f.top, W, D, H, up);
    f.anchor();
  }
  else if (wall) f.hang();
  else if (H >= 800) f.anchor();
}

/** Doors on hinges: hinges into the doors on the floor, the doors hung on their plates, then lined up. */
export function doorSteps(b: PlanBuilder, p: CabinetParams, W: number, H: number, D: number, base: number, t: number) {
  if (p.doors <= 0) return;
  const nd = p.doors;
  const dw = nd === 2 ? W / 2 - 3 : W - 4;
  const dh = H - base - 4;
  const dy = base + 2 + dh / 2;
  const doorT = b.part("Door", [dw, dh, t]);
  const doors = Array.from({ length: nd }, (_, i) => {
    const x = nd === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0;
    return b.place(doorT, [x, dy, D / 2 + t / 2]);
  });
  const hn = dh > 1500 ? 4 : dh > 900 ? 3 : 2;
  const hingeYs = Array.from({ length: hn }, (_, i) => base + 110 + (i * (dh - 220)) / (hn - 1));
  const hingeX = (i: number) => {
    // left door hinges on the left, right on the right, single door on the left
    const sgn = nd === 2 && i === 1 ? 1 : -1;
    return { x: sgn * (W / 2 - 22), sgn };
  };
  b.step(
    {
      title: nd > 1 ? "Press the hinges into the doors" : "Press the hinges into the door",
      detail: "Two small screws hold each one.",
      tools: ["screwdriver"],
      scene: "doors",
      repeat: undefined,
      kind: "hinges",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      doors.forEach((d, i) => b.stage(d, [(i - (nd - 1) / 2) * (dw + 80), t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
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
      people: dh > 1500 ? 2 : 1,
      warnings: dh > 1500 ? ["two"] : [],
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
  if (p.handles !== "none") {
    const def = p.handles === "bar" ? HW.handle : HW.knob;
    b.step(
      {
        title: p.handles === "bar" ? "Screw on the handles" : "Screw on the knobs",
        detail: "Screw from the inside of the door.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = doors.map((d, i) => {
          const { sgn } = hingeX(i);
          const x = b.partItem(d).final.pos[0] - sgn * (dw / 2 - 40);
          return { on: d, at: [x, Math.min(dy, 1050), D / 2 + t], dir: [0, 0, -1], hole: false, twist: p.handles === "bar" ? Math.PI / 2 : 0 };
        });
        b.fits(def, list, 0.12);
      },
    );
  }
}

/** A back panel standing up from the back of the top, screwed on from behind. */
function upstandStep(b: PlanBuilder, top: string, W: number, D: number, H: number, up: number) {
  const panelT = b.part("Back panel, standing", [W, up, 18]);
  const panel = b.place(panelT, [0, H + up / 2, -D / 2 + 9]);
  b.step(
    {
      title: "Screw on the back panel",
      detail: "It stands up along the back of the top. Screw it on through its brackets.",
      tools: ["screwdriver"],
      kind: "screws",
      people: W > 800 ? 2 : 1,
    },
    () => {
      b.add(panel, [0, 300, -100]);
      b.then(0.1);
      b.fits(HW.screwM, [-W / 3, 0, W / 3].map((x) => ({ on: panel, at: [x, H + 20, -D / 2 + 18] as Vec3, dir: [0, 0, -1] as Vec3, mate: top })), 0.1);
    },
  );
}

/** A height extension unit goes on top of the bookcase or cabinet it extends, screwed down through its bottom. */
function onTopStep(b: PlanBuilder, what: string, bottom: string, W: number, D: number, t: number) {
  b.step(
    {
      title: `Screw it onto the top of the ${what}`,
      detail: `Line it up with the back and both sides, then screw down through its bottom into the ${what}.`,
      tools: ["screwdriver"],
      people: W > 600 ? 2 : 1,
      kind: "screws",
      warnings: W > 600 ? ["two"] : [],
    },
    () => {
      const list: FitOpts[] = [];
      for (const x of W > 600 ? [-W / 2 + 80, 0, W / 2 - 80] : [-W / 2 + 80, W / 2 - 80]) for (const z of [-D / 4, D / 4]) list.push({ on: bottom, at: [x, t, z], dir: [0, -1, 0], hole: false });
      b.fits(HW.screwM, list, 0.08);
    },
  );
}

/** Shoe cabinets like BISSA or HEMNES: stacked compartments with fronts that tip open from the bottom. */
function tiltCabinet(b: PlanBuilder, s: ProductSpec, p: CabinetParams) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = p.thickness;
  const base = p.plinth ? 60 : 0;
  const n = p.compartments;
  const innerH = H - base - 2 * t;
  const compH = (innerH - (n - 1) * t) / n;
  const fixed = Array.from({ length: n - 1 }, (_, i) => base + t + (i + 1) * compH + i * t + t / 2);
  const lying = H > 1100;
  const f = new FrameKit(b, { W, H, D, t, base, plinth: p.plinth, fixed, back: true, pinRows: false, lying, names: { fixed: "Divider shelf" } });
  f.prepSides();
  f.join();
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  f.standUp();

  const fh = (H - base) / n - 4;
  const frontT = b.part("Front", [W - 4, fh, t]);
  const fronts = Array.from({ length: n }, (_, i) => b.place(frontT, [0, base + 2 + i * (fh + 4) + fh / 2, D / 2 + t / 2]));
  b.step(
    {
      title: n > 1 ? "Fit the hinges to the fronts" : "Fit the hinges to the front",
      detail: "They go on the inside, along the bottom edge.",
      tools: ["screwdriver"],
      scene: "fronts",
      kind: "hinges",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      fronts.forEach((k, i) => b.stage(k, [(i - (n - 1) / 2) * (W + 80), t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
      b.then(0.1);
      const list: FitOpts[] = [];
      fronts.forEach((k) => {
        const y = b.partItem(k).final.pos[1] - fh / 2 + 34;
        for (const sx of [-1, 1]) list.push({ on: k, at: [sx * (W / 2 - 60), y, D / 2], dir: [0, 0, 1], twist: sx > 0 ? Math.PI : 0 });
      });
      b.fits(HW.hinge, list, 0.1);
    },
  );
  b.step(
    {
      title: n > 1 ? "Hang the fronts, bottom first" : "Hang the front",
      detail: "Each one tips open from the top. Check it swings freely before the next.",
      kind: "doors",
    },
    () => {
      b.stagger(0.35);
      fronts.forEach((k) => b.add(k, [0, -60, 360]));
    },
  );
  if (p.handles !== "none") {
    const def = p.handles === "bar" ? HW.handle : HW.knob;
    b.step(
      {
        title: p.handles === "bar" ? "Screw on the handles" : "Screw on the knobs",
        detail: "Near the top edge, so the fronts tip open easily.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = fronts.map((k) => ({ on: k, at: [0, b.partItem(k).final.pos[1] + fh / 2 - 50, D / 2 + t] as Vec3, dir: [0, 0, -1] as Vec3, hole: false, twist: p.handles === "bar" ? 0 : 0 }));
        b.fits(def, list, 0.12);
      },
    );
  }
  f.anchor();
  const last = b.steps[b.steps.length - 1];
  last.detail = "Shoe cabinets are shallow and tip forward easily. Always fix it to the wall. Wall screws aren't included.";
}
