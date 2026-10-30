import { fold } from "./fold";
import { parseSizeText, searchBySize, unorderedSizes } from "./dimensions";

/** One individual part, sizes in mm, longest first. `slug` and `ref` say which furniture to add it from. */
export interface PartRow {
  key: string;
  name: string;
  names: string[];
  size: number[];
  material: string;
  count: number;
  slug: string;
  ref: string;
}

/** cm: parts are cut to size, so a size means more here than for a whole piece of furniture */
export const PART_TOLERANCE = 1;

/**
 * How far each part is from the sizes typed ("40x18x2", "h2 w40", "75 cm"), or null when the text is not sizes.
 * A part has no top or front, so each size matches whichever of its three is closest.
 */
export function partGaps(parts: readonly Pick<PartRow, "key" | "size">[], query: string): Map<string, number> | null {
  const q = parseSizeText(query);
  const size = q && unorderedSizes(q);
  if (!size) return null;
  const rows = parts.map((p) => ({ p, size: { w: (p.size[0] ?? 0) / 10, h: (p.size[1] ?? 0) / 10, d: (p.size[2] ?? 0) / 10 } }));
  return new Map(searchBySize(rows, { ...size, tolerance: PART_TOLERANCE }).map((r) => [r.entry.p.key, r.gap]));
}

/** Parts that match what was typed: sizes, closest first, or every word of a name, size or material, in the given order. */
export function searchParts(parts: readonly PartRow[], query: string): PartRow[] {
  const gaps = partGaps(parts, query);
  if (gaps) return parts.filter((p) => gaps.has(p.key)).sort((a, b) => (gaps.get(a.key) ?? 0) - (gaps.get(b.key) ?? 0));
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return [...parts];
  return parts.filter((p) => {
    const text = fold(`${p.names.join(" ")} ${p.size.map((n) => n / 10).join(" ")} ${p.material}`);
    return words.every((w) => text.includes(w));
  });
}
