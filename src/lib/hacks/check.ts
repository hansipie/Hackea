import type { Plan, ProductSpec } from "../types";
import { buildPlan } from "../plan";
import { LIMITS, boundsMm, draftToSpec, specToDraft, type HackDraft } from "./draft";
import { sanitizeDraft, type Problem } from "./sanitize";

/**
 * The rules every hack follows, curated (npm run hacks:check) or made in the editor:
 * it builds a plan, every part is added exactly once, the numbers are finite, the stated size is the parts' own,
 * and it says what it starts from. On top of that, it passes the strict reading of an imported file
 * (./sanitize.ts), so whatever the editor lets through, an export, a share link and this browser's storage read back.
 * `part` and `step` point the editor at the field to fix.
 */
export type Issue = Problem;

/** A draft from the editor: the import rules on the draft as typed, then the guide's own rules on its spec. */
export function checkDraft(id: string, d: HackDraft): { issues: Issue[]; plan: Plan | null } {
  const strict = sanitizeDraft(d).problems;
  const r = checkHack(draftToSpec(id, d), { strict: false, read: true });
  return { issues: [...strict, ...r.issues], plan: r.plan };
}

function finite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
}

/** `strict: false` leaves out the strict reading; `read` says the caller ran it already (checkDraft). */
export function checkHack(h: ProductSpec, o: { strict?: boolean; read?: boolean } = {}): { issues: Issue[]; plan: Plan | null } {
  // a curated hack meets the editor's limits too, so it can be copied into the editor and shared
  const issues: Issue[] = o.strict === false ? [] : sanitizeDraft(specToDraft(h)).problems;
  const fail = (text: string, at: { part?: string; step?: number } = {}) => issues.push({ text, ...at });
  if (!h.slug) fail("It has no slug.");
  if (!h.name.trim()) fail("Give it a name.");
  if (!h.hack) fail("It has no hack details.");
  else {
    if (!h.hack.base.length) fail("Add at least one IKEA piece it starts from.");
    if (!h.hack.summary.trim()) fail("Write a summary.");
  }
  const c = h.custom;
  if (h.archetype !== "custom" || !c) {
    fail("A hack is a custom spec.");
    return { issues, plan: null };
  }
  if (!c.parts.length) {
    fail("Add at least one part.");
    return { issues, plan: null };
  }
  if (c.steps.length > LIMITS.steps) fail(`${c.steps.length} steps: the guide follows ${LIMITS.steps} at most.`);

  for (const p of c.parts) {
    if (!finite(p.size) || !finite(p.pos)) fail(`Part ${p.id} has a size or position that is not a number.`, { part: p.id });
    else if (p.size.some((n) => n <= 0)) fail(`Part ${p.id} needs a size above 0 on every side.`, { part: p.id });
  }
  // the stated size matches the parts, to a centimetre
  const { size } = boundsMm(c.parts);
  const stated = [h.size.w, h.size.h, h.size.d];
  if (stated.some((cm, k) => !(Math.abs(size[k] / 10 - cm) <= 1)))
    fail(`Size is ${stated.join(" × ")} cm but the parts measure ${size.map((mm) => (mm / 10).toFixed(1)).join(" × ")} cm.`);

  const ids = new Set(c.parts.map((p) => p.id));
  // two parts with one id are reported by the strict reading (sanitize.ts), which checkHack and checkDraft both run;
  // a spec read without it still says so here
  if (ids.size !== c.parts.length && o.strict === false && !o.read) fail("Two parts share an id.");
  const addedAt = new Map<string, number>();
  c.steps.forEach((s, i) => {
    for (const id of s.add ?? []) {
      if (!ids.has(id)) fail(`Step ${i + 1} adds a part that doesn't exist (${id}).`, { step: i });
      else if (addedAt.has(id)) fail(`Part ${id} is added twice, in step ${addedAt.get(id)! + 1} and step ${i + 1}.`, { step: i, part: id });
      else addedAt.set(id, i);
    }
    for (const f of s.fix ?? []) for (const id of f.to ?? []) if (!ids.has(id)) fail(`Step ${i + 1} fixes into a part that doesn't exist (${id}).`, { step: i });
  });
  for (const id of ids) if (!addedAt.has(id)) fail(`Part ${id} is never added: pick the step it arrives in.`, { part: id });
  if (!c.steps.length) fail("Add at least one step.");

  let plan: Plan | null = null;
  try {
    plan = buildPlan(h);
    if (plan.steps.length < c.steps.length) fail(`${plan.steps.length} steps built for ${c.steps.length} written.`);
    if (!finite(plan.items) || !finite(plan.parts)) fail("A number in the built guide is not finite.");
  } catch (e) {
    fail(`The guide can't be built: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { issues, plan };
}

/** Every hack in a list, plus slugs that clash. */
export function checkHacks(list: ProductSpec[]): { slug: string; issues: Issue[]; plan: Plan | null }[] {
  const slugs = new Set<string>();
  return list.map((h) => {
    const r = checkHack(h);
    if (h.slug && slugs.has(h.slug)) r.issues.unshift({ text: "Duplicate slug." });
    if (h.slug) slugs.add(h.slug);
    return { slug: h.slug ?? h.name, ...r };
  });
}
