import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A cot: two ends, two barred sides and a slatted base that bolts in at one of two heights.
 * It stands lengthways across the view (x), so the front side faces the camera.
 * Built like IKEA's: one side between the ends, the base at the top height, then the front side.
 */
export function buildCot(b: PlanBuilder, s: ProductSpec) {
  const p = s.bed ?? {};
  const Ml = clamp((p.mattressL ?? 120) * 10, 1000, 1500), Mm = clamp((p.mattressW ?? 60) * 10, 500, 800);
  const H = clamp(s.size.h * 10, 700, 1000);
  const post = 45;
  const L = Ml + 2 * post + 10; // outside length
  const D = Mm + 83; // outside width
  const inner = D - 73; // between the sides
  const ex = L / 2 - post / 2; // centre of each end
  const sz = D / 2 - post / 2; // plane of each side
  const sideT = 28;

  /* ---------- ends: two posts, two rails and a panel ---------- */
  const endPieces = (x: number): PartPiece[] => [
    ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [post, H, post], pos: [x, H / 2, k * sz] })),
    { shape: "box", size: [36, 60, D - 2 * post], pos: [x, H - 30, 0] },
    { shape: "box", size: [36, 60, D - 2 * post], pos: [x, 130, 0] },
    { shape: "box", size: [12, H - 220, D - 2 * post], pos: [x, (H + 100) / 2, 0], material: "board" },
  ];
  const endC = b.compound("End", endPieces(-ex), { material: "wood" });
  const ends = [b.place(endC.type, endC.mid), b.place(endC.type, [-endC.mid[0], endC.mid[1], endC.mid[2]], [0, Math.PI, 0])];

  /* ---------- sides: two rails with bars between ---------- */
  const Ls = L - 2 * post;
  const railLo = 190, railHi = H - 40;
  const bars = Math.max(8, Math.round(Ls / 75));
  const pitch = Ls / bars;
  const sidePieces: PartPiece[] = [
    { shape: "box", size: [Ls, 40, sideT], pos: [0, railHi, 0] },
    { shape: "box", size: [Ls, 40, sideT], pos: [0, railLo, 0] },
  ];
  const barLen = railHi - railLo - 40;
  for (let i = 1; i < bars; i++) sidePieces.push({ shape: "cyl", size: [22, barLen, 22], pos: [-Ls / 2 + i * pitch, (railHi + railLo) / 2, 0] });
  const sideC = b.compound("Side", sidePieces, { material: "wood" });
  const backSide = b.place(sideC.type, [0, sideC.mid[1], -sz]);
  const frontSide = b.place(sideC.type, [0, sideC.mid[1], sz], [0, Math.PI, 0]);

  /* ---------- slatted base ---------- */
  const topY = clamp(H - 380, 380, 520); // top of the slats, top position
  const lowY = 230; // the lower position, for when the baby can sit up
  const baseL = L - 2 * post;
  const rz = inner / 2 - 40;
  const basePieces: PartPiece[] = [-1, 1].map((k) => ({ shape: "box", size: [baseL, 50, 24], pos: [0, topY - 12 - 25, k * rz] }));
  const slats = Math.round(Ml / 130);
  for (let i = 0; i < slats; i++) basePieces.push({ shape: "box", size: [70, 12, 2 * rz + 24], pos: [-Ml / 2 + 60 + (i * (Ml - 120)) / (slats - 1), topY - 6, 0] });
  const baseC = b.compound("Bed base", basePieces, { material: "wood" });
  const base = b.place(baseC.type, baseC.mid);

  /* ---------- drawer ---------- */
  let drawer: string | undefined;
  if (p.drawer) {
    const dw = Ls - 40, dd = inner - 30;
    const dC = b.compound(
      "Drawer",
      [
        { shape: "box", size: [dw - 40, 120, dd - 30], pos: [0, 30 + 60, -10] },
        { shape: "box", size: [dw, 140, 18], pos: [0, 30 + 70, dd / 2 - 9] },
      ],
      { material: "board" },
    );
    drawer = b.place(dC.type, dC.mid);
  }

  /* ---------- steps ---------- */
  const railYs = [railLo, railHi];
  const sideBolts = (side: string, z: number): FitOpts[] =>
    ends.flatMap((e, i) => railYs.map((y) => ({ on: e, at: [(i === 0 ? -1 : 1) * (L / 2), y, z] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3, mate: side })));

  b.step(
    {
      title: "Bolt one side between the ends",
      detail: "Hand tight for now, so the rest lines up easily.",
      tools: ["allen"],
      kind: "bolts",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0.3);
      ends.forEach((e, i) => b.add(e, [(i === 0 ? -1 : 1) * 300, 0, 0]));
      b.then(0.05);
      b.add(backSide, [0, 0, -320]);
      b.then(0.1);
      b.fits(HW.boltL, sideBolts(backSide, -sz), 0.1);
    },
  );

  b.step(
    {
      title: "Bolt the base in at the top height",
      detail: "The top holes are for a newborn. Move the base down once your baby can sit up.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      // the holes for the lower height, for later
      ends.forEach((e, i) => {
        const sgn = i === 0 ? -1 : 1;
        for (const z of [-rz, rz]) b.hole(e, [sgn * (L / 2 - 16.5), lowY - 37, z], [sgn, 0, 0], 3.5);
      });
      b.add(base, [0, 320, 0]);
      b.then(0.1);
      const bolts: FitOpts[] = ends.flatMap((e, i) => [-rz, rz].map((z) => ({ on: e, at: [(i === 0 ? -1 : 1) * (L / 2 - 16.5), topY - 37, z] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3, mate: base })));
      b.fits(HW.boltL, bolts, 0.1);
    },
  );

  b.step(
    {
      title: "Add the other side",
      detail: "Then tighten every bolt firmly. Check none stick out on the inside.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.add(frontSide, [0, 0, 320]);
      b.then(0.1);
      b.fits(HW.boltL, sideBolts(frontSide, sz), 0.1);
    },
  );

  if (drawer) {
    b.step(
      {
        title: "Slide the drawer in underneath",
        detail: "It sits under the base and pulls out from the front.",
        kind: "drawer",
      },
      () => b.add(drawer!, [0, 0, 420]),
    );
  }

  const mT = b.part("Your mattress", [Ml, 100, Mm], { material: "soft", extra: true });
  const m = b.place(mT, [0, topY + 50, 0]);
  b.step(
    {
      title: "Add your mattress",
      detail: "It should fit snugly, with no gap at the sides.",
      kind: "general",
    },
    () => b.add(m, [0, 420, 0]),
  );
}
