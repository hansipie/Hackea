"use client";

import { useEffect } from "react";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { specForKind } from "@/lib/search";
import type { Kind } from "@/lib/products";
import type { StageMode } from "@/engine/stage";
import { shot } from "@/engine/thumbs";

declare global {
  interface Window {
    __draw?: (o: { slug?: string; kind?: Kind; mode?: StageMode; w: number; h: number }) => Promise<string | null>;
  }
}

export default function Renderer() {
  useEffect(() => {
    window.__draw = async ({ slug, kind, mode, w, h }) => {
      const spec = slug ? catalogSpec(slug) : kind ? { ...specForKind(kind, "X"), slug: "kind-" + kind } : null;
      if (!spec) return null;
      const plan = buildPlan(spec);
      const s = await shot(`og:${slug ?? kind}:${JSON.stringify(mode)}`, plan, mode ?? { kind: "assembled" }, w, h);
      return s.url;
    };
    document.body.dataset.ready = "1";
  }, []);
  return null;
}
