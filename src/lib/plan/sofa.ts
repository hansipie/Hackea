import type { ProductSpec, SofaParams, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";
import { buildCornerSofa } from "./corner";
import { buildPouffe, footstool } from "./footstool";
import { sofaDims } from "./sofaDims";

export function defaultsSofa(s: ProductSpec): SofaParams {
  const p = s.sofa ?? {};
  return {
    seats: clamp(Math.round(p.seats ?? Math.max(1, Math.round((s.size.w - 30) / 62))), 1, 4),
    arms: p.arms ?? "wide",
    legs: p.legs ?? "round",
  };
}

/** Upholstered sofas and armchairs: legs on the base, arms and back bolted on, cushions last. */
export function buildSofa(b: PlanBuilder, s: ProductSpec) {
  if (s.sofa?.pouffe) return buildPouffe(b, s);
  if (s.sofa?.table) return withSideTable(b, s);
  // more than four seats: two sections joined, like a corner sofa without the corner
  if (s.sofa?.chaise || s.sofa?.corner || (s.sofa?.seats ?? 0) > 4) return buildCornerSofa(b, s);
  const p = defaultsSofa(s);
  const W = s.size.w * 10, D = s.size.d * 10;
  const { a, legH, baseTop, seatT, seatTop, armH, backH, backT, cushT, cushH } = sofaDims({ ...s, sofa: { ...s.sofa, ...p } }, W, D);
  const big = W > 1500;

  const baseT = b.part("Seat frame", [W - 2 * a, baseTop - legH, D], { material: "soft" });
  const base = b.place(baseT, [0, legH + (baseTop - legH) / 2, 0]);
  const legT = b.part("Leg", p.legs === "round" ? [Math.min(42, legH * 0.9), legH, Math.min(42, legH * 0.9)] : [56, legH, 56], { shape: p.legs === "round" ? "cyl" : "box", material: "wood" });
  const lx = W / 2 - a - 60, lz = D / 2 - 70;
  const legPts: [number, number][] = [
    [-lx, lz],
    [lx, lz],
    [lx, -lz],
    [-lx, -lz],
  ];
  if (W > 2000) legPts.push([0, lz], [0, -lz]);
  const legs = legPts.map(([x, z]) => b.place(legT, [x, legH / 2, z]));
  const arms: string[] = [];
  if (a > 0) {
    // the arms come down to just above the floor, like the frame they bolt to
    const armB = Math.max(15, legH - 40);
    const armT = b.part("Armrest", [a, armH - armB, D], { material: "soft" });
    for (const sgn of [-1, 1]) arms.push(b.place(armT, [sgn * (W / 2 - a / 2), armB + (armH - armB) / 2, 0]));
  }
  const backPT = b.part("Backrest", [W - 2 * a, backH - baseTop, backT], { material: "soft" });
  const back = b.place(backPT, [0, baseTop + (backH - baseTop) / 2, -D / 2 + backT / 2]);
  const cw = (W - 2 * a) / p.seats;
  const seatCT = b.part("Seat cushion", [cw - 8, seatT, D - backT - 16], { material: "soft" });
  const seats = Array.from({ length: p.seats }, (_, i) => b.place(seatCT, [-(W - 2 * a) / 2 + cw * (i + 0.5), baseTop + seatT / 2, backT / 2 + 4]));
  // the back cushions stand on the seat cushions, lean on the backrest and come up over it
  const tilt = 0.12;
  const backCT = b.part("Back cushion", [cw - 14, cushH, cushT], { material: "soft" });
  const backs = Array.from({ length: p.seats }, (_, i) =>
    b.place(backCT, [-(W - 2 * a) / 2 + cw * (i + 0.5), seatTop + cushH / 2 - 4, -D / 2 + backT + cushT / 2 + (cushH / 2) * Math.sin(tilt) + 4], [-tilt, 0, 0]),
  );

  b.step(
    {
      title: "Lay the seat frame upside down",
      detail: "Put a blanket or the flattened box under it first.",
      pose: "-y",
      kind: "general",
      people: big ? 2 : 1,
      warnings: big ? ["two", "floor"] : ["floor"],
    },
    () => b.add(base, [0, 220, 0]),
  );
  b.step(
    {
      title: "Screw in the legs",
      detail: "Clockwise by hand until each one is snug.",
      pose: "-y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.22);
      legs.forEach((l) => b.add(l, [0, -260, 0], { spin: 2 }));
    },
  );
  b.step(
    {
      title: big ? "Turn it over together" : "Turn it over",
      detail: "Lift it by the frame, never by the legs.",
      pose: "+y",
      kind: "flip",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {},
  );
  if (arms.length) {
    b.step(
      {
        title: "Bolt on the armrests",
        detail: "Line up the holes, then bolt loosely. Tighten once both arms are on.",
        tools: ["allen"],
        kind: "bolts",
        warnings: ["loose"],
      },
      () => {
        b.stagger(0.3);
        arms.forEach((k, i) => b.add(k, [(i === 0 ? -1 : 1) * 420, 0, 0]));
        b.then(0.1);
        const bolts: FitOpts[] = [];
        arms.forEach((k, i) => {
          const sgn = i === 0 ? -1 : 1;
          for (const z of [-D / 4, D / 4]) bolts.push({ on: k, at: [sgn * (W / 2 - a), legH + 90, z] as Vec3, dir: [sgn, 0, 0] as Vec3, mate: base });
        });
        b.fits(HW.boltL, bolts, 0.1);
      },
    );
  }
  b.step(
    {
      title: "Attach the backrest",
      detail: "Slide it down behind the seat, then bolt it from the back.",
      tools: ["allen"],
      kind: "bolts",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {
      b.add(back, [0, 120, -420]);
      b.then(0.1);
      const n = W > 1600 ? 3 : 2;
      const bolts: FitOpts[] = Array.from({ length: n }, (_, i) => ({ on: back, at: [-(W - 2 * a) / 2 + ((W - 2 * a) * (i + 1)) / (n + 1), baseTop + 60, -D / 2] as Vec3, dir: [0, 0, 1] as Vec3, mate: base }));
      b.fits(HW.boltL, bolts, 0.12);
    },
  );
  b.step(
    {
      title: p.seats > 1 ? "Drop in the seat cushions" : "Drop in the seat cushion",
      detail: "Zips face the back.",
      kind: "cushions",
    },
    () => {
      b.stagger(0.18);
      seats.forEach((k) => b.add(k, [0, 320, 0]));
    },
  );
  b.step(
    {
      title: p.seats > 1 ? "Add the back cushions" : "Add the back cushion",
      detail: "Plump them up and lean them against the backrest.",
      kind: "cushions",
    },
    () => {
      b.stagger(0.18);
      backs.forEach((k) => b.add(k, [0, 160, 360]));
    },
  );
  if (s.sofa?.bed) {
    b.step(
      {
        title: "Fold it out into a bed once",
        detail: "Pull the seat forward until it lies flat, then fold it back. It should move smoothly both ways.",
        kind: "general",
      },
      () => {},
    );
  }
  if (s.sofa?.foot) footstool(b, { w: Math.min(W * 0.8, 620), h: 420, d: 420, z: D / 2 + 140 + 210 });
}

/**
 * A modular sofa or armchair with a side table module at its right-hand end (LILLEHEM): the sofa is built as it is on
 * its own, then the side table is put together, set at the end and joined to the seat frame with connectors.
 */
function withSideTable(b: PlanBuilder, s: ProductSpec) {
  const T = clamp(s.sofa!.table! * 10, 300, 700);
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const sofa: ProductSpec = { ...s, size: { ...s.size, w: s.size.w - T / 10 }, sofa: { ...s.sofa, table: undefined } };
  buildSofa(b, sofa);
  // the sofa stands at the left, the table at the right-hand end
  const dx = -T / 2;
  for (const it of b.items) {
    if (it.kind === "part") {
      const old = it.final.pos;
      it.final = { pos: [old[0] + dx, old[1], old[2]], rot: it.final.rot };
      for (const st of it.states) if (st.scene === "main") st.pos = st.pos === old ? it.final.pos : [st.pos[0] + dx, st.pos[1], st.pos[2]];
    } else if (!it.parent && it.scene === "main") it.pos = [it.pos[0] + dx, it.pos[1], it.pos[2]];
  }
  const th = clamp(H * 0.65, 420, 620), td = D - 120, t = 20;
  const xc = W / 2 - T / 2;
  const topT = b.part("Side table top", [T, 25, td], { material: "wood" });
  const sideT = b.part("Side table end", [t, th - 25, td], { material: "wood" });
  const shelfT = b.part("Side table shelf", [T - 2 * t, 18, td - 20], { material: "wood" });
  const top = b.place(topT, [xc, th - 12.5, 0]);
  const ends = [-1, 1].map((sx) => b.place(sideT, [xc + sx * (T / 2 - t / 2), (th - 25) / 2, 0]));
  const shelf = b.place(shelfT, [xc, 160, 0]);
  const parts = [...ends, shelf, top];
  const at = (k: string) => b.partItem(k).final.pos;
  b.step(
    {
      title: "Put the side table together",
      detail: "Screw the shelf in between the two ends, then the top down onto them.",
      tools: ["screwdriver"],
      scene: "table",
      kind: "screws",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.22);
      parts.forEach((k) => b.stage(k, [at(k)[0] - xc, at(k)[1], at(k)[2]], [0, 0, 0], [0, 160, 0]));
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const [i, k] of ends.entries()) for (const z of [-td / 4, td / 4]) sc.push({ on: k, at: [at(k)[0] + (i === 0 ? -t / 2 : t / 2), 160, z], dir: [i === 0 ? 1 : -1, 0, 0], mate: shelf });
      for (const k of ends) for (const z of [-td / 4, td / 4]) sc.push({ on: top, at: [at(k)[0], th, z], dir: [0, -1, 0], mate: k });
      b.fits(HW.screwM, sc, 0.06);
    },
  );
  b.step(
    {
      title: "Join the side table to the end of the sofa",
      detail: "Stand it tight against the end, then screw the connectors across underneath, into the seat frame and the table.",
      tools: ["screwdriver"],
      kind: "join",
    },
    () => {
      b.stagger(0);
      parts.forEach((k) => b.add(k, [260, 0, 0]));
      b.then(0.15);
      const x = W / 2 - T;
      b.fits(HW.connector, [-D / 4, D / 4].map((z) => ({ at: [x, 110, z] as Vec3, dir: [0, 1, 0] as Vec3, twist: 0 })), 0.15);
    },
  );
}
