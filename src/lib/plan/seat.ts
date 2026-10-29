import type { ProductSpec, SeatParams, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp, rotate } from "./math";
import { buildOffice } from "./office";
import { buildHighchair } from "./highchair";
import { buildLounger } from "./lounger";
import { buildSwivel } from "./swivel";

export function defaultsSeat(s: ProductSpec): SeatParams {
  const p = s.seat ?? {};
  const kind = p.kind ?? (s.size.h > 70 ? "chair" : "stool");
  return {
    kind,
    seat: p.seat ?? (kind === "stool" ? "round" : "square"),
    seatH: clamp(p.seatH ?? (kind === "chair" ? 45 : s.size.h), 25, 85),
    backH: clamp(p.backH ?? s.size.h, 60, 120),
    stretchers: p.stretchers ?? false,
    splay: p.splay ?? kind === "stool",
    ...(p.arms ? { arms: true } : {}),
  };
}

export function buildSeat(b: PlanBuilder, s: ProductSpec) {
  if (s.seat?.kind === "office") return buildOffice(b, s);
  if (s.seat?.kind === "highchair") return buildHighchair(b, s);
  if (s.seat?.kind === "lounger") return buildLounger(b, s);
  if (s.seat?.kind === "swivel") return buildSwivel(b, s);
  const p = defaultsSeat(s);
  if (p.kind === "chair") return chair(b, s, p);
  return stool(b, s, p);
}

function stool(b: PlanBuilder, s: ProductSpec, p: SeatParams) {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = p.seatH * 10;
  const st = 28;
  const round = p.seat === "round";
  const seatT = b.part("Seat", round ? [W, st, W] : [W, st, D], { shape: round ? "cyl" : "box", material: "wood" });
  const seat = b.place(seatT, [0, H - st / 2, 0]);
  const ld = 34;
  const a = p.splay ? 0.11 : 0;
  const Lh = (H - st) / Math.cos(a) + 4;
  const legT = b.part("Leg", [ld, Lh, ld], { shape: "cyl", material: "wood" });
  const r = round ? W / 2 - ld * 0.9 - 10 : 0;
  const corners: [number, number][] = round
    ? [0, 1, 2, 3].map((i) => [Math.cos(Math.PI / 4 + (i * Math.PI) / 2), Math.sin(Math.PI / 4 + (i * Math.PI) / 2)])
    : [
        [-1, 1],
        [1, 1],
        [1, -1],
        [-1, -1],
      ];
  const legs = corners.map(([cx, cz]) => {
    const tx = round ? cx * r : cx * (W / 2 - ld / 2 - 20);
    const tz = round ? cz * r : cz * (D / 2 - ld / 2 - 20);
    const len = Math.hypot(cx, cz) || 1;
    const rot: Vec3 = [-(cz / len) * a, 0, (cx / len) * a];
    const half = rotate([0, -Lh / 2, 0], rot);
    const topPt: Vec3 = [tx, H - st, tz];
    return { key: b.place(legT, [topPt[0] + half[0], topPt[1] + half[1], topPt[2] + half[2]], rot), rot, topPt };
  });

  b.step(
    {
      title: "Lay the seat upside down",
      detail: "On the flattened box, so it doesn't scratch.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
    },
    () => b.add(seat, [0, 200, 0]),
  );

  b.step(
    {
      title: "Screw a bolt into each leg",
      detail: "By hand, until half of it is showing.",
      scene: "legs",
      kind: "legs",
    },
    () => {
      b.stagger(0.15);
      legs.forEach((l, i) => b.stage(l.key, [(i - 1.5) * 150, Lh / 2, 0], [0, 0, 0], [0, 200, 0]));
      b.then(0.1);
      b.fits(
        { ...HW.legScrew, len: 2 * (st - 8) },
        legs.map((l) => ({ on: l.key, at: l.topPt, dir: rotate([0, -1, 0], l.rot), mate: seat })),
        0.12,
      );
    },
  );

  b.step(
    {
      title: "Screw in the legs",
      detail: "Clockwise, by hand. Stop when each leg feels firm.",
      pose: "-y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.3);
      legs.forEach((l) => b.add(l.key, rotate([0, -300, 0], l.rot), { spin: 2 }));
    },
  );

  if (p.stretchers) {
    const ry = H * 0.35;
    const pts = legs.map((l) => {
      const dy = H - st - ry;
      const v = rotate([0, -1, 0], l.rot);
      const k = dy / -v[1];
      return [l.topPt[0] + v[0] * k, ry, l.topPt[2] + v[2] * k] as Vec3;
    });
    const span = Math.hypot(pts[1][0] - pts[0][0], pts[1][2] - pts[0][2]) - ld;
    const strT = b.part("Rail", [18, span, 18], { shape: "cyl", material: "wood" });
    const rails = pts.map((pt, i) => {
      const q = pts[(i + 1) % 4];
      const mid: Vec3 = [(pt[0] + q[0]) / 2, ry, (pt[2] + q[2]) / 2];
      const ang = Math.atan2(q[2] - pt[2], q[0] - pt[0]);
      return b.place(strT, mid, [0, -ang, Math.PI / 2]);
    });
    b.step(
      {
        title: "Fit the rails between the legs",
        detail: "Ease the legs apart a little to slot each one in.",
        pose: "-y",
        kind: "join",
      },
      () => {
        b.stagger(0.2);
        rails.forEach((rk) => {
          const pos = b.partItem(rk).final.pos;
          const n = Math.hypot(pos[0], pos[2]) || 1;
          b.add(rk, [(pos[0] / n) * 200, 0, (pos[2] / n) * 200]);
        });
      },
    );
  }

  b.step(
    {
      title: "Turn it over",
      detail: "Sit carefully the first time and check nothing wobbles.",
      pose: "+y",
      kind: "flip",
    },
    () => {},
  );
}

