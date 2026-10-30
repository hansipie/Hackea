"use client";

import { useCallback, useState, type FocusEvent, type MouseEvent } from "react";
import Thumb from "../../Thumb";
import { buildPlan } from "@/lib/plan";
import { catalogSpec } from "@/lib/catalog";

interface Tip {
  slug: string;
  ref?: string;
  top: number;
  left: number;
}

const W = 240;
const H = 180;

/** Hover and focus handlers for a search result, and the picture card they show beside it. */
export function usePreview() {
  const [tip, setTip] = useState<Tip | null>(null);
  const hide = useCallback(() => setTip(null), []);
  const on = useCallback(
    (slug: string, ref?: string) => {
      const show = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        // beside the panel, on its right; flipped to the left when there is no room
        const left = r.right + 12 + W > window.innerWidth ? Math.max(8, r.left - 12 - W) : r.right + 12;
        const top = Math.min(Math.max(8, r.top + r.height / 2 - H / 2), window.innerHeight - H - 8);
        setTip({ slug, ref, top, left });
      };
      return { onMouseEnter: show, onFocus: show, onMouseLeave: hide, onBlur: hide };
    },
    [hide],
  );
  return { tip, on, hide };
}

/** The line drawing of a piece of furniture, or of one of its parts, in a card that floats beside the result. */
export function PreviewCard({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const { slug, ref } = tip;
  return (
    <div className="wk-preview" role="presentation" style={{ top: tip.top, left: tip.left, width: W }}>
      <Thumb
        key={slug + (ref ?? "")}
        id={"lib-" + slug}
        plan={() => buildPlan(catalogSpec(slug)!)}
        mode={ref ? { kind: "part", ref } : { kind: "assembled" }}
        w={W * 2}
        h={H * 2}
        className="wk-preview-art"
      />
    </div>
  );
}
