import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";

/**
 * Day-beds: a single bed with a back and two ends, a sofa by day. Most have a second bed underneath
 * that pulls out to make a double: a box on castors with the drawers in it (HEMNES, BRIMNES, FLEKKE), or a
 * trundle on castors (VIHALS). Others have storage boxes on castors, or nothing underneath.
 * It stands lengthways across the view (x), back at the back. Built in IKEA's order: the pull-out first,
 * then the frame around it, the drawers, and last the mattresses, stacked by day and side by side at night.
 */
export function buildDayBed(b: PlanBuilder, s: ProductSpec) {
  const p = s.bed ?? {};
  const Ml = clamp((p.mattressL ?? 200) * 10, 1800, 2100), Mm = clamp((p.mattressW ?? 80) * 10, 700, 1000);
  const L = clamp(s.size.w * 10, Ml + 60, Ml + 200);
  const D = clamp(s.size.d * 10, Mm + 60, Mm + 200);
  const H = clamp(s.size.h * 10, 500, 1000);
  const under = p.under;
  const rolls = under === "pullout" || under === "trundle";
  const nDr = under === "pullout" ? clamp(Math.round(p.drawers ?? 2), 0, 4) : 0;
  const inBox = clamp(Math.round(p.mattresses ?? 0), 0, 2);

  /* ---------- the frame: two ends, a back and a front rail ---------- */
  const te = clamp((L - Ml - 20) / 2, 30, 80); // each end
  const Li = L - 2 * te; // between the ends
  const ex = L / 2 - te / 2;
  const tb = 18, tf = 22;
  const ch = HW.castor.len; // castors lift whatever rolls underneath
  const hb = under === "pullout" ? 220 : under === "trundle" ? 160 : 180; // what rolls under, above its castors
  const yF = Math.max(260, ch + hb + 32); // free height under the front rail
  const railH = 90;
  const ys = yF + 70; // top of the slats
  const ledgeY = ys - 12 - 15;
  const postW = 50;

  const endPieces: PartPiece[] = [
    ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [te, H, postW], pos: [-ex, H / 2, k * (D / 2 - postW / 2)] })),
    { shape: "box", size: [te, 70, D - 2 * postW], pos: [-ex, H - 35, 0] },
    { shape: "box", size: [Math.min(te, 18), H - 130, D - 2 * postW], pos: [-ex, 60 + (H - 130) / 2, 0] },
  ];
  const endC = b.compound("End", endPieces, { material: "board" });
  const ends = [b.place(endC.type, endC.mid), b.place(endC.type, [-endC.mid[0], endC.mid[1], endC.mid[2]], [0, Math.PI, 0])];

  const backY0 = 60, backY1 = H - 40;
  const backC = b.compound(
    "Back",
    [
      { shape: "box", size: [Li, backY1 - backY0, tb], pos: [0, (backY0 + backY1) / 2, -D / 2 + tb / 2] },
      { shape: "box", size: [Li, 30, 24], pos: [0, ledgeY, -D / 2 + tb + 12], material: "wood" },
    ],
    { material: "board" },
  );
  const back = b.place(backC.type, backC.mid);
  const frontC = b.compound(
    "Front rail",
    [
      { shape: "box", size: [Li, railH, tf], pos: [0, yF + railH / 2, D / 2 - tf / 2] },
      { shape: "box", size: [Li, 30, 24], pos: [0, ledgeY, D / 2 - tf - 12], material: "wood" },
    ],
    { material: "board" },
  );
  const front = b.place(frontC.type, frontC.mid);

  // the slats rest on the supports along the back and the front rail
  const Ls = D - 60;
  const slatT = b.part("Slat", [70, 12, Ls], { material: "wood" });
  const nS = Math.round(Ml / 150);
  const slatX = (i: number, span: number) => -span / 2 + 50 + (i * (span - 100)) / (nS - 1);
  const slats = Array.from({ length: nS }, (_, i) => b.place(slatT, [slatX(i, Ml), ys - 6, -2]));

  /* ---------- the pull-out bed or trundle: cross pieces on castors, rails on top, slats ---------- */
  const Lp = Li - 30;
  const Dp = Ls;
  const zc = D / 2 - Dp / 2 - 4; // closed: its front just behind the front rail
  const oz = Dp - 40; // how far it pulls out
  const yTop = ch + hb; // top of its rails
  const tc = 18;
  const nCross = nDr ? nDr + 1 : 3;
  const crossX = (i: number) => -Lp / 2 + tc / 2 + (i * (Lp - tc)) / (nCross - 1);
  const crossH = hb - 22;
  const pull: string[] = [];
  let crosses: string[] = [];
  let topRails: string[] = [];
  let pSlats: string[] = [];
  if (rolls) {
    const crossT = b.part("Cross piece", [tc, crossH, Dp], { material: "board" });
    crosses = Array.from({ length: nCross }, (_, i) => b.place(crossT, [crossX(i), ch + crossH / 2, zc]));
    const topT = b.part("Top rail", [Lp, 22, 80], { material: "board" });
    topRails = [-1, 1].map((k) => b.place(topT, [0, yTop - 11, zc + k * (Dp / 2 - 40)]));
    pSlats = Array.from({ length: nS }, (_, i) => b.place(slatT, [slatX(i, Lp), yTop + 6, zc]));
    pull.push(...crosses, ...topRails, ...pSlats);
  }

  /* ---------- drawers in the pull-out ---------- */
  interface Drawer {
    x: number;
    front: string;
    sides: [string, string];
    back: string;
    bottom: string;
  }
  const drawers: Drawer[] = [];
  const cw = (Lp - nCross * tc) / Math.max(1, nCross - 1); // between two cross pieces
  const fh = crossH - 12, fw = cw - 6;
  const dd = Dp - 70;
  const bw = cw - 26;
  const sh = fh - 40;
  const zf = zc + Dp / 2 - 9; // drawer fronts, flush with the front of the cross pieces
  const yd = ch + 6; // bottom of a drawer front
  const runLen = Math.round((dd - 20) / 10) * 10;
  if (nDr) {
    const frT = b.part("Drawer front", [fw, fh, 18], { material: "board" });
    const sdT = b.part("Drawer side", [12, sh, dd], { material: "board" });
    const bkT = b.part("Drawer back", [bw - 24, sh - 22, 12], { material: "board" });
    const btT = b.part("Drawer bottom", [bw - 10, 3, dd - 8], { material: "fiber" });
    for (let i = 0; i < nDr; i++) {
      const x = (crossX(i) + crossX(i + 1)) / 2;
      const zBox = zf - 9 - dd / 2;
      const sy = yd + 20 + sh / 2;
      drawers.push({
        x,
        front: b.place(frT, [x, yd + fh / 2, zf]),
        sides: [b.place(sdT, [x - bw / 2 + 6, sy, zBox]), b.place(sdT, [x + bw / 2 - 6, sy, zBox])],
        back: b.place(bkT, [x, yd + 20 + 22 + (sh - 22) / 2, zf - 9 - dd + 6]),
        bottom: b.place(btT, [x, yd + 20 + 9, zBox - 2]),
      });
    }
  }
  const drawerKeys = (d: Drawer) => [d.front, d.sides[0], d.sides[1], d.back, d.bottom];
  for (const d of drawers) pull.push(...drawerKeys(d));

  /* ---------- storage boxes on castors ---------- */
  interface Box {
    x: number;
    parts: string[];
    bottom: string;
  }
  const boxes: Box[] = [];
  const bxW = (Li - 60) / 2, bxD = Dp, bxH = hb, bt = 16;
  if (under === "boxes") {
    const fbT = b.part("Box panel", [bxW, bxH - 12, bt], { material: "board" });
    const sdT = b.part("Box side", [bt, bxH - 12, bxD - 2 * bt], { material: "board" });
    const btT = b.part("Box bottom", [bxW, 12, bxD], { material: "board" });
    for (const k of [-1, 1]) {
      const x = k * (bxW / 2 + 10);
      const y = ch + 12 + (bxH - 12) / 2;
      boxes.push({
        x,
        parts: [
          b.place(fbT, [x, y, zc + bxD / 2 - bt / 2]),
          b.place(fbT, [x, y, zc - bxD / 2 + bt / 2]),
          b.place(sdT, [x - bxW / 2 + bt / 2, y, zc]),
          b.place(sdT, [x + bxW / 2 - bt / 2, y, zc]),
        ],
        bottom: b.place(btT, [x, ch + 6, zc]),
      });
    }
  }

  /* ---------- steps: the pull-out ---------- */
  const castorFits = (keys: string[], xs: number[], zs: number[]): FitOpts[] =>
    keys.flatMap((k, i) => zs.map((z) => ({ on: k, at: [xs[i], ch, z] as Vec3, dir: [0, 1, 0] as Vec3, travel: 70, hole: false as const })));
  const at = (k: string) => b.partItem(k).final;

  if (rolls) {
    const what = nDr ? "pull-out bed" : "trundle";
    b.step(
      {
        title: "Screw two castors under each cross piece",
        detail: "Stand them upside down on the box. One castor near each end.",
        tools: ["screwdriver"],
        scene: "pullout",
        pose: "-y",
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        crosses.forEach((k) => b.stage(k, at(k).pos, at(k).rot, [0, 200, 0]));
        b.then(0.1);
        b.fits(HW.castor, castorFits(crosses, crosses.map((k) => at(k).pos[0]), [zc - Dp / 2 + 70, zc + Dp / 2 - 70]), 0.1);
      },
    );
    if (nDr) {
      b.step(
        {
          title: "Screw the drawer runners onto the cross pieces",
          detail: "The open end of each runner points to the front.",
          tools: ["screwdriver"],
          scene: "pullout",
          kind: "runners",
          warnings: ["face"],
        },
        () => {
          const runner = { kind: "runner" as const, len: runLen, dia: 20 };
          const list: FitOpts[] = [];
          const screws: FitOpts[] = [];
          const rz = zf - 9 - runLen / 2 - 8;
          for (let i = 0; i < nCross; i++) {
            const x0 = crossX(i);
            for (const sgn of [-1, 1]) {
              if ((i === 0 && sgn < 0) || (i === nCross - 1 && sgn > 0)) continue;
              const xf = x0 + (sgn * tc) / 2;
              list.push({ on: crosses[i], at: [xf, yd + 34, rz], dir: [-sgn, 0, 0], hole: false });
              for (const dz of [-runLen / 2 + 30, runLen / 2 - 30]) screws.push({ on: crosses[i], at: [xf + sgn * 12, yd + 34, rz + dz], dir: [-sgn, 0, 0], hole: false });
            }
          }
          b.fits(runner, list, 0.1);
          b.then(0.1);
          b.fits(HW.screwS, screws, 0.04);
        },
      );
    }
    b.step(
      {
        title: "Screw the top rails across the cross pieces",
        detail: "One along the front and one along the back. Keep the cross pieces upright as you go.",
        tools: ["screwdriver"],
        scene: "pullout",
        kind: "screws",
      },
      () => {
        b.stagger(0.3);
        topRails.forEach((k, i) => b.stage(k, at(k).pos, at(k).rot, [0, 260, i === 0 ? -120 : 120]));
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const r of topRails) for (const c of crosses) sc.push({ on: r, at: [at(c).pos[0], yTop, at(r).pos[2]], dir: [0, -1, 0], mate: c });
        b.fits(HW.screwM, sc, 0.05);
      },
    );
    b.step(
      {
        title: `Lay the slats on the ${what}`,
        detail: "Spread them evenly from end to end.",
        scene: "pullout",
        kind: "slats",
      },
      () => {
        b.stagger(Math.min(0.08, 1.4 / pSlats.length));
        pSlats.forEach((k) => b.stage(k, at(k).pos, at(k).rot, [0, 260, 0]));
      },
    );
  }

  // screws through the front and back panels into the sides, and castors under the bottom, in the assembled frame
  const boxScrews = (bx: Box): FitOpts[] =>
    [bx.parts[0], bx.parts[1]].flatMap((k) => {
      const z = at(k).pos[2];
      const out = z > zc;
      return [-1, 1].flatMap((sx) =>
        [ch + 60, ch + bxH - 50].map((y) => ({ on: k, at: [bx.x + sx * (bxW / 2 - bt / 2), y, z + (out ? bt / 2 : -bt / 2)] as Vec3, dir: [0, 0, out ? -1 : 1] as Vec3, hole: false as const })),
      );
    });
  const boxCastors = (bx: Box): FitOpts[] =>
    [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ on: bx.bottom, at: [bx.x + sx * (bxW / 2 - 60), ch, zc + sz * (bxD / 2 - 60)] as Vec3, dir: [0, 1, 0] as Vec3, travel: 70, hole: false as const })));
  if (boxes.length) {
    const b0 = boxes[0];
    const rel = (k: string): Vec3 => {
      const f = at(k).pos;
      return [f[0] - b0.x, f[1], f[2] - zc];
    };
    b.step(
      {
        title: "Put the storage boxes together",
        detail: "Screw the sides between the front and the back.",
        tools: ["screwdriver"],
        scene: "box",
        repeat: 2,
        kind: "screws",
      },
      () => {
        b.stagger(0.25);
        b0.parts.forEach((k, i) => b.stage(k, rel(k), at(k).rot, i < 2 ? [0, 0, i === 0 ? 260 : -260] : [i === 2 ? -260 : 260, 0, 0]));
        b.then(0.1);
        b.fits(HW.screwM, boxScrews(b0), 0.06);
      },
    );
    b.step(
      {
        title: "Screw on the bottom and the castors",
        detail: "Turn the box over first. One castor near each corner.",
        tools: ["screwdriver"],
        scene: "box",
        pose: "-y",
        repeat: 2,
        kind: "screws",
      },
      () => {
        b.stage(b0.bottom, rel(b0.bottom), [0, 0, 0], [0, -200, 0]);
        b.then(0.1);
        b.fits(HW.castor, boxCastors(b0), 0.12);
      },
    );
  }

  /* ---------- steps: the frame ---------- */
  const endBolts = (key: string, ys2: number[], z: number): FitOpts[] =>
    ends.flatMap((e, i) => ys2.map((y) => ({ on: e, at: [(i === 0 ? -1 : 1) * (L / 2), y, z] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3, mate: key })));
  b.step(
    {
      title: "Bolt the back between the ends",
      detail: "One holds the ends upright while the other bolts. Hand tight for now.",
      tools: ["allen"],
      people: 2,
      kind: "bolts",
      warnings: ["two", "loose"],
    },
    () => {
      b.stagger(0.3);
      ends.forEach((e, i) => b.add(e, [(i === 0 ? -1 : 1) * 320, 0, 0]));
      b.then(0.05);
      b.add(back, [0, 0, -320]);
      b.then(0.1);
      const ys2 = [backY0 + 90, (backY0 + backY1) / 2, backY1 - 90];
      b.fits(HW.boltL, endBolts(back, ys2, -D / 2 + tb / 2), 0.08);
    },
  );
  b.step(
    {
      title: "Bolt on the front rail",
      detail: "Then tighten every bolt firmly.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.add(front, [0, 0, 320]);
      b.then(0.1);
      b.fits(HW.boltL, endBolts(front, [yF + 25, yF + 65], D / 2 - tf / 2), 0.1);
    },
  );
  b.step(
    {
      title: "Lay the slats in the frame",
      detail: "They rest on the supports along the back and the front rail.",
      kind: "slats",
    },
    () => {
      b.stagger(Math.min(0.08, 1.4 / slats.length));
      slats.forEach((k) => b.add(k, [0, 260, 0]));
    },
  );

  if (rolls) {
    b.step(
      {
        title: nDr ? "Push the pull-out bed in underneath" : "Roll the trundle in underneath",
        detail: "It rolls in on its castors, under the slats.",
        kind: "join",
        weight: 1.6,
      },
      () => {
        b.stagger(0);
        [...crosses, ...topRails, ...pSlats].forEach((k) => b.add(k, [0, 0, 760]));
      },
    );
  }
  if (boxes.length) {
    b.step(
      {
        title: "Roll the boxes in underneath",
        detail: "They pull out from the front, one at each end.",
        kind: "join",
        weight: 1.6,
      },
      () => {
        b.stagger(0.4);
        for (const bx of boxes) {
          b.stagger(0);
          [...bx.parts, bx.bottom].forEach((k) => b.add(k, [0, 0, 700]));
          b.wait(0.4);
        }
        // the second box comes put together
        for (const o of boxScrews(boxes[1])) b.preset(HW.screwM, o);
        for (const o of boxCastors(boxes[1])) b.preset(HW.castor, o);
      },
    );
  }

  /* ---------- steps: the drawers ---------- */
  if (drawers.length) {
    const d0 = drawers[0];
    const c0: Vec3 = [d0.x, yd + fh / 2, zf - dd / 2];
    const rel = (k: string): Vec3 => {
      const f = at(k).pos;
      return [f[0] - c0[0], f[1] - c0[1], f[2] - c0[2]];
    };
    const backScrews = (d: Drawer): FitOpts[] => {
      const bp = at(d.back).pos;
      return d.sides.flatMap((sd, i) => {
        const xo = at(sd).pos[0] + (i === 0 ? -6 : 6);
        return [-(sh - 22) / 4, (sh - 22) / 4].map((dy) => ({ on: sd, at: [xo, bp[1] + dy, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
      });
    };
    b.step(
      {
        title: nDr > 1 ? "Put the drawers together" : "Put the drawer together",
        detail: "Sides onto the front, slide the bottom in along the grooves, then screw on the back.",
        tools: ["screwdriver"],
        scene: "drawer",
        pose: "-z",
        repeat: nDr > 1 ? nDr : undefined,
        kind: "drawer",
        warnings: ["floor"],
      },
      () => {
        b.stage(d0.front, rel(d0.front), [0, 0, 0], [0, 0, -160]);
        b.then(0.1);
        b.stagger(0.25);
        for (const sd of d0.sides) b.stage(sd, rel(sd), [0, 0, 0], [0, 0, -300]);
        b.then(0.1);
        b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, -420]);
        b.then(0.1);
        b.stage(d0.back, rel(d0.back), [0, 0, 0], [0, 0, -260]);
        b.then(0.15);
        b.fits(HW.screwM, backScrews(d0), 0.12);
      },
    );
    b.step(
      {
        title: nDr > 1 ? "Slide the drawers into the pull-out bed" : "Slide the drawer into the pull-out bed",
        detail: "Rest each one on its runners and push until it clicks.",
        kind: "drawer",
        weight: 1 + 0.4 * nDr,
      },
      () => {
        for (const [i, d] of drawers.entries()) {
          b.stagger(0);
          for (const k of drawerKeys(d)) b.add(k, [0, 0, 520]);
          if (i > 0) for (const o of backScrews(d)) b.preset(HW.screwM, o);
          b.wait(0.25);
        }
      },
    );
    if (p.knobs === "knob" || p.knobs === "bar") {
      const def = p.knobs === "bar" ? HW.handle : HW.knob;
      b.step(
        {
          title: p.knobs === "bar" ? "Screw on the handles" : "Screw on the knobs",
          detail: "Screw from inside the drawer. Snug is enough.",
          tools: ["screwdriver"],
          kind: "screws",
        },
        () => {
          b.fits(
            def,
            drawers.map((d) => ({ on: d.front, at: [d.x, yd + fh / 2, zf + 9] as Vec3, dir: [0, 0, -1] as Vec3, hole: false, twist: p.knobs === "bar" ? Math.PI / 2 : 0 })),
            0.12,
          );
        },
      );
    }
  }

  /* ---------- mattresses, and the pull-out in use ---------- */
  const mt = 120;
  const mT = inBox ? b.part("Mattress", [Ml, mt, Mm], { material: "soft" }) : b.part("Your mattress", [Ml, mt, Mm], { material: "soft", extra: true });
  const zm = -2;
  const ms = Array.from({ length: rolls ? 2 : 1 }, (_, i) => b.place(mT, [0, ys + mt / 2 + i * mt, zm]));
  const mats = (n: number) => (inBox ? (n > 1 ? "Add the mattresses" : "Add the mattress") : n > 1 ? "Add your mattresses" : "Add your mattress");
  const unwrap = inBox ? " Unwrap them and give them a few hours to rise." : "";
  if (!rolls) {
    b.step(
      {
        title: mats(1),
        detail: inBox ? "Unwrap it and give it a few hours to rise. Then it's a sofa by day and a bed at night." : "Done. It's a sofa by day and a bed at night.",
        kind: "general",
      },
      () => b.add(ms[0], [0, 420, 0]),
    );
    return;
  }

  const opened = (k: string): Vec3 => {
    const f = at(k).pos;
    return [f[0], f[1], f[2] + oz];
  };
  b.step(
    {
      title: nDr ? "Pull it out to make a double bed" : "Roll out the trundle for a double bed",
      detail: nDr ? "Pull it by the top rail, not by the drawers. It rolls out on its castors." : "Pull it all the way out, so it sits snug against the frame.",
      kind: "general",
      weight: 1,
    },
    () => {
      b.stagger(0);
      for (const k of pull) b.stage(k, opened(k), at(k).rot);
    },
  );
  b.step(
    {
      title: mats(2),
      detail: `One on each base for a double bed.${unwrap}`,
      kind: "general",
    },
    () => {
      b.stagger(0.4);
      b.add(ms[0], [0, 420, 0]);
      b.stage(ms[1], [0, yTop + 12 + mt / 2, zc + oz], [0, 0, 0], [0, 420, 0]);
    },
  );
  b.step(
    {
      title: nDr ? "Push it back in for a day-bed" : "Roll the trundle back in for a day-bed",
      detail: "Stack both mattresses on top to use it as a sofa.",
      kind: "general",
      weight: 1.2,
    },
    () => {
      b.stagger(0);
      for (const k of pull) b.add(k);
      b.then(0.1);
      b.add(ms[1]);
    },
  );
}
