import type { ProductSpec } from "./types";

export type Phase = "cover" | "tools" | "parts" | "steps" | "done";

export interface Progress {
  slug: string;
  name: string;
  variant: string;
  phase: Phase;
  step: number;
  steps: number;
  tools: string[];
  parts: string[];
  missing?: string[];
  category?: string;
  minutes?: number;
  people?: 1 | 2;
  startedAt?: number;
  doneAt?: number;
  updatedAt: number;
  spec?: ProductSpec;
  /** Time actually spent building, with long breaks left out. */
  activeMs?: number;
  /** Steps that were on screen at least once. */
  seen?: number[];
  /** First time it was finished, and how: survives reviewing the steps or building it again. */
  builtAt?: number;
  builtMs?: number;
  builtFull?: boolean;
}

/** Built at least once. Older saves only knew the phase. */
export const isBuilt = (p: Progress) => !!p.builtAt || p.phase === "done";

/** A gap longer than this between taps counts as a break, not building time. */
export const BREAK_MS = 20 * 60_000;

/** Minutes a build took, only when every step was followed and it took at least a fifth of the typical time (not tapped through). */
export function buildMinutes(ms: number | undefined, full: boolean | undefined, typical: number): number | null {
  if (!full || !ms) return null;
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= typical * 0.2 ? m : null;
}

const KEY = "hackea:builds";

function read(): Record<string, Progress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(all: Record<string, Progress>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked */
  }
}

export function loadProgress(slug: string): Progress | null {
  return read()[slug] ?? null;
}

export function saveProgress(p: Progress) {
  const all = read();
  all[p.slug] = { ...p, updatedAt: Date.now() };
  write(all);
}

export function removeProgress(slug: string) {
  const all = read();
  delete all[slug];
  write(all);
}

export function listProgress(): Progress[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

const SPEC_KEY = "hackea:spec:";
export function cacheSpec(slug: string, spec: ProductSpec) {
  try {
    localStorage.setItem(SPEC_KEY + slug, JSON.stringify(spec));
  } catch {
    /* ignore */
  }
}
export function uncacheSpec(slug: string) {
  try {
    localStorage.removeItem(SPEC_KEY + slug);
  } catch {
    /* ignore */
  }
}
export function cachedSpec(slug: string): ProductSpec | null {
  try {
    const s = localStorage.getItem(SPEC_KEY + slug);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function getPref<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem("hackea:pref:" + k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
export function setPref(k: string, v: unknown) {
  try {
    localStorage.setItem("hackea:pref:" + k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
