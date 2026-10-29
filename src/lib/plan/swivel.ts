import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * An upholstered easy chair on a swivel base: the chair comes in one piece, with its armrests and backrest. Turned upside
 * down, it gets the swivel plate bolted under the seat (a rocking one gets the rocking mechanism there instead), then it is
 * lowered onto the base, and the seat cushion goes in last.
 */
export function buildSwivel(b: PlanBuilder, s: ProductSpec) {
  const p = s.seat ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const arms = !!p.arms;
  const rock = !!p.rock;
  const seatTop = clamp((p.seatH ?? 44) * 10, 300, 520);
  const cushT = 100;
  // underside of the chair: low enough for its seat, high enough for the base under it
  const shellBot = Math.max(110, seatTop - cushT - 140);
  const block = seatTop - cushT - shellBot;
  const a = arms ? clamp(W * 0.14, 80, 150) : 0;
  const backT = clamp(D * 0.2, 120, 200);
  const armTop = Math.min(H - 80, seatTop + 220);

  /* ---------- the chair, in one piece ---------- */
  const shell: PartPiece[] = [
    { shape: "box", size: [W - 2 * a, block, D - backT], pos: [0, shellBot + block / 2, backT / 2] },
    { shape: "box", size: [W, H - shellBot, backT], pos: [0, shellBot + (H - shellBot) / 2, -D / 2 + backT / 2] },
  ];
  if (arms) for (const sx of [-1, 1]) shell.push({ shape: "box", size: [a, armTop - shellBot, D - backT], pos: [sx * (W / 2 - a / 2), shellBot + (armTop - shellBot) / 2, backT / 2] });
  const chairC = b.compound(arms ? "Armchair" : "Easy chair", shell, { material: "soft" });
  const chair = b.place(chairC.type, chairC.mid);
  const cushion = b.place(b.part("Seat cushion", [W - 2 * a - 20, cushT, D - backT - 30], { material: "soft" }), [0, seatTop - cushT / 2, backT / 2 + 5]);

  /* ---------- under the seat, and the base ---------- */
  const plateH = rock ? 70 : 24;
  const plateC = b.compound(
    rock ? "Rocking mechanism" : "Swivel plate",
    rock
      ? [
          { shape: "box", size: [300, 20, 300], pos: [0, shellBot - 10, 0] },
          { shape: "box", size: [220, plateH - 20, 180], pos: [0, shellBot - 20 - (plateH - 20) / 2, 0] },
          ...[-1, 1].map((sx) => ({ shape: "cyl" as const, size: [40, 40, 40] as Vec3, pos: [sx * 80, shellBot - plateH / 2, 0] as Vec3 })),
        ]
      : [
          { shape: "box", size: [260, plateH, 260], pos: [0, shellBot - plateH / 2, 0] },
          { shape: "cyl", size: [70, 40, 70], pos: [0, shellBot - plateH - 20, 0] },
        ],
    { material: "metal" },
  );
  const plate = b.place(plateC.type, plateC.mid);
  const colTop = shellBot - plateH - (rock ? 0 : 40);
  const R = clamp(Math.min(W, D) / 2 - 60, 220, 340);
  const baseC = b.compound(
    "Swivel base",
    [
      { shape: "cyl", size: [2 * R, 14, 2 * R], pos: [0, 7, 0] },
      { shape: "cyl", size: [56, colTop - 14, 56], pos: [0, 14 + (colTop - 14) / 2, 0] },
    ],
    { material: "metal" },
  );
  const base = b.place(baseC.type, baseC.mid);

  /* ---------- steps ---------- */
  b.step(
    {
      title: rock ? "Bolt the rocking mechanism under the seat" : "Bolt the swivel plate under the seat",
      detail: "Turn the chair upside down on a blanket first. Four bolts hold it.",
      tools: ["allen"],
      scene: "chair",
      pose: "-y",
      kind: "bolts",
      people: W > 750 ? 2 : 1,
      warnings: ["floor"],
    },
    () => {
      b.stage(chair, b.partItem(chair).final.pos, [0, 0, 0], [0, 200, 0]);
      b.then(0.1);
      b.stage(plate, b.partItem(plate).final.pos, [0, 0, 0], [0, -220, 0]);
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const x of [-100, 100]) for (const z of [-100, 100]) bolts.push({ on: plate, at: [x, shellBot - (rock ? 20 : plateH), z], dir: [0, 1, 0], mate: chair });
      b.fits(HW.boltL, bolts, 0.1);
    },
  );
  b.step(
    {
      title: "Lower the chair onto the base",
      detail: rock ? "Turn it the right way up and set it on the base. Sit down on it once, firmly." : "Turn it the right way up and drop the plate over the post. Sit down on it once, firmly.",
      kind: "join",
      people: W > 750 ? 2 : 1,
      warnings: W > 750 ? ["two"] : [],
    },
    () => {
      b.add(base, [0, 160, 0]);
      b.then(0.2);
      b.stagger(0);
      for (const k of [chair, plate]) b.add(k, [0, 360, 0]);
    },
  );
  b.step({ title: "Drop in the seat cushion", detail: "The zip faces the back.", kind: "cushions" }, () => b.add(cushion, [0, 300, 0]));
}
