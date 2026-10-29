/**
 * Downloads IKEA's public product listings so build.ts can turn them into catalog rows.
 *
 *   npm run ikea:fetch                  fetch what is not cached yet, then write facts.json
 *   npm run ikea:fetch -- --us          also read the US product sitemaps (extra names for the names index)
 *   npm run ikea:fetch -- --market us   the US range instead, into facts-us.json, for products the UK doesn't sell
 *
 * Every raw response is cached under scripts/ikea/cache/, so a re-run never refetches. The cache, facts.json and
 * facts-us.json are git ignored: IKEA's listings are not ours to republish, only the catalog rows built from them ship.
 * Requests go one at a time, at most about two a second. Only facts are kept in facts.json:
 * name, type, size text, article numbers and category keys. No images, prices, descriptions or PDFs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Fact } from "./classify";

const DIR = import.meta.dirname;
const CACHE = path.join(DIR, "cache");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 hackea-catalog/1.0";
const WINDOW = 1000; // the API refuses windows larger than 1000
const GAP_MS = 600;

const args = process.argv.slice(2);
const withUs = args.includes("--us");
/** Which IKEA range: the UK one (gb) by default, or the US one, kept apart in facts-us.json. */
const market = args.includes("--market") ? args[args.indexOf("--market") + 1] : "gb";
if (market !== "gb" && market !== "us") throw new Error(`unknown market ${market}`);
const LIST = `https://sik.search.blue.cdtapps.com/${market}/en/product-list-page/more-products`;
const FACTS = path.join(DIR, market === "us" ? "facts-us.json" : "facts.json");
const LANG = market === "us" ? "en-US" : "en-GB";
/** Cached responses of the US range start with its market, so they never mix with the UK ones. */
const PREFIX = market === "us" ? "us-" : "";

let last = 0;
/** Fetch once and cache on disk. `keep` can shrink what is cached (the US sitemaps are mostly image links). */
async function get(url: string, file: string, accept = "application/json", keep = (t: string) => t): Promise<string | null> {
  const p = path.join(CACHE, file);
  if (existsSync(p)) return readFileSync(p, "utf8");
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": LANG } });
    if (r.status === 404) return null;
    if (r.ok) {
      const text = keep(await r.text());
      writeFileSync(p, text);
      console.log(`  got ${file} (${Math.round(text.length / 1024)} KB)`);
      return text;
    }
    console.log(`  ${r.status} on ${url}, retry ${attempt}`);
    await new Promise((res) => setTimeout(res, 3000 * attempt));
  }
  throw new Error(`could not fetch ${url}`);
}

/**
 * Top level category keys, read from the GB "all products" page. IKEA's category keys are the same in every market,
 * so the US range is read by the keys the UK facts already hold, without reading any page.
 */
async function categories(): Promise<string[]> {
  if (market === "us") {
    const gb: Fact[] = JSON.parse(readFileSync(path.join(DIR, "facts.json"), "utf8")).products;
    return [...new Set(gb.map((f) => f.cats[0]).filter((k): k is string => !!k))];
  }
  const html = await get("https://www.ikea.com/gb/en/cat/products-products/", "gb-products.html", "text/html");
  const keys = [...(html ?? "").matchAll(/\/gb\/en\/cat\/[a-z0-9-]+-([a-z]{2}\d{3})\//g)].map((m) => m[1]);
  return [...new Set(keys)];
}

interface Raw {
  name: string;
  typeName: string;
  itemMeasureReferenceText?: string;
  itemNo: string;
  itemType: string;
  categoryPath?: { key: string }[];
  gprDescription?: { variants?: { itemNo: string; itemType?: string; itemMeasureReferenceText?: string; typeName?: string; name?: string }[] };
}


async function main() {
  mkdirSync(CACHE, { recursive: true });
  const cats = await categories();
  console.log(`${cats.length} categories`);
  const byItem = new Map<string, Fact>();
  const covered = new Set<string>();
  for (const cat of cats) {
    if (covered.has(cat)) continue; // already listed under a parent category
    for (let start = 0; ; start += WINDOW) {
      const text = await get(`${LIST}?category=${cat}&start=${start}&end=${start + WINDOW}`, `${PREFIX}plp-${cat}-${start}.json`);
      const list: Raw[] = text ? (JSON.parse(text).moreProducts?.productWindow ?? []) : [];
      for (const p of list) {
        const path = (p.categoryPath ?? []).map((c) => c.key);
        path.slice(1).forEach((k) => covered.add(k));
        add(byItem, p, path);
      }
      if (list.length < WINDOW) break;
    }
  }
  const facts = [...new Set(byItem.values())];
  writeFileSync(FACTS, JSON.stringify({ source: `ikea.com/${market}/en`, market, fetched: new Date().toISOString().slice(0, 10), products: facts }).replace(/\},\{/g, "},\n{"));
  console.log(`${facts.length} products, ${facts.reduce((s, f) => s + f.items.length, 0)} article numbers`);
  if (withUs) console.log(`${(await usPages()).length} US product pages`);
}

function add(byItem: Map<string, Fact>, p: Raw, cats: string[]) {
  if (!p.name || !p.itemNo) return;
  const known = byItem.get(p.itemNo);
  if (known) {
    for (const c of cats) if (!known.cats.includes(c)) known.cats.push(c);
    return;
  }
  const variants = (p.gprDescription?.variants ?? []).filter((v) => (!v.name || v.name === p.name) && (!v.typeName || v.typeName === p.typeName));
  const art = [p, ...variants].filter((v) => v.itemType !== "SPR").map((v) => v.itemNo);
  const spr = [p, ...variants].filter((v) => v.itemType === "SPR").map((v) => v.itemNo);
  const fact: Fact = { name: p.name, type: p.typeName ?? "", size: p.itemMeasureReferenceText ?? "", items: [...new Set([...art, ...spr])], spr: p.itemType === "SPR", cats: [...cats] };
  for (const i of fact.items) if (!byItem.has(i)) byItem.set(i, fact);
}

/** US product page slugs (/us/en/p/kallax-shelf-unit-white-80275887/): extra names for the names index. */
async function usPages(): Promise<string[]> {
  const out: string[] = [];
  for (let n = 1; n <= 8; n++) {
    const locs = await get(`https://www.ikea.com/sitemaps/prod-en-US_${n}.xml`, `us-sitemap-${n}.txt`, "application/xml", (xml) =>
      [...xml.matchAll(/<loc>https:\/\/www\.ikea\.com\/us\/en\/p\/([a-z0-9-]+)\/<\/loc>/g)].map((m) => m[1]).join("\n"),
    );
    if (locs === null) break;
    out.push(...locs.split("\n").filter(Boolean));
  }
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
