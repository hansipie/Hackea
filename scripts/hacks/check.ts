/**
 * Checks every hack in src/data/hacks with the rules the editor uses too (src/lib/hacks/check.ts): it builds a plan,
 * every part is added once, the numbers are finite, and the hack says what it starts from and what to buy.
 * Then the editor's own pieces: each curated hack survives export and a strict re-import, every starter template
 * passes, and the importer turns away files it should. Last, the editor itself: every operation it offers leaves a
 * draft the import reads back exactly, a stored hack that breaks a rule is repaired and flagged instead of dropped,
 * and share links read back.
 *
 *   npm run hacks:check
 */
import { HACKS } from "@/data/hacks";
import { catalogSpec } from "@/lib/catalog";
import { checkDraft, checkHack, checkHacks } from "@/lib/hacks/check";
import { draftToSpec, LIMITS, mineSlug, specToDraft, type HackDraft } from "@/lib/hacks/draft";
import * as E from "@/lib/hacks/edit";
import { autoSteps } from "@/lib/hacks/autosteps";
import { begin, commit, redo, undo } from "@/lib/hacks/history";
import { snapMove } from "@/lib/hacks/snap";
import { FORMAT, VERSION, exportHack, parseHackText, sanitizeDraft } from "@/lib/hacks/sanitize";
import { deleteHack, duplicateHack, exportBackup, exportSaved, isUnreadable, listHacks, loadHack, loadStored, localSpec, mineSpec, readSaved, readShared, readStored, saveHack } from "@/lib/hacks/store";
import { packJson } from "@/lib/scan/share";
import { billyDraft, blankDraft, kallaxDraft } from "@/lib/hacks/templates";

let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.error("FAIL", msg);
};
const known = (slug: string) => !!catalogSpec(slug);
// the same data whatever order its keys are in
const canon = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]` : v && typeof v === "object" ? `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${k}:${canon(x)}`).join(",")}}` : JSON.stringify(v);

for (const r of checkHacks(HACKS)) {
  for (const i of r.issues) fail(`${r.slug}: ${i.text}`);
  if (!r.issues.length && r.plan) console.log(`ok  ${r.slug}: ${r.plan.parts.length} part types, ${r.plan.steps.length} steps`);
}

// a curated hack exported from the editor and imported again is the same hack
for (const h of HACKS) {
  const draft = specToDraft(h);
  const back = parseHackText(exportHack(draft), known);
  if (!back.draft) {
    fail(`${h.slug}: re-import refused: ${back.errors.join("; ")}`);
    continue;
  }
  if (canon(back.draft) !== canon(draft)) fail(`${h.slug}: re-import changed the hack`);
  const { issues } = checkHack(draftToSpec("roundtrip01", back.draft));
  for (const i of issues) fail(`${h.slug} (as a draft): ${i.text}`);
}

const templates = { blank: blankDraft(), "kallax 1x1": kallaxDraft(1, 1), "kallax 2x2": kallaxDraft(2, 2), "kallax 4x4": kallaxDraft(4, 4), "kallax 5x5": kallaxDraft(5, 5), "billy 1": billyDraft(1), "billy 3": billyDraft(3), "billy 4": billyDraft(4) };
for (const [name, d] of Object.entries(templates)) {
  // a template has no summary or, for the blank one, no base yet: those are the person's to write
  const { issues, plan } = checkHack(draftToSpec("template01", { ...d, summary: "x", base: d.base.length ? d.base : [{ name: "x", qty: 1 }] }));
  for (const i of issues) fail(`template ${name}: ${i.text}`);
  if (d.parts.length > LIMITS.parts || d.steps.length > LIMITS.steps) fail(`template ${name}: over the editor's limits`);
  if (!issues.length) console.log(`ok  template ${name}: ${plan?.steps.length} steps`);
}

