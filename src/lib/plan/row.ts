import type { HwItem, PartItem, ProductSpec, Step, Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";
import { clamp, rotate, toWorld } from "./math";
import { slidingDoors } from "./sliding";

const UNIT: Record<string, [string, string]> = {
  bookcase: ["bookcase", "bookcases"],
  tv: ["TV bench", "TV benches"],
  wardrobe: ["wardrobe", "wardrobes"],
  wallcab: ["wall cabinet", "wall cabinets"],
  cabinet: ["cabinet", "cabinets"],
};
const COUNT = ["", "", "two", "three", "four"];

/**
 * Several identical frames side by side (two BILLY bookcases, two BESTÅ TV benches, a row of PAX wardrobes).
 * The first is built step by step exactly as its own guide does, the others the same way off to the side;
 * then they're pushed together (and screwed to each other through their sides when IKEA joins them),
 * and fixed to the wall last, every one of them.
 */
export function buildRow(b: PlanBuilder, s: ProductSpec, one: (b: PlanBuilder, s: ProductSpec) => void) {
  const n = clamp(Math.round(s.row?.n ?? 2), 2, 4);
  const join = !!s.row?.join;
  const W = s.size.w * 10, H = s.size.h * 10;
  const uw = W / n;
  const { row, ...rest } = s;
  void row;
  // a pair of sliding doors runs in front of the frames, so the frames are that much shallower
  const slide = s.row?.slide;
  const unit: ProductSpec = { ...rest, size: { w: s.size.w / n, h: s.size.h, d: slide ? s.size.d - 8 : s.size.d } };
  one(b, unit);
  const [what, whats] = UNIT[s.row?.of ?? (s.archetype === "shelf" ? "bookcase" : "cabinet")] ?? ["one", "others"];

  // the first one's wall fixing waits until they all stand together
  let anchor: { def: Step; items: HwItem[] } | undefined;
  const lastStep = b.steps[b.steps.length - 1];
  if (lastStep?.kind === "anchor") {
    const items = b.items.filter((it): it is HwItem => it.kind === "hw" && it.step === lastStep.n);
    b.items = b.items.filter((it) => !(it.kind === "hw" && it.step === lastStep.n));
    for (const it of items) b.map.delete(it.key);
    b.steps.pop();
    anchor = { def: lastStep, items };
  }

  // the first one stands at the left end of the row
  const dx0 = -W / 2 + uw / 2;
  const shift = (p: Vec3, dx: number): Vec3 => [p[0] + dx, p[1], p[2]];
  const parts = b.items.filter((it): it is PartItem => it.kind === "part");
  for (const it of parts) {
    const old = it.final.pos;
    it.final = { pos: shift(old, dx0), rot: it.final.rot };
    for (const st of it.states) if (st.scene === "main") st.pos = st.pos === old ? it.final.pos : shift(st.pos, dx0);
  }
  for (const it of b.items) if (it.kind === "hw" && !it.parent && it.scene === "main") it.pos = shift(it.pos, dx0);
  const fitted = b.items.filter((it): it is HwItem => it.kind === "hw" && !!it.parent);

  // how long the first one took, to weigh the others by
  const own = b.steps.reduce((sum, st) => sum + weightOf(b, st), 0);

  /* ---------- the others, built the same way ---------- */
  const copies = new Map<string, string[]>(parts.map((it) => [it.key, []]));
  const gap = 160;
  b.step(
    {
      title: n > 2 ? `Build the other ${COUNT[n - 1]} ${whats} the same way` : `Build the second ${what} the same way`,
      detail: n > 2 ? "Every step as for the first one. Stand each one next to the last." : "Every step as for the first one. Stand it next to the first.",
      kind: "general",
      people: s.people,
      weight: own * (n - 1) * 0.85,
    },
    () => {
      for (let k = 1; k < n; k++) {
        b.stagger(0);
        for (const it of parts) {
          const pos = shift(it.final.pos, k * uw);
          const key = b.place(it.ref, pos, it.final.rot);
          b.partItem(key).holes = it.holes.map((h) => ({ p: [...h.p] as Vec3, n: [...h.n] as Vec3, r: h.r }));
          copies.get(it.key)!.push(key);
          b.stage(key, shift(pos, k * gap), it.final.rot, [520, 0, 0]);
        }
        // its fittings are in already
        for (const h of fitted) {
          const ht = b.hw.get(h.ref)!;
          const key = copies.get(h.parent!)![k - 1];
          const f = b.partItem(key).final;
          const k2 = b.preset({ kind: ht.kind, len: ht.len, dia: ht.dia, notIncluded: ht.notIncluded }, { on: key, at: toWorld(h.pos, f.pos, f.rot), dir: rotate(h.dir, f.rot), twist: h.twist, scale: h.scale, hole: false });
          const c = b.map.get(k2) as HwItem;
          c.spin = h.spin;
          c.turn = h.turn;
        }
        b.wait(0.35);
      }
    },
  );

  /* ---------- pushed together ---------- */
  const frameOf = (orig: string, k: number) => (k === 0 ? orig : copies.get(orig)![k - 1]);
  const sides = parts.filter((it) => b.parts.find((p) => p.id === it.ref)?.name === "Side panel");
  const left = sides.reduce<PartItem | undefined>((a, it) => (!a || it.final.pos[0] < a.final.pos[0] ? it : a), undefined);
  const right = sides.reduce<PartItem | undefined>((a, it) => (!a || it.final.pos[0] > a.final.pos[0] ? it : a), undefined);
  const screws = join && left && right && left !== right;
  b.step(
    {
      title: screws ? "Push them together and screw them to each other" : "Push them together",
      detail: screws ? "Line up the fronts and the tops, then screw through the sides." : "Line up the fronts and the tops, side by side against the wall.",
      tools: screws ? ["screwdriver"] : [],
      people: 2,
      kind: "join",
      warnings: ["two"],
      weight: screws ? 1.2 + 0.4 * (n - 1) : 1,
    },
    () => {
      b.stagger(0);
      for (const list of copies.values()) for (const key of list) b.add(key);
      if (!screws) return;
      b.then(0.15);
      const t = b.parts.find((p) => p.id === right.ref)!.size[0];
      const ys = (H > 1500 ? [0.12, 0.38, 0.62, 0.88] : H > 700 ? [0.2, 0.5, 0.8] : [0.3, 0.7]).map((f) => Math.round(H * f));
      const list: FitOpts[] = [];
      for (let k = 0; k < n - 1; k++) {
        const x = -W / 2 + (k + 1) * uw - t;
        for (const y of ys) list.push({ on: frameOf(right.key, k), at: [x, y, (unit.size.d * 10) / 2 - 60], dir: [1, 0, 0], mate: frameOf(left.key, k + 1) });
      }
      b.fits(HW.screwM, list, 0.08);
    },
  );

  /* ---------- sliding doors across the whole row ---------- */
  if (slide) slidingDoors(b, { span: W, n: slide, topY: H, botY: 0, zFront: (unit.size.d * 10) / 2, front: true });

  /* ---------- every one fixed to the wall ---------- */
  if (anchor) {
    const a = anchor;
    b.step(
      { title: a.def.title.replace(/\bit\b/, "them"), detail: a.def.detail, tools: a.def.tools, people: a.def.people, kind: a.def.kind, warnings: a.def.warnings, wall: a.def.wall },
      () => {
        b.stagger(0.12);
        for (const h of a.items) {
          const ht = b.hw.get(h.ref)!;
          const def = { kind: ht.kind, len: ht.len, dia: ht.dia, notIncluded: ht.notIncluded };
          for (let k = 0; k < n; k++) {
            if (h.parent) {
              const key = frameOf(h.parent, k);
              const f = b.partItem(key).final;
              b.fit(def, { on: key, at: toWorld(h.pos, f.pos, f.rot), dir: rotate(h.dir, f.rot), travel: h.travel, spin: h.spin, twist: h.twist, hole: false });
            } else b.fit(def, { at: shift(h.pos, dx0 + k * uw), dir: h.dir, travel: h.travel, spin: h.spin, twist: h.twist });
          }
        }
      },
    );
  }
}

/** The builder's own estimate of a step's work, before minutes are shared out. */
function weightOf(b: PlanBuilder, s: Step) {
  if (s.minutes) return s.minutes;
  if (s.quiet) return 1.6;
  const parts = b.items.filter((i) => i.kind === "part" && i.states[0]?.step === s.n).length + b.items.filter((i) => i.kind === "part" && i.states.length > 1 && i.states.some((x, k) => k > 0 && x.step === s.n)).length * 0.5;
  const hws = b.items.filter((i) => i.kind === "hw" && i.step === s.n && !i.preset).length;
  return (0.8 + parts * 0.6 + hws * 0.12) * (s.repeat ?? 1);
}
