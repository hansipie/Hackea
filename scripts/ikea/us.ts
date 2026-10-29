/**
 * IKEA's US range, read the way the UK one is: its measures in centimetres and its type names in UK words, so the same
 * rules in classify.ts decide what each product is. Used by build.ts for facts-us.json (from fetch.ts --market us).
 */
import type { Fact } from "./classify";

/** US mattress sizes in cm, by the name IKEA US gives a bed frame's size. A US King is wider than a UK one. */
const US_BEDS: Record<string, string> = {
  twin: "97x191 cm",
  "twin xl": "97x203 cm",
  full: "137x191 cm",
  "full/double": "137x191 cm",
  "full/queen": "152x203 cm",
  "full/queen (double/queen)": "152x203 cm",
  double: "137x191 cm",
  queen: "152x203 cm",
  king: "193x203 cm",
  "california king": "183x213 cm",
};

const INCH = 2.54;
const FRACTIONS: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3" };

/** One measure in inches with an optional fraction ("30 3/8", "15", "3/4"), in cm, to the nearest half. */
function inches(t: string): number | null {
  const m = t.trim().match(/^(?:(\d+(?:\.\d+)?)(?: (\d+)\/(\d+))?|(\d+)\/(\d+))$/);
  if (!m) return null;
  const v = m[4] ? Number(m[4]) / Number(m[5]) : Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
  return Math.round(v * INCH * 2) / 2;
}

/**
 * A measure in inches ("30 3/8x15 3/8 \"", "29 1/8/52 3/4x31 1/2 \"" for a table that opens out), or in inches and cm
 * together, as the cm text the UK range uses ("77x39 cm"). A cm measure comes back as it is. Null when it can't be read.
 */
