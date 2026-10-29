import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * Bunk beds (two beds on four posts) and loft beds (one bed up high, room underneath).
 * The bed runs across the view (x), ladder at the front right. Two people stand the end frames up,
 * bolt in the side rails, lay in the slatted bases, then fit the guard rails and the ladder.
 */
export function buildBunk(b: PlanBuilder, s: ProductSpec) {
  const p = s.bed ?? {};
  const loft = p.type === "loft";
  const Ml = clamp((p.mattressL ?? 200) * 10, 1800, 2100), Mm = clamp((p.mattressW ?? 90) * 10, 700, 1400);
  const H = clamp(s.size.h * 10, loft ? 1100 : 1300, 2300);
  const post = 50;
  const L = Ml + 2 * post + 10; // outside length
  const D = Mm + post + 48; // outside width
  const zr = D / 2 - post / 2; // plane of the posts and side rails
  const railH = 140, railT = 28;
  const Ls = L - 2 * post; // between the posts
  const ex = L / 2 - post / 2;
  const yUp = H - 500; // upper bed (or the only one), centre of its side rails
  const yLow = 300;
  const levels = loft ? [yUp] : [yLow, yUp];

  /* ---------- end frames: two posts and rails across ---------- */
  const across = (y: number, h: number): PartPiece => ({ shape: "box", size: [36, h, D - 2 * post], pos: [-ex, y, 0] });
  const endPieces: PartPiece[] = [-1, 1].map((k): PartPiece => ({ shape: "box", size: [post, H, post], pos: [-ex, H / 2, k * zr] }));
  for (const y of levels) endPieces.push(across(y, railH));
  endPieces.push(across(H - 40, 80)); // the top, a guard at the head and foot
  endPieces.push(across((yUp + railH / 2 + H - 80) / 2, 60));
  endPieces.push(loft ? across(200, 80) : across((yLow + yUp) / 2, 60));
  const endC = b.compound("End frame", endPieces, { material: "wood" });
  const ends = [b.place(endC.type, endC.mid), b.place(endC.type, [-endC.mid[0], endC.mid[1], endC.mid[2]], [0, Math.PI, 0])];

  /* ---------- side rails, with a ledge on the inside for the slats ---------- */
  const railC = b.compound(
    "Side rail",
    [
      { shape: "box", size: [Ls, railH, railT], pos: [0, 0, 0] },
      { shape: "box", size: [Ls, 30, 24], pos: [0, -railH / 2 + 15, railT / 2 + 12] },
    ],
    { material: "wood" },
  );
  // back rails (ledge facing forward) and front rails (turned round), per level
  const rails = levels.map((y) => ({
    y,
    back: b.place(railC.type, [0, y + railC.mid[1], -zr + railC.mid[2]]),
    front: b.place(railC.type, [0, y + railC.mid[1], zr - railC.mid[2]], [0, Math.PI, 0]),
  }));
  // a long stay at the back keeps a loft bed from racking
  const stay = loft ? b.place(b.part("Back stay", [Ls, 80, railT], { material: "wood" }), [0, 300, -zr]) : undefined;

  /* ---------- slatted bases ---------- */
  const slatY = (y: number) => y - railH / 2 + 30 + 6;
  const nSl = 14;
  const basePieces: PartPiece[] = [];
  for (let i = 0; i < nSl; i++) basePieces.push({ shape: "box", size: [70, 12, Mm + 10], pos: [-Ml / 2 + 50 + (i * (Ml - 100)) / (nSl - 1), 0, 0] });
  for (const z of [-Mm / 4, Mm / 4]) basePieces.push({ shape: "box", size: [Ml - 40, 3, 40], pos: [0, -7.5, z], material: "fiber" });
  const baseC = b.compound("Slatted base", basePieces, { material: "wood" });
  const bases = levels.map((y) => b.place(baseC.type, [0, slatY(y) + baseC.mid[1], 0]));

  /* ---------- guard rails on the top bed, open at the ladder ---------- */
  const opening = 520;
  const gTop = H - 60;
  const gLow = yUp; // the uprights come down over the side rail
  const guard = (len: number, name: string) => {
    const n = Math.max(2, Math.round(len / 600) + 1);
    const pieces: PartPiece[] = [{ shape: "box", size: [len, 60, railT], pos: [0, gTop, 0] }];
    for (let i = 0; i < n; i++) pieces.push({ shape: "box", size: [40, gTop - 30 - gLow + 40, railT], pos: [-len / 2 + 30 + (i * (len - 60)) / (n - 1), (gTop - 30 + gLow - 40) / 2, 0] });
    return { c: b.compound(name, pieces, { material: "wood" }), n };
  };
  const zOut = zr + railT; // just outside a side rail
  const backG = guard(Ls, "Guard rail");
  const frontLen = Ls - opening;
  const frontG = guard(frontLen, "Front guard rail");
  const backGuard = b.place(backG.c.type, [0, backG.c.mid[1], -zOut]);
  const frontGuard = b.place(frontG.c.type, [-Ls / 2 + frontLen / 2, frontG.c.mid[1], zOut], [0, Math.PI, 0]);
  const uprightXs = (len: number, n: number, x0: number) => Array.from({ length: n }, (_, i) => x0 - len / 2 + 30 + (i * (len - 60)) / (n - 1));

  /* ---------- ladder ---------- */
  const lx = Ls / 2 - opening / 2; // in the opening
  const ladTop = yUp + railH / 2 + 60;
  const lz = zr + railT / 2 + 25;
  const span = 400;
  const ladPieces: PartPiece[] = [-1, 1].map((k): PartPiece => ({ shape: "box", size: [40, ladTop, 50], pos: [k * (span / 2), ladTop / 2, 0] }));
  for (let y = 280; y < yUp - 100; y += 260) ladPieces.push({ shape: "cyl", size: [30, span - 40, 30], pos: [0, y, 0], rot: [0, 0, Math.PI / 2] });
  const ladC = b.compound("Ladder", ladPieces, { material: "wood" });
  const ladder = b.place(ladC.type, [lx, ladC.mid[1], lz]);

  /* ---------- steps ---------- */
  const railBolts = (key: string, y: number, z: number): FitOpts[] =>
    ends.map((e, i) => ({ on: e, at: [(i === 0 ? -1 : 1) * (L / 2), y, z] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3, mate: key }));
  const boltsFor = (r: (typeof rails)[number]) =>
    [-25, 25].flatMap((dy) => [...railBolts(r.back, r.y + dy, -zr), ...railBolts(r.front, r.y + dy, zr)]);

  const first = rails[0];
  b.step(
    {
      title: loft ? "Stand the ends up and bolt in the side rails" : "Stand the ends up and bolt in the lower rails",
      detail: "One holds the ends upright while the other bolts. Hand tight for now.",
      tools: ["allen"],
      people: 2,
      kind: "bolts",
      warnings: ["two", "loose"],
    },
    () => {
      b.stagger(0.3);
      ends.forEach((e, i) => b.add(e, [(i === 0 ? -1 : 1) * 360, 0, 0]));
      b.then(0.05);
      b.add(first.back, [0, 0, -320]);
      b.add(first.front, [0, 0, 320]);
      if (stay) b.add(stay, [0, 0, -320]);
      b.then(0.1);
      const bolts = boltsFor(first);
      if (stay) bolts.push(...railBolts(stay, 300, -zr));
      b.fits(HW.boltL, bolts, 0.06);
    },
  );

  if (!loft) {
    const up = rails[1];
    b.step(
      {
        title: "Bolt in the upper rails",
        detail: "Same as the lower ones, at the top holes.",
        tools: ["allen"],
        people: 2,
        kind: "bolts",
        warnings: ["two", "loose"],
      },
      () => {
        b.stagger(0.3);
        b.add(up.back, [0, 0, -320]);
        b.add(up.front, [0, 0, 320]);
        b.then(0.1);
        b.fits(HW.boltL, boltsFor(up), 0.06);
      },
    );
  }

  b.step(
    {
      title: loft ? "Lay in the slatted base" : "Lay in the slatted bases",
      detail: loft ? "Unroll it onto the ledges, straps facing down." : "Unroll each one onto its ledges, straps facing down.",
      kind: "slats",
    },
    () => {
      b.stagger(0.4);
      bases.forEach((k) => b.add(k, [0, 300, 0]));
    },
  );

  b.step(
    {
      title: loft ? "Fit the guard rails" : "Fit the guard rails to the top bed",
      detail: "The gap in the front rail is for the ladder.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.stagger(0.3);
      b.add(frontGuard, [0, 300, 0]);
      b.add(backGuard, [0, 300, 0]);
      b.then(0.1);
      const top = rails[rails.length - 1];
      const bolts: FitOpts[] = [
        ...uprightXs(frontLen, frontG.n, -Ls / 2 + frontLen / 2).map((x) => ({ on: frontGuard, at: [x, top.y, zOut + railT / 2] as Vec3, dir: [0, 0, -1] as Vec3, mate: top.front })),
        ...uprightXs(Ls, backG.n, 0).map((x) => ({ on: backGuard, at: [x, top.y, -zOut - railT / 2] as Vec3, dir: [0, 0, 1] as Vec3, mate: top.back })),
      ];
      b.fits(HW.boltL, bolts, 0.08);
    },
  );

  b.step(
    {
      title: "Hook on the ladder and bolt it",
      detail: "Then tighten every bolt firmly, and check them again every few months.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.add(ladder, [0, 0, 360]);
      b.then(0.1);
      const top = rails[rails.length - 1];
      b.fits(
        HW.boltL,
        [-1, 1].map((k) => ({ on: ladder, at: [lx + k * (span / 2), top.y, lz + 25] as Vec3, dir: [0, 0, -1] as Vec3, mate: top.front })),
        0.12,
      );
    },
  );

  const mT = b.part("Your mattress", [Ml, 140, Mm], { material: "soft", extra: true });
  const ms = levels.map((y) => b.place(mT, [0, slatY(y) + 6 + 70, 0]));
  b.step(
    {
      title: loft ? "Add your mattress" : "Add your mattresses",
      detail: "No thicker than the line on the guard rail, so the rail stays high enough.",
      people: 2,
      kind: "general",
      warnings: ["two"],
    },
    () => {
      b.stagger(0.4);
      ms.forEach((m) => b.add(m, [0, 420, 0]));
    },
  );
}
