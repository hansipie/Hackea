/** IKEA's shorthand in product names, spelled out: "Base cab f hob/2 frnts" reads "Base cabinet for hob/2 fronts". */
const SHORTHAND: [RegExp, string][] = [
  [/\s*\+\s*/g, " and "],
  [/\b(cab|cb)\b/gi, "cabinet"],
  [/\bhi\b/gi, "high"],
  [/\bf\b/g, "for"],
  [/\bwsh-stnd\b/gi, "wash-stand"],
  [/\bstnd\b/g, "stand"],
  [/\bsnk\b/g, "sink"],
  [/\bov\b/g, "oven"],
  [/\bextr\b/g, "extractor"],
  [/\bb-in\b/g, "built-in"],
  [/\bfrnts\b/g, "fronts"],
  [/\bfrnt\b/g, "front"],
  [/\b(drws|drwrs)\b/g, "drawers"],
  [/\bdrw\b/g, "drawer"],
  [/\bdr\b/g, "door"],
  [/\b(\d) m\b/g, "$1 medium"],
  [/\bmd\b/g, "medium"],
  [/\bfr\b/g, "frame"],
  [/\b(\d) h\b/g, "$1 high"],
  [/\bshlf\b/g, "shelf"],
  [/\bshlvs?\b/g, "shelves"],
  [/\bp-out\b/g, "pull-out"],
  [/\bhght\b/g, "height"],
  [/\bext ut\b/g, "extension unit"],
  [/\bpnl\b/g, "panel"],
  [/\bglss\b/g, "glass"],
];

export function spellOut(t: string) {
  return SHORTHAND.reduce((acc, [re, word]) => acc.replace(re, word), t)
    .replace(/(^|\s)w (?=\S)/gi, "$1with ")
    .replace(/\bdrs\b/g, "doors")
    .replace(/(\d) seat\b/g, "$1-seat");
}
