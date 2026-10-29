import type { BedParams, ProductSpec } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";
import { buildBunk } from "./bunk";
import { buildCot } from "./cot";
import { buildDayBed } from "./daybed";

export function defaultsBed(s: ProductSpec): BedParams {
  const p = s.bed ?? {};
  const mw = clamp(p.mattressW ?? Math.max(80, s.size.w - 16), 70, 200);
  return {
    mattressW: mw,
    mattressL: clamp(p.mattressL ?? 200, 140, 220),
    headH: clamp(p.headH ?? s.size.h, 40, 140),
    footH: clamp(p.footH ?? 38, 0, 100),
    slats: clamp(Math.round(p.slats ?? 17), 8, 30),
    centerBeam: p.centerBeam ?? mw >= 120,
  };
}

export function buildBed(b: PlanBuilder, s: ProductSpec) {
  if (s.bed?.type === "cot") return buildCot(b, s);
  if (s.bed?.type === "bunk" || s.bed?.type === "loft") return buildBunk(b, s);
  if (s.bed?.type === "daybed") return buildDayBed(b, s);
  const p = defaultsBed(s);
  const Wm = p.mattressW * 10, Lm = p.mattressL * 10;
  const t = 22;
  const railTop = 380, railH = 170;
  const slatTop = railTop - 50;
  const headH = p.headH * 10;
  const footH = Math.max(p.footH * 10, railTop);
  const outerW = Wm + 20 + 2 * t;
  const zh = -(Lm / 2 + 10 + t / 2), zf = Lm / 2 + 10 + t / 2;
  const rx = Wm / 2 + 10 + t / 2;

  const headT = b.part("Headboard", [outerW, headH, t]);
  const head = b.place(headT, [0, headH / 2, zh]);
  const footT = b.part("Footboard", [outerW, footH, t]);
  const foot = b.place(footT, [0, footH / 2, zf]);
  const railT = b.part("Side rail", [t, railH, Lm + 20]);
  const rails = [b.place(railT, [-rx, railTop - railH / 2, 0]), b.place(railT, [rx, railTop - railH / 2, 0])];
  const ledgeT = b.part("Slat support", [24, 30, Lm], { material: "wood" });
  const lx = Wm / 2 + 10 - 12;
  const ledgeY = slatTop - 10 - 15;
  const ledges = [b.place(ledgeT, [-lx, ledgeY, 0]), b.place(ledgeT, [lx, ledgeY, 0])];
  const slatT = b.part("Slat", [Wm - 4, 10, 68], { material: "wood" });
  const pitch = (Lm - 60) / (p.slats - 1);
  const slats = Array.from({ length: p.slats }, (_, i) => b.place(slatT, [0, slatTop - 5, -Lm / 2 + 30 + i * pitch]));

  b.step(
    {
      title: "Attach the side rails to the headboard",
      detail: "One person holds, one bolts. Don't tighten fully yet.",
      tools: ["allen"],
      people: 2,
      kind: "bolts",
      warnings: ["two", "loose"],
    },
    () => {
      b.add(head, [0, 0, -260]);
      b.then(0.1);
      b.stagger(0.3);
      rails.forEach((r) => b.add(r, [0, 0, 420]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const x of [-rx, rx]) for (const dy of [-45, 45]) bolts.push({ on: head, at: [x, railTop - railH / 2 + dy, zh - t / 2], dir: [0, 0, 1], mate: rails[x < 0 ? 0 : 1] });
      b.fits(HW.boltL, bolts, 0.1);
    },
  );

  b.step(
    {
      title: "Attach the footboard",
      detail: "Now tighten every bolt firmly.",
      tools: ["allen"],
      people: 2,
      kind: "bolts",
      warnings: ["two"],
    },
    () => {
      b.add(foot, [0, 0, 360]);
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const x of [-rx, rx]) for (const dy of [-45, 45]) bolts.push({ on: foot, at: [x, railTop - railH / 2 + dy, zf + t / 2], dir: [0, 0, -1], mate: rails[x < 0 ? 0 : 1] });
      b.fits(HW.boltL, bolts, 0.1);
    },
  );

  b.step(
    {
      title: "Screw the slat supports to the rails",
      detail: "Keep them level with the bottom of the marks.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.stagger(0.25);
      ledges.forEach((l, i) => b.add(l, [i === 0 ? 260 : -260, 0, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      ledges.forEach((l, i) => {
        const x = i === 0 ? -lx + 12 : lx - 12;
        for (let k = 0; k < 5; k++) sc.push({ on: l, at: [x, ledgeY, -Lm / 2 + 120 + (k * (Lm - 240)) / 4], dir: [i === 0 ? -1 : 1, 0, 0] });
      });
      b.fits(HW.screwM, sc, 0.05);
    },
  );

  if (p.centerBeam) {
    const beamT = b.part("Center beam", [50, 70, Lm + 20], { material: "metal" });
    const by = slatTop - 10 - 35;
    const beam = b.place(beamT, [0, by, 0]);
    const legH = by - 35;
    const legT = b.part("Support leg", [36, legH, 36], { shape: "cyl", material: "metal" });
    const bl = [b.place(legT, [0, legH / 2, -Lm / 4]), b.place(legT, [0, legH / 2, Lm / 4])];
    b.step(
      {
        title: "Screw the legs onto the center beam",
        detail: "Turn them until they're firm.",
        scene: "beam",
        pose: "-y",
        kind: "legs",
        warnings: ["hand"],
      },
      () => {
        b.stage(beam, [0, by, 0], [0, 0, 0], [0, -200, 0]);
        b.then(0.1);
        b.stagger(0.3);
        bl.forEach((l) => b.stage(l, b.partItem(l).final.pos, [0, 0, 0], [0, -260, 0]));
      },
    );
    b.step(
      {
        title: "Hook the beam onto the head and foot",
        detail: "Its feet should stand flat on the floor.",
        kind: "join",
      },
      () => {
        b.stagger(0);
        b.add(beam, [0, 360, 0]);
        bl.forEach((l) => b.add(l, [0, 360, 0]));
      },
    );
  }

  b.step(
    {
      title: "Lay out the slats",
      detail: "Curved side up, spread evenly from head to foot.",
      kind: "slats",
    },
    () => {
      b.stagger(Math.min(0.08, 1.6 / slats.length));
      slats.forEach((sl) => b.add(sl, [0, 260, 0]));
    },
  );

  const mT = b.part("Your mattress", [Wm, 180, Lm], { material: "soft", extra: true });
  const m = b.place(mT, [0, slatTop + 90, 0]);
  b.step(
    {
      title: "Add your mattress",
      detail: "Done. Check the bolts again after a week of use.",
      people: 2,
      kind: "general",
      warnings: ["two"],
    },
    () => b.add(m, [0, 420, 0]),
  );
}
