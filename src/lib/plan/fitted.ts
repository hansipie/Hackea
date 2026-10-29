import type { FitUse, FitZone, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit } from "./frame";
import { clamp } from "./math";

/** The last step: what goes in afterwards, and who connects it. The guide never covers plumbing, gas or electrics. */
const READY: Record<Exclude<FitUse, "storage">, [string, string]> = {
  basin: ["Ready for the basin", "Fit the basin, the tap and the drain following their own instructions, or ask a plumber."],
  sink: ["Ready for the sink", "Fit the sink, the tap and the drain following their own instructions, or ask a plumber."],
  hob: ["Ready for the hob", "The hob goes in the worktop above. Have a qualified electrician connect it, or a gas engineer for gas."],
  oven: ["Ready for the oven", "Fit the oven following its own instructions. Have a qualified electrician connect it."],
  ovenhob: ["Ready for the oven and hob", "Fit them following their own instructions. Have a qualified electrician connect them."],
  fridge: ["Ready for the fridge", "Fit the fridge or freezer following its own instructions."],
  microwave: ["Ready for the microwave", "Fit the microwave following its own instructions."],
  hood: ["Ready for the extractor hood", "Fit the hood following its own instructions. Have a qualified electrician connect it."],
  appliance: ["Ready for the appliances", "Fit each one following its own instructions. Have a qualified electrician connect them."],
};

interface Band {
  z: FitZone;
  lo: number; // mm, the band's share of the front
  hi: number;
}

interface Drawer {
  front: string;
  sides: [string, string];
  back: string;
  bottom: string;
  ys: number; // bottom of its slot
  slotH: number;
  sh: number; // height of its sides
}

interface Door {
  key: string;
  x: number;
  sgn: number; // the hinge side: -1 left, 1 right
  lo: number;
  dh: number;
  dw: number;
}

/**
 * Cabinets built around something fitted afterwards: wash-stands under a basin, kitchen base cabinets under a sink or a hob,
 * and cabinets with room for an oven, a fridge or a microwave. The front is split into bands from the bottom up: drawers,
 * doors, a fixed front in front of a sink, an opening for the appliance, open shelves, or room for a sink's own front.
 * Built like any cabinet: runners onto the sides while they lie flat, the carcass with a fixed shelf wherever a band ends,
 * the back, then shelves, doors, fronts and drawers. A wash-stand is hung on the wall before its fronts go on.
 * A basin that comes in the box goes on top last; otherwise a closing step says what is fitted separately, and by whom.
 */
