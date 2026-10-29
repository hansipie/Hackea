import type { HwType, Item, PartType, Plan, Vec3 } from "../types";

export interface Lineup {
  plan: Plan;
  /** x centre of each product along the row, in mm */
  centers: number[];
  /** left and right ends of the row */
  span: [number, number];
}

/** Stand several finished products side by side in one scene, so they share a camera and a scale. */
export function lineup(plans: Plan[], gap = 420): Lineup {
  const parts: PartType[] = [];
  const hardware: HwType[] = [];
  const items: Item[] = [];
  const centers: number[] = [];
  const widths = plans.map((p) => Math.max(...p.items.filter((i) => i.kind === "part").map((i) => Math.abs((i as Extract<Item, { kind: "part" }>).final.pos[0])), 0) * 2 + 40);
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, plans.length - 1);
  let x = -total / 2;
  plans.forEach((p, i) => {
    const w = Math.max(widths[i], p.spec.size.w * 10);
    const cx = x + w / 2;
    const pre = `L${i}`;
    const wallSteps = new Set(p.steps.filter((s) => s.wall).map((s) => s.n));
    for (const t of p.parts) parts.push({ ...t, id: pre + t.id });
    for (const h of p.hardware) hardware.push({ ...h, id: pre + h.id });
    for (const it of p.items) {
      if (it.kind === "part") {
        const pos: Vec3 = [it.final.pos[0] + cx, it.final.pos[1], it.final.pos[2]];
        items.push({ ...it, key: pre + it.key, ref: pre + it.ref, final: { pos, rot: it.final.rot }, states: [{ step: 0, scene: "main", pos, rot: it.final.rot, delay: 0 }] });
      } else if (it.parent && !wallSteps.has(it.step)) {
        items.push({ ...it, key: pre + it.key, ref: pre + it.ref, parent: pre + it.parent, step: 0 });
      }
    }
    centers.push(cx);
    x += w + gap;
  });
  const first = plans[0];
  return {
    plan: {
      spec: { ...first.spec, name: "Workshop", variant: "" },
      parts,
      hardware,
      items,
      steps: [{ n: 0, title: "", tools: [], people: 1, scene: "main", pose: "+y", warnings: [], kind: "general", minutes: 1 }],
      tools: [],
    },
    centers,
    span: [-total / 2, total / 2],
  };
}
