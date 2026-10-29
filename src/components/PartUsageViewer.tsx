"use client";

import { useMemo } from "react";
import type { ProductSpec } from "@/lib/types";
import { buildPlan } from "@/lib/plan";
import StageView from "./StageView";

const MODE = { kind: "assembled", ghost: true } as const;

export default function PartUsageViewer({ spec, refs }: { spec: ProductSpec; refs: string[] }) {
  const plan = useMemo(() => buildPlan(spec), [spec]);
  return <div className="pv-stage individual-stage"><StageView plan={plan} mode={MODE} highlight={refs} options={{ interactive: true }} /></div>;
}
