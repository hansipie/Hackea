/**
 * Checks a hack exported from the editor (a .hackea.json file) with the same rules as the editor and hacks:check,
 * before it is turned into a curated hack in src/data/hacks.
 *
 *   npm run hacks:validate -- my-bench.hackea.json
 */
import { readFileSync } from "node:fs";
import { catalogSpec } from "@/lib/catalog";
import { checkHack } from "@/lib/hacks/check";
import { draftToSpec } from "@/lib/hacks/draft";
import { parseHackText } from "@/lib/hacks/sanitize";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npm run hacks:validate -- <file.json> [more.json]");
  process.exit(2);
}
let failed = 0;
for (const f of files) {
  const r = parseHackText(readFileSync(f, "utf8"), (slug) => !!catalogSpec(slug));
  if (!r.draft) {
    failed++;
    for (const e of r.errors) console.error(`FAIL ${f}: ${e}`);
    continue;
  }
  const { issues, plan } = checkHack(draftToSpec("validate01", r.draft));
  if (issues.length) failed++;
  for (const i of issues) console.error(`FAIL ${f}: ${i.text}`);
  if (!issues.length) console.log(`ok  ${f}: ${r.draft.name}, ${plan?.parts.length} part types, ${plan?.steps.length} steps`);
}
if (failed) process.exit(1);