function chair(b: PlanBuilder, s: ProductSpec, p: SeatParams) {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = p.seatH * 10, BH = p.backH * 10;
  const ls = 38, st = 28;
  const sx = W / 2 - ls / 2, sz = D / 2 - ls / 2;
  // with armrests the front legs run up past the seat to carry them
  const AH = p.arms ? Math.min(H + 220, BH - 140) : 0;
  const backT = b.part("Back leg", [ls, BH, ls], { material: "wood" });
  const frontT = b.part("Front leg", [ls, p.arms ? AH : H - st, ls], { material: "wood" });
  const restT = b.part("Backrest", [W - 2 * ls, 130, 20], { material: "wood" });
  const seatT = b.part("Seat", p.arms ? [W - 2 * ls, st, D - 2 * ls] : [W - 2 * ls, st, D - ls], { material: "wood" });
  const bl = [b.place(backT, [-sx, BH / 2, -sz]), b.place(backT, [sx, BH / 2, -sz])];
  const fy = (p.arms ? AH : H - st) / 2;
  const fl = [b.place(frontT, [-sx, fy, sz]), b.place(frontT, [sx, fy, sz])];
  const rest = b.place(restT, [0, BH - 110, -sz]);
  const seat = b.place(seatT, [0, H - st / 2, p.arms ? 0 : ls / 2]);
  const lowT = b.part("Front rail", [W - 2 * ls, 50, 20], { material: "wood" });
  const low = b.place(lowT, [0, H - st - 25, sz]);
  const sideT = b.part("Side rail", [20, 50, D - 2 * ls], { material: "wood" });
  const sides = [b.place(sideT, [-sx, H - st - 25, 0]), b.place(sideT, [sx, H - st - 25, 0])];

  b.step(
    {
      title: "Join the backrest to the back legs",
      detail: "Don't tighten fully yet.",
      tools: ["allen"],
      scene: "back",
      pose: "+z",
      kind: "bolts",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0.2);
      bl.forEach((k, i) => b.stage(k, b.partItem(k).final.pos, [0, 0, 0], [i === 0 ? -200 : 200, 0, 0]));
      b.then(0.05);
      b.stage(rest, b.partItem(rest).final.pos, [0, 0, 0], [0, 0, 260]);
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const [i, k] of bl.entries()) for (const dy of [-30, 30]) bolts.push({ on: k, at: [(i === 0 ? -1 : 1) * (W / 2), BH - 110 + dy, -sz], dir: [i === 0 ? 1 : -1, 0, 0], mate: rest });
      b.fits(HW.boltL, bolts, 0.1);
    },
  );

  b.step(
    {
      title: "Add the front legs and rails",
      detail: "Rails slot into the legs. Bolt them loosely.",
      tools: ["allen"],
      kind: "bolts",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0);
      [...bl, rest].forEach((k) => b.add(k, [0, 0, -200]));
      b.then(0.1);
      b.stagger(0.2);
      sides.forEach((k, i) => b.add(k, [i === 0 ? -220 : 220, 0, 0]));
      b.then(0.05);
      b.stagger(0);
      [...fl, low].forEach((k) => b.add(k, [0, 0, 300]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const [i, k] of fl.entries()) bolts.push({ on: k, at: [(i === 0 ? -1 : 1) * (W / 2), H - st - 25, sz], dir: [i === 0 ? 1 : -1, 0, 0], mate: sides[i] });
      for (const [i, k] of bl.entries()) bolts.push({ on: k, at: [(i === 0 ? -1 : 1) * (W / 2), H - st - 25, -sz], dir: [i === 0 ? 1 : -1, 0, 0], mate: sides[i] });
      b.fits(HW.boltL, bolts, 0.08);
    },
  );

  b.step(
    {
      title: "Lay the seat in and screw it down",
      detail: "Then tighten every bolt firmly, and again after a week.",
      tools: ["allen", "screwdriver"],
      kind: "screws",
    },
    () => {
      b.add(seat, [0, 300, 0]);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const x of [-(W / 2 - ls - 30), W / 2 - ls - 30]) for (const z of [-(D / 2 - ls - 40), D / 2 - ls - 50]) sc.push({ on: seat, at: [x, H, z + (p.arms ? 0 : ls / 2)], dir: [0, -1, 0], hole: false });
      b.fits(HW.screwL, sc, 0.1);
    },
  );

  if (!p.arms) return;
  const armT = b.part("Armrest", [56, 24, D + 40], { material: "wood" });
  const arms = [-1, 1].map((sgn) => b.place(armT, [sgn * sx, AH + 12, 20]));
  b.step(
    {
      title: "Fit the armrests",
      detail: "Each one sits on a front leg and bolts into the back leg.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.stagger(0.25);
      arms.forEach((k, i) => b.add(k, [i === 0 ? -160 : 160, 220, 0]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const [i, k] of arms.entries()) {
        const x = (i === 0 ? -1 : 1) * sx;
        bolts.push({ on: k, at: [x, AH + 24, sz], dir: [0, -1, 0], mate: fl[i] });
        bolts.push({ on: k, at: [(i === 0 ? -1 : 1) * (W / 2), AH + 12, -sz], dir: [i === 0 ? 1 : -1, 0, 0], mate: bl[i] });
      }
      b.fits(HW.boltL, bolts, 0.08);
    },
  );
}
