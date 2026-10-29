/** Part roles, rather than furniture categories. One geometric part may have several names and roles. */
const GROUPS = [
  { id: "shelves", label: "Shelves", pattern: /\bshel(?:f|ves)\b/ },
  { id: "drawers", label: "Drawers", pattern: /\bdrawer\b/ },
  { id: "doors", label: "Doors", pattern: /\bdoor\b/ },
  { id: "panels", label: "Panels", pattern: /\b(panel|side|divider|front|back|bottom|end)\b/ },
  { id: "legs", label: "Legs", pattern: /\b(leg|foot)\b/ },
  { id: "tops", label: "Tops", pattern: /\b(top|leaf|lid|tray)\b/ },
  { id: "frames", label: "Frames", pattern: /\b(frame|underframe|upright|post|plinth|beam|stretcher|base)\b/ },
  { id: "rails", label: "Rails", pattern: /\b(rail|track|pole|support|stay|guide|slat)\b/ },
  { id: "seating", label: "Seats & cushions", pattern: /\b(seat|cushion|backrest|armrest|armchair|chair|footstool|chaise)\b/ },
  { id: "beds", label: "Bed parts", pattern: /\b(bed|headboard|footboard|slat|slatted|ladder|guard)\b/ },
] as const;

export const PART_FILTERS = [
  { id: "all", label: "All" },
  ...GROUPS.map(({ id, label }) => ({ id, label })),
  { id: "other", label: "Other" },
];

export function partGroups(names: string[]): string[] {
  const matches = GROUPS.filter(({ pattern }) => names.some((name) => pattern.test(name.toLowerCase()))).map(({ id }) => id);
  return matches.length ? matches : ["other"];
}
