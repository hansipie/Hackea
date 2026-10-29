/** Grounding and API contract checks, without paid provider requests. */
import assert from "node:assert/strict";
import { catalogEntry } from "@/lib/catalog";
import { compilePhotoDraft, photoCandidates, selectionSchema, stockUnits } from "@/lib/hacks/photo";
import { checkDraft } from "@/lib/hacks/check";
import { draftToSpec } from "@/lib/hacks/draft";
import { exportHack, parseHackText } from "@/lib/hacks/sanitize";
import { POST } from "@/app/api/hack-photo/route";

const selections = [{ slug: "kallax-2x2", qty: 1 }];
const units = stockUnits(selections);
assert.ok(units[0].parts.length > 4, "base geometry must use constituent catalogue-generated parts");
const candidates = photoCandidates(["KALLAX 2x2", "BILLY"]);
assert.ok(candidates.some(c => c.slug === "kallax-2x2"));
for (const c of candidates) assert.deepEqual(c.size, catalogEntry(c.slug)!.size);
assert.throws(() => stockUnits([{ slug: "invented-product", qty: 1 }]), /unknown product/);
assert.equal(selectionSchema.safeParse([{ slug: "kallax-2x2", qty: 5 }]).success, false);
assert.equal(selectionSchema.safeParse([...selections, ...selections]).success, false);
const [w, h, d] = units[0].size;
const layout = {
  name: "Photo shelf with a wood top", summary: "A KALLAX base with a fitted top board.", minutes: 60,
  placements: [{ unit: units[0].id, pos: [0, h / 2, 0], turn: 0, sideways: false }],
  additions: [{ id: "extra-top", name: "Wood top", size: [w, 18, d], pos: [0, h + 9, 0], material: "wood" }],
  steps: [{ title: "Fit the top", detail: "Measure the top and verify the fastening before attaching it.", add: ["extra-top"], tools: ["tape"] }],
  buy: [{ name: "Wood top", qty: 1, note: "Cut to the measured size." }], mods: ["Fit a wood top."], uncertainties: ["Top thickness is estimated from the photo."],
};
const draft = compilePhotoDraft(layout, selections);
assert.equal(checkDraft("phototest", draft).issues.length, 0);
assert.equal(draft.base[0].slug, "kallax-2x2");
assert.equal(draft.parts.length, units[0].parts.length + 1);
for (const part of units[0].parts) assert.deepEqual(draft.parts.find(p => p.id === part.id)!.size, part.size, "model must not resize stock parts");
assert.equal(parseHackText(exportHack(draft)).errors.length, 0, "generated guides must survive export/import");
assert.ok(draftToSpec("phototest", draft).custom!.steps.length > 1);
assert.throws(() => compilePhotoDraft({ ...layout, placements: [] }, selections));
assert.throws(() => compilePhotoDraft({ ...layout, additions: [{ ...layout.additions[0], id: units[0].parts[0].id }] }, selections));
assert.throws(() => compilePhotoDraft({ ...layout, steps: [{ title: "Wrong", add: [units[0].parts[0].id] }] }, selections));
assert.throws(() => compilePhotoDraft({ ...layout, steps: [] }, selections), /never added/);
assert.throws(() => compilePhotoDraft({ ...layout, placements: [{ ...layout.placements[0], pos: [0, 0, 0] }] }, selections), /below the floor/);
const doubleSelections = [{ slug: "kallax-2x2", qty: 2 }];
assert.throws(() => compilePhotoDraft({ ...layout, additions: [], steps: [], placements: stockUnits(doubleSelections).map(u => ({ unit: u.id, pos: [0, h / 2, 0], turn: 0, sideways: false })) }, doubleSelections), /overlap/);
const sideways = compilePhotoDraft({ ...layout, additions: [], buy: [], steps: [], placements: [{ unit: units[0].id, pos: [0, w / 2, 0], turn: 90, sideways: true }] }, selections);
assert.equal(checkDraft("turnedunit", sideways).issues.length, 0);

const originalFetch = globalThis.fetch;
const calls: { url: string; body: string }[] = [];
let replies: Response[] = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: String(init?.body) });
  assert.ok(replies.length, "unexpected paid request");
  return replies.shift()!;
};
const completion = (content: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
let requestId = 0;
const image = "data:image/jpeg;base64,/9j/2Q==";
const req = (body: unknown, headers: Record<string, string> = {}) => new Request("https://hackea.test/api/hack-photo", { method: "POST", headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin", "x-openai-key": "sk-test-photo-key-1234567890", "x-real-ip": `test-${++requestId}`, ...headers }, body: JSON.stringify(body) });
try {
  replies = [completion({ furniture: true, description: "A square shelf with a wood top.", queries: ["KALLAX 2x2"], uncertainties: ["Check the exact size."] }), completion({ selections })];
  const analysis = await POST(req({ action: "analyze", image }));
  assert.equal(analysis.status, 200);
  assert.equal(analysis.headers.get("cache-control"), "no-store");
  const data = await analysis.json();
  assert.deepEqual(data.selections, selections);
  assert.ok(data.candidates.some((c: { slug: string }) => c.slug === selections[0].slug));
  assert.ok(calls.every(c => c.url === "https://api.openai.com/v1/chat/completions"));
  assert.match(calls[1].body, /kallax-2x2/);

  replies = [completion(layout)];
  const generated = await POST(req({ action: "generate", image, selections }));
  assert.equal(generated.status, 200);
  assert.deepEqual((await generated.json()).draft.base, draft.base);
  const before = calls.length;
  assert.equal((await POST(req({ action: "generate", image, selections: [{ slug: "invented", qty: 1 }] }))).status, 400);
  assert.equal((await POST(req({ action: "analyze", image: "https://attacker.test/image.jpg" }))).status, 400);
  assert.equal((await POST(req({ action: "analyze", image }, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await POST(req({ action: "analyze", image }, { "x-openai-key": "" }))).status, 401);
  assert.equal((await POST(req({ action: "analyze", image: "x".repeat(3_020_001) }))).status, 400);
  assert.equal(calls.length, before, "invalid input must never reach OpenAI");
  replies = [completion({ furniture: false, description: "No furniture", queries: [], uncertainties: [] })];
  assert.equal((await POST(req({ action: "analyze", image }))).status, 422);
  replies = [completion({ furniture: true, description: "A shelf", queries: ["KALLAX"], uncertainties: [] }), completion({ selections: [{ slug: "invented", qty: 1 }] })];
  assert.equal((await POST(req({ action: "analyze", image }))).status, 422);
  replies = [Response.json({ error: { code: "insufficient_quota" } }, { status: 429 })];
  assert.equal((await POST(req({ action: "analyze", image }))).status, 402);
  replies = [completion({ bad: true }), completion(layout)];
  assert.equal((await POST(req({ action: "generate", image, selections }))).status, 200, "one invalid model layout can be repaired");
  replies = [completion({ bad: true }), completion({ bad: true })];
  assert.equal((await POST(req({ action: "generate", image, selections }))).status, 422);
  console.log("Photo hack checks passed: catalogue retrieval, immutable stock geometry, parts, steps, export, matching, generation, repair, invalid inputs and quotas.");
} finally { globalThis.fetch = originalFetch; }
