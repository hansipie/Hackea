/** Size search: which pieces match a space or a size, from any of height, width and depth (cm). */

export interface Sized {
  size: { w: number; h: number; d: number };
}

export interface SizeQuery {
  w?: number;
  h?: number;
  d?: number;
  /** sizes with no label ("80 x 40"): each one matches a different axis, whichever fits, so a piece turned on its side is found too */
  any?: number[];
  /** "about": within `tolerance` of each size given. "within": no bigger than each size given, as for a gap to fill. */
  mode?: "about" | "within";
  /** cm, for "about" */
  tolerance?: number;
}

export const DEFAULT_TOLERANCE = 5;
const AXES = ["w", "h", "d"] as const;

/** A positive number of cm from what someone typed ("77", "77,5"), or undefined when it is empty or not a size. */
export function parseCm(text: string): number | undefined {
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : undefined;
}

export function hasSize(q: SizeQuery) {
  return AXES.some((a) => q[a] !== undefined) || !!q.any?.length;
}

const NUM = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;
const LABELS: [RegExp, "h" | "w" | "d"][] = [
  [/\b(?:height|hauteur|haut|h)\s*[:=]?\s*NUM(?:\s*cm)?/i, "h"],
  [/\b(?:width|largeur|larg|w|l)\s*[:=]?\s*NUM(?:\s*cm)?/i, "w"],
  [/\b(?:depth|profondeur|prof|d|p)\s*[:=]?\s*NUM(?:\s*cm)?/i, "d"],
].map(([re, a]) => [new RegExp((re as RegExp).source.replace("NUM", NUM), "i"), a as "h" | "w" | "d"]);
const UNLABELLED = new RegExp(String.raw`^${NUM}(?:\s*cm)?(?:\s*[x×*]\s*${NUM}(?:\s*cm)?){1,2}$`, "i");
const SINGLE = new RegExp(String.raw`^${NUM}\s*cm$`, "i");

/**
 * A size query from what someone typed in a search bar, or null when it is a name or an article number.
 * Labelled ("h100 w80", "height 100, depth 40") sizes are exact axes; "80 x 40 x 100" sizes match any axes.
 * A bare number is not a size (it could be part of an article number) unless it says cm.
 */
export function parseSizeText(text: string): SizeQuery | null {
  let rest = text.trim().toLowerCase();
  if (!rest || rest.length > 60) return null;
  const q: SizeQuery = {};
  for (const [re, axis] of LABELS) {
    const m = re.exec(rest);
    if (!m) continue;
    const n = parseCm(m[1]);
    if (n === undefined || q[axis] !== undefined) return null;
    q[axis] = n;
    rest = rest.replace(m[0], " ");
  }
  rest = rest.replace(/;|,(?!\d)|(?<!\d),/g, " ").replace(/\s+/g, " ").trim();
  if (rest) {
    if (hasSize(q)) return null;
    const nums = UNLABELLED.test(rest) ? rest.match(/\d{1,4}(?:[.,]\d{1,2})?/g) : SINGLE.test(rest) ? rest.match(/\d{1,4}(?:[.,]\d{1,2})?/g) : null;
    const any = nums?.map(parseCm);
    if (!any || any.some((n) => n === undefined)) return null;
    q.any = any as number[];
  }
  return hasSize(q) ? q : null;
}

/** every way to hand the sizes to the axes that are free */
function assignments(free: readonly ("w" | "h" | "d")[], n: number): ("w" | "h" | "d")[][] {
  if (n === 0) return [[]];
  return free.flatMap((a) => assignments(free.filter((x) => x !== a), n - 1).map((rest) => [a, ...rest]));
}

/**
 * The entries that match, closest first. The gap is the sum of the differences on the sizes given,
 * so a piece off by 1 cm on two sizes comes before one off by 4 cm on one. In "within" mode the
 * biggest piece that still fits comes first. Ties keep the catalogue's order.
 */
export function searchBySize<T extends Sized>(entries: readonly T[], q: SizeQuery): { entry: T; gap: number }[] {
  const given = AXES.filter((a) => q[a] !== undefined);
  const any = q.any ?? [];
  const free = AXES.filter((a) => q[a] === undefined);
  if (!given.length && !any.length) return [];
  if (any.length > free.length) return [];
  const tol = q.tolerance ?? DEFAULT_TOLERANCE;
  /** the gap between a size wanted and the one a piece has, or null when it does not match */
  const off = (want: number, have: number) => {
    if (q.mode === "within") return have > want ? null : want - have;
    const d = Math.abs(have - want);
    return d > tol ? null : d;
  };
  const turns = assignments(free, any.length);
  const out: { entry: T; gap: number; i: number }[] = [];
  entries.forEach((entry, i) => {
    let gap = 0;
    for (const a of given) {
      const g = off(q[a] as number, entry.size[a]);
      if (g === null) return;
      gap += g;
    }
    let best = Infinity;
    for (const turn of turns) {
      let sum = 0;
      for (let k = 0; k < turn.length && sum < best; k++) {
        const g = off(any[k], entry.size[turn[k]]);
        if (g === null) { sum = Infinity; break; }
        sum += g;
      }
      best = Math.min(best, sum);
    }
    if (best === Infinity) return;
    out.push({ entry, gap: gap + best, i });
  });
  return out.sort((x, y) => x.gap - y.gap || x.i - y.i).map(({ entry, gap }) => ({ entry, gap }));
}

/** The query as a URL query string for /size, and back (see `sizeFromParams`). */
export function sizeParams(q: SizeQuery): string {
  const p = new URLSearchParams();
  for (const a of AXES) if (q[a] !== undefined) p.set(a, String(q[a]));
  if (q.any?.length) p.set("any", q.any.join(","));
  if (q.mode === "within") p.set("mode", "within");
  return p.toString();
}

export function sizeFromParams(get: (key: string) => string | undefined): SizeQuery {
  const q: SizeQuery = { mode: get("mode") === "within" ? "within" : "about" };
  for (const a of AXES) q[a] = parseCm(get(a) ?? "");
  const any = (get("any") ?? "").split(",").map(parseCm).filter((n): n is number => n !== undefined);
  if (any.length) q.any = any.slice(0, 3);
  return q;
}
