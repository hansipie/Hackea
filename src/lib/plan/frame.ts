import type { Pose, ToolId, Vec3 } from "../types";
import { HW, PlanBuilder } from "./builder";

/**
 * Shared carcass used by bookcases, chests and wardrobes:
 * two full-height sides with bolts and dowels, horizontal panels with cam locks between them,
 * optional plinth and a nailed fibreboard back.
 */
export interface FrameOpts {
  W: number;
  H: number;
  D: number;
  t: number;
  base: number; // underside of the bottom panel
  plinth: boolean;
  fixed: number[]; // y centres of extra fixed shelves
  back: boolean;
  pinRows: boolean;
  lying: boolean;
  names?: { side?: string; top?: string; bottom?: string; fixed?: string };
  /** two rails across the top, front and back, instead of a top panel: room for a basin, a sink or a hob */
  rails?: boolean;
}

/** A panel joined between the sides. Rails are narrow, so they say where their dowels and bolts go. */
interface Joint {
  key: string;
  y: number;
  camDir: 1 | -1;
  face: number;
  zd?: number[];
  zb?: number[];
  /** a front rail: the back panel isn't nailed to it */
  front?: boolean;
}

export class FrameKit {
  sides!: [string, string];
  top!: string;
  bottom!: string;
  fixed: string[] = [];
  plinth?: string;
  backPanel?: string;
  pose: Pose;
  innerW: number;
  joints: Joint[] = [];
  /** the front rail, when there are rails instead of a top; `top` is then the back one */
  frontRail?: string;
  pinYs: number[] = [];

  constructor(
    public b: PlanBuilder,
    public o: FrameOpts,
  ) {
    this.pose = o.lying ? "+z" : "+y";
    this.innerW = o.W - 2 * o.t;
    this.make();
  }

  get zb() {
    const { D } = this.o;
    return D >= 300 ? D / 2 - 50 : D / 2 - 36;
  }
  get zd() {
    const { D } = this.o;
    return Math.max(D / 2 - 110, 26);
  }

  private make() {
    const { b, o } = this;
    const { W, H, D, t, base } = o;
    const sideT = b.part(o.names?.side ?? "Side panel", [t, H, D]);
    const sx = W / 2 - t / 2;
    this.sides = [b.place(sideT, [-sx, H / 2, 0]), b.place(sideT, [sx, H / 2, 0], [0, Math.PI, 0])];

    const iw = W - 2 * t;
    if (o.rails) {
      const rd = 100;
      const railT = b.part(o.names?.top ?? "Top rail", [iw, t, rd]);
      const zr = -D / 2 + rd / 2, zf = D / 2 - rd / 2;
      this.top = b.place(railT, [0, H - t / 2, zr]);
      this.frontRail = b.place(railT, [0, H - t / 2, zf]);
      this.joints.push({ key: this.top, y: H - t / 2, camDir: 1, face: H - t, zd: [zr - 22], zb: [zr + 22] });
      this.joints.push({ key: this.frontRail, y: H - t / 2, camDir: 1, face: H - t, zd: [zf + 22], zb: [zf - 22], front: true });
    } else {
      const topT = b.part(o.names?.top ?? "Top panel", [iw, t, D]);
      this.top = b.place(topT, [0, H - t / 2, 0]);
    }
    const botT = b.part(o.names?.bottom ?? "Bottom panel", [iw, t, D]);
    this.bottom = b.place(botT, [0, base + t / 2, 0]);
    if (!o.rails) this.joints.push({ key: this.top, y: H - t / 2, camDir: 1, face: H - t });
    this.joints.push({ key: this.bottom, y: base + t / 2, camDir: -1, face: base + t });
    if (o.fixed.length) {
      const fxT = b.part(o.names?.fixed ?? "Fixed shelf", [iw, t, D - 4]);
      for (const y of o.fixed) {
        const k = b.place(fxT, [0, y, -2]);
        this.fixed.push(k);
        this.joints.push({ key: k, y, camDir: 1, face: y - t / 2 });
      }
    }
    if (o.plinth && base > 0) {
      const plT = b.part("Plinth", [iw, base, t]);
      this.plinth = b.place(plT, [0, base / 2, D / 2 - t / 2 - 12]);
    }
    if (o.back) {
      const bh = H - 4;
      const bkT = b.part("Back panel", [W - 4, bh, 3], { material: "fiber" });
      this.backPanel = b.place(bkT, [0, H / 2, -D / 2 - 1.5]);
    }

    // shelf pin hole rows
    if (o.pinRows) {
      const y0 = base + t + 110;
      const y1 = H - t - 110;
      for (let y = y0; y <= y1; y += 64) {
        if (o.fixed.some((f) => Math.abs(f - y) < 50)) continue;
        this.pinYs.push(y);
        for (const [i, side] of this.sides.entries()) {
          const xi = i === 0 ? -W / 2 + t : W / 2 - t;
          const n: Vec3 = [i === 0 ? 1 : -1, 0, 0];
          for (const z of [D / 2 - 40, -D / 2 + 40]) b.hole(side, [xi, y, z], n, 2.5);
        }
      }
    }
  }

