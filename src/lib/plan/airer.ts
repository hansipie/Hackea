import type { PartPiece, ProductSpec } from "../types";
import { PlanBuilder } from "./builder";
import { clamp } from "./math";

/**
 * A freestanding drying rack (MULIG, JÄLL): two end frames of tube on legs, rails clicked in between them across the
 * top, and a wing hooked on at the front and the back that folds out flat.
 */
export function buildAirer(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tube = 22, rail = 12;
  const Dc = clamp(D * 0.42, 250, 500); // the middle part, between the legs
  const wing = (D - Dc) / 2;
  const ex = W / 2 - tube / 2;
  const yTop = H - tube / 2;

  const endPieces: PartPiece[] = [];
  for (const z of [-Dc / 2 + tube / 2, Dc / 2 - tube / 2]) endPieces.push({ shape: "cyl", size: [tube, H, tube], pos: [0, H / 2, z] });
  endPieces.push({ shape: "cyl", size: [tube, Dc, tube], pos: [0, yTop, 0], rot: [Math.PI / 2, 0, 0] });
  endPieces.push({ shape: "cyl", size: [tube - 4, Dc - tube, tube - 4], pos: [0, 260, 0], rot: [Math.PI / 2, 0, 0] });
  const endC = b.compound("End frame", endPieces, { material: "metal" });
  const ends = [-1, 1].map((sx) => b.place(endC.type, [sx * ex + endC.mid[0], endC.mid[1], endC.mid[2]]));

  const nr = clamp(Math.round(Dc / 70), 3, 7);
  const railT = b.part("Rail", [rail, W - tube, rail], { shape: "cyl", material: "metal" });
  const rz = (i: number) => -Dc / 2 + tube + ((Dc - 2 * tube) * i) / (nr - 1);
  const rails = Array.from({ length: nr }, (_, i) => b.place(railT, [0, yTop, rz(i)], [0, 0, Math.PI / 2]));

  // a wing: a frame of tube with rails across it, lying flat out from the top
  const wn = clamp(Math.round(wing / 70), 2, 5);
  const wingPieces: PartPiece[] = [];
  for (const x of [-ex, ex]) wingPieces.push({ shape: "cyl", size: [tube - 4, wing, tube - 4], pos: [x, 0, wing / 2], rot: [Math.PI / 2, 0, 0] });
  wingPieces.push({ shape: "cyl", size: [tube - 4, W - tube, tube - 4], pos: [0, 0, wing], rot: [0, 0, Math.PI / 2] });
  for (let i = 1; i < wn; i++) wingPieces.push({ shape: "cyl", size: [rail, W - tube, rail], pos: [0, 0, (wing * i) / wn], rot: [0, 0, Math.PI / 2] });
  const wingC = b.compound("Wing", wingPieces, { material: "metal" });
  const wings = [1, -1].map((sz) =>
    sz > 0
      ? b.place(wingC.type, [wingC.mid[0], yTop + wingC.mid[1], Dc / 2 + wingC.mid[2]])
      : b.place(wingC.type, [wingC.mid[0], yTop + wingC.mid[1], -Dc / 2 - wingC.mid[2]], [0, Math.PI, 0]),
  );

  b.step(
    {
      title: "Click the rails into one end frame",
      detail: "Stand the end frame up, then push each rail into its hole along the top until it clicks.",
      kind: "join",
    },
    () => {
      b.add(ends[0], [-260, 0, 0]);
      b.then(0.1);
      b.stagger(0.14);
      rails.forEach((k) => b.add(k, [300, 0, 0]));
    },
  );

  b.step(
    {
      title: "Add the other end frame",
      detail: "Line it up with the free ends of the rails and press it on, one rail at a time.",
      kind: "join",
      people: W > 1200 ? 2 : 1,
    },
    () => b.add(ends[1], [320, 0, 0]),
  );

  b.step(
    {
      title: "Hook on the wings",
      detail: "One along the front and one along the back. Fold them out flat to dry, and down again to store.",
      kind: "join",
    },
    () => {
      b.stagger(0.3);
      wings.forEach((k, i) => b.add(k, [0, 220, i === 0 ? 200 : -200]));
    },
  );
}
