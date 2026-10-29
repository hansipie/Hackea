/**
 * Draws the pictures the share cards use, with the app's own engine:
 *
 *   npm run dev, then: node scripts/og/render.mjs [--base http://localhost:3000] [--only kallax-2x2] [--missing]
 *
 * Needs Playwright from any project that has it: PLAYWRIGHT_FROM=/path/to/project.
 * Writes public/og/{slug}.png for every catalog product and public/og/kind-{kind}.png
 * for every furniture kind (the fallback for everything else).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const base = arg("--base", "http://localhost:3000");
const only = arg("--only");
const from = process.env.PLAYWRIGHT_FROM;
if (!from) throw new Error("set PLAYWRIGHT_FROM to a folder whose node_modules has playwright");
const { chromium } = createRequire(path.join(from, "package.json"))("playwright");

const OUT = path.resolve(import.meta.dirname, "../../public/og");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.goto(`${base}/dev/og`);
await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 60_000 });

// --step malm-3-drawers:6:malm-step draws one step of a product instead of the whole list
const step = arg("--step");
const jobs = step
  ? [{ slug: step.split(":")[0], mode: { kind: "step", index: Number(step.split(":")[1]) }, out: step.split(":")[2] }]
  : await page.evaluate(() => fetch("/dev/og/list").then((r) => r.json()));
const missing = args.includes("--missing");
const name = (j) => j.out ?? j.slug ?? "kind-" + j.kind;
const list = (only ? jobs.filter((j) => j.slug === only || j.kind === only) : jobs).filter((j) => !missing || !existsSync(path.join(OUT, `${name(j)}.png`)));
let n = 0;
const failed = [];
for (const j of list) {
  // one plan that fails to draw shouldn't stop the rest
  const url = await page.evaluate((o) => window.__draw(o), { ...j, w: 640, h: 560 }).catch((e) => void failed.push(`${name(j)}: ${e.message.split("\n")[0]}`));
  if (!url) continue;
  const file = path.join(OUT, `${name(j)}.png`);
  writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
  // flatten onto pure white and keep 48 colours: line art stays crisp at a sixth of the size
  const tmp = file + ".tmp.png";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-filter_complex", "color=white:s=1280x1120,format=rgba[bg];[bg][0:v]overlay=shortest=1,scale=720:-1:flags=lanczos,format=rgb24,lutrgb=r='if(gt(val\\,246)\\,255\\,val)':g='if(gt(val\\,246)\\,255\\,val)':b='if(gt(val\\,246)\\,255\\,val)',split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=none", "-frames:v", "1", tmp]);
  renameSync(tmp, file);
  if (++n % 20 === 0) console.log(`${n}/${list.length}`);
}
console.log(`drew ${n} pictures into public/og`);
if (failed.length) console.log(`couldn't draw ${failed.length}:\n  ${failed.join("\n  ")}`);
await browser.close();
