import type { ProductSpec, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp } from "./math";
import { sofaDims } from "./sofaDims";

/** One seat section on the floor: its footprint and how its seats run. */
interface Section {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  seats: number;
  /** seats run front to back (the return of a corner sofa) */
  along: "x" | "z";
  /** where it waits before it is pushed against the others, or none when it stays put */
  slide?: Vec3;
  frame?: string;
  legs: string[];
}

/**
 * Sofas with a chaise longue at one or both ends, and corner sofas (an L with a return on one side).
 * The sections are laid out like the straight sofa: legs in upside down, turned over, then pushed together
 * and bolted, armrests, backrests, and the cushions last.
 */
export function buildCornerSofa(b: PlanBuilder, s: ProductSpec) {
  if (s.sofa?.corner && (s.sofa.seats ?? 3) <= 1) return cornerSection(b, s);
  const p = s.sofa ?? {};
  const W = s.size.w * 10, D = s.size.d * 10;
  // a long straight sofa: two sections side by side, as deep as the sofa
  const straight = p.corner === undefined && !p.chaise;
  const sd = straight ? D : clamp((p.depth ?? 92) * 10, 700, Math.min(1100, D - 300));
  const { a, legH, baseTop, seatT, seatTop, armH, backH, backT, cushT, cushH } = sofaDims(s, W, sd);
  const fh = baseTop - legH;
  const hb = backH - baseTop;
  const bh = cushH;
  // the back cushions stand on the seat cushions and lean on the backrest
  const tilt = 0.12;
  const lean = (bh / 2) * Math.sin(tilt) + 4;
  const corner = p.corner !== undefined;
  // a U: a corner sofa with a chaise longue at the far end of the back
  const u = corner && !!p.chaise;
  const N = clamp(Math.round(p.seats ?? 3), 2, u ? 8 : 6);
  const back = -D / 2;
  // a corner on the left is the right one mirrored
  const sx = p.corner === "left" ? -1 : 1;
  const X = (x: number) => sx * x;

  /* ---------- sections ---------- */
  const secs: Section[] = [];
  const sectionName = (n: number) => `${n}-seat section`;
  let frontArm = false;
  if (straight) {
    // the longer section first, the other pushed against its right-hand end
    const cw = (W - 2 * a) / N;
    const n0 = Math.ceil(N / 2);
    secs.push({ name: sectionName(n0), x0: -W / 2 + a, x1: -W / 2 + a + n0 * cw, z0: back, z1: D / 2, seats: n0, along: "x", legs: [] });
    secs.push({ name: sectionName(N - n0), x0: -W / 2 + a + n0 * cw, x1: W / 2 - a, z0: back, z1: D / 2, seats: N - n0, along: "x", slide: [300, 0, 0], legs: [] });
  } else if (!corner) {
    const side = p.chaise ?? "right";
    const nCh = side === "both" ? 2 : 1;
    const cw = (W - 2 * a) / N;
    const nm = N - nCh;
    let x = -W / 2 + a;
    const chaise = (dir: number) => {
      secs.push({ name: "Chaise longue", x0: x, x1: x + cw, z0: back, z1: D / 2, seats: 1, along: "x", slide: [dir * 300, 0, 0], legs: [] });
      x += cw;
    };
    if (side !== "right") chaise(-1);
    if (nm > 0) secs.push({ name: sectionName(nm), x0: x, x1: x + nm * cw, z0: back, z1: back + sd, seats: nm, along: "x", legs: [] });
    x += nm * cw;
    if (side !== "left") chaise(1);
  } else {
    // the corner seat, and a U's chaise longue, count among the seats
    const k = u ? 2 : 1;
    const n1 = Math.ceil((N - k) / 2);
    const nRet = N - k - n1;
    // a corner with no seats in front of it is open there: no armrest across the seat
    frontArm = !p.open && nRet > 0 && a > 0;
    const aFront = frontArm ? a : 0;
    let x1 = -W / 2 + a;
    if (u) {
      // as wide as one of the back's seats, and as long as the sofa says
      const cwU = (W - a - sd) / (n1 + 1);
      const reach = clamp((p.reach ?? 160) * 10, sd + 300, D);
      secs.push({ name: "Chaise longue", x0: x1, x1: x1 + cwU, z0: back, z1: back + reach, seats: 1, along: "x", slide: [-600, 0, 0], legs: [] });
      x1 += cwU;
    }
    secs.push({ name: sectionName(n1), x0: x1, x1: W / 2 - sd, z0: back, z1: back + sd, seats: n1, along: "x", slide: [-300, 0, 0], legs: [] });
    secs.push({ name: "Corner section", x0: W / 2 - sd, x1: W / 2, z0: back, z1: back + sd, seats: 1, along: "x", legs: [] });
    if (nRet > 0) secs.push({ name: sectionName(nRet), x0: W / 2 - sd, x1: W / 2, z0: back + sd, z1: D / 2 - aFront, seats: nRet, along: "z", slide: [0, 0, 300], legs: [] });
  }

  // parts of the same name and size are one part, however they are turned
  const types = new Map<string, string>();
  const soft = (name: string, size: Vec3) => {
    const k = `${name}|${size.map(Math.round).join("x")}`;
    if (!types.has(k)) types.set(k, b.part(name, size, { material: "soft" }));
    return types.get(k)!;
  };

  // frames and legs
  const legT = b.part("Leg", [42, legH, 42], { shape: "cyl", material: "wood" });
  for (const sec of secs) {
    const lx = sec.x1 - sec.x0, lz = sec.z1 - sec.z0;
    const turned = sec.along === "z";
    const cx = (sec.x0 + sec.x1) / 2, cz = (sec.z0 + sec.z1) / 2;
    sec.frame = b.place(soft(sec.name, turned ? [lz, fh, lx] : [lx, fh, lz]), [X(cx), legH + fh / 2, cz], turned ? [0, Math.PI / 2, 0] : [0, 0, 0]);
    const ix = Math.min(60, lx / 4), iz = Math.min(70, lz / 4);
    const xs = [sec.x0 + ix, sec.x1 - ix];
    const zs = [sec.z0 + iz, sec.z1 - iz];
    if (lx > 2000) xs.splice(1, 0, cx);
    if (lz > 2000) zs.splice(1, 0, cz);
    for (const x of xs) for (const z of zs) sec.legs.push(b.place(legT, [X(x), legH / 2, z]));
  }

  // armrests: at the outer ends, and at the front of a corner sofa's return
  const armKeys: { key: string; from: Vec3 }[] = [];
  const armB = Math.max(15, legH - 40);
  const ah = armH - armB, ay = armB + ah / 2;
  if (a > 0) {
    const first = secs[0], last = secs[secs.length - 1];
    // an armrest along a chaise longue is longer than the others
    const typeFor = (d: number) => soft(Math.abs(d - sd) < 1 ? "Armrest" : "Chaise armrest", [a, ah, d]);
    const depthOf = (sec: Section) => sec.z1 - sec.z0;
    armKeys.push({ key: b.place(typeFor(depthOf(first)), [X(-W / 2 + a / 2), ay, (first.z0 + first.z1) / 2]), from: [X(-420), 0, 0] });
    if (!corner) armKeys.push({ key: b.place(typeFor(depthOf(last)), [W / 2 - a / 2, ay, (last.z0 + last.z1) / 2]), from: [420, 0, 0] });
    else if (frontArm) armKeys.push({ key: b.place(typeFor(sd), [X(W / 2 - sd / 2), ay, D / 2 - a / 2], [0, Math.PI / 2, 0]), from: [0, 0, 420] });
  }

  // backrests, along the back and down the outer side of a corner sofa's return
  const backs: { key: string; bolts: FitOpts[] }[] = [];
  const by = baseTop + hb / 2;
  const boltY = baseTop + 60;
  for (const sec of secs) {
    if (sec.name === "Corner section") {
      const c = b.compound(
        "Corner backrest",
        [
          { shape: "box", size: [sd, hb, backT], pos: [X(W / 2 - sd / 2), by, back + backT / 2] },
          { shape: "box", size: [backT, hb, sd - backT], pos: [X(W / 2 - backT / 2), by, back + backT + (sd - backT) / 2] },
        ],
        { material: "soft" },
      );
      const key = b.place(c.type, c.mid);
      backs.push({ key, bolts: [{ on: key, at: [X(W / 2 - sd / 2), boltY, back], dir: [0, 0, 1], mate: sec.frame }, { on: key, at: [X(W / 2), boltY, back + sd / 2], dir: [X(-1), 0, 0], mate: sec.frame }] });
    } else if (sec.along === "z") {
      const len = sec.z1 - sec.z0;
      const t = soft(`Backrest, ${sec.seats}-seat`, [len, hb, backT]);
      const key = b.place(t, [X(W / 2 - backT / 2), by, (sec.z0 + sec.z1) / 2], [0, Math.PI / 2, 0]);
      const n = len > 1600 ? 3 : 2;
      backs.push({ key, bolts: Array.from({ length: n }, (_, i) => ({ on: key, at: [X(W / 2), boltY, sec.z0 + (len * (i + 1)) / (n + 1)] as Vec3, dir: [X(-1), 0, 0] as Vec3, mate: sec.frame })) });
    } else {
      const len = sec.x1 - sec.x0;
      const t = soft(sec.name === "Chaise longue" ? "Chaise backrest" : `Backrest, ${sec.seats}-seat`, [len, hb, backT]);
      const key = b.place(t, [X((sec.x0 + sec.x1) / 2), by, back + backT / 2]);
      const n = len > 1600 ? 3 : len > 800 ? 2 : 1;
      backs.push({ key, bolts: Array.from({ length: n }, (_, i) => ({ on: key, at: [X(sec.x0 + (len * (i + 1)) / (n + 1)), boltY, back] as Vec3, dir: [0, 0, 1] as Vec3, mate: sec.frame })) });
    }
  }

  // cushions
  const seatCs: string[] = [];
  const backCs: string[] = [];
  const cd = sd - backT - 16;
  const zSeat = back + backT + 8 + cd / 2;
  const zBack = back + backT + cushT / 2 + lean;
  const yBack = seatTop + bh / 2 - 4;
  for (const sec of secs) {
    if (sec.along === "x") {
      const cw = (sec.x1 - sec.x0) / sec.seats;
      const depth = sec.z1 - sec.z0 - backT - 16;
      const isCorner = sec.name === "Corner section";
      for (let i = 0; i < sec.seats; i++) {
        const x = sec.x0 + cw * (i + 0.5);
        if (isCorner) {
          // the corner seat stops at the side backrest
          const cx = W / 2 - backT - 8 - cd / 2;
          seatCs.push(b.place(soft("Seat cushion", [cd, seatT, cd]), [X(cx), baseTop + seatT / 2, zSeat]));
          backCs.push(b.place(soft("Back cushion", [sd - backT - 14, bh, cushT]), [X(W / 2 - backT - (sd - backT) / 2), yBack, zBack], [-tilt, 0, 0]));
          continue;
        }
        const sz = sec.name === "Chaise longue" ? "Chaise cushion" : "Seat cushion";
        seatCs.push(b.place(soft(sz, [cw - 8, seatT, depth]), [X(x), baseTop + seatT / 2, back + backT + 8 + depth / 2]));
        backCs.push(b.place(soft("Back cushion", [cw - 14, bh, cushT]), [X(x), yBack, zBack], [-tilt, 0, 0]));
      }
    } else {
      const cw = (sec.z1 - sec.z0) / sec.seats;
      const cx = W / 2 - backT - 8 - cd / 2;
      for (let i = 0; i < sec.seats; i++) {
        const z = sec.z0 + cw * (i + 0.5);
        seatCs.push(b.place(soft("Seat cushion", [cw - 8, seatT, cd]), [X(cx), baseTop + seatT / 2, z], [0, Math.PI / 2, 0]));
        // thin across, leaning out against the side backrest
        backCs.push(b.place(soft("Back cushion", [cushT, bh, cw - 14]), [X(W / 2 - backT - cushT / 2 - lean), yBack, z], [0, 0, X(-tilt)]));
      }
    }
  }

  /* ---------- steps ---------- */
  const at = (key: string) => b.partItem(key).final;
  const moved = (pos: Vec3, off: Vec3): Vec3 => [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]];
  const slid = (sec: Section) => (sec.slide ? ([X(sec.slide[0]), sec.slide[1], sec.slide[2]] as Vec3) : null);

  b.step(
    {
      title: "Lay the sections upside down",
      detail: "Put a blanket or the flattened box under them first.",
      pose: "-y",
      kind: "general",
      people: 2,
      warnings: ["two", "floor"],
    },
    () => {
      b.stagger(0.3);
      for (const sec of secs) {
        const off = slid(sec);
        if (off) b.stage(sec.frame!, moved(at(sec.frame!).pos, off), at(sec.frame!).rot, [0, 220, 0]);
        else b.add(sec.frame!, [0, 220, 0]);
      }
    },
  );
  b.step(
    {
      title: "Screw in the legs",
      detail: "Clockwise by hand until each one is snug.",
      pose: "-y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.14);
      for (const sec of secs) {
        const off = slid(sec);
        for (const l of sec.legs) {
          if (off) b.stage(l, moved(at(l).pos, off), [0, 0, 0], [0, -260, 0]);
          else b.add(l, [0, -260, 0], { spin: 2 });
        }
      }
    },
  );
  // still upside down: push the sections together and screw a connector across each joint underneath
  const sliders = secs.filter((x) => x.slide);
  b.step(
    {
      title: u || straight ? "Join the sections together" : corner ? (sliders.length > 1 ? "Join the sections to the corner" : "Join the section to the corner") : sliders.length > 1 ? "Join the chaise longues to the sofa" : "Join the chaise longue to the sofa",
      detail: "Push them together, then screw a connector across each joint.",
      tools: ["screwdriver"],
      pose: "-y",
      people: 2,
      kind: "join",
      warnings: ["two"],
    },
    () => {
      b.stagger(0.35);
      for (const sec of sliders) {
        b.add(sec.frame!);
        for (const l of sec.legs) b.add(l);
        b.stagger(0);
      }
      b.then(0.1);
      const plates: FitOpts[] = [];
      const screws: FitOpts[] = [];
      const half = HW.connector.len / 4;
      for (const sec of sliders) {
        // a U's chaise longue joins the back's seats, which join the corner
        const fixed = u ? (sec.name === "Chaise longue" ? secs[1] : secs.find((x) => x.name === "Corner section")) : corner ? secs[1] : secs.find((x) => !x.slide);
        if (!fixed) continue;
        for (const f of [0.3, 0.7]) {
          if (sec.along === "z") {
            // the return meets the corner along its back edge: the connector runs front to back
            const x = X(sec.x0 + (sec.x1 - sec.x0) * f);
            plates.push({ on: sec.frame, at: [x, legH, sec.z0], dir: [0, 1, 0], twist: Math.PI / 2, hole: false });
            for (const dz of [-half, half]) screws.push({ on: sec.frame, at: [x, legH - 2, sec.z0 + dz], dir: [0, 1, 0], hole: false });
          } else {
            const jx = X(sec.x0 >= fixed.x1 - 1 ? sec.x0 : sec.x1);
            const z = back + sd * f;
            plates.push({ on: sec.frame, at: [jx, legH, z], dir: [0, 1, 0], hole: false });
            for (const dx of [-half, half]) screws.push({ on: sec.frame, at: [jx + dx, legH - 2, z], dir: [0, 1, 0], hole: false });
          }
        }
      }
      b.fits(HW.connector, plates, 0.12);
      b.then(0.1);
      b.fits(HW.screwM, screws, 0.06);
    },
  );
  b.step(
    {
      title: "Turn it over together",
      detail: "Lift it by the frame, never by the legs.",
      pose: "+y",
      kind: "flip",
      people: 2,
      warnings: ["two"],
    },
    () => {},
  );

  if (armKeys.length) {
    b.step(
      {
        title: armKeys.length > 1 ? "Bolt on the armrests" : "Bolt on the armrest",
        detail: armKeys.length > 1 ? "Line up the holes, then bolt loosely. Tighten once both arms are on." : "Line up the holes, then bolt it on firmly.",
        tools: ["allen"],
        kind: "bolts",
        warnings: armKeys.length > 1 ? ["loose"] : [],
      },
      () => {
        b.stagger(0.3);
        armKeys.forEach((k) => b.add(k.key, k.from));
        b.then(0.1);
        const bolts: FitOpts[] = [];
        for (const k of armKeys) {
          const pos = at(k.key).pos;
          const turned = at(k.key).rot[1] !== 0;
          if (!turned) {
            const sgn = Math.sign(pos[0]);
            const sec = sgn * sx < 0 ? secs[0] : secs[secs.length - 1];
            const depth = (sec.z1 - sec.z0) / 2;
            for (const f of [-0.5, 0.5]) bolts.push({ on: k.key, at: [pos[0] - (sgn * a) / 2, legH + 90, pos[2] + f * depth] as Vec3, dir: [sgn, 0, 0] as Vec3, mate: sec.frame });
          } else {
            const sec = secs[secs.length - 1];
            for (const f of [-0.25, 0.25]) bolts.push({ on: k.key, at: [pos[0] + f * sd, legH + 90, pos[2] - a / 2] as Vec3, dir: [0, 0, 1] as Vec3, mate: sec.frame });
          }
        }
        b.fits(HW.boltL, bolts, 0.1);
      },
    );
  }

  b.step(
    {
      title: "Attach the backrests",
      detail: "Slide each one down behind the seat, then bolt it from the back.",
      tools: ["allen"],
      kind: "bolts",
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.stagger(0.3);
      // the backrest of a return comes in from its side
      for (const bk of backs) b.add(bk.key, at(bk.key).rot[1] !== 0 ? [X(420), 120, 0] : [0, 120, -420]);
      b.then(0.1);
      b.fits(
        HW.boltL,
        backs.flatMap((bk) => bk.bolts),
        0.1,
      );
    },
  );
  b.step(
    {
      title: "Drop in the seat cushions",
      detail: "Zips face the back.",
      kind: "cushions",
    },
    () => {
      b.stagger(0.14);
      seatCs.forEach((k) => b.add(k, [0, 320, 0]));
    },
  );
  b.step(
    {
      title: "Add the back cushions",
      detail: "Plump them up and lean them against the backrest.",
      kind: "cushions",
    },
    () => {
      b.stagger(0.14);
      backCs.forEach((k) => b.add(k, at(k).rot[2] !== 0 ? [X(-360), 160, 0] : [0, 160, 360]));
    },
  );
}

