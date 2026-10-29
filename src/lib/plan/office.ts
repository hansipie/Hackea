import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * Office and swivel chairs, in IKEA's order: castors into the star base, the gas lift into the base,
 * the mechanism under the seat, then the armrests and the backrest, and the seat onto the gas lift last.
 * The seat is built in scenes of its own (upside down, then lying on its back), so each view stands on the floor.
 */
export function buildOffice(b: PlanBuilder, s: ProductSpec) {
  const p = s.seat ?? {};
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const arms = !!p.arms;
  const seatTop = clamp((p.seatH ?? 48) * 10, 400, 560);
  const seatT = 80;
  const seatBot = seatTop - seatT;
  const sw = clamp(W - (arms ? 140 : 100), 380, 520);
  const sd = clamp(D - 130, 360, 500);
  const zs = 20; // the seat sits a little in front of the gas lift

  /* ---------- star base ---------- */
  const R = clamp(Math.max(W, D) / 2 - 10, 250, 345);
  const tilt = 0.09;
  const armT = 32, armW = 44;
  const r0 = 20, rt = R - 24; // arms start inside the hub; castors sit just in from the tips
  const rm = (r0 + R) / 2;
  const tipY = HW.castor.len;
  const ym = tipY + (rt - rm) * Math.tan(tilt) + armT / 2 / Math.cos(tilt);
  const hubD = 72, hubH = 115;
  const hubBot = ym + (rm - hubD / 2) * Math.tan(tilt) - armT / 2 - 4;
  const hubTop = hubBot + hubH;
  const angles = [0, 1, 2, 3, 4].map((i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5); // one arm points forward
  const basePieces: PartPiece[] = [{ shape: "cyl", size: [hubD, hubH, hubD], pos: [0, hubBot + hubH / 2, 0] }];
  for (const a of angles) basePieces.push({ shape: "box", size: [(R - r0) / Math.cos(tilt), armT, armW], pos: [rm * Math.cos(a), ym, -rm * Math.sin(a)], rot: [0, a, -tilt] });
  const baseC = b.compound("Star base", basePieces, { material: "metal" });
  const base = b.place(baseC.type, baseC.mid);

  /* ---------- seat, mechanism ---------- */
  const seatPT = b.part("Seat", [sw, seatT, sd], { material: "soft" });
  const seat = b.place(seatPT, [0, seatTop - seatT / 2, zs]);
  const mechH = 40;
  const mechBot = seatBot - mechH;
  const mechC = b.compound(
    "Mechanism",
    [
      { shape: "box", size: [230, mechH, 240], pos: [0, seatBot - mechH / 2, 0] },
      // the height lever, on the right
      { shape: "box", size: [120, 10, 16], pos: [115 + 60, seatBot - 30, 50] },
      { shape: "box", size: [34, 14, 26], pos: [115 + 120, seatBot - 30, 50] },
    ],
    { material: "metal" },
  );
  const mech = b.place(mechC.type, mechC.mid);

  /* ---------- armrests ---------- */
  const armKeys: string[] = [];
  const postX = sw / 2 + 38;
  const padY = seatTop + 200;
  if (arms) {
    const armC = b.compound(
      "Armrest",
      [
        { shape: "box", size: [158, 12, 70], pos: [-(sw / 2 - 41), seatBot - 6, zs], material: "metal" },
        { shape: "box", size: [30, padY - 16 - (seatBot - 12), 56], pos: [-postX, (padY - 16 + seatBot - 12) / 2, zs], material: "metal" },
        { shape: "box", size: [64, 32, 250], pos: [-postX, padY, zs], material: "soft" },
      ],
      { material: "metal" },
    );
    armKeys.push(b.place(armC.type, armC.mid), b.place(armC.type, [-armC.mid[0], armC.mid[1], armC.mid[2]], [0, Math.PI, 0]));
  }

  /* ---------- backrest with its bar ---------- */
  const backBot = seatTop + 60;
  const bh = Math.max(260, H - backBot);
  const bw = clamp(sw - 20, 360, 540);
  const cushT = 70;
  const zFront = zs - sd / 2 - 10; // front of the backrest
  const zBar = zFront - cushT - 9;
  const barTop = backBot + bh * 0.45;
  const barLow = seatBot - 18;
  const zMechBack = -120;
  const backC = b.compound(
    "Backrest",
    [
      { shape: "box", size: [bw, bh, cushT], pos: [0, backBot + bh / 2, zFront - cushT / 2], material: "soft" },
      { shape: "box", size: [60, barTop - barLow, 18], pos: [0, (barTop + barLow) / 2, zBar] },
      { shape: "box", size: [60, 18, zMechBack - (zBar - 9)], pos: [0, seatBot - 9, (zMechBack + zBar - 9) / 2] },
    ],
    { material: "metal" },
  );
  const back = b.place(backC.type, backC.mid);
  const seatParts = [seat, mech, ...armKeys, back];

  /* ---------- steps ---------- */
  b.step(
    {
      title: "Push a castor into each leg of the base",
      detail: "Lay the base upside down. Press each castor in until it clicks.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.add(base, [0, 200, 0]);
      b.then(0.1);
      const pts: FitOpts[] = angles.map((a) => ({ on: base, at: [rt * Math.cos(a), tipY, -rt * Math.sin(a)] as Vec3, dir: [0, 1, 0] as Vec3, travel: 70, hole: false }));
      b.fits(HW.castor, pts, 0.16);
    },
  );

  b.step(
    {
      title: "Stand the base up and drop in the gas lift",
      detail: "The narrow end goes into the hole in the middle. No tools needed.",
      kind: "general",
    },
    () => {
      b.fit({ ...HW.gasLift, len: Math.round(mechBot - hubTop) }, { on: base, at: [0, hubTop, 0], dir: [0, -1, 0], travel: 160, hole: false });
    },
  );

  b.step(
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down. The lever goes on its right-hand side.",
      tools: ["allen"],
      scene: "seat",
      pose: "-y",
      kind: "bolts",
      warnings: ["floor"],
    },
    () => {
      b.stage(seat, b.partItem(seat).final.pos, [0, 0, 0], [0, 200, 0]);
      b.then(0.05);
      b.stage(mech, b.partItem(mech).final.pos, [0, 0, 0], [0, -220, 0]);
      b.then(0.1);
      const bolts: FitOpts[] = [];
      for (const x of [-85, 85]) for (const z of [-90, 90]) bolts.push({ on: mech, at: [x, mechBot, z], dir: [0, 1, 0] });
      b.fits(HW.boltL, bolts, 0.1);
    },
  );

  if (arms) {
    b.step(
      {
        title: "Bolt on the armrests",
        detail: "Still upside down. Two bolts each, into the seat.",
        tools: ["allen"],
        scene: "arms",
        pose: "-y",
        kind: "bolts",
      },
      () => {
        b.stagger(0);
        [seat, mech].forEach((k) => b.stage(k, b.partItem(k).final.pos, [0, 0, 0]));
        b.then(0.1);
        b.stagger(0.3);
        armKeys.forEach((k, i) => b.stage(k, b.partItem(k).final.pos, b.partItem(k).final.rot, [(i === 0 ? -1 : 1) * 260, 0, 0]));
        b.then(0.1);
        const bolts: FitOpts[] = [];
        armKeys.forEach((k, i) => {
          const sx = i === 0 ? -1 : 1;
          for (const dz of [-22, 22]) bolts.push({ on: k, at: [sx * (sw / 2 - 85), seatBot - 12, zs + dz], dir: [0, 1, 0] });
        });
        b.fits(HW.boltS, bolts, 0.1);
      },
    );
  }

  b.step(
    {
      title: "Lay it on its back and bolt on the backrest",
      detail: "The bar goes under the seat, behind the mechanism. Two bolts hold it.",
      tools: ["allen"],
      scene: "back",
      pose: "+z",
      kind: "bolts",
    },
    () => {
      b.stagger(0);
      [seat, mech, ...armKeys].forEach((k) => b.stage(k, b.partItem(k).final.pos, b.partItem(k).final.rot));
      b.then(0.1);
      // lying on its back, forward is up: the backrest comes down onto the floor behind the seat
      b.stage(back, b.partItem(back).final.pos, [0, 0, 0], [0, 0, 320]);
      b.then(0.1);
      const zb = (zMechBack + zs - sd / 2) / 2;
      b.fits(HW.boltS, [-18, 18].map((x) => ({ on: back, at: [x, seatBot - 18, zb] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.12);
    },
  );

  b.step(
    {
      title: "Lower the seat onto the gas lift",
      detail: "Then sit down on it once, firmly. Your weight locks it in place.",
      kind: "join",
    },
    () => {
      b.stagger(0);
      seatParts.forEach((k) => b.add(k, [0, 320, 0]));
    },
  );
}
