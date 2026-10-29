import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A sun lounger with a backrest that adjusts: two long side rails on four legs, cross rails between them, a slatted seat
 * screwed on top, and a slatted backrest bolted at the end of the seat so it tips up, propped on a support that drops
 * into notches on the rails. It lies along the depth, the backrest at the back.
 */
export function buildLounger(b: PlanBuilder, s: ProductSpec) {
  const p = s.seat ?? {};
  const W = s.size.w * 10, L = s.size.d * 10;
  const top = clamp((p.seatH ?? 33) * 10, 250, 450); // top of the seat
  const railH = 80, railT = 36, slatT = 18;
  const railTop = top - slatT;
  const ry = railTop - railH / 2;
  const legS = 46;
  const backLen = Math.round(L * 0.36);
  const zh = -L / 2 + backLen; // where the backrest hinges, at the end of the seat
  const tilt = (50 * Math.PI) / 180;

  /* ---------- frame ---------- */
  const railTp = b.part("Side rail", [railT, railH, L], { material: "wood" });
  const xr = W / 2 - railT / 2;
  const rails = [b.place(railTp, [-xr, ry, 0]), b.place(railTp, [xr, ry, 0])];
  const legT = b.part("Leg", [legS, railTop, legS], { material: "wood" });
  const xl = W / 2 - railT - legS / 2, zl = L / 2 - 70;
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => b.place(legT, [sx * xl, railTop / 2, sz * zl])));
  const crossT = b.part("Cross rail", [W - 2 * railT, 60, 30], { material: "wood" });
  const zc = [-L / 2 + 150, 0, L / 2 - 150];
  const cross = zc.map((z) => b.place(crossT, [0, ry, z]));

  /* ---------- the slatted seat, and the backrest ---------- */
  const slats = (len: number): PartPiece[] => {
    const n = Math.max(4, Math.round(len / 95));
    const step = len / n;
    return Array.from({ length: n }, (_, i) => ({ shape: "box", size: [W - 20, slatT, step - 22], pos: [0, 0, -len / 2 + step * (i + 0.5)] }));
  };
  const seatLen = L / 2 - zh;
  const seatC = b.compound("Seat", [...slats(seatLen), ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [30, 20, seatLen - 20] as Vec3, pos: [sx * (W / 2 - railT - 40), -slatT / 2 - 10, 0] as Vec3 }))], { material: "wood" });
  const seat = b.place(seatC.type, [0, top - slatT / 2 + seatC.mid[1], zh + seatLen / 2]);
  const backC = b.compound("Backrest", [...slats(backLen), ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [30, 20, backLen - 20] as Vec3, pos: [sx * (W / 2 - railT - 40), -slatT / 2 - 10, 0] as Vec3 }))], { material: "wood" });
  // raised: it turns about the hinge, its far end up
  const along: Vec3 = [0, Math.sin(tilt), -Math.cos(tilt)];
  const bc: Vec3 = [0, top - slatT / 2 + along[1] * (backLen / 2), zh + along[2] * (backLen / 2)];
  const backrest = b.place(backC.type, bc, [tilt, 0, 0]);
  // the support: two struts up from the rails to the underside of the backrest, joined across the bottom
  const tp: Vec3 = [0, top - slatT + along[1] * backLen * 0.62, zh + along[2] * backLen * 0.62];
  const sh = tp[1] - railTop;
  const supC = b.compound(
    "Back support",
    [
      ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [24, sh, 24] as Vec3, pos: [sx * (W / 2 - railT - 22), railTop + sh / 2, tp[2]] as Vec3 })),
      { shape: "cyl", size: [22, W - 2 * railT, 22], pos: [0, railTop + 11, tp[2]], rot: [0, 0, Math.PI / 2] },
    ],
    { material: "wood" },
  );
  const support = b.place(supC.type, supC.mid);

  /* ---------- steps ---------- */
  b.step(
    {
      title: "Bolt a leg to each end of the side rails",
      detail: "The legs go on the inside of the rails. Two bolts each, hand tight for now.",
      tools: ["allen"],
      kind: "bolts",
      warnings: ["loose"],
    },
    () => {
      b.stagger(0.25);
      rails.forEach((r, i) => b.add(r, [(i === 0 ? -1 : 1) * 300, 0, 0]));
      b.then(0.1);
      b.stagger(0.18);
      legs.forEach((l) => b.add(l, [0, -200, 0]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      legs.forEach((l, i) => {
        const sx = i < 2 ? -1 : 1;
        const z = b.partItem(l).final.pos[2];
        for (const dz of [-12, 12]) bolts.push({ on: rails[i < 2 ? 0 : 1], at: [sx * (W / 2), ry, z + dz], dir: [-sx, 0, 0], mate: l });
      });
      b.fits(HW.boltL, bolts, 0.06);
    },
  );
  b.step(
    {
      title: "Join the sides with the cross rails",
      detail: "Bolt them in, stand it on its legs, then tighten every bolt.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.stagger(0.25);
      cross.forEach((c) => b.add(c, [0, 260, 0]));
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const z of zc) for (const sx of [-1, 1]) bolts.push({ on: rails[sx < 0 ? 0 : 1], at: [sx * (W / 2), ry, z], dir: [-sx, 0, 0], mate: cross[zc.indexOf(z)] });
      b.fits(HW.boltL, bolts, 0.06);
    },
  );
  b.step(
    {
      title: "Screw the seat onto the rails",
      detail: "Its slats run across, from the backrest end to the foot end.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.add(seat, [0, 300, 0]);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const z of [zh + 120, zh + seatLen / 2, L / 2 - 120]) for (const sx of [-1, 1]) sc.push({ on: seat, at: [sx * (W / 2 - railT / 2), top, z], dir: [0, -1, 0], hole: false });
      b.fits(HW.screwM, sc, 0.08);
    },
  );
  b.step(
    {
      title: "Bolt on the backrest",
      detail: "One bolt each side, at the end of the seat. It should tip up and down freely.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.add(backrest, [0, 260, -300]);
      b.then(0.1);
      b.fits(HW.boltS, [-1, 1].map((sx) => ({ on: rails[sx < 0 ? 0 : 1], at: [sx * (W / 2), ry, zh] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: backrest })), 0.15);
    },
  );
  b.step(
    {
      title: "Prop the backrest up on its support",
      detail: "Lift the backrest and set the support in the notch you like. The lower the notch, the further it leans back.",
      kind: "general",
    },
    () => b.add(support, [0, 0, 300]),
  );
}
