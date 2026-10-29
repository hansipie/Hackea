import type { PartPiece, ProductSpec, ShelfParams, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit, anchorStep } from "./frame";
import { clamp } from "./math";
import { buildChanging } from "./changing";
import { buildRack } from "./rack";
import { buildScreen } from "./screen";
import { CASTOR_H } from "./castors";
import { buildCoatStand, buildHatRack } from "./stands";
import { buildAirer } from "./airer";

export function defaultsShelf(s: ProductSpec): ShelfParams {
  const p = s.shelf ?? {};
  const grid = p.style === "grid";
  return {
    style: grid ? "grid" : "bookcase",
    cols: clamp(Math.round(p.cols ?? (grid ? 2 : 1)), 1, 5),
    rows: clamp(Math.round(p.rows ?? (grid ? 2 : 1)), 1, 5),
    shelves: clamp(Math.round(p.shelves ?? Math.max(1, Math.round(s.size.h / 45) - 1)), 0, 6),
    fixedShelf: p.fixedShelf ?? s.size.h > 150,
    back: p.back ?? !grid,
    plinth: p.plinth ?? (!grid && s.size.h > 150),
    outer: clamp(p.outer ?? (grid ? 40 : 16), 12, 50),
    inner: clamp(p.inner ?? 16, 12, 30),
  };
}

export function buildShelf(b: PlanBuilder, s: ProductSpec) {
  if (s.shelf?.changing) return buildChanging(b, s, buildShelf);
  if (s.shelf?.style === "rack") return buildRack(b, s);
  if (s.shelf?.style === "screen") return buildScreen(b, s);
  if (s.shelf?.style === "hatrack") return buildHatRack(b, s);
  if (s.shelf?.style === "stand") return buildCoatStand(b, s);
  if (s.shelf?.style === "airer") return buildAirer(b, s);
  const p = defaultsShelf(s);
  if (p.style === "grid") return s.shelf?.underframe ? onUnderframe(b, s, p) : s.shelf?.inserts ? withInserts(b, s, p) : grid(b, s, p);
  if (s.shelf?.rail) return withRail(b, s, p);
  if (s.shelf?.boxUnder) return withBox(b, s, p);
  return bookcase(b, s, p);
}

