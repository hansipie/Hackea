import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { FrameKit, anchorStep } from "./frame";
import { clamp } from "./math";

/** Kitchen corner cabinets: an L with a door that folds at the inner corner, or a blind corner with a door at its open end. */
export function buildCornerCabinet(b: PlanBuilder, s: ProductSpec) {
  if (s.cabinet?.corner?.shape === "blind") return blind(b, s);
  return ell(b, s);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * An L-shaped corner cabinet, its corner at the back left: a back panel along each wall, a side panel at the end of each leg,
 * and an L-shaped bottom and top. The back panels are screwed together at the corner first, the bottom and top go onto
 * their dowels, the sides close the ends, and the cam locks hold it all. The door comes in two halves hinged together:
 * one half hangs on the side panel, the other folds against it at the inner corner.
 */
function ell(b: PlanBuilder, s: ProductSpec) {
  const c = s.cabinet ?? {};
  const k = c.corner ?? { shape: "l" };
  const W = s.size.w * 10, L = s.size.d * 10, H = s.size.h * 10;
  const t = clamp(c.thickness ?? 18, 12, 25);
  const wall = !!c.wall;
  const dp = clamp((k.depth ?? (wall ? 37 : 60)) * 10, 250, Math.min(W, L) - 200);
  const base = wall ? 0 : 70;
  const x0 = -W / 2, z0 = -L / 2;
  // the inner corner, where the two halves of the door meet
  const xi = x0 + dp, zi = z0 + dp;
  const carousel = k.inner === "carousel";
  const nShelves = carousel ? 0 : clamp(Math.round(c.shelves ?? 0), 0, 3);
  const hasDoor = c.doors !== 0;
  const handles = c.handles ?? "bar";

  /* ---------- carcass ---------- */
  const backA = b.place(b.part("Back panel", [W, H, t]), [0, H / 2, z0 + t / 2]);
  const backB = b.place(b.part("Left back panel", [t, H, L - t]), [x0 + t / 2, H / 2, z0 + t + (L - t) / 2]);
  const sideT = b.part("Side panel", [t, H, dp - t]);
  const sideR = b.place(sideT, [W / 2 - t / 2, H / 2, z0 + t + (dp - t) / 2]);
  const sideF = b.place(sideT, [x0 + t + (dp - t) / 2, H / 2, L / 2 - t / 2], [0, Math.PI / 2, 0]);

  /** An L of two boards at height y, inside the backs and the sides: along the back, then down the left leg. */
  const ellPieces = (y: number, inset = 0): PartPiece[] => [
    { shape: "box", size: [W - 2 * t - 2 * inset, t, dp - t - inset], pos: [0, y, (z0 + t + zi - inset) / 2] },
    { shape: "box", size: [dp - t - inset, t, L / 2 - t - zi], pos: [(x0 + t + xi - inset) / 2, y, (zi + L / 2 - t) / 2 - inset] },
  ];
  const botC = b.compound("Bottom panel", ellPieces(base + t / 2));
  const bottom = b.place(botC.type, botC.mid);
  const topC = b.compound("Top panel", ellPieces(H - t / 2));
  const top = b.place(topC.type, topC.mid);

  let plinth: string | undefined;
  if (base) {
    // a board under each inner face, set back a little; the one down the left leg runs into the corner
    const zA = zi - 12 - t / 2, xB = xi - 12 - t / 2;
    const pc = b.compound("Plinth", [
      { shape: "box", size: [W / 2 - t - (xi - 12), base, t], pos: [(xi - 12 + W / 2 - t) / 2, base / 2, zA] },
      { shape: "box", size: [t, base, L / 2 - t - (zi - 12 - t)], pos: [xB, base / 2, (zi - 12 - t + L / 2 - t) / 2] },
    ]);
    plinth = b.place(pc.type, pc.mid);
  }

  /* ---------- where the dowels and bolts go ---------- */
  // along each board that carries the bottom and top: [part, inner face point builder, direction into the bottom/top]
  const ys = [base + t / 2, H - t / 2];
  const along = (a: number, z: number, n: number) => Array.from({ length: n }, (_, i) => a + ((z - a) * (i + 0.5)) / n);
  const joints: { on: string; at: (y: number) => Vec3[]; into: Vec3 }[] = [
    { on: backA, at: (y) => along(x0 + dp, W / 2 - t, 2).map((x) => [x, y, z0 + t] as Vec3), into: [0, 0, 1] },
    { on: backB, at: (y) => along(z0 + dp, L / 2 - t, 2).map((z) => [x0 + t, y, z] as Vec3), into: [1, 0, 0] },
    { on: sideR, at: (y) => [[W / 2 - t, y, z0 + t + (dp - t) * 0.3], [W / 2 - t, y, z0 + t + (dp - t) * 0.75]], into: [-1, 0, 0] },
    { on: sideF, at: (y) => [[x0 + t + (dp - t) * 0.3, y, L / 2 - t], [x0 + t + (dp - t) * 0.75, y, L / 2 - t]], into: [0, 0, -1] },
  ];

  /* ---------- shelves, or a carousel ---------- */
  const shelfYs = Array.from({ length: nShelves }, (_, i) => Math.round((base + t + ((H - base - 2 * t) * (i + 1)) / (nShelves + 1)) / 32) * 32);
  const shelfKeys: string[] = [];
  if (nShelves) {
    const sc = b.compound("Shelf", ellPieces(0, 10));
    for (const y of shelfYs) shelfKeys.push(b.place(sc.type, [sc.mid[0], y + 3 + t / 2, sc.mid[2]]));
  }
  const pinsAt = (y: number): FitOpts[] => [
    { on: sideR, at: [W / 2 - t, y, z0 + t + 40], dir: [1, 0, 0], hole: false },
    { on: sideR, at: [W / 2 - t, y, zi - 40], dir: [1, 0, 0], hole: false },
    { on: sideF, at: [x0 + t + 40, y, L / 2 - t], dir: [0, 0, 1], hole: false },
    { on: sideF, at: [xi - 40, y, L / 2 - t], dir: [0, 0, 1], hole: false },
    { on: backA, at: [x0 + dp, y, z0 + t], dir: [0, 0, -1], hole: false },
    { on: backB, at: [x0 + t, y, z0 + dp], dir: [-1, 0, 0], hole: false },
  ];
  for (const y0 of shelfYs)
    for (const dy of [-64, 0, 64])
      for (const p of pinsAt(y0 + dy)) b.hole(p.on!, p.at, [-p.dir[0], -p.dir[1], -p.dir[2]], 2.5);

  // a carousel turns on a pole in the back corner, its shelves clear of the door
  let pole: string | undefined;
  const discs: string[] = [];
  const rc = Math.round(Math.min(0.58 * (dp - t) - 10, (W - 2 * t) / 2 - 20, (L - 2 * t) / 2 - 20));
  const cx = x0 + t + rc + 10, cz = z0 + t + rc + 10;
  if (carousel) {
    const ph = H - base - 2 * t;
    pole = b.place(b.part("Carousel pole", [30, ph, 30], { shape: "cyl", material: "metal" }), [cx, base + t + ph / 2, cz]);
    const dT = b.part("Carousel shelf", [2 * rc, t, 2 * rc], { shape: "cyl" });
    const ysd = H > 700 ? [base + t + 80, base + t + Math.round((H - base - 2 * t) * 0.55)] : [base + t + Math.round((H - base - 2 * t) * 0.4)];
    for (const y of ysd) discs.push(b.place(dT, [cx, y, cz]));
  }

  /* ---------- the door in two halves ---------- */
  const dh = r1(H - base - 4);
  const dw = r1(W / 2 - xi - t - 4);
  let doorA: string | undefined, doorB: string | undefined;
  if (hasDoor) {
    const dT = b.part("Door", [dw, dh, t]);
    doorA = b.place(dT, [xi + t + 2 + dw / 2, base + 2 + dh / 2, zi + t / 2]);
    doorB = b.place(dT, [xi + t / 2, base + 2 + dh / 2, L / 2 - 2 - dw / 2], [0, Math.PI / 2, 0]);
  }

  /* ---------- steps ---------- */
  b.step(
    {
      title: "Fit the dowels and bolts into the back panels and sides",
      detail: "Tap the dowels in gently. Twist the bolts in by hand until they stop.",
      tools: ["hammer", "screwdriver"],
      scene: "prep",
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.16);
      // laid flat with the inner face up, one after another
      const flat: [string, Vec3, number][] = [
        [backA, [-Math.PI / 2, 0, 0], W],
        [backB, [0, 0, Math.PI / 2], H],
        [sideR, [0, 0, -Math.PI / 2], H],
        [sideF, [0, 0, Math.PI / 2], H],
      ];
      const total = flat.reduce((a, [, , w]) => a + w, 0) + 120 * (flat.length - 1);
      let x = -total / 2;
      for (const [key, rot, w] of flat) {
        b.stage(key, [x + w / 2, t / 2, 0], rot, [0, 120, 0]);
        x += w + 120;
      }
      b.then(0.2);
      const dowels: FitOpts[] = [];
      const bolts: FitOpts[] = [];
      for (const j of joints)
        for (const [yi, y] of ys.entries())
          for (const p of j.at(y)) {
            const mate = yi === 0 ? bottom : top;
            const off = 26;
            const shift = (v: Vec3, d: number): Vec3 =>
              j.into[0] !== 0 ? [v[0], v[1], v[2] + d] : [v[0] + d, v[1], v[2]];
            dowels.push({ on: j.on, at: shift(p, -off), dir: [-j.into[0], -j.into[1], -j.into[2]], mate });
            bolts.push({ on: j.on, at: shift(p, off), dir: [-j.into[0], -j.into[1], -j.into[2]], mate, mateHole: 4 });
          }
      if (plinth) {
        dowels.push({ on: sideR, at: [W / 2 - t, base / 2, zi - 12 - t / 2], dir: [1, 0, 0], mate: plinth });
        dowels.push({ on: sideF, at: [xi - 12 - t / 2, base / 2, L / 2 - t], dir: [0, 0, 1], mate: plinth });
      }
      b.fits(HW.dowel, dowels, 0.05);
      b.then(0.15);
      b.fits(HW.camScrew, bolts, 0.05);
    },
  );
  b.step(
    {
      title: "Screw the back panels together at the corner",
      detail: "Stand them up at a right angle, then screw through the long one into the edge of the other.",
      tools: ["screwdriver"],
      kind: "join",
      people: H > 1000 ? 2 : 1,
      warnings: H > 1000 ? ["two"] : [],
    },
    () => {
      b.add(backA, [0, 0, -300]);
      b.then(0.05);
      b.add(backB, [-300, 0, 0]);
      b.then(0.1);
      const list: FitOpts[] = [0.15, 0.5, 0.85].map((f) => ({ on: backA, at: [x0 + t / 2, H * f, z0] as Vec3, dir: [0, 0, 1] as Vec3, mate: backB }));
      b.fits(HW.screwM, list, 0.12);
    },
  );
  b.step(
    {
      title: "Add the bottom and the top",
      detail: "Push each one onto the dowels along both back panels.",
      kind: "join",
      warnings: ["face"],
    },
    () => {
      b.stagger(0.3);
      b.add(bottom, [260, 0, 260]);
      b.add(top, [260, 0, 260]);
    },
  );
  b.step(
    {
      title: "Add the side panels",
      detail: "One at the end of each leg. Line up the bolts with the holes and press them on evenly.",
      kind: "join",
    },
    () => {
      b.stagger(0.3);
      b.add(sideR, [360, 0, 0]);
      b.add(sideF, [0, 0, 360]);
    },
  );
  b.step(
    {
      title: "Lock the cam locks",
      detail: "Drop each one in with the arrow pointing at the bolt, then turn clockwise until it bites.",
      tools: ["screwdriver"],
      kind: "cams",
    },
    () => {
      const list: FitOpts[] = [];
      for (const j of joints)
        for (const [yi, y] of ys.entries())
          for (const p of j.at(y)) {
            const into = j.into;
            const cam: Vec3 = [p[0] + into[0] * 24 + (into[0] !== 0 ? 0 : 26), yi === 0 ? base + t : H - t, p[2] + into[2] * 24 + (into[0] !== 0 ? 26 : 0)];
            list.push({ on: yi === 0 ? bottom : top, at: cam, dir: [0, yi === 0 ? -1 : 1, 0] });
          }
      b.fits(HW.cam, list, 0.06);
    },
  );
  if (plinth) {
    b.step(
      {
        title: "Fit the plinth",
        detail: "Press it onto the dowels under the front, from one side to the other.",
        kind: "join",
      },
      () => b.add(plinth!, [180, 0, 180]),
    );
  }

  if (shelfKeys.length) {
    b.step(
      {
        title: shelfKeys.length > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf",
        detail: "Six pins hold each shelf: two in each side, one in each back panel.",
        kind: "shelves",
      },
      () => {
        b.fits(HW.pin, shelfYs.flatMap(pinsAt), 0.04);
        b.then(0.2);
        b.stagger(0.25);
        shelfKeys.forEach((key) => b.add(key, [260, 0, 260]));
      },
    );
  }

  if (pole) {
    b.step(
      {
        title: discs.length > 1 ? "Slide the shelves onto the carousel pole" : "Slide the shelf onto the carousel pole",
        detail: "Click each one in at its height, one low down and one higher up.",
        scene: "carousel",
        kind: "general",
      },
      () => {
        b.stage(pole!, [0, (H - base - 2 * t) / 2, 0], [0, 0, 0], [0, 200, 0]);
        b.then(0.1);
        b.stagger(0.3);
        for (const d of discs) b.stage(d, [0, b.partItem(d).final.pos[1] - base - t, 0], [0, 0, 0], [0, 300, 0]);
      },
    );
    b.step(
      {
        title: "Stand the carousel in the cabinet",
        detail: "Tip it in through the opening, then screw its top and bottom plates to the cabinet.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.stagger(0);
        for (const key of [pole!, ...discs]) b.add(key, [300, 0, 300]);
        b.then(0.15);
        const list: FitOpts[] = [];
        for (const [y, dir] of [[base + t, -1], [H - t, 1]] as const)
          for (const dx of [-30, 30]) list.push({ on: y === base + t ? bottom : top, at: [cx + dx, y, cz], dir: [0, dir, 0], hole: false });
        b.fits(HW.screwS, list, 0.1);
      },
    );
  }

  if (wall) anchorStep(b, { W, D: L, top, y: H, backZ: z0, tools: ["drill", "screwdriver", "pencil", "level"], hang: true });

  if (doorA && doorB) {
    const hn = dh > 900 ? 3 : 2;
    const hy = Array.from({ length: hn }, (_, i) => base + 2 + 108 + (i * (dh - 216)) / (hn - 1));
    b.step(
      {
        title: "Press the hinges into the two halves of the door",
        detail: "The corner hinges join the halves. The others go on the outer edge, to hang it on the side panel.",
        tools: ["screwdriver"],
        scene: "doors",
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.2);
        // face down, side by side as they will fold
        b.stage(doorB!, [-dw / 2 - 2, t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
        b.stage(doorA!, [dw / 2 + 2, t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
        b.then(0.1);
        const corner: FitOpts[] = hy.map((y) => ({ on: doorA!, at: [xi + t + 24, y, zi] as Vec3, dir: [0, 0, 1] as Vec3 }));
        const outer: FitOpts[] = hy.map((y) => ({ on: doorA!, at: [W / 2 - 24, y, zi] as Vec3, dir: [0, 0, 1] as Vec3, twist: Math.PI }));
        b.fits(HW.hinge, [...corner, ...outer], 0.1);
        b.then(0.05);
        b.fits(
          HW.screwS,
          [...corner, ...outer].flatMap((h) => [-24, 24].map((d) => ({ on: doorA!, at: [h.at[0], h.at[1] + d, zi] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const }))),
          0.03,
        );
      },
    );
    b.step(
      {
        title: "Hang the door",
        detail: "Clip the outer hinges onto the plates on the side panel, then fold the other half in at the corner.",
        kind: "doors",
      },
      () => {
        b.add(doorA!, [0, 0, 380]);
        b.then(0.1);
        b.add(doorB!, [380, 0, 0]);
      },
    );
    b.step(
      {
        title: "Line up the door",
        detail: "Turn the hinge screws a little until both halves close evenly.",
        tools: ["screwdriver"],
        kind: "doors",
      },
      () => {},
    );
    if (handles !== "none") {
      const bar = handles === "bar";
      b.step(
        {
          title: bar ? "Screw on the handle" : "Screw on the knob",
          detail: "It goes on the half that folds, near its free edge. Screw from the inside.",
          tools: ["screwdriver"],
          kind: "screws",
        },
        () => {
          const y = wall ? base + 2 + 110 : base + 2 + dh - 110;
          b.fit(bar ? HW.handle : HW.knob, { on: doorB!, at: [xi + t, y, L / 2 - 2 - 40], dir: [-1, 0, 0], hole: false, twist: bar ? Math.PI / 2 : 0 });
        },
      );
    }
  }

  if (!wall) anchorStep(b, { W, D: L, top, y: H, backZ: z0 });
}

/**
 * A blind corner cabinet: a long carcass built like any base cabinet, with a door at its open end. The rest of its front
 * is hidden behind the cabinet on the other wall. Inside, a shelf, a pull-out fitting behind the door, and a drawer over it.
 */
function blind(b: PlanBuilder, s: ProductSpec) {
  const c = s.cabinet ?? {};
  const k = c.corner ?? { shape: "blind" };
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = clamp(c.thickness ?? 18, 12, 25);
  const base = 70;
  const handles = c.handles ?? "bar";
  const doorW = clamp((k.door ?? 0) * 10, 0, W - 200);
  const drawer = !!k.drawer && doorW > 0;
  const pullout = k.inner === "pullout";
  const nShelves = clamp(Math.round(c.shelves ?? 0), 0, 2);
  const f = new FrameKit(b, { W, H, D, t, base, plinth: true, fixed: [], back: true, pinRows: nShelves > 0, lying: false });

  // the door's end of the cabinet: from the middle panel (or where the door starts) to the right-hand side
  const xL = W / 2 - doorW;
  const bandH = drawer ? 200 : 0;
  let middle: string | undefined;
  // it carries the drawer's runner, so it only reaches down as far as the drawer
  const midH = bandH + 30;
  if (drawer) middle = b.place(b.part("Middle panel", [t, midH, D - 4]), [xL + t / 2, H - t - midH / 2, -2]);

  // the pull-out: a rail screwed to the bottom, a post, and two wire baskets that swing out through the door
  let fitting: string | undefined;
  let fitX = 0;
  if (pullout) {
    const bw = Math.max(200, doorW - 2 * t - 60);
    const bd = D - 140;
    const xc = W / 2 - t - 30 - bw / 2;
    fitX = xc;
    const y0 = base + t;
    const top = H - t - bandH - (drawer ? t : 0);
    const pieces: PartPiece[] = [
      { shape: "box", size: [60, 24, D - 80], pos: [xc, y0 + 12, 0] },
      { shape: "box", size: [30, top - y0 - 40, 30], pos: [xc - bw / 2 + 15, y0 + (top - y0 - 40) / 2, D / 2 - 70] },
      { shape: "box", size: [bw, 110, bd], pos: [xc, y0 + 60 + 55, -10] },
      { shape: "box", size: [bw, 110, bd], pos: [xc, y0 + (top - y0) * 0.58 + 55, -10] },
    ];
    const fc = b.compound("Pull-out fitting", pieces, { material: "metal" });
    fitting = b.place(fc.type, fc.mid);
  }

  // the drawer over the door, on runners on the right-hand side and the middle panel
  const runLen = Math.round((D - 60) / 10) * 10;
  const runner = { kind: "runner" as const, len: runLen, dia: 20 };
  const fh = bandH - 4;
  let dr: { front: string; sides: [string, string]; back: string; bottom: string; ys: number; sh: number } | undefined;
  const inW = doorW - 2 * t;
  const bxc = W / 2 - t - inW / 2;
  const dd = D - 50;
  const zBox = D / 2 - dd / 2;
  if (drawer) {
    const ys = H - t - bandH + 4;
    const sh = 110;
    const bw = inW - 26;
    const sy = ys + 24 + sh / 2;
    const sideT = b.part("Drawer side", [12, sh, dd]);
    dr = {
      ys,
      sh,
      front: b.place(b.part("Drawer front", [doorW - 4, fh, t]), [W / 2 - doorW / 2, H - 2 - fh / 2, D / 2 + t / 2]),
      sides: [b.place(sideT, [bxc - bw / 2 + 6, sy, zBox]), b.place(sideT, [bxc + bw / 2 - 6, sy, zBox])],
      back: b.place(b.part("Drawer back", [bw - 24, sh - 22, 12]), [bxc, ys + 24 + 22 + (sh - 22) / 2, D / 2 - dd + 6]),
      bottom: b.place(b.part("Drawer bottom", [bw - 10, 3, dd - 8], { material: "fiber" }), [bxc, ys + 24 + 9, zBox - 2]),
    };
  }

  const dh = r1(H - base - 4 - bandH);
  let door: string | undefined;
  if (doorW > 0) door = b.place(b.part("Door", [doorW - 4, dh, t]), [W / 2 - doorW / 2, base + 2 + dh / 2, D / 2 + t / 2]);

  /* ---------- steps ---------- */
  f.prepSides();
  f.join();
  f.otherSide();
  f.cams();
  f.plinthStep();
  f.backSteps();
  f.standUp();

  if (middle) {
    b.step(
      {
        title: "Screw in the middle panel",
        detail: "It hangs under the top, where the door begins. Screw down through the top into it.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.add(middle!, [0, 0, 420]);
        b.then(0.1);
        const list: FitOpts[] = [];
        for (const z of [-D / 3, 0, D / 3]) list.push({ on: f.top, at: [xL + t / 2, H, z], dir: [0, -1, 0], mate: middle });
        b.fits(HW.screwM, list, 0.1);
      },
    );
  }
  if (nShelves) f.shelves(nShelves);
  if (fitting) {
    b.step(
      {
        title: "Fit the pull-out fitting",
        detail: "Screw its rail to the bottom panel behind the door, then hook the baskets on.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.add(fitting!, [0, 0, 460]);
        b.then(0.1);
        b.fits(HW.screwS, [-D / 3, 0, D / 3].map((z) => ({ on: fitting!, at: [fitX, base + t + 24, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: f.bottom })), 0.1);
      },
    );
  }
  if (dr) {
    const d = dr;
    b.step(
      {
        title: "Screw the drawer runners in",
        detail: "One on the side, one on the middle panel, just under the top. The open ends point to the front.",
        tools: ["screwdriver"],
        kind: "runners",
      },
      () => {
        const y = d.ys + 14;
        const zr = D / 2 - runLen / 2 - 8;
        b.fits(runner, [
          { on: f.sides[1], at: [W / 2 - t, y, zr], dir: [1, 0, 0], hole: false },
          { on: middle!, at: [xL + t, y, zr], dir: [-1, 0, 0], hole: false },
        ], 0.15);
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const dz of [-runLen / 2 + 30, runLen / 2 - 30]) {
          sc.push({ on: f.sides[1], at: [W / 2 - t - 12, y, zr + dz], dir: [1, 0, 0], hole: false });
          sc.push({ on: middle!, at: [xL + t + 12, y, zr + dz], dir: [-1, 0, 0], hole: false });
        }
        b.fits(HW.screwS, sc, 0.05);
      },
    );
    const c0: Vec3 = [bxc, d.ys + bandH / 2, zBox];
    const rel = (key: string): Vec3 => {
      const p = b.partItem(key).final.pos;
      return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
    };
    b.step(
      {
        title: "Put the drawer together",
        detail: "Sides onto the front, slide the bottom in along the grooves, then screw on the back.",
        tools: ["screwdriver"],
        scene: "drawer",
        pose: "-z",
        kind: "drawer",
        warnings: ["floor"],
      },
      () => {
        b.stage(d.front, rel(d.front), [0, 0, 0], [0, 0, -160]);
        b.then(0.1);
        b.stagger(0.25);
        for (const sd of d.sides) b.stage(sd, rel(sd), [0, 0, 0], [0, 0, -300]);
        b.then(0.1);
        b.stage(d.bottom, rel(d.bottom), [0, 0, 0], [0, 0, -420]);
        b.then(0.1);
        b.stage(d.back, rel(d.back), [0, 0, 0], [0, 0, -260]);
        b.then(0.15);
        const bp = b.partItem(d.back).final.pos;
        b.fits(
          HW.screwM,
          d.sides.flatMap((sd, i) => {
            const xo = b.partItem(sd).final.pos[0] + (i === 0 ? -6 : 6);
            return [-(d.sh - 22) / 4, (d.sh - 22) / 4].map((dy) => ({ on: sd, at: [xo, bp[1] + dy, bp[2]] as Vec3, dir: [i === 0 ? 1 : -1, 0, 0] as Vec3 }));
          }),
          0.12,
        );
      },
    );
    b.step(
      {
        title: "Slide in the drawer",
        detail: "Rest the back on the runners, then push until it clicks closed.",
        kind: "drawer",
      },
      () => {
        b.stagger(0);
        for (const key of [d.front, d.sides[0], d.sides[1], d.back, d.bottom]) b.add(key, [0, 0, 520]);
      },
    );
  }

  if (door) {
    const hn = dh > 900 ? 3 : 2;
    const hy = Array.from({ length: hn }, (_, i) => base + 2 + 108 + (i * (dh - 216)) / (hn - 1));
    const x = W / 2 - 22;
    b.step(
      {
        title: "Press the hinges into the door",
        detail: "Two small screws hold each one. They go on the edge by the end of the cabinet.",
        tools: ["screwdriver"],
        scene: "doors",
        kind: "hinges",
        warnings: ["floor"],
      },
      () => {
        b.stage(door!, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
        b.then(0.1);
        b.fits(HW.hinge, hy.map((y) => ({ on: door!, at: [x, y, D / 2] as Vec3, dir: [0, 0, 1] as Vec3, twist: Math.PI })), 0.1);
        b.then(0.05);
        b.fits(HW.screwS, hy.flatMap((y) => [-24, 24].map((dy) => ({ on: door!, at: [x + 4, y + dy, D / 2] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const }))), 0.03);
      },
    );
    b.step({ title: "Hang the door", detail: "Slide each hinge arm onto its plate until it clicks.", kind: "doors" }, () => b.add(door!, [0, 0, 380]));
    b.step({ title: "Line up the door", detail: "Turn the hinge screws a little until the gaps look even.", tools: ["screwdriver"], kind: "doors" }, () => {});
  }
  const faces = [...(door ? [door] : []), ...(dr ? [dr.front] : [])];
  if (handles !== "none" && faces.length) {
    const bar = handles === "bar";
    b.step(
      {
        title: bar ? (faces.length > 1 ? "Screw on the handles" : "Screw on the handle") : faces.length > 1 ? "Screw on the knobs" : "Screw on the knob",
        detail: "Screw from the inside. Snug is enough.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        const list: FitOpts[] = [];
        if (door) list.push({ on: door, at: [xL + 42, base + 2 + dh - 110, D / 2 + t], dir: [0, 0, -1], hole: false, twist: bar ? Math.PI / 2 : 0 });
        if (dr) list.push({ on: dr.front, at: [W / 2 - doorW / 2, H - 2 - fh / 2, D / 2 + t], dir: [0, 0, -1], hole: false });
        b.fits(bar ? HW.handle : HW.knob, list, 0.12);
      },
    );
  }
  b.step(
    {
      title: "Push it into the corner",
      detail: doorW > 0 ? "The end without a door goes into the corner, behind the cabinet on the other wall." : "One end goes into the corner, behind the cabinet on the other wall.",
      kind: "general",
      people: W > 1100 ? 2 : 1,
    },
    () => {},
  );
  f.anchor();
}