// files the importer must turn away
const ok = specToDraft(HACKS[0]);
const refused: [string, string][] = [
  ["not JSON", "{"],
  ["another format", JSON.stringify({ format: "other", version: 1, hack: ok })],
  ["a newer version", JSON.stringify({ format: "hackea-hack", version: 2, hack: ok })],
  ["a part out of bounds", JSON.stringify({ ...ok, parts: [{ ...ok.parts[0], size: [1e9, 10, 10] }] })],
  ["a size as text", JSON.stringify({ ...ok, parts: [{ ...ok.parts[0], size: ["10", 10, 10] }] })],
  ["too many parts", JSON.stringify({ ...ok, parts: Array.from({ length: LIMITS.parts + 1 }, (_, i) => ({ ...ok.parts[0], id: `p${i}` })) })],
  ["too many steps", JSON.stringify({ ...ok, steps: Array.from({ length: LIMITS.steps + 1 }, () => ok.steps[0]) })],
  ["a long name", JSON.stringify({ ...ok, name: "x".repeat(LIMITS.name + 1) })],
  ["an unknown fitting", JSON.stringify({ ...ok, steps: [{ title: "x", fix: [{ kind: "rivet", count: 2 }] }] })],
  ["a bad part id", JSON.stringify({ ...ok, parts: [{ ...ok.parts[0], id: "<img src=x>" }] })],
  ["an array", "[]"],
  ["a huge file", JSON.stringify({ ...ok, summary: "x".repeat(400_000) })],
];
for (const [what, text] of refused) if (parseHackText(text, known).draft) fail(`the importer accepted ${what}`);
// and a product link it doesn't know is dropped, not followed
const linked = parseHackText(JSON.stringify({ ...ok, base: [{ name: "Thing", slug: "not-a-product-we-have", qty: 1 }] }), known);
if (linked.draft?.base[0].slug) fail("the importer kept a link to an unknown product");
console.log(`ok  importer: ${refused.length} bad files refused`);

/* ---------- what the editor makes always reads back ---------- */

// strict reading of a draft the editor holds: it must pass, and give back exactly the same draft
const readsBack = (d: HackDraft, what: string) => {
  const r = sanitizeDraft(d, known);
  if (!r.draft) return fail(`${what}: the editor kept a draft the import refuses: ${r.errors.slice(0, 3).join("; ")}`);
  if (canon(r.draft) !== canon(d)) fail(`${what}: the draft changed when read back`);
  const { issues } = checkDraft("editorops1", d);
  const strictOnes = issues.filter((i) => r.problems.some((p) => p.text === i.text));
  if (strictOnes.length) fail(`${what}: checkDraft and the import disagree`);
};

