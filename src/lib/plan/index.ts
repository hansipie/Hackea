import type { Plan, ProductSpec } from "../types";
import { PlanBuilder } from "./builder";
import { buildShelf } from "./shelf";
import { buildDrawers } from "./drawers";
import { buildTable } from "./table";
import { buildBed } from "./bed";
import { buildCabinet } from "./cabinet";
import { buildSeat } from "./seat";
import { buildSofa } from "./sofa";
import { buildCustom } from "./custom";
import { buildRow } from "./row";
import { buildUnits } from "./units";

const cache = new Map<string, Plan>();

export function buildPlan(spec: ProductSpec): Plan {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PlanBuilder(spec);
  if (spec.row?.units) buildUnits(b, spec, buildOne);
  else if (spec.row) buildRow(b, spec, buildOne);
  else buildOne(b, spec);
  const plan = b.build();
  // the hack editor builds a new plan on every edit: keep the most recent ones only
  if (cache.size >= 300) cache.delete(cache.keys().next().value!);
  cache.set(key, plan);
  return plan;
}

function buildOne(b: PlanBuilder, spec: ProductSpec) {
  switch (spec.archetype) {
    case "shelf":
      return buildShelf(b, spec);
    case "drawers":
      return buildDrawers(b, spec);
    case "table":
      return buildTable(b, spec);
    case "bed":
      return buildBed(b, spec);
    case "cabinet":
      return buildCabinet(b, spec);
    case "seat":
      return buildSeat(b, spec);
    case "sofa":
      return buildSofa(b, spec);
    case "custom":
      return buildCustom(b, spec);
  }
}
