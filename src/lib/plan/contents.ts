import type { HwType, PartType, Plan, StepKind, TipKey } from "../types";

const TIP_FOR: Partial<Record<StepKind, TipKey>> = {
  join: "frame",
  cams: "frame",
  dowels: "frame",
  bolts: "frame",
  nails: "back",
  square: "back",
  shelves: "shelves",
  drawer: "drawers",
  runners: "drawers",
  doors: "doors",
  hinges: "doors",
  legs: "legs",
  slats: "slats",
  anchor: "anchor",
};

/** The product tip worth showing on this step, once per topic. */
export function tipFor(plan: Plan, index: number) {
  const s = plan.steps[index];
  const key = TIP_FOR[s.kind];
  if (!key || !plan.spec.tips?.[key]) return index === 0 ? plan.spec.tips?.general : undefined;
  const first = plan.steps.findIndex((x) => TIP_FOR[x.kind] === key);
  return first === index ? plan.spec.tips[key] : undefined;
}

export interface StepContents {
  parts: { type: PartType; count: number }[];
  hardware: { type: HwType; count: number }[];
}

const memo = new WeakMap<Plan, StepContents[]>();

/** What the person needs in their hands for each step. */
export function stepContents(plan: Plan, index: number): StepContents {
  let all = memo.get(plan);
  if (!all) {
    all = plan.steps.map((s) => {
      const parts = new Map<string, number>();
      const hw = new Map<string, number>();
      if (!s.quiet)
        for (const it of plan.items) {
          if (it.kind !== "part") continue;
          const first = it.states[0];
          if (first && first.step === s.n) parts.set(it.ref, (parts.get(it.ref) ?? 0) + 1);
        }
      for (const it of plan.items) {
        if (it.kind !== "hw" || it.step !== s.n || it.preset) continue;
        hw.set(it.ref, (hw.get(it.ref) ?? 0) + 1);
      }
      return {
        parts: [...parts].map(([id, count]) => ({ type: plan.parts.find((p) => p.id === id)!, count })).filter((x) => x.type),
        hardware: [...hw].map(([id, count]) => ({ type: plan.hardware.find((h) => h.id === id)!, count })).filter((x) => x.type),
      };
    });
    memo.set(plan, all);
  }
  return all[index] ?? { parts: [], hardware: [] };
}

export function totals(plan: Plan) {
  const panels = plan.parts.filter((p) => !p.extra).reduce((s, p) => s + p.qty, 0);
  const fittings = plan.hardware.filter((h) => !h.notIncluded).reduce((s, h) => s + h.qty, 0);
  const minutes = plan.steps.reduce((s, x) => s + x.minutes, 0);
  const twoAt = plan.steps.filter((s) => s.people === 2).map((s) => s.n + 1);
  return { panels, fittings, minutes, twoAt };
}

export function floorSpace(plan: Plan) {
  const { w, h, d } = plan.spec.size;
  const a = Math.max(w, h) + 100;
  const b = Math.max(d, Math.min(w, h)) + 100;
  const r = (x: number) => Math.max(1, Math.round(x / 50) / 2);
  return `${r(a)} × ${r(b)} m`;
}