export function buildFitted(b: PlanBuilder, s: ProductSpec) {
  const c = s.cabinet ?? {};
  const fit = c.fit!;
  const basinH = fit.basin ? clamp(fit.basin, 3, 20) * 10 : 0;
  // with a basin in the box the size is the whole thing: the cabinet is a little narrower and shallower than the basin
  const W = (s.size.w - (basinH ? 2 : 0)) * 10, D = (s.size.d - (basinH ? 1 : 0)) * 10;
  const H = s.size.h * 10 - basinH;
  const t = clamp(c.thickness ?? 18, 12, 25);
  const wall = !!c.wall;
  const plinth = !wall && (c.plinth ?? true);
  const base = plinth ? 70 : 0;
  const handles = c.handles ?? "bar";
  const lying = H > 1100;

  /* ---------- bands ---------- */
  const zones: FitZone[] = fit.zones.length ? fit.zones : [{ kind: "doors", h: 0 }];
  const span = H - base;
  const fixedSum = zones.reduce((a, z) => a + (z.h > 0 ? z.h * 10 : 0), 0);
  const flex = zones.filter((z) => !(z.h > 0)).length;
  const hs =
    flex && span - fixedSum >= 120 * flex
      ? zones.map((z) => (z.h > 0 ? z.h * 10 : (span - fixedSum) / flex))
      : (() => {
          // the bands don't fit as given (the plinth takes its share): shrink them all alike
          const want = zones.map((z) => (z.h > 0 ? z.h * 10 : 400));
          const sum = want.reduce((a, v) => a + v, 0);
          return want.map((v) => (v * span) / sum);
        })();
  const bands: Band[] = [];
  let yy = base;
  zones.forEach((z, i) => {
    bands.push({ z, lo: Math.round(yy), hi: Math.round(yy + hs[i]) });
    yy += hs[i];
  });
  // a fixed shelf wherever one band ends and the next begins, except behind a front that only covers the sink
  const shelfAt = (i: number) => {
    const lo = bands[i].z.kind, up = bands[i + 1].z.kind;
    return lo !== "front" && up !== "front" && up !== "apron" && !(lo === "drawers" && up === "drawers");
  };
  const fixed: number[] = [];
  for (let i = 0; i < bands.length - 1; i++) if (shelfAt(i)) fixed.push(bands[i].hi);
  /** The inside of a band: from the panel under it to the one over it. */
  const inner = (i: number): [number, number] => [
    i === 0 ? base + t : shelfAt(i - 1) ? bands[i].lo + t / 2 : bands[i].lo,
    i === bands.length - 1 ? H - t : shelfAt(i) ? bands[i].hi - t / 2 : bands[i].hi,
  ];

  const f = new FrameKit(b, { W, H, D, t, base, plinth, fixed, back: true, pinRows: false, lying, rails: !!fit.rails, names: { fixed: "Fixed shelf" } });
  const fz = D / 2 + t / 2; // fronts sit on the front edge of the carcass
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const types = new Map<string, string>();
  const typeOf = (name: string, size: Vec3, material?: PartMaterial) => {
    const key = `${name}|${size.join(",")}`;
    let id = types.get(key);
    if (!id) types.set(key, (id = b.part(name, size, material ? { material } : {})));
    return id;
  };

  /* ---------- drawers ---------- */
  const runLen = Math.round((D - 60) / 10) * 10;
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };
  const bw = W - 2 * t - 26;
  const dd = D - 50;
  const zBox = D / 2 - dd / 2;
  const drawers: Drawer[] = [];
  bands.forEach((bd, i) => {
    if (bd.z.kind !== "drawers") return;
    const n = clamp(Math.round(bd.z.n ?? 1), 1, 5);
    const [lo, hi] = inner(i);
    const slotH = (hi - lo) / n;
    const fh = r1((bd.hi - bd.lo) / n - 4);
    const sh = r1(clamp(slotH - 46, 60, 170));
    const frT = typeOf("Drawer front", [W - 4, fh, t]);
    const dsT = typeOf("Drawer side", [12, sh, dd]);
    const dbT = typeOf("Drawer back", [bw - 24, sh - 22, 12]);
    const dbtT = typeOf("Drawer bottom", [bw - 10, 3, dd - 8], "fiber");
    for (let r = 0; r < n; r++) {
      const ys = lo + r * slotH;
      const sy = ys + 24 + sh / 2;
      drawers.push({
        ys,
        slotH,
        sh,
        front: b.place(frT, [0, bd.lo + 2 + r * (fh + 4) + fh / 2, fz]),
        sides: [b.place(dsT, [-bw / 2 + 6, sy, zBox]), b.place(dsT, [bw / 2 - 6, sy, zBox])],
        back: b.place(dbT, [0, ys + 24 + 22 + (sh - 22) / 2, D / 2 - dd + 6]),
        bottom: b.place(dbtT, [0, ys + 24 + 9, zBox - 2]),
      });
    }
  });

  /* ---------- doors and fixed fronts ---------- */
  const doors: Door[] = [];
  const fronts: string[] = [];
  for (const bd of bands) {
    const dh = r1(bd.hi - bd.lo - 4);
    if (bd.z.kind === "doors") {
      const nd = bd.z.n === 2 ? 2 : 1;
      const dw = nd === 2 ? W / 2 - 3 : W - 4;
      const T = typeOf("Door", [dw, dh, t]);
      for (let i = 0; i < nd; i++) {
        const x = nd === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0;
        doors.push({ key: b.place(T, [x, bd.lo + 2 + dh / 2, fz]), x, sgn: nd === 2 && i === 1 ? 1 : -1, lo: bd.lo + 2, dh, dw });
      }
    } else if (bd.z.kind === "front") fronts.push(b.place(typeOf("Fixed front", [W - 4, dh, t]), [0, bd.lo + 2 + dh / 2, fz]));
  }

  /* ---------- shelves: open bands, and behind doors ---------- */
  const shelfYs: number[] = [];
  bands.forEach((bd, i) => {
    const n = bd.z.kind === "open" ? (bd.z.n ?? 0) : bd.z.kind === "doors" ? (bd.z.shelves ?? 0) : 0;
    if (!n) return;
    const [lo, hi] = inner(i);
    if (hi - lo < 150 * (n + 1)) return;
    for (let k = 1; k <= n; k++) shelfYs.push(Math.round((lo + ((hi - lo) * k) / (n + 1)) / 32) * 32);
  });

  /* ---------- a basin in the box: a bowl with a deck at the back for the tap ---------- */
  let basin: string | undefined;
  if (basinH) {
    const BW = s.size.w * 10, BD = s.size.d * 10;
    const wt = 26, floor = 14, deck = 90;
    const ht = basinH - floor, yw = floor + ht / 2;
    const pieces: PartPiece[] = [
      { shape: "box", size: [BW, floor, BD], pos: [0, floor / 2, 0] },
      { shape: "box", size: [BW, ht, wt], pos: [0, yw, BD / 2 - wt / 2] },
      { shape: "box", size: [BW, ht, deck], pos: [0, yw, -BD / 2 + deck / 2] },
      { shape: "box", size: [wt, ht, BD - wt - deck], pos: [-BW / 2 + wt / 2, yw, (deck - wt) / 2] },
      { shape: "box", size: [wt, ht, BD - wt - deck], pos: [BW / 2 - wt / 2, yw, (deck - wt) / 2] },
    ];
    const bc = b.compound("Wash-basin", pieces);
    // the backs line up, so the basin's lip reaches past the front
    basin = b.place(bc.type, [bc.mid[0], H + bc.mid[1], -D / 2 + BD / 2 + bc.mid[2]]);
  }

  /* ---------- steps: the carcass ---------- */
  f.prepSides();
  if (drawers.length) {
    b.step(
      {
        title: drawers.length > 1 ? "Screw the drawer runners onto the sides" : "Screw the drawer runner onto each side",
        detail: "The open end of each runner points to the front.",
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
        warnings: ["face"],
      },
      () => {
        const list: FitOpts[] = [];
        const screws: FitOpts[] = [];
        f.sides.forEach((side, i) => {
          const xi = i === 0 ? -W / 2 + t : W / 2 - t;
          const into: Vec3 = [i === 0 ? -1 : 1, 0, 0];
          for (const d of drawers) {
            const y = d.ys + 14;
            list.push({ on: side, at: [xi, y, D / 2 - runLen / 2 - 8], dir: into, hole: false });
            for (const dz of [-runLen / 2 + 30, runLen / 2 - 30]) screws.push({ on: side, at: [xi + (i === 0 ? 12 : -12), y, D / 2 - runLen / 2 - 8 + dz], dir: into, hole: false });
          }
        });
        b.fits(runner, list, 0.12);
        b.then(0.1);
        b.fits(HW.screwS, screws, 0.04);
      },
    );
  }
  f.join(H > 1500 ? 2 : 1);
  f.otherSide(H > 1500 ? 2 : 1);
  f.cams();
  f.plinthStep();
  f.backSteps();
  f.standUp();

  if (shelfYs.length) {
    const shT = b.part("Shelf", [W - 2 * t - 3, t, D - 26]);
    const shelves = shelfYs.map((y) => b.place(shT, [0, y + 3 + t / 2, 11]));
    for (const y0 of shelfYs)
      for (const dy of [-64, 0, 64])
        for (const [i, side] of f.sides.entries()) {
          const xi = i === 0 ? -W / 2 + t : W / 2 - t;
          for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(side, [xi, y0 + dy, z], [i === 0 ? 1 : -1, 0, 0], 2.5);
        }
    b.step(
      {
        title: shelves.length > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf",
        detail: "Pick any height you like. Use the same hole on all four corners.",
        kind: "shelves",
      },
      () => {
        const pins: FitOpts[] = [];
        for (const y of shelfYs)
          for (const [i, sd] of f.sides.entries()) {
            const x = i === 0 ? -W / 2 + t : W / 2 - t;
            for (const z of [D / 2 - 40, -D / 2 + 40]) pins.push({ on: sd, at: [x, y, z], dir: [i === 0 ? -1 : 1, 0, 0], hole: false });
          }
        b.fits(HW.pin, pins, 0.05);
        b.then(0.2);
        b.stagger(0.25);
        shelves.forEach((k) => b.add(k, [0, 0, 420]));
      },
    );
  }

  // a wash-stand goes up empty, so it's light: the fronts go on once it hangs
  if (wall && fit.hangFirst) f.hang();

  /* ---------- doors ---------- */
  if (doors.length) {
    const many = doors.length > 1;
    const hingeYs = (d: Door) => {
      const hn = d.dh > 1500 ? 4 : d.dh > 900 ? 3 : 2;
      return Array.from({ length: hn }, (_, i) => d.lo + 108 + (i * (d.dh - 216)) / (hn - 1));
    };
    const total = doors.reduce((a, d) => a + d.dw, 0) + 80 * (doors.length - 1);
    b.step(
      {
        title: many ? "Press the hinges into the doors" : "Press the hinges into the door",
        detail: "Two small screws hold each one.",
        tools: ["screwdriver"],
        scene: "doors",
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        let x0 = -total / 2;
        for (const d of doors) {
          b.stage(d.key, [x0 + d.dw / 2, t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
          x0 += d.dw + 80;
        }
        b.then(0.1);
        const hinges: FitOpts[] = [];
        const screws: FitOpts[] = [];
        for (const d of doors) {
          const x = d.sgn * (W / 2 - 22);
          for (const y of hingeYs(d)) {
            hinges.push({ on: d.key, at: [x, y, D / 2], dir: [0, 0, 1], twist: d.sgn > 0 ? Math.PI : 0 });
            for (const dy of [-24, 24]) screws.push({ on: d.key, at: [x + d.sgn * 4, y + dy, D / 2], dir: [0, 0, 1], hole: false });
          }
        }
        b.fits(HW.hinge, hinges, 0.1);
        b.then(0.05);
        b.fits(HW.screwS, screws, 0.03);
      },
    );
    const tall = doors.some((d) => d.dh > 1500);
    b.step(
      {
        title: many ? "Hang the doors" : "Hang the door",
        detail: "Slide each hinge arm onto its plate until it clicks.",
        kind: "doors",
        people: tall ? 2 : 1,
        warnings: tall ? ["two"] : [],
      },
      () => {
        b.stagger(0.35);
        doors.forEach((d) => b.add(d.key, [0, 0, 380]));
      },
    );
    b.step(
      {
        title: many ? "Line up the doors" : "Line up the door",
        detail: "Turn the hinge screws a little until the gaps look even.",
        tools: ["screwdriver"],
        kind: "doors",
      },
      () => {},
    );
  }

  /* ---------- a fixed front, in front of the sink ---------- */
  if (fronts.length) {
    b.step(
      {
        title: "Screw on the fixed front",
        detail: "It doesn't open. Screw it on from the inside, just under the top rail.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.stagger(0.3);
        fronts.forEach((k) => b.add(k, [0, 0, 340]));
        b.then(0.1);
        const list: FitOpts[] = [];
        for (const k of fronts) {
          const p = b.partItem(k).final.pos;
          const y = Math.min(p[1], H - t - 14);
          for (const x of [-W / 2 + t + 60, W / 2 - t - 60]) list.push({ on: k, at: [x, y, D / 2], dir: [0, 0, 1], hole: false });
        }
        b.fits(HW.screwS, list, 0.12);
      },
    );
  }

  /* ---------- drawers ---------- */
  if (drawers.length) {
    const n = drawers.length;
    const d0 = drawers[0];
    const c0: Vec3 = [0, d0.ys + d0.slotH / 2, zBox];
    const at = (k: string) => b.partItem(k).final.pos;
    const rel = (k: string): Vec3 => [at(k)[0] - c0[0], at(k)[1] - c0[1], at(k)[2] - c0[2]];
    const backScrews = (d: Drawer): FitOpts[] => {
      const bp = at(d.back);
      return d.sides.flatMap((sd, i) => {
        const xo = at(sd)[0] + (i === 0 ? -6 : 6);
        return [-(d.sh - 22) / 4, (d.sh - 22) / 4].map((dy) => ({ on: sd, at: [xo, bp[1] + dy, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
      });
    };
    b.step(
      {
        title: n > 1 ? "Put the drawers together" : "Put the drawer together",
        detail: "Sides onto the front, slide the bottom in along the grooves, then screw on the back.",
        tools: ["screwdriver"],
        scene: "drawer",
        pose: "-z",
        repeat: n > 1 ? n : undefined,
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
        title: n > 2 ? `Slide in all ${n} drawers` : n > 1 ? "Slide in both drawers" : "Slide in the drawer",
        detail: "Rest the back on the runners, then push until it clicks closed.",
        kind: "drawer",
        weight: 0.8 + 0.5 * n,
      },
      () => {
        for (const [i, d] of drawers.entries()) {
          b.stagger(0);
          for (const k of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(k, [0, 0, 520]);
          if (i > 0) for (const o of backScrews(d)) b.preset(HW.screwM, o);
          b.wait(0.22);
        }
      },
    );
  }

  /* ---------- knobs or handles on every front ---------- */
  const faces = doors.length + drawers.length + fronts.length;
  if (handles !== "none" && faces) {
    const bar = handles === "bar";
    const one = faces === 1;
    b.step(
      {
        title: bar ? (one ? "Screw on the handle" : "Screw on the handles") : one ? "Screw on the knob" : "Screw on the knobs",
        detail: doors.length && (drawers.length || fronts.length) ? "Screw from the inside of each door and drawer. Snug is enough." : "Screw from the inside. Snug is enough.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = doors.map((d) => {
          const x = d.x - d.sgn * (d.dw / 2 - 40);
          // a wall cabinet opens from the bottom edge, a base cabinet from the top, a tall door at hand height
          const y = wall && !fit.hangFirst ? d.lo + 110 : clamp(1000, d.lo + 110, d.lo + d.dh - 110);
          return { on: d.key, at: [x, y, D / 2 + t], dir: [0, 0, -1], hole: false, twist: bar ? Math.PI / 2 : 0 };
        });
        for (const k of [...drawers.map((d) => d.front), ...fronts]) list.push({ on: k, at: [0, b.partItem(k).final.pos[1], D / 2 + t], dir: [0, 0, -1], hole: false });
        b.fits(bar ? HW.handle : HW.knob, list, 0.1);
      },
    );
  }

  if (wall && !fit.hangFirst) f.hang();
  else if (!wall && H >= 800) f.anchor();

  /* ---------- the basin last, or what comes next ---------- */
  if (basin) {
    const big = W > 900;
    b.step(
      {
        title: "Set the basin on top",
        detail: "Lower it gently onto the frame and check that it sits level. Fit the tap and the drain following their own instructions, or ask a plumber.",
        kind: "general",
        people: big ? 2 : 1,
        warnings: big ? ["two"] : [],
      },
      () => b.add(basin!, [0, 260, 0]),
    );
  } else if (fit.use !== "storage") {
    const [title, detail] = READY[fit.use];
    const apron = bands.some((bd) => bd.z.kind === "apron");
    b.step({ title, detail: apron ? "The sink's own front fills the space at the top. " + detail : detail, kind: "general" }, () => {});
  }
}