  /** Step: both sides laid flat, dowels and bolts in. */
  prepSides(extra?: () => void) {
    const { b, o } = this;
    const { W, D, t } = o;
    b.step(
      {
        title: "Fit the dowels and bolts into both sides",
        detail: "Tap the dowels in gently. Twist the bolts in by hand until they stop.",
        tools: ["hammer", "screwdriver"],
        scene: "prep",
        kind: "dowels",
        warnings: ["floor"],
      },
      () => {
        b.stagger(0.18);
        this.sides.forEach((s, i) => b.stage(s, [0, t / 2, (i === 0 ? -1 : 1) * (D / 2 + 70)], [0, 0, Math.PI / 2], [0, 120, 0]));
        b.then(0.2);
        const dowels: Parameters<PlanBuilder["fits"]>[1] = [];
        const bolts: Parameters<PlanBuilder["fits"]>[1] = [];
        this.sides.forEach((side, i) => {
          const xi = i === 0 ? -W / 2 + t : W / 2 - t;
          const into: Vec3 = [i === 0 ? -1 : 1, 0, 0];
          for (const j of this.joints) {
            for (const z of j.zd ?? [-this.zd, this.zd]) dowels.push({ on: side, at: [xi, j.y, z], dir: into, mate: j.key });
            for (const z of j.zb ?? [-this.zb, this.zb]) bolts.push({ on: side, at: [xi, j.y, z], dir: into, mate: j.key, mateHole: 4 });
          }
          if (this.plinth) dowels.push({ on: side, at: [xi, o.base / 2, D / 2 - t / 2 - 12], dir: into, mate: this.plinth });
        });
        b.fits(HW.dowel, dowels, 0.05);
        b.then(0.15);
        b.fits(HW.camScrew, bolts, 0.05);
        extra?.();
      },
    );
  }

  join(people: 1 | 2 = 1) {
    const { b, o } = this;
    b.step(
      {
        title: o.lying ? "Lay one side down and add the panels" : "Attach the panels to one side",
        detail: "The holes should face each other. Push each panel onto the dowels.",
        scene: "main",
        pose: this.pose,
        kind: "join",
        people,
        warnings: ["face"],
      },
      () => {
        b.add(this.sides[0], [-260, 0, 0]);
        b.then(0.1);
        b.stagger(0.22);
        for (const j of this.joints) b.add(j.key, [380, 0, 0]);
      },
    );
  }

  otherSide(people: 1 | 2 = 1) {
    const { b } = this;
    b.step(
      {
        title: "Add the other side",
        detail: "Line up the bolts with the holes, then press it on evenly.",
        pose: this.pose,
        kind: "join",
        people,
      },
      () => {
        b.add(this.sides[1], [420, 0, 0]);
      },
    );
  }