/**
 * A corner section sold on its own, a square piece of a modular sofa: a seat frame on legs with a backrest along two sides,
 * one seat cushion and a back cushion against each side of the backrest.
 */
function cornerSection(b: PlanBuilder, s: ProductSpec) {
  const p = s.sofa ?? {};
  const W = s.size.w * 10, D = s.size.d * 10;
  const { legH, baseTop, seatT, seatTop, backH, backT, cushT, cushH: bh } = sofaDims({ ...s, sofa: { ...p, arms: "none" } }, W, D);
  const fh = baseTop - legH;
  const hb = backH - baseTop;
  const tilt = 0.12;
  const lean = (bh / 2) * Math.sin(tilt) + 4;
  const back = -D / 2;
  // the backrest runs along the back and down one side, the left unless the sofa says right
  const sx = p.corner === "right" ? 1 : -1;
  const X = (x: number) => sx * x;
  const frame = b.place(b.part("Corner section", [W, fh, D], { material: "soft" }), [0, legH + fh / 2, 0]);
  const legT = b.part("Leg", [42, legH, 42], { shape: "cyl", material: "wood" });
  const ix = Math.min(60, W / 4), iz = Math.min(70, D / 4);
  const legs = [-1, 1].flatMap((a) => [-1, 1].map((c) => b.place(legT, [a * (W / 2 - ix), legH / 2, c * (D / 2 - iz)])));
  const by = baseTop + hb / 2;
  const rest = b.compound(
    "Corner backrest",
    [
      { shape: "box", size: [W, hb, backT], pos: [0, by, back + backT / 2] },
      { shape: "box", size: [backT, hb, D - backT], pos: [X(W / 2 - backT / 2), by, back + backT + (D - backT) / 2] },
    ],
    { material: "soft" },
  );
  const backrest = b.place(rest.type, rest.mid);
  const cs = Math.min(W, D) - backT - 16;
  const seat = b.place(b.part("Seat cushion", [cs, seatT, cs], { material: "soft" }), [X(W / 2 - backT - 8 - cs / 2), baseTop + seatT / 2, back + backT + 8 + cs / 2]);
  const bcT = b.part("Back cushion", [cs - 6, bh, cushT], { material: "soft" });
  const cushions = [
    b.place(bcT, [X(W / 2 - backT - 8 - cs / 2), seatTop + bh / 2 - 4, back + backT + cushT / 2 + lean], [-tilt, 0, 0]),
    b.place(b.part("Back cushion", [cushT, bh, cs - 6], { material: "soft" }), [X(W / 2 - backT - cushT / 2 - lean), seatTop + bh / 2 - 4, back + backT + 8 + cs / 2], [0, 0, X(-tilt)]),
  ];

  b.step(
    {
      title: "Lay the section upside down",
      detail: "Put a blanket or the flattened box under it first.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
    },
    () => b.add(frame, [0, 220, 0]),
  );
  b.step(
    {
      title: "Screw in the legs",
      detail: "Clockwise by hand until each one is snug.",
      pose: "-y",
      kind: "legs",
      warnings: ["hand"],
    },
    () => {
      b.stagger(0.22);
      legs.forEach((l) => b.add(l, [0, -260, 0], { spin: 2 }));
    },
  );
  b.step({ title: "Turn it over", detail: "Lift it by the frame, never by the legs.", pose: "+y", kind: "flip" }, () => {});
  b.step(
    {
      title: "Attach the backrest",
      detail: "It runs along two sides. Slide it down behind the seat, then bolt it from the back.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {
      b.add(backrest, [X(260), 120, -300]);
      b.then(0.1);
      const boltY = baseTop + 60;
      const bolts: FitOpts[] = [
        ...[-0.25, 0.25].map((f) => ({ on: backrest, at: [f * W, boltY, back] as Vec3, dir: [0, 0, 1] as Vec3, mate: frame })),
        ...[0.35, 0.65].map((f) => ({ on: backrest, at: [X(W / 2), boltY, back + D * f] as Vec3, dir: [X(-1), 0, 0] as Vec3, mate: frame })),
      ];
      b.fits(HW.boltL, bolts, 0.1);
    },
  );
  b.step({ title: "Drop in the seat cushion", detail: "The zip faces the back.", kind: "cushions" }, () => b.add(seat, [0, 320, 0]));
  b.step(
    {
      title: "Add the back cushions",
      detail: "One against each side of the backrest. Plump them up first.",
      kind: "cushions",
    },
    () => {
      b.stagger(0.2);
      b.add(cushions[0], [0, 160, 360]);
      b.add(cushions[1], [X(-360), 160, 0]);
    },
  );
}