// the triggers the review found, one by one
{
  const base = E.addBase(blankDraft());
  if (!base || !base.base[0].name) fail("adding a piece by hand gives it no name");
  else readsBack(base, "add a piece by hand");
  const buy = E.addBuy(blankDraft());
  if (!buy || !buy.buy[0].name) fail("adding something to buy gives it no name");
  else readsBack(buy, "add something to buy");
  const lines = E.addLine(E.addLine(blankDraft(), "mods")!, "watchOut")!;
  readsBack(lines, "add an empty change and watch-out line");
  if (draftToSpec("lines00001", lines).hack!.mods.length || draftToSpec("lines00001", lines).watchOut) fail("empty lines reach the guide");

  // BILLY x4, then the "Add a BILLY frame" button six times: refused once there is no room, never past the bounds
  let d = billyDraft(4);
  let refusedAdds = 0;
  for (let i = 0; i < 6; i++) {
    const n = E.addBilly(d);
    if (n) d = n;
    else refusedAdds++;
  }
  readsBack(d, "BILLY x4 plus six more frames");
  if (!refusedAdds) fail("adding BILLY frames never ran out of room");
  if (d.parts.some((p) => p.pos.some((x) => Math.abs(x) > LIMITS.pos))) fail("a BILLY frame was placed past the bounds");

  // duplicating the part at the edge, over and over
  let e = kallaxDraft(5, 5);
  for (let i = 0; i < 60; i++) {
    const edge = e.parts.reduce((a, p) => (p.pos[0] > a.pos[0] ? p : a));
    const n = E.duplicatePart(e, edge.id);
    if (!n) break;
    e = n.draft;
  }
  readsBack(e, "duplicating the part at the edge");

  // a fitting narrowed to parts: 20 reads back, 21 does not, and the editor's checkbox list stops at the same 20
  const many = kallaxDraft(5, 5);
  const ids = many.parts.map((p) => p.id);
  const withTo = (n: number) => E.updateStep(many, 0, { fix: [{ kind: "screw", count: 2, to: ids.slice(0, n) }] });
  readsBack(withTo(LIMITS.targets), `${LIMITS.targets} targets`);
  if (sanitizeDraft(withTo(LIMITS.targets + 1)).draft) fail(`${LIMITS.targets + 1} targets read back`);
  readsBack(E.updateStep(many, 0, { fix: [{ kind: "screw", count: 2, to: [] }] }), "a fitting narrowed to no part yet");

  // long dashes are cleaned to ", ", which must never push a text over its limit
  const dash = String.fromCharCode(0x2014);
  const summary = ("a" + dash + "b ").repeat(LIMITS.summary).slice(0, LIMITS.summary);
  const dashed = { ...blankDraft(), summary };
  const r = sanitizeDraft(dashed);
  if (!r.draft) fail(`a summary at its limit with long dashes is refused: ${r.errors[0]}`);
  else if (r.draft.summary.length > LIMITS.summary || r.draft.summary.includes(dash)) fail("a cleaned summary is too long or keeps its dashes");

  // names cleared in the editor: shown as problems where they are, and storage keeps the hack instead of dropping it
  const k = kallaxDraft(2, 2);
  const cleared: HackDraft = { ...k, name: "", parts: k.parts.map((p, i) => (i ? p : { ...p, name: "" })), steps: k.steps.map((s, i) => (i ? s : { ...s, title: "" })) };
  const issues = checkDraft("cleared001", cleared).issues;
  if (!issues.some((i) => !i.part && i.step === undefined && /^Name/.test(i.text))) fail("an empty hack name is not shown as a problem");
  if (!issues.some((i) => i.part === k.parts[0].id)) fail("an empty part name does not point at its part");
  if (!issues.some((i) => i.step === 0)) fail("an empty step title does not point at its step");
  const saved = readSaved("cleared001", { id: "cleared001", createdAt: 1, updatedAt: 2, draft: cleared });
  if (!saved) fail("storage dropped a hack with empty names");
  else {
    if (!saved.problems?.length) fail("a stored hack with empty names is not flagged for repair");
    if (saved.draft.name !== "Untitled hack" || !saved.draft.parts[0].name || !saved.draft.steps[0].title) fail("the repair does not fill the blanks");
    if (saved.draft.parts.length !== k.parts.length || saved.draft.steps.length !== k.steps.length) fail("the repair lost parts or steps");
    if (sanitizeDraft(saved.draft).problems.length) fail("a repaired hack still breaks a rule");
    const out = JSON.parse(exportSaved(saved));
    if (canon(out.hack) !== canon(cleared)) fail("export as saved does not hold what was stored");
  }
  if (!isUnreadable(readStored("garbage001", "not a record"))) fail("storage dropped a record it couldn't read instead of flagging it");
  if (readSaved("../bad", {})) fail("storage read a key that is not one of our ids");
  if (readSaved("missing001", undefined)) fail("storage made up a hack where there is no record");
  const far = readSaved("faraway001", { id: "faraway001", draft: { ...k, parts: k.parts.map((p) => ({ ...p, pos: [9e9, p.pos[1], p.pos[2]] })) } });
  if (!far?.problems || far.draft.parts.some((p) => Math.abs(p.pos[0]) > LIMITS.pos)) fail("a part past the bounds is not clamped by the repair");
}

