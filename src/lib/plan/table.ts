import type { ProductSpec, TableParams, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";
import { buildDropLeaf } from "./dropleaf";
import { buildGateleg } from "./gateleg";
import { buildCornerDesk } from "./cornerdesk";
import { buildDeskDrawers } from "./deskdraw";
import { buildBoxDesk } from "./boxdesk";
import { buildRiser } from "./riser";

export function defaultsTable(s: ProductSpec): TableParams {
  const p = s.table ?? {};
  const out: TableParams = {
    topThickness: clamp(p.topThickness ?? 30, 15, 60),
    legs: p.legs === "round" ? "round" : "square",
    legSize: clamp(p.legSize ?? 50, 25, 90),
    shelf: p.shelf ?? false,
    attach: p.attach ?? "screw",
  };
  // a round top sits on legs set in under it: no apron rails or lower shelf to square off
  if (p.round) Object.assign(out, { round: true, shelf: false, attach: out.attach === "apron" ? "plate" : out.attach });
  return out;
}

export function buildTable(b: PlanBuilder, s: ProductSpec) {
  if (s.table?.drawers) return buildDeskDrawers(b, s);
  if (s.table?.frame) return buildBoxDesk(b, s);
  if (s.table?.riser) return buildRiser(b, s);
  if (s.table?.ell) return buildCornerDesk(b, s);
  if (s.table?.gate) return buildGateleg(b, s);
  if (s.table?.leaves) return buildDropLeaf(b, s);
  const p = defaultsTable(s);
  const rackH = (s.table?.rack ?? 0) * 10;
  const W = s.size.w * 10, H = s.size.h * 10 - rackH;
  const D = p.round ? W : s.size.d * 10;
  const tt = p.topThickness, ls = p.legSize;
  const inset = p.round ? (W / 2) * (1 - 0.78 / Math.SQRT2) - ls / 2 : p.attach === "screw" ? 0 : p.attach === "plate" ? 30 : 45;
  const Lh = H - tt;
  const big = W > 1000;

  const seat = !!s.table?.seat;
  const topT = b.part(seat ? "Seat" : s.category.toLowerCase().includes("desk") ? "Desk top" : "Table top", [W, tt, D], p.round ? { shape: "cyl" } : undefined);
  const top = b.place(topT, [0, H - tt / 2, 0]);
  const legT = b.part("Leg", p.legs === "round" ? [ls, Lh, ls] : [ls, Lh, ls], { shape: p.legs === "round" ? "cyl" : "box", material: "wood" });
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const lx = W / 2 - ls / 2 - inset, lz = D / 2 - ls / 2 - inset;
  const legs = corners.map(([sx, sz]) => b.place(legT, [sx * lx, Lh / 2, sz * lz]));

  b.step(
    {
      title: seat ? "Lay the seat upside down" : "Lay the top upside down",
      detail: "Put the flattened box under it so the surface stays scratch free.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
      people: big ? 2 : 1,
    },
    () => b.add(top, [0, 200, 0]),
  );

  if (p.attach === "plate") {
    b.step(
      {
        title: "Screw a leg plate into each corner",
        detail: "Use the pre-drilled holes. Four screws per plate.",
        tools: ["screwdriver"],
        pose: "-y",
        kind: "screws",
      },
      () => {
        const plates: FitOpts[] = corners.map(([sx, sz]) => ({ on: top, at: [sx * lx, H - tt, sz * lz], dir: [0, 1, 0], hole: false }));
        b.fits(HW.plate, plates, 0.15);
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const [sx, sz] of corners)
          for (const [dx, dz] of [[-28, -28], [28, -28], [28, 28], [-28, 28]])
            sc.push({ on: top, at: [sx * lx + dx, H - tt - 3, sz * lz + dz], dir: [0, 1, 0], hole: false });
        b.fits(HW.screwM, sc, 0.04);
      },
    );
  }

  let rails: string[] = [];
  if (p.attach === "apron") {
    const rh = 80, rt = 20;
    const longT = b.part("Long rail", [W - 2 * inset - 2 * ls, rh, rt], { material: "wood" });
    const shortT = b.part("Short rail", [rt, rh, D - 2 * inset - 2 * ls], { material: "wood" });
    const ry = H - tt - rh / 2;
    rails = [
      b.place(longT, [0, ry, lz + ls / 2 - rt / 2]),
      b.place(longT, [0, ry, -(lz + ls / 2 - rt / 2)]),
      b.place(shortT, [lx + ls / 2 - rt / 2, ry, 0]),
      b.place(shortT, [-(lx + ls / 2 - rt / 2), ry, 0]),
    ];
    b.step(
      {
        title: seat ? "Screw the rails under the seat" : "Screw the rails under the top",
        detail: "They frame the underside, set in from the edge.",
        tools: ["screwdriver"],
        pose: "-y",
        kind: "screws",
      },
      () => {
        b.stagger(0.2);
        rails.forEach((r) => b.add(r, [0, -260, 0]));
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const r of rails) {
          const it = b.partItem(r);
          const along = it.final.pos[0] === 0 ? 0 : 2;
          const len = along === 0 ? W - 2 * inset - 2 * ls : D - 2 * inset - 2 * ls;
          for (const f of [-0.33, 0.33]) {
            const at: Vec3 = [...it.final.pos] as Vec3;
            at[along] += f * len;
            at[1] = H - tt - rh;
            sc.push({ on: r, at, dir: [0, 1, 0], hole: false });
          }
        }
        b.fits(HW.screwL, sc, 0.06);
      },
    );
  }

  if (p.attach === "screw") {
    b.step(
      {
        title: "Screw a bolt into each leg",
        detail: "Turn them in by hand until only half is showing.",
        scene: "legs",
        kind: "legs",
      },
      () => {
        b.stagger(0.15);
        legs.forEach((l, i) => b.stage(l, [(i - 1.5) * (ls + 110), Lh / 2, 0], [0, 0, 0], [0, 200, 0]));
        b.then(0.1);
        b.fits(
          { ...HW.legScrew, len: Math.round(Math.max(30, Math.min(70, 2 * (tt - 8))) / 2) * 2 },
          legs.map((l) => {
            const pos = b.partItem(l).final.pos;
            return { on: l, at: [pos[0], Lh, pos[2]], dir: [0, -1, 0], mate: top };
          }),
          0.12,
        );
      },
    );
  }

  b.step(
    {
      title: p.attach === "apron" ? "Bolt the legs into the corners" : "Screw in the legs",
      detail: p.attach === "apron" ? "Hand tight for now. Tighten them all once every leg is on." : "Turn each one clockwise by hand. Hand tight is enough.",
      tools: p.attach === "apron" ? ["allen"] : [],
      pose: "-y",
      kind: "legs",
      warnings: p.attach === "apron" ? ["loose"] : ["hand"],
    },
    () => {
      b.stagger(0.3);
      legs.forEach((l) => b.add(l, [0, -360, 0], { spin: p.attach === "apron" ? 0 : 2 }));
      if (p.attach === "apron") {
        b.then(0.1);
        const bolts: FitOpts[] = [];
        const y = H - tt - 40;
        const off = ls / 2 - 10;
        corners.forEach(([sx, sz], i) => {
          bolts.push({ on: legs[i], at: [sx * (lx + ls / 2), y, sz * (lz + off)], dir: [-sx, 0, 0] });
          bolts.push({ on: legs[i], at: [sx * (lx + off), y, sz * (lz + ls / 2)], dir: [0, 0, -sz] });
        });
        b.fits(HW.boltL, bolts, 0.08);
      }
    },
  );

  if (p.shelf && s.table?.inner) {
    // between the legs, set in like they are, and screwed through them
    const shT = b.part("Shelf", [W - 2 * inset - 2 * ls - 2, 18, D - 2 * inset], { material: "board" });
    const sy = Math.max(110, H * 0.22);
    const shelf = b.place(shT, [0, sy, 0]);
    b.step(
      {
        title: "Fit the shelf between the legs",
        detail: "Two screws through each leg.",
        tools: ["screwdriver"],
        pose: "-y",
        kind: "screws",
      },
      () => {
        b.add(shelf, [0, -320, 0]);
        b.then(0.1);
        const sc: FitOpts[] = [];
        corners.forEach(([sx, sz], i) => {
          for (const dz of [-ls / 5, ls / 5]) sc.push({ on: legs[i], at: [sx * (lx + ls / 2), sy, sz * lz + dz], dir: [-sx, 0, 0], hole: false });
        });
        b.fits(HW.screwL, sc, 0.06);
      },
    );
  } else if (p.shelf) {
    const shT = b.part("Shelf", [W - 2 * ls - 2, 16, D], { material: "board" });
    const sy = Math.max(110, H * 0.26);
    // a trolley's tiers: the lowest near the floor, the rest shared out evenly up to the top
    const n = clamp(Math.round(s.table?.levels ?? 1), 1, 4);
    const gap = n > 1 ? (H - tt - sy) / n : 0;
    const ys = Array.from({ length: n }, (_, i) => sy + gap * i);
    const shelves = ys.map((y) => b.place(shT, [0, y, 0]));
    b.step(
      {
        title: n > 1 ? `Fit the ${n} shelves between the legs` : "Fit the shelf between the legs",
        detail: "Two screws through each leg.",
        tools: ["screwdriver"],
        pose: "-y",
        kind: "screws",
      },
      () => {
        b.stagger(0.18);
        shelves.forEach((k) => b.add(k, [0, -320, 0]));
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const y of ys)
          corners.forEach(([sx, sz], i) => {
            for (const dz of [-ls / 5, ls / 5]) sc.push({ on: legs[i], at: [sx * (W / 2), y, sz * lz + dz], dir: [-sx, 0, 0], hole: false });
          });
        b.fits(HW.screwL, sc, n > 1 ? 0.03 : 0.06);
      },
    );
  }

  b.step(
    {
      title: big ? "Turn it over together" : "Turn it over",
      detail: seat ? "Lift it by the seat, not the legs." : "Lift it by the top, not the legs.",
      pose: "+y",
      kind: "flip",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    },
    () => {},
  );
  if (rackH) rackSteps(b, top, W, D, H, rackH);
}