export function metric(s: string): string | null {
  // fractions written as one character: "29 ½" is "29 1/2"
  const t = s
    .replace(/\s+/g, " ")
    .replace(/ ?([½¼¾⅛⅜⅝⅞⅓⅔])/g, (_m, c: string) => ` ${FRACTIONS[c]}`)
    .replace(/(^|x) /g, "$1")
    .trim();
  if (!t) return t;
  // inches and centimetres together: the centimetres are exact
  const cm = t.match(/(\d[\d./ x-]*?) ?cm\b/);
  if (cm && /"/.test(t)) return `${cm[1].replace(/ /g, "")} cm`;
  if (!/"$/.test(t)) return t;
  const body = t.replace(/ ?"$/, "");
  const dims = body.split("x").map((d) => {
    // a dimension can give two sizes, closed and open: "29 1/8/52 3/4". Split where a whole number starts a new one.
    const parts = d.trim().match(/\d+\/\d+(?!\d)|\d+(?:\.\d+)?(?: \d+\/\d+)?/g) ?? [];
    // anything else in it (a range, feet) can't be read
    if (parts.join("/") !== d.trim().replace(/\s*\/\s*(?=\d+(?:\.\d+)? |\d+(?:\.\d+)?$)/g, "/")) return null;
    const vals = parts.map(inches);
    return vals.some((v) => v === null) || !vals.length ? null : (vals as number[]).join("/");
  });
  if (dims.some((d) => d === null)) return null;
  return `${dims.join("x")} cm`;
}

/** US type names in the words the UK range uses, so the same rules read them. */
const US_TYPES: [RegExp, string][] = [
  [/ & /g, "/"],
  [/\bw\/ ?/g, "with "],
  [/^(\d+)-drawer (?:dresser|chest)$/, "chest of $1 drawers"],
  [/^(\d+)-drawer (?:dresser|chest) with (.+)$/, "chest of $1 drawers with $2"],
  [/^dresser$/, "chest of drawers"],
  [/^(\d+)-drawer nightstand$/, "bedside table with $1 drawers"],
  [/^(\d+)-drawer (?:unit|cabinet)$/, "drawer unit with $1 drawers"],
  [/^end table$/, "side table"],
  [/^sleeper sofa$/, "sofa-bed"],
  [/^(\d)-seat sleeper sofa$/, "$1-seat sofa-bed"],
  [/^sleeper loveseat$/, "2-seat sofa-bed"],
  [/^loveseat$/, "2-seat sofa"],
  [/^sleeper chair$/, "chair-bed"],
  [/^(?:sleeper )?sectional,? (\d)-seat(?: corner)?$/, "corner sofa, $1-seat"],
  [/^(?:sleeper )?sectional,? (\d)-seat with chaise$/, "corner sofa, $1-seat with chaise longue"],
  [/^sofa with chaise$/, "3-seat sofa with chaise longue"],
  [/^(\d)-seat sofa with chaise$/, "$1-seat sofa with chaise longue"],
  [/^chaise$/, "chaise longue section"],
  [/^tv (?:unit|stand)$|^media console$/, "tv bench"],
  [/^tv (?:unit|stand) with (\d) doors$/, "tv bench with $1 doors"],
  [/^armoire$/, "wardrobe"],
  [/^crib( with drawer)?$/, "cot$1"],
  [/^counter stool(?: with backrest)?$/, "bar stool"],
  [/^ottoman$/, "pouffe"],
  [/^ottoman with storage$/, "footstool with storage"],
  [/^daybed/, "day-bed"],
  [/^corner base cabinet with lazy susan$/, "corner base cabinet with carousel"],
  [/^base cabinet for sink with (\d) doors$/, "base cabinet for sink + $1 doors"],
  [/^pouf( with storage)?$/, "pouffe$1"],
  [/^high back armchair$/, "high-back armchair"],
  [/^rocking chair$/, "rocking-chair"],
  [/^armchair and ottoman$/, "armchair and footstool"],
  [/^(?:kitchen|utility) cart$/, "kitchen trolley"],
  [/^bathroom vanity(?= with| w |$)/, "wash-stand"],
  [/^(\d)\.5-seat mod(?:ular)? sofa$/, "$1,5-seat modular sofa"],
  [/^drawer unit\/drop file storage$/, "drawer unit with drop-file storage"],
  [/^loveseat sleeper section$/, "2-seat sofa-bed section"],
  [/^loveseat section$/, "2-seat section"],
  [/^chaise section$/, "chaise longue section"],
  [/^chaise module, (left|right)$/, "chaise longue module, $1"],
  [/^chaise, add-on unit$/, "chaise longue, add-on unit"],
  [/^(?:corner )?sectional,? (\d)-seat (?:w chaise|crn\/chaise)$/, "corner sofa, $1-seat with chaise longue"],
  [/^child's desk chair$/, "children's desk chair"],
  [/^(\d) section shelving unit$/, "$1 sections/shelves"],
  [/^base cab f cktp\//, "base cab f hob/"],
];

/** A US fact read the way a UK one is: its type in UK words and its measure in cm. Null when its size can't be read. */
export function asUk(f: Fact): Fact | null {
  const size = US_BEDS[f.size.trim().toLowerCase()] ?? metric(f.size);
  if (size === null) return null;
  // ", outdoor" stays at the end, where the UK rules look for it
  const raw = f.type.replace(/\s+/g, " ").trim().toLowerCase();
  const out = raw.match(/,?\s*(in\/)?outdoor$/)?.[0] ?? "";
  let type = raw.slice(0, raw.length - out.length);
  for (const [re, to] of US_TYPES) type = type.replace(re, to);
  type += out;
  return { ...f, type: type.charAt(0).toUpperCase() + type.slice(1), size };
}

/** The US name of a bed size ("Queen"), to say alongside its size in cm. */
export function usBedName(size: string): string | undefined {
  const k = size.trim().toLowerCase();
  if (!US_BEDS[k]) return undefined;
  return size.trim().replace(/\s*\(.*\)$/, "");
}
