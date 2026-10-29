"use client";

import { useMemo, useState } from "react";
import type { ProductSpec } from "@/lib/types";
import { buildPlan } from "@/lib/plan";
import StageView from "./StageView";

const MODE = { kind: "assembled", ghost: true } as const;

function dims(s: [number, number, number]) {
  const v = [...s].sort((a, b) => b - a).map((x) => Math.round(x / 10));
  return v[2] < 1 ? `${v[0]} × ${v[1]} cm` : `${v[0]} × ${v[1]} × ${Math.max(1, v[2])} cm`;
}

/** The parts of one piece, and the piece in 3D: the part you pick turns green, the rest goes grey. */
export default function PartViewer({ spec }: { spec: ProductSpec }) {
  const plan = useMemo(() => {
    try {
      return buildPlan(spec);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [spec]);
  const [picked, setPicked] = useState<string | null>(null);
  const highlight = useMemo(() => (picked ? [picked] : null), [picked]);

  if (!plan) return <p className="lead">This piece can&apos;t be drawn.</p>;
  const parts = plan.parts.filter((p) => !p.extra);
  return (
    <div className="pv">
      <div className="pv-stage">
        <StageView plan={plan} mode={MODE} highlight={highlight} options={{ interactive: true }} />
      </div>
      <ul className="pv-list" aria-label="Parts">
        {parts.map((p) => (
          <li key={p.id}>
            <button type="button" className={"pv-part" + (picked === p.id ? " on" : "")} aria-pressed={picked === p.id} onClick={() => setPicked(picked === p.id ? null : p.id)}>
              <span className="letter sm">{p.label}</span>
              <span className="ptext">
                <b>{p.name}</b>
                <span>{dims(p.size)}</span>
              </span>
              <span className="pqty">{p.qty}&times;</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
