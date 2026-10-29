import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { anchorStep } from "./frame";

const RIM = 100; // mm: the changing top's raised edge at the back and sides

/**
 * Changing tables: a chest of drawers or an open shelf unit, built exactly as one, with a changing top on it:
 * a board with a raised edge at the back and the sides. A chest is shallower than its top, which lines up at the back
 * and reaches out over the front. The top goes on last, once the unit stands fixed to the wall.
 */
export function buildChanging(b: PlanBuilder, s: ProductSpec, unit: (b: PlanBuilder, s: ProductSpec) => void) {
  const chest = !!s.drawers;
  const W = s.size.w * 10, D = s.size.d * 10;
  const Du = chest ? Math.min(D, 520) : D;
  const Hu = s.size.h * 10 - RIM;
  const inner: ProductSpec = chest
    ? { ...s, size: { w: s.size.w, h: Hu / 10, d: Du / 10 }, drawers: { ...s.drawers, changing: undefined } }
    : { ...s, size: { w: s.size.w, h: Hu / 10, d: Du / 10 }, shelf: { ...s.shelf, changing: undefined } };
  unit(b, inner);
  // a changing table is always fixed to the wall, however low it is
  if (b.steps[b.steps.length - 1]?.kind !== "anchor") {
    const topType = b.parts.find((p) => p.name === "Top panel");
    const topItem = b.items.find((it) => it.kind === "part" && it.ref === topType?.id);
    if (topItem) anchorStep(b, { W, D: Du, top: topItem.key, y: Hu, backZ: -Du / 2, severe: true });
  }

  const floor = 18, wall = 18, lip = 30;
  const pieces: PartPiece[] = [
    { shape: "box", size: [W, floor, D], pos: [0, floor / 2, 0] },
    { shape: "box", size: [W, RIM, wall], pos: [0, RIM / 2, -D / 2 + wall / 2] },
    { shape: "box", size: [wall, RIM, D - wall], pos: [-W / 2 + wall / 2, RIM / 2, wall / 2] },
    { shape: "box", size: [wall, RIM, D - wall], pos: [W / 2 - wall / 2, RIM / 2, wall / 2] },
    { shape: "box", size: [W - 2 * wall, lip, wall], pos: [0, lip / 2, D / 2 - wall / 2] },
  ];
  const c = b.compound("Changing top", pieces);
  // the backs line up
  const z0 = -Du / 2 + D / 2;
  const top = b.place(c.type, [c.mid[0], Hu + c.mid[1], z0 + c.mid[2]]);
  b.step(
    {
      title: "Screw on the changing top",
      detail: "Raised edges at the back and the sides. Screw it down into the top, so it can't slide. Never leave a baby on it alone.",
      tools: ["screwdriver"],
      kind: "screws",
      people: W > 900 ? 2 : 1,
    },
    () => {
      b.add(top, [0, 300, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const x of [-W / 2 + 80, W / 2 - 80]) for (const z of [-Du / 2 + 60, Du / 2 - 60]) list.push({ on: top, at: [x, Hu + floor, z] as Vec3, dir: [0, -1, 0] as Vec3, hole: false });
      b.fits(HW.screwM, list, 0.1);
    },
  );
}
