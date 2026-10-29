import type { HwKind, Plan, ToolId } from "../types";
import { stepContents, tipFor } from "../plan/contents";
import { TTS } from "./tts";

/**
 * What the hands-free voice says. Every line is one clip: the recorder renders
 * each unique line once, and the app plays them back to back. Keep lines short
 * and self-contained so they can be reused across products.
 */

/** Pre-recorded clips live under this folder, named by clipId(): one folder per voice. */
export const VOICE_DIR = `/voice/${TTS.name.toLowerCase()}`;

export const LINES = {
  on: "Voice is on. I'll read each step out loud.",
  // said once the first step has been read, when we know whether the mic is listening
  sayNext: "When you're done, just say next.",
  tapNext: "Tap done when you're ready for the next one.",
  off: "Okay, voice is off.",
  first: "This is the first step.",
  nothing: "Nothing extra for this one.",
  slower: "Okay, I'll slow down.",
  normal: "Back to normal speed.",
  commands: "You can say next, back or again. Ask how many, or say stop to quiet me.",
  checking: "One moment.",
  noAnswer: "I can't look that up right now. The help button has quick answers.",
  halfway: "You're halfway there.",
  last: "Last step.",
  two: "This one's easier with two people.",
  tip: "Kids climb, so always fix it to the wall.",
  builtGeneric: "And that's it. It's built. Well done.",
} as const;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numWords(n: number): string {
  if (n < 20) return ONES[n] ?? String(n);
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  return String(n);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentence = (s: string) => {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : t + ".";
};

function list(items: string[]) {
  if (items.length < 2) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function count(n: number, kind: HwKind, name: string) {
  const lower = name.toLowerCase().replace(/\ballen\b/, "Allen");
  // nobody counts out thirty-four nails
  if (kind === "nail") return "the nails";
  if (n === 1) return (/^[aeiou]/i.test(lower) ? "an " : "a ") + lower;
  return `${numWords(n)} ${lower}s`;
}

const HW_ORDER: HwKind[] = ["dowel", "camScrew", "cam", "legScrew", "bolt", "pin", "plate", "bracket", "runner", "hinge", "knob", "handle", "screw", "nail", "glide", "plug"];

const TOOL_SPOKEN: Record<ToolId, string> = {
  allen: "the Allen key",
  screwdriver: "the screwdriver",
  flathead: "the flat screwdriver",
  hammer: "the hammer",
  drill: "the drill",
  level: "the spirit level",
  tape: "the tape measure",
  pencil: "a pencil",
  wrench: "the spanner",
  knife: "the box cutter",
};

/** Product names arrive in capitals; say them as words, not letters. */
export function spokenName(name: string) {
  const first = name.split("/")[0].trim();
  return first
    .toLowerCase()
    .split(/\s+/)
    .map((w) => cap(w))
    .join(" ");
}

export function stepOpener(plan: Plan, i: number) {
  return i === plan.steps.length - 1 && plan.steps.length >= 2 ? LINES.last : `Step ${numWords(i + 1)}.`;
}

/** "You'll need fourteen wooden dowels and twelve cam bolts." */
export function needsLine(plan: Plan, i: number) {
  const hw = stepContents(plan, i)
    .hardware.filter((h) => !h.type.notIncluded)
    .sort((a, b) => HW_ORDER.indexOf(a.type.kind) - HW_ORDER.indexOf(b.type.kind));
  if (!hw.length) return null;
  return `You'll need ${list(hw.map((h) => count(h.count, h.type.kind, h.type.name)))}.`;
}

const TOOL_ORDER = Object.keys(TOOL_SPOKEN) as ToolId[];

/** Tools that first appear on this step. */
export function toolsLine(plan: Plan, i: number) {
  const seen = new Set(plan.steps.slice(0, i).flatMap((s) => s.tools));
  const fresh = plan.steps[i].tools.filter((t) => !seen.has(t)).sort((a, b) => TOOL_ORDER.indexOf(a) - TOOL_ORDER.indexOf(b));
  if (!fresh.length) return null;
  return `Grab ${list(fresh.map((t) => TOOL_SPOKEN[t]))}.`;
}

/** The clips for one step, in the order they are spoken. */
export function stepLines(plan: Plan, i: number): string[] {
  const s = plan.steps[i];
  const n = plan.steps.length;
  const out: string[] = [];
  if (n >= 6 && i === Math.floor(n / 2)) out.push(LINES.halfway);
  out.push(stepOpener(plan, i));
  if (s.people === 2) out.push(LINES.two);
  out.push(sentence(s.title));
  if (s.repeat && s.repeat > 1) {
    const drawers = plan.spec.archetype === "drawers";
    out.push(s.repeat === 2 && !drawers ? "Do this for both of them. The counts are for one." : `Do this for all ${numWords(s.repeat)} ${drawers ? "drawers" : "of them"}. The counts are for one.`);
  }
  const needs = needsLine(plan, i);
  if (needs) out.push(needs);
  const tools = toolsLine(plan, i);
  if (tools) out.push(tools);
  if (s.detail) out.push(sentence(s.detail));
  if (s.warnings.includes("tip")) out.push(LINES.tip);
  const tip = tipFor(plan, i);
  if (tip) out.push(sentence(tip));
  return out;
}

export function whereLine(i: number, n: number) {
  return `You're on step ${numWords(i + 1)} of ${numWords(n)}.`;
}

export function builtLine(plan: Plan) {
  return plan.spec.source === "catalog" ? `And that's it. Your ${spokenName(plan.spec.name)} is built. Well done.` : LINES.builtGeneric;
}

/** Short, stable id for a line (cyrb53), used as the clip file name. */
export function clipId(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** The first few sentences of a helper answer, as lines short enough to record live. */
export function spokenAnswer(text: string) {
  const clean = text
    .replace(/[*_#`>]/g, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const out: string[] = [];
  let total = 0;
  for (const s of (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []).map((x) => x.trim()).filter(Boolean)) {
    if (out.length && total + s.length > 360) break;
    out.push(s.slice(0, 300));
    total += s.length;
  }
  return out;
}
