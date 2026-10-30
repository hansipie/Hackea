import assert from "node:assert/strict";
import test from "node:test";
import { blankDraft } from "../src/lib/hacks/templates";
import { SHAPES, addFurniture, addShape, duplicateParts, groupParts, groupsOf, removePart, ungroupParts, withGroup } from "../src/lib/hacks/edit";
import { exportHack, sanitizeDraft } from "../src/lib/hacks/sanitize";
import { checkDraft } from "../src/lib/hacks/check";

const withTwoBoards = () => {
  let d = addFurniture(blankDraft(), "billy-80x202")!;
  for (let i = 0; i < 2; i++) d = addShape(d, SHAPES[0])!.draft;
  return d;
};

test("a piece of furniture arrives as one group, which saves and reads back", () => {
  const d = withTwoBoards();
  const g = groupsOf(d);
  assert.equal(g.length, 1, JSON.stringify(g.map((x) => x.id)));
  assert.ok(g[0].ids.length > 1);
  assert.deepEqual(withGroup(d, g[0].ids[0]), g[0].ids);
  const back = sanitizeDraft(JSON.parse(exportHack(d)));
  assert.deepEqual(back.errors, []);
  assert.deepEqual(back.draft?.groups, d.groups);
  assert.deepEqual(checkDraft("x", d).issues.filter((i) => /group/i.test(i.text)), []);
});

test("group, add to a group, take one out, ungroup", () => {
  const d = withTwoBoards();
  const [g] = groupsOf(d);
  const loose = d.parts.filter((p) => !g.ids.includes(p.id)).map((p) => p.id);
  const made = groupParts(d, loose)!;
  assert.equal(groupsOf(made.draft).length, 2);
  // a loose part plus the whole piece: it joins the piece
  const joined = groupParts(d, [...g.ids, loose[0]])!;
  assert.equal(groupsOf(joined.draft).length, 1);
  assert.ok(groupsOf(joined.draft)[0].ids.includes(loose[0]));
  // one part out
  const out = ungroupParts(joined.draft, [loose[0]])!;
  assert.deepEqual(groupsOf(out)[0].ids, g.ids);
  // the whole group out, and it stays out after a save
  const none = ungroupParts(out, g.ids)!;
  assert.deepEqual(groupsOf(none), []);
  assert.deepEqual(sanitizeDraft(JSON.parse(exportHack(none))).draft?.groups, []);
  assert.equal(groupParts(d, [loose[0]]), null);
});

test("removing parts keeps groups valid; copying a whole group makes a group", () => {
  const d = withTwoBoards();
  const [g] = groupsOf(d);
  let x = d;
  for (const id of g.ids.slice(0, -1)) x = removePart(x, id);
  assert.deepEqual(groupsOf(x), []);
  const c = duplicateParts(d, g.ids)!;
  assert.equal(groupsOf(c.draft).length, 2);
  assert.deepEqual(sanitizeDraft(JSON.parse(exportHack(c.draft))).errors, []);
});

test("a file with a bad group is refused", () => {
  const d = withTwoBoards();
  const bad = { ...d, groups: [{ id: "a", name: "A", ids: [d.parts[0].id, "nope"] }] };
  assert.ok(sanitizeDraft(bad).errors.length);
});
