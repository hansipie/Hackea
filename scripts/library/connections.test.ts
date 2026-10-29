import assert from "node:assert/strict";
import test from "node:test";
import { elementSignature, individualPartData } from "../../src/lib/part-connections";
import type { PartType } from "../../src/lib/types";
import { PRODUCTS, catalogSpec } from "../../src/lib/catalog";
import { buildPlan } from "../../src/lib/plan";

const panel: PartType = { id: "a", label: "A", name: "Shelf", size: [600, 18, 300], shape: "box", material: "board", qty: 2 };

test("panel matching ignores name, quantity and orientation", () => {
  assert.equal(elementSignature(panel), elementSignature({ ...panel, name: "Bottom", qty: 1, size: [18, 300, 600] }));
});

test("different thicknesses, materials and shapes do not match", () => {
  for (const changed of [{ ...panel, size: [600, 19, 300] as [number, number, number] }, { ...panel, material: "wood" as const }, { ...panel, shape: "cyl" as const }]) {
    assert.notEqual(elementSignature(panel), elementSignature(changed));
  }
});

test("cylinders preserve their diameter and length axes", () => {
  assert.notEqual(elementSignature({ ...panel, shape: "cyl", size: [20, 40, 20] }), elementSignature({ ...panel, shape: "cyl", size: [40, 20, 20] }));
});

test("composite geometry distinguishes parts with the same bounding box", () => {
  const piece = { shape: "box" as const, size: [600, 18, 30] as [number, number, number], pos: [0, 0, 0] as [number, number, number] };
  assert.notEqual(elementSignature({ ...panel, pieces: [piece] }), elementSignature({ ...panel, pieces: [{ ...piece, pos: [0, 0, 30] }] }));
});

test("the individual library includes unique parts and stable, distinct URLs", () => {
  const all = individualPartData();
  assert.ok(all.elements.some((p) => p.products.length === 1));
  assert.equal(new Set(all.elements.map((p) => p.key)).size, all.elements.length);
  assert.equal(new Set(all.elements.map((p) => p.signature)).size, all.elements.length);
  for (const part of all.elements) {
    assert.match(part.key, /^[a-f0-9]{24}$/);
    assert.ok(part.products.length >= 1);
    assert.ok(part.names.includes(part.name));
  }
});

test("every plan part is indexed with all of its furniture and correct quantities", () => {
  const all = individualPartData();
  const bySignature = new Map(all.elements.map((p, index) => [p.signature, index]));
  const bySlug = new Map(all.products.map((p, index) => [p.slug, index]));
  for (const product of PRODUCTS) {
    const productIndex = bySlug.get(product.slug)!;
    assert.notEqual(productIndex, undefined);
    const quantities = new Map<number, number>();
    for (const part of buildPlan({ ...product, source: "catalog" }).parts.filter((p) => !p.extra)) {
      const id = bySignature.get(elementSignature(part))!;
      assert.notEqual(id, undefined);
      assert.ok(all.elements[id].products.includes(productIndex));
      quantities.set(id, (quantities.get(id) ?? 0) + part.qty);
    }
    assert.deepEqual(new Map(all.products[productIndex].parts.map((p) => [p.id, p.qty])), quantities);
  }
});

test("part detail references highlight the exact indexed part in each matching plan", () => {
  const all = individualPartData();
  const productIndex = all.products.findIndex((p) => p.slug === "kallax-2x2");
  for (const { id } of all.products[productIndex].parts) {
    const part = all.elements[id];
    for (const index of part.products) {
      const spec = catalogSpec(all.products[index].slug)!;
      const matches = buildPlan(spec).parts.filter((p) => !p.extra && elementSignature(p) === part.signature);
      assert.ok(matches.length > 0);
      assert.equal(matches.reduce((n, p) => n + p.qty, 0), all.products[index].parts.find((p) => p.id === id)?.qty);
    }
  }
});
