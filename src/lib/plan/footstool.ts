import type { ProductSpec } from "../types";
import { PlanBuilder } from "./builder";

/**
 * A padded footstool on four legs: turned upside down, the legs screwed in by hand, and stood up. Sold on its own as a
 * pouffe, or with an armchair, when it's built after the chair and stood in front of it.
 */
export function footstool(b: PlanBuilder, o: { w: number; h: number; d: number; z?: number; alone?: boolean; round?: boolean }) {
  const { w, h, d } = o;
  // a round pouffe stands low on short feet; a footstool on proper legs
  const legH = o.round ? Math.min(40, h * 0.1) : Math.min(120, h * 0.3);
  const z = o.z ?? 0;
  const padT = b.part(o.alone ? "Seat" : "Footstool", [w, h - legH, d], { material: "soft", ...(o.round ? { shape: "cyl" as const } : {}) });
  const pad = b.place(padT, [0, legH + (h - legH) / 2, z]);
  const legT = b.part(o.alone ? "Leg" : "Footstool leg", [36, legH, 36], { shape: "cyl", material: "wood" });
  // on a drum the feet sit inside its round edge
  const lx = o.round ? w * 0.3 : w / 2 - 60, lz = o.round ? d * 0.3 : d / 2 - 60;
  const legs = [
    [-lx, lz],
    [lx, lz],
    [lx, -lz],
    [-lx, -lz],
  ].map(([x, zz]) => b.place(legT, [x, legH / 2, z + zz]));
  const scene = o.alone ? "main" : "footstool";
  const at = (k: string) => b.partItem(k).final.pos;

  if (o.alone) {
    b.step(
      {
        title: "Lay it upside down",
        detail: "On a blanket or the flattened box, so the fabric stays clean.",
        pose: "-y",
        kind: "general",
        warnings: ["floor"],
      },
      () => b.add(pad, [0, 200, 0]),
    );
  }
  b.step(
    {
      title: o.alone ? "Screw in the legs" : "Screw the legs into the footstool",
      detail: o.alone ? "Clockwise by hand until each one is snug." : "Lay it upside down first. Clockwise by hand until each one is snug.",
      scene,
      pose: o.alone ? "-y" : "+y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      if (!o.alone) {
        // upside down on its own, legs pointing up
        b.stage(pad, [0, (h - legH) / 2, 0], [Math.PI, 0, 0], [0, 180, 0]);
        b.then(0.1);
        b.stagger(0.22);
        for (const l of legs) {
          const p = at(l);
          b.stage(l, [p[0], h - legH + legH / 2, -(p[2] - z)], [Math.PI, 0, 0], [0, 240, 0]);
        }
        return;
      }
      b.stagger(0.22);
      legs.forEach((l) => b.add(l, [0, -260, 0], { spin: 2 }));
    },
  );
  b.step(
    {
      title: o.alone ? "Turn it over" : "Stand the footstool in front of the chair",
      detail: o.alone ? "Check that it stands steady on all four legs." : "Turn it over onto its legs and check it stands steady.",
      pose: "+y",
      kind: "flip",
    },
    () => {
      if (o.alone) return;
      b.stagger(0);
      b.add(pad, [0, 260, 0]);
      legs.forEach((l) => b.add(l, [0, 260, 0]));
    },
  );
}

/** A pouffe or footstool sold on its own. */
export function buildPouffe(b: PlanBuilder, s: ProductSpec) {
  footstool(b, { w: s.size.w * 10, h: s.size.h * 10, d: s.size.d * 10, alone: true, round: s.sofa?.round });
}
