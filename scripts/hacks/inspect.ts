/**
 * Prints what the engine made of a hack, step by step: the parts that arrive and the fittings it placed.
 *
 *   npm run hacks:inspect -- hack-kallax-cabinet-doors
 */
import { HACKS } from "@/data/hacks";
import { buildPlan } from "@/lib/plan";

const slug = process.argv[2];
for (const h of HACKS.filter((x) => !slug || x.slug === slug)) {
  const plan = buildPlan(h);
  const hw = new Map(plan.hardware.map((t) => [t.id, t]));
  const partOf = new Map(plan.items.filter((i) => i.kind === "part").map((i) => [i.key, i]));
  console.log(`\n${h.slug}  ${h.size.w} × ${h.size.h} × ${h.size.d} cm  ${plan.parts.length} part types, ${plan.hardware.length} fitting types`);
  plan.steps.forEach((s, i) => {
    const arriving = plan.items.filter((it) => it.kind === "part" && it.states[0]?.step === i).length;
    const fits = new Map<string, number>();
    for (const it of plan.items) {
      if (it.kind !== "hw" || it.step !== i) continue;
      const t = hw.get(it.ref);
      const host = it.parent ? partOf.get(it.parent) : undefined;
      const on = host ? plan.parts.find((p) => p.id === host.ref)?.name : "scene";
      const k = `${t?.kind} ${t?.spec} on ${on}`;
      fits.set(k, (fits.get(k) ?? 0) + 1);
    }
    console.log(`  ${i + 1}. ${s.title} [${s.kind}, ${s.pose}${s.people === 2 ? ", 2 people" : ""}] +${arriving} parts` + [...fits].map(([k, n]) => `\n       ${n} × ${k}`).join(""));
  });
}