// a seeded walk through the editor's operations: after every one, the draft reads back exactly
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const starts: [string, HackDraft][] = [["blank", blankDraft()], ["kallax", kallaxDraft(3, 2)], ["billy", billyDraft(2)], ...HACKS.map((h): [string, HackDraft] => [h.slug!, specToDraft(h)])];
  let ops = 0;
  for (const [name, start] of starts) {
    let d = start;
    for (let i = 0; i < 300; i++) {
      const part = d.parts.length ? pick(d.parts) : null;
      const si = d.steps.length ? Math.floor(rnd() * d.steps.length) : -1;
      const choices: (() => HackDraft | null)[] = [
        () => E.addPart(d)?.draft ?? null,
        () => (part ? (E.duplicatePart(d, part.id)?.draft ?? null) : null),
        () => E.addKallax(d, 1 + Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 5)),
        () => E.addBilly(d),
        () => E.addStep(d),
        () => (si >= 0 ? E.moveStep(d, si, rnd() < 0.5 ? -1 : 1) : null),
        () => (si >= 0 ? E.duplicateStep(d, si) : null),
        () => (si >= 0 && rnd() < 0.3 ? E.removeStep(d, si) : null),
        () => (part ? E.setPartStep(d, part.id, Math.floor(rnd() * (d.steps.length + 1)) - 1) : null),
        () => (part && rnd() < 0.3 ? E.removePart(d, part.id) : null),
        () => (part ? E.renamePart(d, part.id, `p${Math.floor(rnd() * 1e6)}`) : null),
        () => (part && d.parts.length > 1 ? E.renamePart(d, part.id, pick(d.parts).id) : null),
        // what the number fields let through: clamped to the same bounds
        () => (part ? E.updatePart(d, part.id, { pos: [Math.round((rnd() * 2 - 1) * LIMITS.pos), part.pos[1], part.pos[2]] }) : null),
        () => E.addBase(d),
        () => E.addBuy(d),
        () => E.addLine(d, rnd() < 0.5 ? "mods" : "watchOut"),
        () => (si >= 0 ? E.updateStep(d, si, { fix: [{ kind: pick(["screw", "dowel", "hinge"] as const), count: 1 + Math.floor(rnd() * LIMITS.fixCount), to: d.parts.slice(0, Math.floor(rnd() * (LIMITS.targets + 1))).map((p) => p.id) }] }) : null),
      ];
      const n = pick(choices)();
      if (n) d = n;
      ops++;
      const r = sanitizeDraft(d, known);
      if (new Set(d.parts.map((p) => p.id)).size !== d.parts.length) {
        fail(`editor walk from ${name}, step ${i}: two parts share an id`);
        break;
      }
      if (!r.draft || canon(r.draft) !== canon(d)) {
        fail(`editor walk from ${name}, step ${i}: the draft no longer reads back (${r.errors[0] ?? "changed"})`);
        break;
      }
    }
  }
  console.log(`ok  editor walk: ${ops} operations, every draft reads back exactly`);
}

// a share link carries the hack and is read back with the same checks
{
  const d = { ...kallaxDraft(2, 2), summary: "Shared.", name: "Shared hack" };
  const packed = await packJson({ format: FORMAT, version: VERSION, hack: d });
  const back = await readShared("mine-share00001", packed);
  if (!back || back.name !== "Shared hack" || back.source !== "mine") fail("a share link does not read back");
  if (await readShared("mine-share00001", packed.slice(0, 40))) fail("a broken share link was read");
  const evil = await packJson({ format: FORMAT, version: VERSION, hack: { ...d, parts: [{ ...d.parts[0], size: [1e9, 1, 1] }] } });
  if (await readShared("mine-share00001", evil)) fail("a share link out of bounds was read");
  console.log("ok  share links");
}

