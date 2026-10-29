import { PRODUCTS } from "./catalog";
import { buildPlan } from "./plan";
import type { PartType, Vec3 } from "./types";
import { createHash } from "node:crypto";

export interface ConnectionProduct {
  slug: string;
  name: string;
  variant: string;
  kind: string;
  parts: { id: number; qty: number }[];
}

export interface ConnectionElement {
  key: string;
  signature: string;
  names: string[];
  name: string;
  size: number[];
  material: string;
  shape: string;
  products: number[];
}

export interface ConnectionData {
  products: ConnectionProduct[];
  elements: ConnectionElement[];
  skipped: number;
}

const precise = (n: number) => Math.round(n * 1e6) / 1e6;
const dimensions = (size: Vec3) => [...size].map(precise).sort((a, b) => b - a);

/** Geometric similarity only. The generated plans do not carry IKEA part numbers or drilling patterns. */
export function elementSignature(part: PartType): string {
  const pieces = part.pieces?.map((p) => JSON.stringify([
    p.shape, p.material ?? part.material, p.size.map(precise), p.pos.map(precise), (p.rot ?? [0, 0, 0]).map(precise),
  ])).sort();
  // Cylinders keep their length axis. Composite geometry keeps its original axes too.
  return JSON.stringify([part.shape, part.material, pieces || part.shape === "cyl" ? part.size.map(precise) : dimensions(part.size), pieces ?? null]);
}

let allCached: ConnectionData | undefined;

export function individualPartData(): ConnectionData {
  if (allCached) return allCached;
  const products: ConnectionProduct[] = [];
  const elements: ConnectionElement[] = [];
  const bySignature = new Map<string, number>();
  let skipped = 0;
  for (const entry of PRODUCTS) {
    let parts: PartType[];
    try {
      parts = buildPlan({ ...entry, source: "catalog" }).parts;
    } catch {
      skipped++;
      continue;
    }
    const productIndex = products.length;
    const quantities = new Map<number, number>();
    for (const part of parts) {
      if (part.extra) continue;
      const signature = elementSignature(part);
      let id = bySignature.get(signature);
      if (id === undefined) {
        id = elements.length;
        bySignature.set(signature, id);
        elements.push({ key: createHash("sha256").update(signature).digest("hex").slice(0, 24), signature, names: [], name: part.name, size: dimensions(part.size), material: part.material, shape: part.shape, products: [] });
      }
      if (!elements[id].names.includes(part.name)) elements[id].names.push(part.name);
      quantities.set(id, (quantities.get(id) ?? 0) + part.qty);
    }
    for (const id of quantities.keys()) elements[id].products.push(productIndex);
    products.push({ slug: entry.slug, name: entry.name, variant: entry.variant, kind: entry.kind ?? "other", parts: [...quantities].map(([id, qty]) => ({ id, qty })) });
  }
  allCached = { products, elements, skipped };
  return allCached;
}

