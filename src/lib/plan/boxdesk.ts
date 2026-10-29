import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * A low desk between two storage frames (TROFAST): each frame is two sides with a top and a bottom screwed between
 * them, the desk top is screwed in between the frames at their height, and the boxes, trays or shelves slide into
 * the frames' grooves last.
 */
export function buildBoxDesk(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tp = s.table ?? {};
  const fw = clamp((tp.frame ?? 32) * 10, 250, Math.max(250, W / 3)); // each frame's width
  const per = clamp(Math.round(tp.boxes ?? 2), 1, 4); // boxes in each frame
  const shelves = !!tp.shelvesIn;
  const t = 15;
  const iw = fw - 2 * t;
  const fx = [-W / 2 + fw / 2, W / 2 - fw / 2]; // the frames' middles

  const sideT = b.part("Frame side", [t, H, D]);
  const flatT = b.part("Frame top and bottom", [iw, t, D]);
  const frames = fx.map((x) => ({
    x,
    parts: [
      b.place(sideT, [x - fw / 2 + t / 2, H / 2, 0]),
      b.place(sideT, [x + fw / 2 - t / 2, H / 2, 0]),
      b.place(flatT, [x, t / 2, 0]),
      b.place(flatT, [x, H - t / 2, 0]),
    ],
  }));
  const topW = W - 2 * fw;
  const deskT = b.part("Desk top", [topW, 22, D]);
  const desk = b.place(deskT, [0, H - 11, 0]);
  const slotH = (H - 2 * t) / per;
  const boxT = shelves ? b.part("Shelf", [iw - 4, 10, D - 30]) : b.part("Storage box", [iw - 6, slotH - 14, D - 30], { material: "fiber" });
  const boxes = frames.flatMap((f) =>
    Array.from({ length: shelves ? per - 1 : per }, (_, i) => {
      const y = shelves ? t + (i + 1) * slotH : t + i * slotH + slotH / 2;
      return b.place(boxT, [f.x, y, 15]);
    }),
  );

  const f0 = frames[0];
  const at = (k: string) => b.partItem(k).final.pos;
  const rel = (k: string): Vec3 => [at(k)[0] - f0.x, at(k)[1], at(k)[2]];
  const corners = (f: (typeof frames)[number]): FitOpts[] =>
    f.parts.slice(0, 2).flatMap((sd, i) => {
      const x = at(sd)[0] + (i === 0 ? -t / 2 : t / 2);
      return [t / 2, H - t / 2].flatMap((y) => [-D / 4, D / 4].map((z) => ({ on: sd, at: [x, y, z] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 })));
    });

  b.step(
    {
      title: "Put the frames together",
      detail: "Screw the top and bottom in between the two sides. Grooves face inwards, for the boxes.",
      tools: ["screwdriver"],
      scene: "frame",
      repeat: 2,
      kind: "screws",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      f0.parts.forEach((k) => b.stage(k, rel(k), [0, 0, 0], [0, 160, 0]));
      b.then(0.1);
      b.fits(HW.screwM, corners(f0), 0.08);
    },
  );

  b.step(
    {
      title: "Screw the desk top in between the frames",
      detail: "Stand the frames apart, then screw through their inner sides into the ends of the top.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      for (const [i, f] of frames.entries()) {
        b.stagger(0);
        f.parts.forEach((k) => b.add(k, [i === 0 ? -260 : 260, 0, 0]));
        if (i > 0) for (const o of corners(f)) b.preset(HW.screwM, o);
        b.wait(0.2);
      }
      b.then(0.1);
      b.add(desk, [0, 260, 0]);
      b.then(0.1);
      const list: FitOpts[] = [];
      for (const [i, f] of frames.entries()) {
        const x = f.x + (i === 0 ? fw / 2 : -fw / 2);
        for (const z of [-D / 3, 0, D / 3]) list.push({ on: f.parts[i === 0 ? 1 : 0], at: [x - (i === 0 ? t : -t), H - 11, z], dir: [i === 0 ? 1 : -1, 0, 0], mate: desk });
      }
      b.fits(HW.screwM, list, 0.08);
    },
  );

  b.step(
    {
      title: shelves ? "Slide in the shelves" : "Slide in the boxes",
      detail: shelves ? "Each one runs along a pair of grooves until it stops." : "Each one runs along a pair of grooves. They pull out from either side.",
      kind: "general",
      weight: 0.8 + 0.3 * boxes.length,
    },
    () => {
      b.stagger(0.18);
      boxes.forEach((k) => b.add(k, [0, 0, 420]));
    },
  );
}