/** A rack on a kitchen island: two posts bolted up through the back of the top, a rail across them, hooks under it. */
function rackSteps(b: PlanBuilder, top: string, W: number, D: number, H: number, R: number) {
  const ps = 40;
  const px = W / 2 - ps / 2 - 20, pz = -D / 2 + ps / 2 + 20;
  const postT = b.part("Rack post", [ps, R - ps, ps], { material: "wood" });
  const posts = [-1, 1].map((sx) => b.place(postT, [sx * px, H + (R - ps) / 2, pz]));
  const railT = b.part("Rack rail", [W - 40, ps, ps], { material: "wood" });
  const rail = b.place(railT, [0, H + R - ps / 2, pz]);
  b.step(
    {
      title: "Bolt the rack posts onto the top",
      detail: "One at each back corner. The bolts go up through the top into the posts.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.stagger(0.3);
      posts.forEach((k) => b.add(k, [0, 300, 0]));
      b.then(0.1);
      b.fits(HW.boltL, [-1, 1].map((sx) => ({ on: top, at: [sx * px, H - 30, pz] as Vec3, dir: [0, 1, 0] as Vec3, mate: posts[sx < 0 ? 0 : 1] })), 0.15);
    },
  );
  const nh = Math.max(3, Math.round(W / 250));
  b.step(
    {
      title: "Screw the rail across the posts, then the hooks",
      detail: "Two people make it easier: one holds the rail level while the other screws.",
      tools: ["screwdriver"],
      kind: "screws",
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.add(rail, [0, 260, 0]);
      b.then(0.1);
      b.fits(HW.screwL, [-1, 1].map((sx) => ({ on: rail, at: [sx * px, H + R, pz] as Vec3, dir: [0, -1, 0] as Vec3, mate: posts[sx < 0 ? 0 : 1] })), 0.15);
      b.then(0.1);
      b.fits(HW.hook, Array.from({ length: nh }, (_, i) => ({ on: rail, at: [-W / 2 + 60 + ((W - 120) * (i + 0.5)) / nh, H + R - ps, pz] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.08);
    },
  );
}
