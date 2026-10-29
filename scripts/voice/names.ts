/** Generates plain phonetic spellings for OpenAI speech. Use --check or --prune to compare recordings. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRODUCTS } from "@/lib/catalog";
import { spokenName } from "@/lib/voice/script";
import { forTTS, speak } from "@/lib/voice/tts";

const FILE = path.resolve(import.meta.dirname, "../../src/lib/voice/names.ts");
const key = process.env.OPENAI_API_KEY?.trim();
if (!key) throw new Error("OPENAI_API_KEY is not set");
const args = process.argv.slice(2);
const names: Record<string, string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8").replace(/^[^{]*/, "").replace(/;\s*$/, "")) : {};
const save = () =>
  writeFileSync(FILE, `/** How the voice says product names, as plain phonetic spellings. Written by scripts/voice/names.ts. */\nexport const NAMES: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(names).sort()), null, 1)};\n`);

const OK = /^[a-zA-Z -]+$/;
const PROMPT = `Write plain phonetic respellings of IKEA product names for an American English text-to-speech voice. Examples: MALM is \"mahlm\", POÄNG is \"poh-ENG\", IDÅSEN is \"ee-DOH-sen\". Use only English letters, spaces and hyphens, no IPA or markup. Return JSON only: {\"NAME\": \"respelling\"} for every name given.`;
function tidy(raw: string) {
  return raw.trim();
}

async function ask(list: string[]): Promise<Record<string, string>> {
  for (let tries = 0; ; tries++) {
    try {
      return await askOnce(list);
    } catch (e) {
      if (tries >= 2) throw e;
    }
  }
}

async function askOnce(list: string[]) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL?.split(",")[0]?.trim() || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
      temperature: 0.2,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: list.join("\n") },
      ],
    }),
  });
  if (!r.ok) throw new Error(`chat ${r.status}`);
  const text: string = (await r.json()).choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
}

async function transcribe(buf: ArrayBuffer) {
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/mpeg" }), "clip.mp3");
  form.append("model", "gpt-transcribe");
  form.append("languages[]", "en");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) throw new Error(`transcription ${r.status}`);
  return String((await r.json()).text ?? "");
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
function sim(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length, 1);
}

async function main() {
  const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",").map(fold)) : null;
  const all = [...new Set(PRODUCTS.map((p) => spokenName(p.name)))].filter((n) => !only || only.has(fold(n)));
  if (args.includes("--prune")) {
    const queue = all.filter((n) => names[n]);
    let kept = 0, dropped = 0;
    const one = async (n: string) => {
      const line = `Your ${n} is built.`;
      const [a, b] = await Promise.all([speak(line, key!), speak(forTTS(line), key!)]);
      const [ha, hb] = await Promise.all([transcribe(a), transcribe(b)]);
      const word = (h: string) => fold(h.replace(/^\W*your\s+/i, "").replace(/\s+is built.*$/i, ""));
      const sa = sim(fold(n), word(ha)), sb = sim(fold(n), word(hb));
      if (sb >= sa + 0.15) kept++;
      else {
        delete names[n];
        dropped++;
      }
    };
    const work = [...queue];
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let n = work.shift(); n; n = work.shift()) await one(n).catch(() => {});
    }));
    save();
    console.log(`kept ${kept} spellings, dropped ${dropped}`);
    return;
  }
  if (args.includes("--check")) {
    const sample = all.filter((n) => names[n]).slice(0, Number(args[args.indexOf("--check") + 1]) || 30);
    let plain = 0, spelled = 0;
    for (const n of sample) {
      const line = `Your ${n} is built.`;
      const [a, b] = await Promise.all([speak(line, key!), speak(forTTS(line), key!)]);
      const [ha, hb] = await Promise.all([transcribe(a), transcribe(b)]);
      const word = (h: string) => fold(h.replace(/^\W*your\s+/i, "").replace(/\s+is built.*$/i, ""));
      const sa = sim(fold(n), word(ha)), sb = sim(fold(n), word(hb));
      plain += sa;
      spelled += sb;
      console.log(`${n.padEnd(12)} plain "${word(ha)}" ${sa.toFixed(2)}   spelled "${word(hb)}" ${sb.toFixed(2)}   ${names[n]}`);
    }
    console.log(`average likeness to the written name: plain ${(plain / sample.length).toFixed(2)}, spelled ${(spelled / sample.length).toFixed(2)}`);
    return;
  }
  const todo = all.filter((n) => !names[n]);
  console.log(`${all.length} names, ${todo.length} to spell`);
  for (let i = 0; i < todo.length; i += 40) {
    const got = await ask(todo.slice(i, i + 40).map((n) => n.toUpperCase()));
    for (const [k, v] of Object.entries(got)) {
      const n = todo.find((x) => x.toUpperCase() === k.toUpperCase());
      const ipa = tidy(String(v));
      if (n && OK.test(ipa)) names[n] = ipa;
      else if (n) console.log(`  skipped ${n}: ${ipa}`);
    }
    save();
    console.log(`${Math.min(i + 40, todo.length)}/${todo.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