/* ---------- part ids are unique, whatever comes in ---------- */
{
  const k = kallaxDraft(2, 2);
  const two = { ...k, parts: [k.parts[0], { ...k.parts[1], id: k.parts[0].id }, ...k.parts.slice(2)] };
  if (sanitizeDraft(two).draft) fail("a strict import of two parts with one id passed");
  if (!checkDraft("dupes00001", two).issues.some((i) => /another part has this id/.test(i.text))) fail("checkDraft does not report two parts with one id");
  // repair: the bad id must not take an id a later part has
  const fixed = sanitizeDraft({ ...k, parts: [{ ...k.parts[0], id: "bad!" }, { ...k.parts[1], id: "part-1" }], steps: [] }, () => true, { repair: true }).draft!;
  const ids = fixed.parts.map((p) => p.id);
  if (new Set(ids).size !== ids.length || ids[1] !== "part-1") fail(`repair gave clashing ids: ${ids.join(", ")}`);
  const dupFixed = sanitizeDraft(two, () => true, { repair: true }).draft!;
  if (new Set(dupFixed.parts.map((p) => p.id)).size !== dupFixed.parts.length) fail("repair kept two parts with one id");
  if (sanitizeDraft({ ...k, steps: [{ title: "x", add: [k.parts[0].id, k.parts[0].id] }] }).draft) fail("a step listing a part twice passed");
  // the editor: renaming onto a used id changes nothing, duplicating always picks a free one
  const renamed = E.renamePart(k, k.parts[0].id, k.parts[1].id);
  if (renamed !== k) fail("renaming a part onto another part's id was allowed");
  let d = k;
  for (let i = 0; i < 10; i++) d = E.duplicatePart(d, d.parts[0].id)?.draft ?? d;
  if (new Set(d.parts.map((p) => p.id)).size !== d.parts.length) fail("duplicating a part made two with one id");
  console.log("ok  part ids stay unique");
}

