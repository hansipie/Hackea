import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";

/**
 * A shelving unit with a cabinet at the bottom (BROR, KOLBJÖRN): one carcass with a fixed shelf as high as the
 * cabinet, doors over the part below it and open shelves on pins above. Built like a cabinet: the carcass and its
 * back, the shelves, then the doors, and it is fixed to the wall last.
 */
export function buildShelfCab(b: PlanBuilder, s: ProductSpec) {
  const c = s.cabinet ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = clamp(c.thickness ?? 18, 12, 25);
  const base = c.plinth ? 70 : 0;
  const yc = clamp((c.low ?? 80) * 10, base + 300, H - 400); // top of the cabinet
  const f = new FrameKit(b, { W, H, D, t, base, plinth: !!c.plinth, fixed: [yc - t / 2], back: true, pinRows: false, lying: H > 1100, names: { fixed: "Cabinet top" } });
  const nd = c.doors === 1 ? 1 : 2;
  const handles = c.handles ?? "knob";

  // shelves: one behind the doors when there's room, and the open part above shared out evenly
  const inner = W - 2 * t;
  const shT = b.part("Shelf", [inner - 3, t, D - 26]);
  const behind = yc - base - t > 600 ? [Math.round(((base + t + yc) / 2) / 32) * 32] : [];
  const nOpen = clamp(Math.round((H - yc) / 380) - 1, 1, 4);
  const open = Array.from({ length: nOpen }, (_, i) => Math.round((yc + ((H - t - yc) * (i + 1)) / (nOpen + 1)) / 32) * 32);
  const ys = [...behind, ...open];
  const shelves = ys.map((y) => b.place(shT, [0, y + 3 + t / 2, 11]));
  for (const y0 of ys)
    for (const dy of [-64, 0, 64])
      for (const [i, side] of f.sides.entries()) {
        const xi = i === 0 ? -W / 2 + t : W / 2 - t;
        for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(side, [xi, y0 + dy, z], [i === 0 ? 1 : -1, 0, 0], 2.5);
      }

  f.prepSides();
  f.join();
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  f.standUp();

  b.step(
    {
      title: ys.length > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf",
      detail: behind.length ? "One inside the cabinet, the rest in the open part above. Use the same hole on all four corners." : "In the open part above the cabinet. Use the same hole on all four corners.",
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

  /* ---------- doors over the cabinet ---------- */
  const fz = D / 2 + t / 2;
  const dw = nd === 2 ? W / 2 - 3 : W - 4;
  const dh = yc - base - 4;
  const dy = base + 2 + dh / 2;
  const doorT = b.part("Door", [dw, dh, t]);
  const doors = Array.from({ length: nd }, (_, i) => b.place(doorT, [nd === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0, dy, fz]));
  const hn = dh > 900 ? 3 : 2;
  const hingeYs = Array.from({ length: hn }, (_, i) => base + 110 + (i * (dh - 220)) / (hn - 1));
  const hingeX = (i: number) => {
    const sgn = nd === 2 && i === 1 ? 1 : -1;
    return { x: sgn * (W / 2 - 22), sgn };
  };
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
      detail: "Slide each hinge arm onto its plate until it clicks, then turn the hinge screws until the gaps look even.",
      tools: ["screwdriver"],
      kind: "doors",
    },
    () => {
      b.stagger(0.35);
      doors.forEach((d) => b.add(d, [0, 0, 380]));
    },
  );
  if (handles !== "none") {
    const def = handles === "bar" ? HW.handle : HW.knob;
    b.step(
      {
        title: handles === "bar" ? "Screw on the handles" : "Screw on the knobs",
        detail: "Screw from the inside of the door, near its top edge.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = doors.map((d, i) => {
          const { sgn } = hingeX(i);
          const x = b.partItem(d).final.pos[0] - sgn * (dw / 2 - 40);
          return { on: d, at: [x, yc - 90, D / 2 + t] as Vec3, dir: [0, 0, -1] as Vec3, hole: false, twist: handles === "bar" ? Math.PI / 2 : 0 };
        });
        b.fits(def, list, 0.12);
      },
    );
  }

  if (H >= 800) f.anchor();
}
