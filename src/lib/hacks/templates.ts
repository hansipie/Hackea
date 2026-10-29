import type { CustomStep } from "../types";
import { HACKS } from "@/data/hacks";
import { billyFrame, kallaxGrid } from "@/data/hacks/parts";
import { catalogSpec } from "../catalog";
import { specToDraft, type HackDraft } from "./draft";

/** Starting points for the editor: an empty board, an IKEA frame drawn as parts, or a copy of a curated hack. */

const common = { minutes: 60, people: 1 as const, difficulty: 2 as const, buy: [], mods: [], watchOut: [] };

export function blankDraft(): HackDraft {
  return {
    ...common,
    name: "My hack",
    variant: "",
    category: "Hack",
    summary: "",
    base: [],
    parts: [{ id: "top", label: "A", name: "Top", size: [800, 18, 400], pos: [0, 9, 0], material: "board" }],
    steps: [{ title: "Lay out the top", add: ["top"] }],
  };
}

const cm = (mm: number) => Math.round(mm / 10);

export function kallaxDraft(cols: number, rows: number): HackDraft {
  const c = Math.min(5, Math.max(1, Math.round(cols)));
  const r = Math.min(5, Math.max(1, Math.round(rows)));
  const g = kallaxGrid(c, r);
  const slug = `kallax-${c}x${r}`;
  return {
    ...common,
    name: "My KALLAX hack",
    variant: `Starts from a KALLAX ${c} × ${r}`,
    category: "Shelving",
    summary: "",
    base: [{ name: `KALLAX shelving unit, ${cm(g.size[0])} × ${cm(g.size[1])} cm`, ...(catalogSpec(slug) ? { slug } : {}), qty: 1 }],
    parts: g.parts,
    steps: g.steps,
  };
}

export function billyDraft(units: number): HackDraft {
  const n = Math.min(4, Math.max(1, Math.round(units)));
  const frames = Array.from({ length: n }, (_, i) => billyFrame(String.fromCharCode(97 + i), (i - (n - 1) / 2) * 800));
  const which = (i: number) => (n === 1 ? "" : ` ${i + 1}`);
  const steps: CustomStep[] = frames.flatMap((f, i): CustomStep[] => [
    { title: `Build frame${which(i)}`, detail: "Follow the BILLY manual for the frame, and leave the back in the box for now.", add: f.ids.frame, fix: [{ kind: "dowel", count: 8 }, { kind: "camScrew", count: 4 }], people: 2 },
    { title: `Fit the shelves${which(i)}`, add: f.ids.shelves, fix: [{ kind: "pin", count: 4 * f.ids.shelves.length }] },
    { title: `Nail on the back${which(i)}`, detail: "Square the frame with the back panel as you nail it.", add: [f.back.id], fix: [{ kind: "nail", count: 18 }], tools: ["hammer"], warnings: ["square"] },
  ]);
  return {
    ...common,
    minutes: 60 * n,
    people: 2,
    name: "My BILLY hack",
    variant: n === 1 ? "Starts from a BILLY 80 × 202 cm" : `Starts from ${n} BILLY bookcases side by side`,
    category: "Bookcase",
    summary: "",
    base: [{ name: "BILLY bookcase, 80 × 202 cm", ...(catalogSpec("billy-80x202") ? { slug: "billy-80x202" } : {}), qty: n }],
    parts: frames.flatMap((f) => [...f.frame, ...f.shelves, f.back]),
    steps,
  };
}

/** The curated hacks, as drafts to start from. */
export const CURATED = HACKS.map((h) => ({ slug: h.slug!, name: h.name, draft: () => ({ ...specToDraft(h), name: `${h.name}, my version`.slice(0, 60) }) }));