  cams() {
    const { b, o } = this;
    const { W, t } = o;
    b.step(
      {
        title: "Lock the cam locks",
        detail: "Drop each one in with the arrow pointing at the bolt, then turn clockwise until it bites.",
        tools: ["screwdriver"],
        pose: this.pose,
        kind: "cams",
      },
      () => {
        const list: Parameters<PlanBuilder["fits"]>[1] = [];
        for (const j of this.joints) {
          for (const x of [-W / 2 + t + 24, W / 2 - t - 24])
            for (const z of j.zb ?? [-this.zb, this.zb]) list.push({ on: j.key, at: [x, j.face, z], dir: [0, j.camDir, 0] });
        }
        b.fits(HW.cam, list, 0.07);
      },
    );
  }

  plinthStep() {
    if (!this.plinth) return;
    const { b } = this;
    b.step(
      {
        title: "Fit the plinth",
        detail: "Press it onto the dowels at the front, below the bottom panel.",
        pose: this.pose,
        kind: "join",
      },
      () => b.add(this.plinth!, [0, 0, 320]),
    );
  }

  backSteps() {
    if (!this.backPanel) return;
    const { b, o } = this;
    const { W, H, D, t, base } = o;
    const big = H > 1100 || W > 1000;
    b.step(
      {
        title: "Turn it face down",
        detail: big ? "Lift it together and lay it on the box." : "Lay it on the flattened box so the front doesn't scratch.",
        pose: "-z",
        kind: "flip",
        people: big ? 2 : 1,
        warnings: big ? ["two", "floor"] : ["floor"],
      },
      () => {},
    );
    b.step(
      {
        title: "Check that it's square",
        detail: "Measure both diagonals. Push the corners gently until they match.",
        tools: ["tape"],
        pose: "-z",
        kind: "square",
        check: "square",
        warnings: ["square"],
      },
      () => {},
    );
    b.step(
      {
        title: "Nail on the back panel",
        detail: "Start at the corners, then work along the edges.",
        tools: ["hammer"],
        pose: "-z",
        kind: "nails",
      },
      () => {
        b.add(this.backPanel!, [0, 0, -340]);
        b.then(0.25);
        const z = -D / 2 - 3;
        const list: Parameters<PlanBuilder["fits"]>[1] = [];
        const pts = (a: number, c: number, n: number) => Array.from({ length: n }, (_, i) => a + ((c - a) * i) / Math.max(1, n - 1));
        // sides
        const ny = Math.max(3, Math.round(H / 170));
        for (const [i, s] of this.sides.entries()) {
          const x = (i === 0 ? -1 : 1) * (W / 2 - t / 2);
          for (const y of pts(base + 30, H - 30, ny)) list.push({ on: s, at: [x, y, z], dir: [0, 0, 1], hole: false });
        }
        const nx = Math.max(2, Math.round((W - 2 * t) / 180));
        for (const j of this.joints) {
          if (j.front) continue;
          for (const x of pts(-W / 2 + t + 40, W / 2 - t - 40, nx)) list.push({ on: j.key, at: [x, j.y, z], dir: [0, 0, 1], hole: false });
        }
        // corners first
        list.sort((a, b2) => Math.abs(b2.at[0]) + Math.abs(b2.at[1] - H / 2) - (Math.abs(a.at[0]) + Math.abs(a.at[1] - H / 2)));
        b.fits(HW.nail, list, Math.min(0.05, 2.2 / list.length));
      },
    );
  }

  standUp() {
    const { b, o } = this;
    const big = o.H > 1000;
    b.step(
      {
        title: big ? "Stand it up together" : "Stand it up",
        detail: big ? "Lift from the top, keep the bottom on the floor, and walk it up." : "Turn it upright on a flat floor.",
        pose: "+y",
        kind: "standup",
        people: big ? 2 : 1,
        warnings: big ? ["two"] : [],
      },
      () => {},
    );
  }