/** Open shelving with a clothes rail (OMAR): a fixed shelf near the top with the rail under it, and one shelf low down. */
function withRail(b: PlanBuilder, s: ProductSpec, p: ShelfParams) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = p.outer;
  const lying = H > 1100;
  const yTop = Math.round((H - Math.min(420, H * 0.22)) / 32) * 32;
  const f = new FrameKit(b, { W, H, D, t, base: 0, plinth: false, fixed: [yTop], back: p.back, pinRows: false, lying, names: { fixed: "Top shelf" } });
  const yLow = 320;
  const shT = b.part("Shelf", [W - 2 * t - 3, t, D - 26]);
  const low = b.place(shT, [0, yLow + 3 + t / 2, 11]);
  for (const dy of [-64, 0, 64])
    for (const [i, side] of f.sides.entries()) {
      const xi = i === 0 ? -W / 2 + t : W / 2 - t;
      for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(side, [xi, yLow + dy, z], [i === 0 ? 1 : -1, 0, 0], 2.5);
    }
  const two: 1 | 2 = H > 1500 ? 2 : 1;
  f.prepSides();
  f.join(lying ? 1 : two);
  f.otherSide(lying ? 1 : two);
  f.cams();
  if (p.back) f.backSteps();
  if (p.back || lying) f.standUp();
  b.step(
    {
      title: "Add the shelf pins and the low shelf",
      detail: "Near the bottom, for shoes or boxes. Use the same hole on all four corners.",
      kind: "shelves",
    },
    () => {
      const pins: FitOpts[] = [];
      for (const [i, sd] of f.sides.entries()) {
        const x = i === 0 ? -W / 2 + t : W / 2 - t;
        for (const z of [D / 2 - 40, -D / 2 + 40]) pins.push({ on: sd, at: [x, yLow, z], dir: [i === 0 ? -1 : 1, 0, 0], hole: false });
      }
      b.fits(HW.pin, pins, 0.06);
      b.then(0.2);
      b.add(low, [0, 0, 420]);
    },
  );
  const ry = yTop - t / 2 - 150; // low enough under the shelf to lift hangers on and off
  const railT = b.part("Clothes rail", [24, W - 2 * t - 2, 24], { shape: "cyl", material: "metal" });
  const rail = b.place(railT, [0, ry, 0], [0, 0, Math.PI / 2]);
  b.step(
    {
      title: "Fit the clothes rail",
      detail: "Screw the holders to the sides under the top shelf, then drop the rail in.",
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
  f.anchor();
}

/** Open shelving with its bottom shelf raised, and a storage box on castors that rolls in under it (IVAR). */
function withBox(b: PlanBuilder, s: ProductSpec, p: ShelfParams) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = p.outer;
  const U = clamp(s.shelf!.boxUnder! * 10, 150, 500);
  const lying = H > 1100;
  const f = new FrameKit(b, { W, H, D, t, base: U, plinth: false, fixed: p.fixedShelf ? [Math.round((U + H) / 2 / 32) * 32] : [], back: p.back, pinRows: p.shelves > 0, lying });
  const two: 1 | 2 = H > 1500 ? 2 : 1;
  f.prepSides();
  f.join(lying ? 1 : two);
  f.otherSide(lying ? 1 : two);
  f.cams();
  if (p.back) f.backSteps();
  if (p.back || lying) f.standUp();
  f.shelves(p.shelves);
  const bw = W - 2 * t - 30, bh = U - CASTOR_H - 25, bd = D - 30;
  const boxT = b.part("Storage box", [bw, bh, bd]);
  const box = b.place(boxT, [0, CASTOR_H + bh / 2, 0]);
  b.step(
    {
      title: "Fit the castors under the storage box",
      detail: "Turn it upside down. Push a castor into each corner until it clicks.",
      scene: "box",
      kind: "legs",
      warnings: ["floor"],
    },
    () => {
      b.stage(box, [0, bh / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
      b.then(0.1);
      const list: FitOpts[] = [];
      for (const x of [-bw / 2 + 45, bw / 2 - 45]) for (const z of [-bd / 2 + 45, bd / 2 - 45]) list.push({ on: box, at: [x, CASTOR_H, z], dir: [0, 1, 0], travel: 70, hole: false });
      b.fits(HW.castor, list, 0.12);
    },
  );
  b.step(
    {
      title: "Roll the storage box in under the bottom shelf",
      detail: "It sits on its castors, clear of the floor, and pulls out from the front.",
      kind: "general",
    },
    () => b.add(box, [0, 0, 480]),
  );
  if (H >= 900) f.anchor();
}

function bookcase(b: PlanBuilder, s: ProductSpec, p: ShelfParams) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = p.outer;
  if (s.shelf?.wall) p.plinth = false;
  const base = p.plinth ? 60 : 0;
  const lying = H > 1100;
  const f = new FrameKit(b, {
    W, H, D, t, base,
    plinth: p.plinth,
    fixed: p.fixedShelf ? [Math.round((base + H) / 2 / 32) * 32] : [],
    back: p.back,
    pinRows: p.shelves > 0,
    lying,
  });
  const two: 1 | 2 = H > 1500 ? 2 : 1;
  f.prepSides();
  f.join(lying ? 1 : two);
  f.otherSide(lying ? 1 : two);
  f.cams();
  f.plinthStep();
  if (p.back) f.backSteps();
  if (p.back || lying) f.standUp();
  f.shelves(p.shelves);
  if (s.shelf?.wall) f.hang();
  else if (H >= 900) f.anchor();
}

/** Cube shelving: full-width top and bottom, sides between, an inner grid on dowels. Built upright from the bottom. */
function grid(b: PlanBuilder, s: ProductSpec, p: ShelfParams, beforeAnchor?: () => void) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = p.outer, ti = p.inner;
  const { cols, rows } = p;
  const cellW = (W - 2 * T - (cols - 1) * ti) / cols;
  const cellH = (H - 2 * T - (rows - 1) * ti) / rows;
  const zb = D / 2 - 55;
  const zd = Math.max(D / 2 - 120, 30);
  const zi = Math.max(D / 2 - 90, 30);

  const tbT = b.part("Top and bottom", [W, T, D]);
  const bottom = b.place(tbT, [0, T / 2, 0]);
  const top = b.place(tbT, [0, H - T / 2, 0]);
  const sideT = b.part("Side panel", [T, H - 2 * T, D]);
  const sides = [b.place(sideT, [-(W / 2 - T / 2), H / 2, 0]), b.place(sideT, [W / 2 - T / 2, H / 2, 0], [0, Math.PI, 0])];
  const longT = rows > 1 ? b.part("Long shelf", [W - 2 * T, ti, D]) : "";
  const divT = cols > 1 ? b.part("Divider", [ti, cellH, D]) : "";

  const rowY0 = (r: number) => T + r * (cellH + ti); // bottom of row r
  const longs = Array.from({ length: rows - 1 }, (_, r) => b.place(longT, [0, rowY0(r) + cellH + ti / 2, 0]));
  const divX = (c: number) => -W / 2 + T + (c + 1) * cellW + c * ti + ti / 2;
  const divs = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols - 1 }, (_, c) => b.place(divT, [divX(c), rowY0(r) + cellH / 2, 0])),
  );
  const below = (r: number) => (r === 0 ? bottom : longs[r - 1]);
  const above = (r: number) => (r === rows - 1 ? top : longs[r]);
  const sx = W / 2 - T / 2;

  // 1. bottom
  b.step(
    {
      title: "Fit bolts and dowels into the bottom",
      detail: "Twist the bolts in by hand. Tap the dowels in halfway.",
      tools: ["screwdriver", "hammer"],
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.add(bottom, [0, 160, 0]);
      b.then(0.15);
      const bolts: FitOpts[] = [];
      const dowels: FitOpts[] = [];
      for (const [i, x] of [-sx, sx].entries()) {
        for (const z of [-zb, zb]) bolts.push({ on: bottom, at: [x, T, z], dir: [0, -1, 0], mate: sides[i], mateHole: 4 });
        for (const z of [-zd, zd]) dowels.push({ on: bottom, at: [x, T, z], dir: [0, -1, 0], mate: sides[i] });
      }
      for (const d of divs[0]) for (const z of [-zi, zi]) dowels.push({ on: bottom, at: [b.partItem(d).final.pos[0], T, z], dir: [0, -1, 0], mate: d });
      b.fits(HW.camScrew, bolts, 0.08);
      b.then(0.1);
      b.fits(HW.dowel, dowels, 0.05);
    },
  );

  for (let r = 0; r < rows; r++) {
    if (cols > 1) {
      b.step(
        {
          title: r === 0 ? "Stand the dividers on the dowels" : "Add the next row of dividers",
          detail: "Then tap dowels into their top edges.",
          tools: ["hammer"],
          kind: "join",
        },
        () => {
          b.stagger(0.2);
          divs[r].forEach((d) => b.add(d, [0, 260, 0]));
          b.then(0.15);
          const list: FitOpts[] = [];
          for (const d of divs[r]) {
            const x = b.partItem(d).final.pos[0];
            for (const z of [-zi, zi]) list.push({ on: d, at: [x, rowY0(r) + cellH, z], dir: [0, -1, 0], mate: above(r) });
          }
          b.fits(HW.dowel, list, 0.06);
        },
      );
    }
    if (r < rows - 1) {
      const L = longs[r];
      const yc = rowY0(r) + cellH + ti / 2;
      b.step(
        {
          title: r === 0 ? "Lay the long shelf on top" : "Add the next long shelf",
          detail: "Dowels go into both ends, and on top for the next row.",
          tools: ["hammer"],
          kind: "join",
        },
        () => {
          b.add(L, [0, 280, 0]);
          b.then(0.15);
          const list: FitOpts[] = [];
          for (const [i, x] of [-(W / 2 - T), W / 2 - T].entries())
            for (const z of [-zi, zi]) list.push({ on: L, at: [x, yc, z], dir: [i === 0 ? 1 : -1, 0, 0], mate: sides[i] });
          if (cols > 1)
            for (const d of divs[r + 1]) {
              const x = b.partItem(d).final.pos[0];
              for (const z of [-zi, zi]) list.push({ on: L, at: [x, yc + ti / 2, z], dir: [0, -1, 0], mate: d });
            }
          b.fits(HW.dowel, list, 0.05);
        },
      );
    }
  }
  void below;

  b.step(
    {
      title: "Add both sides",
      detail: "Slide them onto the bolts and dowels from the outside.",
      kind: "join",
      people: H > 1200 ? 2 : 1,
    },
    () => {
      b.stagger(0.3);
      b.add(sides[0], [-420, 0, 0]);
      b.add(sides[1], [420, 0, 0]);
    },
  );

  // top prepared upside down in its own scene
  b.step(
    {
      title: "Fit bolts and dowels into the top",
      detail: "Lay it upside down on the box first.",
      tools: ["screwdriver", "hammer"],
      scene: "top",
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.stage(top, [0, T / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
      b.then(0.15);
      const bolts: FitOpts[] = [];
      const dowels: FitOpts[] = [];
      for (const [i, x] of [-sx, sx].entries()) {
        for (const z of [-zb, zb]) bolts.push({ on: top, at: [x, H - T, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 });
        for (const z of [-zd, zd]) dowels.push({ on: top, at: [x, H - T, z], dir: [0, 1, 0], mate: sides[i] });
      }
      b.fits(HW.camScrew, bolts, 0.08);
      b.then(0.1);
      b.fits(HW.dowel, dowels, 0.06);
    },
  );

  b.step(
    {
      title: "Put the top on",
      detail: "Lower it evenly so every dowel finds its hole.",
      kind: "join",
      people: H > 1200 ? 2 : 1,
      warnings: H > 1200 ? ["two"] : [],
    },
    () => b.add(top, [0, 320, 0]),
  );

  b.step(
    {
      title: "Lock all the cam locks",
      detail: "Arrow towards the bolt, then turn clockwise until it's snug.",
      tools: ["screwdriver"],
      kind: "cams",
    },
    () => {
      const list: FitOpts[] = [];
      for (const [i, side] of sides.entries()) {
        const xi = i === 0 ? -W / 2 + T : W / 2 - T;
        for (const y of [T + 26, H - T - 26]) for (const z of [-zb, zb]) list.push({ on: side, at: [xi, y, z], dir: [i === 0 ? -1 : 1, 0, 0] });
      }
      b.fits(HW.cam, list, 0.08);
    },
  );

  beforeAnchor?.();
  if (H >= 700) anchorStep(b, { W, D, top, y: H, backZ: -D / 2, severe: H > 1200 });
}

/**
 * A cube shelf sold with inserts (KALLAX): the shelf first, then each insert, a small box with a door, is put
 * together, pushed into a cube and screwed in, from the bottom row up; last the doors go on their hinges.
 */
function withInserts(b: PlanBuilder, s: ProductSpec, p: ShelfParams) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = p.outer, ti = p.inner;
  const { cols, rows } = p;
  const n = clamp(Math.round(s.shelf!.inserts!), 1, cols * rows);
  const cellW = (W - 2 * T - (cols - 1) * ti) / cols;
  const cellH = (H - 2 * T - (rows - 1) * ti) / rows;
  const cx = (c: number) => -W / 2 + T + c * (cellW + ti) + cellW / 2;
  const cy = (r: number) => T + r * (cellH + ti) + cellH / 2;
  grid(b, s, p, () => {
    const it = 12, dt = 16;
    const bw = cellW - 2, bh = cellH - 2, bd = D - 20 - dt - 2;
    const zb = -D / 2 + 20 + bd / 2; // the box sits back from the front, behind its door
    const sideT = b.part("Insert side", [it, bh, bd]);
    const flatT = b.part("Insert top and bottom", [bw - 2 * it, it, bd]);
    const doorT = b.part("Door", [cellW - 4, cellH - 4, dt]);
    const boxes = Array.from({ length: n }, (_, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = cx(c), y = cy(r);
      return {
        x,
        y,
        parts: [
          b.place(sideT, [x - bw / 2 + it / 2, y, zb]),
          b.place(sideT, [x + bw / 2 - it / 2, y, zb]),
          b.place(flatT, [x, y - bh / 2 + it / 2, zb]),
          b.place(flatT, [x, y + bh / 2 - it / 2, zb]),
        ],
        door: b.place(doorT, [x, y, D / 2 - dt / 2]),
      };
    });
    const at = (k: string) => b.partItem(k).final.pos;
    const b0 = boxes[0];
    const rel = (k: string): Vec3 => [at(k)[0] - b0.x, at(k)[1] - b0.y + bh / 2, at(k)[2] - zb];
    const corners = (bx: (typeof boxes)[number]): FitOpts[] =>
      bx.parts.slice(0, 2).flatMap((sd, i) => {
        const x = at(sd)[0] + (i === 0 ? -it / 2 : it / 2);
        return [bx.y - bh / 2 + it / 2, bx.y + bh / 2 - it / 2].map((y) => ({ on: sd, at: [x, y, zb] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
      });
    b.step(
      {
        title: n > 1 ? "Put the inserts together" : "Put the insert together",
        detail: "Screw the top and bottom between the two sides.",
        tools: ["screwdriver"],
        scene: "insert",
        repeat: n > 1 ? n : undefined,
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        b0.parts.forEach((k) => b.stage(k, rel(k), [0, 0, 0], [0, 160, 0]));
        b.then(0.1);
        b.fits(HW.screwM, corners(b0), 0.1);
      },
    );
    b.step(
      {
        title: n > 1 ? "Push the inserts into the cubes" : "Push the insert into a cube",
        detail: "From the bottom row up. Slide each one in until it meets the back edge, then screw it to the shelf under it.",
        tools: ["screwdriver"],
        kind: "join",
        weight: 0.8 + 0.4 * n,
      },
      () => {
        for (const [i, bx] of boxes.entries()) {
          b.stagger(0);
          bx.parts.forEach((k) => b.add(k, [0, 0, 420]));
          if (i > 0) for (const o of corners(bx)) b.preset(HW.screwM, o);
          b.wait(0.18);
        }
        b.then(0.1);
        const list: FitOpts[] = boxes.flatMap((bx) => [-bw / 4, bw / 4].map((dx) => ({ on: bx.parts[2], at: [bx.x + dx, bx.y - bh / 2 + it, zb + bd / 4] as Vec3, dir: [0, -1, 0] as Vec3, hole: false })));
        b.fits(HW.screwS, list, 0.06);
      },
    );
    const hingeX = cellW / 2 - 22;
    b.step(
      {
        title: n > 1 ? "Press the hinges into the doors" : "Press the hinges into the door",
        detail: n > 1 ? "Two on each door, along its left edge." : "Two of them, along its left edge.",
        tools: ["screwdriver"],
        scene: "doors",
        repeat: n > 1 ? n : undefined,
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stage(b0.door, [0, dt / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
        b.then(0.1);
        const list: FitOpts[] = [b0.y - cellH / 2 + 70, b0.y + cellH / 2 - 70].map((y) => ({ on: b0.door, at: [b0.x - hingeX, y, D / 2 - dt], dir: [0, 0, 1] as Vec3 }));
        b.fits(HW.hinge, list, 0.12);
      },
    );
    b.step(
      {
        title: n > 1 ? "Hang the doors" : "Hang the door",
        detail: "Clip each hinge onto its plate inside the insert, then turn the screws until the gaps look even.",
        tools: ["screwdriver"],
        kind: "doors",
        weight: 0.8 + 0.4 * n,
      },
      () => {
        for (const [i, bx] of boxes.entries()) {
          b.stagger(0);
          b.add(bx.door, [0, 0, 360]);
          if (i > 0) for (const y of [bx.y - cellH / 2 + 70, bx.y + cellH / 2 - 70]) b.preset(HW.hinge, { on: bx.door, at: [bx.x - hingeX, y, D / 2 - dt], dir: [0, 0, 1] });
          b.wait(0.2);
        }
      },
    );
  });
}

/**
 * A cube shelf on an underframe (KALLAX): the shelf is built exactly as it is on its own, then laid on its back
 * for the underframe to be screwed to its bottom, and stood up on it. Built with its bottom at zero, then lifted.
 */
function onUnderframe(b: PlanBuilder, s: ProductSpec, p: ShelfParams) {
  const U = clamp(s.shelf!.underframe! * 10, 80, 400);
  const W = s.size.w * 10, D = s.size.d * 10;
  const shelf: ProductSpec = { ...s, size: { ...s.size, h: s.size.h - U / 10 } };
  const tall = shelf.size.h > 120;
  const leg = 40, rail = 50;
  grid(b, shelf, p, () => {
    const xs = W / 2 - leg / 2, zs = D / 2 - leg / 2;
    const pieces: PartPiece[] = [];
    for (const x of [-xs, xs]) for (const z of [-zs, zs]) pieces.push({ shape: "box", size: [leg, U, leg], pos: [x, -U / 2, z] });
    for (const z of [-zs, zs]) pieces.push({ shape: "box", size: [W - 2 * leg, rail, 22], pos: [0, -rail / 2, z] });
    for (const x of [-xs, xs]) pieces.push({ shape: "box", size: [22, rail, D - 2 * leg], pos: [x, -rail / 2, 0] });
    const c = b.compound("Underframe", pieces, { material: "wood" });
    const frame = b.place(c.type, c.mid);
    b.step(
      {
        title: "Lay it on its back and screw on the underframe",
        detail: "Line the frame up with the bottom's edges, then screw it on through the rails.",
        tools: ["screwdriver"],
        pose: "+z",
        kind: "legs",
        people: tall ? 2 : 1,
        warnings: tall ? ["two", "floor"] : ["floor"],
      },
      () => {
        b.add(frame, [0, -320, 0]);
        b.then(0.15);
        const list: FitOpts[] = [];
        for (const z of [-zs, zs]) for (const x of [-W / 4, W / 4]) list.push({ on: frame, at: [x, -rail, z], dir: [0, 1, 0], hole: false });
        for (const x of [-xs, xs]) list.push({ on: frame, at: [x, -rail, 0], dir: [0, 1, 0], hole: false });
        b.fits(HW.screwL, list, 0.08);
      },
    );
    b.step(
      {
        title: tall ? "Stand it up together" : "Stand it up",
        detail: "Tip it up onto the underframe on a flat floor, and check it doesn't rock.",
        kind: "standup",
        people: tall ? 2 : 1,
        warnings: tall ? ["two"] : [],
      },
      () => {},
    );
  });
  // everything was built with the shelf's bottom at zero: lift it all onto the underframe
  for (const it of b.items) {
    if (it.kind === "part") {
      const old = it.final.pos;
      it.final = { pos: [old[0], old[1] + U, old[2]], rot: it.final.rot };
      for (const st of it.states) if (st.scene === "main") st.pos = st.pos === old ? it.final.pos : [st.pos[0], st.pos[1] + U, st.pos[2]];
    } else if (!it.parent && it.scene === "main") it.pos = [it.pos[0], it.pos[1] + U, it.pos[2]];
  }
}

export type { Vec3 };