/* ---------- storage: a hack that needs repairing is never lost ---------- */
{
  // what the browser gives the store, for this script
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  };
  const k = kallaxDraft(2, 2);
  // parts past the bounds, as an older version could have saved them: the repair would clamp them
  const raw = { ...k, name: "", summary: "Far.", parts: k.parts.map((p, i) => (i ? p : { ...p, pos: [9000, p.pos[1], p.pos[2]] })) };
  const id = "flagged001";
  mem.set("hackea:hacks", JSON.stringify({ [id]: { id, createdAt: 1, updatedAt: 2, draft: raw } }));
  const before = mem.get("hackea:hacks");
  const opened = loadHack(id);
  listHacks();
  if (!opened?.problems) fail("a stored hack past the bounds is not flagged");
  if (mem.get("hackea:hacks") !== before) fail("opening a flagged hack wrote to storage");
  if (opened && canon(opened.raw) !== canon(raw)) fail("the flagged hack's raw record is not what was stored");

  // duplicating it keeps the flag and the raw record
  const copy = duplicateHack(id);
  const c = copy ? loadHack(copy) : null;
  if (!c?.problems || canon(c.raw) !== canon(raw)) fail("duplicating a flagged hack lost its flag or its raw record");
  if (mem.get("hackea:hacks")!.includes(`"${id}":`) && canon(loadHack(id)!.raw) !== canon(raw)) fail("duplicating changed the original");

  // saving the repaired version keeps the original as a backup, once
  saveHack(id, { ...opened!.draft, name: "Repaired" });
  const after = loadHack(id);
  if (after?.problems) fail("the repaired version still needs repairing");
  if (!after?.backup || canon(after.backup.raw) !== canon(raw)) fail("saving the repaired version lost the original");
  saveHack(id, { ...opened!.draft, name: "Repaired again" });
  if (canon(loadHack(id)!.backup!.raw) !== canon(raw)) fail("a later save replaced the backup");
  if (!exportBackup(loadHack(id)!)?.includes('"pos"')) fail("the backup can't be exported");
  deleteHack(id);
  if ((mem.get("hackea:hacks-backup") ?? "").includes(id)) fail("deleting a hack left its backup behind");

  // the guide and its print view read an own hack the same way: broken means nothing older shows
  const own = "printown01";
  const good = { ...k, summary: "Good." };
  saveHack(own, good);
  const okSpec = localSpec(mineSlug(own));
  if (!okSpec.own || !okSpec.spec) fail("an own hack that passes doesn't resolve");
  // an older copy and a build in progress both hold the good version
  mem.set("hackea:spec:" + mineSlug(own), JSON.stringify(okSpec.spec));
  mem.set("hackea:builds", JSON.stringify({ [mineSlug(own)]: { slug: mineSlug(own), spec: okSpec.spec, updatedAt: 1 } }));
  saveHack(own, { ...good, summary: "Broken.", base: [] });
  const broken = localSpec(mineSlug(own));
  if (!broken.own || broken.spec) fail("a broken own hack resolves to an older copy");
  // someone else's hack opened from a link still prints from the copy kept when it was opened
  mem.set("hackea:spec:mine-shared0001", JSON.stringify({ ...okSpec.spec, slug: "mine-shared0001" }));
  const shared = localSpec("mine-shared0001");
  if (shared.own || !shared.spec) fail("a hack opened from a link no longer resolves");
  // records that aren't hacks at all: listed as unreadable, exported as stored, deletable, and nothing else touched
  {
    const good = { ...kallaxDraft(2, 2), summary: "Good." };
    const goodId = "goodrecord1";
    const strange: Record<string, unknown> = {
      fmtrecord01: { id: "fmtrecord01", updatedAt: 3, draft: { format: "hackea-hack", version: 1, hack: good } },
      fmtwrong001: { id: "fmtwrong001", updatedAt: 3, draft: { format: "other", hack: good } },
      verrecord01: { id: "verrecord01", updatedAt: 3, draft: { version: 2, ...good } },
      strrecord01: "a string",
      arrrecord01: [1, 2, 3],
      nullrecord1: null,
      noidrecord1: { updatedAt: 3, draft: good },
      strdraft001: { id: "strdraft001", draft: "not a draft" },
      arrdraft001: { id: "arrdraft001", draft: [good] },
    };
    mem.set("hackea:hacks", JSON.stringify({ [goodId]: { id: goodId, createdAt: 1, updatedAt: 1, draft: good }, ...strange }));
    mem.set("hackea:hacks-backup", JSON.stringify({ strrecord01: { raw: "older", problems: [], at: 1 } }));
    let listed: ReturnType<typeof listHacks> = [];
    try {
      listed = listHacks();
    } catch (e) {
      fail(`listing hacks threw on a strange record: ${e}`);
    }
    for (const [id, v] of Object.entries(strange)) {
      const h = listed.find((x) => x.id === id);
      if (!h || !isUnreadable(h)) {
        fail(`${id}: not listed as unreadable`);
        continue;
      }
      if (canon(JSON.parse(exportSaved(h))) !== canon(v)) fail(`${id}: export as saved doesn't hold what is stored`);
      try {
        if (loadHack(id)) fail(`${id}: opens as a hack`);
        if (!isUnreadable(loadStored(id))) fail(`${id}: the editor would not see it as unreadable`);
        if (mineSpec(mineSlug(id))) fail(`${id}: has a guide`);
        const r = localSpec(mineSlug(id));
        if (!r.own || r.spec) fail(`${id}: the guide and print view don't show it as needing a fix`);
      } catch (e) {
        fail(`${id}: reading it threw: ${e}`);
      }
    }
    const goodRow = listed.find((x) => x.id === goodId);
    if (!goodRow || isUnreadable(goodRow) || goodRow.problems) fail("a good record next to strange ones was not read as it is");
    for (const id of Object.keys(strange)) deleteHack(id);
    const left = JSON.parse(mem.get("hackea:hacks")!);
    if (Object.keys(left).join() !== goodId) fail(`deleting the unreadable records left ${Object.keys(left).join(", ")}`);
    if ((mem.get("hackea:hacks-backup") ?? "").includes("strrecord01")) fail("deleting an unreadable record left its backup");
    if (canon(left[goodId].draft) !== canon(good)) fail("deleting the unreadable records changed the good one");
    // saving over an unreadable record keeps it as a backup first
    mem.set("hackea:hacks", JSON.stringify({ ...left, fmtrecord01: strange.fmtrecord01 }));
    saveHack("fmtrecord01", good);
    if (!loadHack("fmtrecord01")?.backup || canon(loadHack("fmtrecord01")!.backup!.raw) !== canon(strange.fmtrecord01)) fail("saving over an unreadable record lost it");
    console.log(`ok  ${Object.keys(strange).length} unreadable records listed, exported, deleted, the rest untouched`);
  }
  delete (globalThis as { localStorage?: unknown }).localStorage;
  console.log("ok  storage keeps flagged hacks, backups and one way to read a guide");
}