  shelves(count: number) {
    if (count <= 0) return;
    const { b, o } = this;
    const { W, D, t } = o;
    const shT = b.part("Shelf", [W - 2 * t - 3, t, D - 26]);
    // choose evenly spaced pin rows
    const ys = this.pinYs;
    if (!ys.length) return;
    const slots: number[] = [];
    const gaps = this.gapsForShelves(count);
    for (const target of gaps) {
      let best = ys[0];
      for (const y of ys) if (Math.abs(y - target) < Math.abs(best - target)) best = y;
      if (!slots.includes(best)) slots.push(best);
    }
    const shelves = slots.map((y) => b.place(shT, [0, y + 3 + t / 2, 13 - 2]));
    b.step(
      {
        title: count > 1 ? "Add the shelf pins and shelves" : "Add the shelf pins and the shelf",
        detail: "Pick any height you like. Use the same hole on all four corners.",
        kind: "shelves",
      },
      () => {
        const pins: Parameters<PlanBuilder["fits"]>[1] = [];
        for (const y of slots)
          for (const [i, s] of this.sides.entries()) {
            const x = i === 0 ? -W / 2 + t : W / 2 - t;
            for (const z of [D / 2 - 40, -D / 2 + 40]) pins.push({ on: s, at: [x, y, z], dir: [i === 0 ? -1 : 1, 0, 0], hole: false });
          }
        b.fits(HW.pin, pins, 0.05);
        b.then(0.2);
        b.stagger(0.25);
        shelves.forEach((k) => b.add(k, [0, 0, 420]));
      },
    );
    return shelves;
  }

  private gapsForShelves(count: number) {
    const { H, t, base } = this.o;
    const bounds = [base + t, ...this.o.fixed, H - t].sort((a, b) => a - b);
    // distribute shelves across compartments by height
    const comps = bounds.slice(1).map((y, i) => ({ a: bounds[i], b: y, n: 0 }));
    for (let k = 0; k < count; k++) {
      comps.sort((x, y) => (y.b - y.a) / (y.n + 1) - (x.b - x.a) / (x.n + 1));
      comps[0].n++;
    }
    const out: number[] = [];
    for (const c of comps) for (let i = 1; i <= c.n; i++) out.push(c.a + ((c.b - c.a) * i) / (c.n + 1));
    return out.sort((a, b) => a - b);
  }

  anchor(top = this.top, ySurface = this.o.H, tools: ToolId[] = ["drill", "screwdriver", "pencil"]) {
    anchorStep(this.b, { W: this.o.W, D: this.o.D, top, y: ySurface, backZ: -this.o.D / 2 - (this.backPanel ? 3 : 0), tools });
  }

  /** Wall cabinets and wall shelves: the last step hangs them up. */
  hang() {
    anchorStep(this.b, { W: this.o.W, D: this.o.D, top: this.top, y: this.o.H, backZ: -this.o.D / 2 - (this.backPanel ? 3 : 0), tools: ["drill", "screwdriver", "pencil", "level"], hang: true });
  }
}

export function anchorStep(
  b: PlanBuilder,
  o: { W: number; D: number; top: string; y: number; backZ: number; tools?: ToolId[]; severe?: boolean; hang?: boolean },
) {
  const xs = o.W > 1000 ? [-o.W / 3, o.W / 3] : [0];
  b.step(
    {
      title: o.hang ? "Hang it on the wall" : "Fix it to the wall",
      detail: o.hang
        ? "Mark the height with a level first. Wall screws aren't included: pick ones made for your wall."
        : o.severe
          ? "Furniture like this can tip over if it isn't fixed. Wall screws aren't included: pick ones made for your wall."
          : "Wall screws aren't included. Pick ones made for your wall.",
      tools: o.tools ?? ["drill", "screwdriver", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      b.stagger(0.2);
      for (const x of xs) b.fit(HW.bracket, { on: o.top, at: [x, o.y, o.backZ + 16], dir: [0, -1, 0], travel: 60 });
      b.then(0.1);
      const sc: Parameters<PlanBuilder["fits"]>[1] = [];
      for (const x of xs) for (const dx of [-11, 11]) sc.push({ on: o.top, at: [x + dx, o.y + 2, o.backZ + 22], dir: [0, -1, 0], hole: false });
      b.fits(HW.screwS, sc, 0.1);
      b.then(0.1);
      for (const x of xs) b.fit(HW.plug, { at: [x, o.y + 26, o.backZ], dir: [0, 0, -1] });
      b.then(0.05);
      for (const x of xs) b.fit(HW.wallScrew, { at: [x, o.y + 26, o.backZ + 2], dir: [0, 0, -1] });
    },
  );
}
