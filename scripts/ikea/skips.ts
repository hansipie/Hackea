/**
 * Why IKEA products are skipped, to find what to draw next:
 *
 *   node --experimental-transform-types --no-warnings --import ./scripts/voice/register.mjs scripts/ikea/skips.ts            counts per reason
 *   ... scripts/ikea/skips.ts "appliance" [40]                                                                                  product types behind one reason
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { classify, type Fact } from "./classify";

const facts: Fact[] = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "facts.json"), "utf8")).products;
const [reason, top] = process.argv.slice(2);
const re = reason ? new RegExp(reason, "i") : null;
const count = new Map<string, number>();
for (const f of facts) {
  const v = classify(f, () => undefined);
  if (!("skip" in v)) continue;
  if (!re) count.set(v.skip, (count.get(v.skip) ?? 0) + 1);
  else if (re.test(v.skip)) {
    const t = f.type.toLowerCase().replace(/,?\s*(in\/)?outdoor$/, "").replace(/\d+/g, "#");
    count.set(t, (count.get(t) ?? 0) + 1);
  }
}
for (const [k, n] of [...count].sort((a, b) => b[1] - a[1]).slice(0, Number(top) || 200)) console.log(String(n).padStart(5), k);