/* ---------- the workspace's own pieces: turns, steps worked out from the parts, undo, snapping ---------- */
{
  // a turned part survives the file, the share link and the strict re-import
  let d = blankDraft();
  d = E.turnParts(d, [d.parts[0].id], 1, Math.PI / 2);
  const turned = d.parts[0].rot;
  if (!turned || Math.abs(turned[1] - Math.PI / 2) > 1e-9) fail("turning a part did not set its rotation");
  const back = parseHackText(exportHack(d));
  if (!back.draft || JSON.stringify(back.draft.parts[0].rot) !== JSON.stringify(turned)) fail("a part's rotation did not survive export and import");
  if (E.turnParts(d, [d.parts[0].id], 1, -Math.PI / 2).parts[0].rot !== undefined) fail("a part turned back to zero kept a rotation");
  console.log("ok  rotation survives export and import");

  // steps worked out from the parts build a plan for every starter and for a turned board
  const starters: [string, HackDraft][] = [["blank", blankDraft()], ["kallax 2x2", kallaxDraft(2, 2)], ["billy 3", billyDraft(3)]];
  let stacked = E.addPart(blankDraft())!.draft;
  stacked = E.addPart(stacked)!.draft;
  starters.push(["stacked boards", stacked], ["turned board", E.turnParts(stacked, [stacked.parts[1].id], 2, Math.PI / 2)]);
  for (const [name, draft] of starters) {
    const auto = autoSteps(draft);
    // the summary and "started from" are the person's to write, as in the templates above
    const r = checkHack(draftToSpec("autocheck01", { ...auto, summary: "x", base: auto.base.length ? auto.base : [{ name: "x", qty: 1 }] }));
    if (r.issues.length || !r.plan) fail(`steps worked out for ${name}: ${r.issues.map((i) => i.text).join("; ") || "no plan"}`);
    else console.log(`ok  auto steps ${name}: ${auto.steps.length} steps`);
  }

  // undo, redo, and a drag that counts as one change
  let h = begin(0);
  h = commit(h, 1, "drag", 1000);
  h = commit(h, 2, "drag", 1100);
  h = commit(h, 3, "drag", 1200);
  if (h.past.length !== 1) fail("a drag was more than one change");
  h = undo(h);
  if (h.now !== 0 || !h.future.length) fail("undo did not go back to before the drag");
  h = redo(h);
  if (h.now !== 3) fail("redo did not come back to after the drag");
  console.log("ok  undo and redo");

  // snapping: a board dropped near the floor and near another part's top lines up
  const board = blankDraft();
  const low = E.updatePart(board, board.parts[0].id, { pos: [0, board.parts[0].size[1] / 2, 0] }).parts;
  const near = snapMove(low, [low[0].id], [0, -6, 0]);
  if (Math.abs(near.delta[1]) > 1e-6) fail(`a part 6 mm under the floor did not snap onto it (moved ${near.delta[1]})`);
  const two = low;
  const free = snapMove(two, [two[0].id], [0, 400, 0], { grid: 0, reach: 15, parts: false });
  if (free.delta[1] !== 400 || free.guides.length) fail("snapping with everything off moved the part");
  console.log("ok  snapping");
}

if (failed) {
  console.error(`${failed} problem(s)`);
  process.exit(1);
}
