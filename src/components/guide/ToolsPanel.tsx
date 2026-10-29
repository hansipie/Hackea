"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Plan, ToolId } from "@/lib/types";
import { ToolArt, TOOL_INFO } from "../art/Tools";
import { IArrowLeft, IArrowRight, ICheck, IRotate } from "../art/Icons";
import { haptic } from "./hooks";
import { playTick } from "./sound";

/**
 * Tools are an exception check: one tap says "I have everything".
 * Tapping a card flips it to show what to use instead.
 */
export default function ToolsPanel({ plan, onNext, onBack }: { plan: Plan; onNext: (have: ToolId[]) => void; onBack: () => void }) {
  const required = plan.tools.filter((t) => !t.optional);
  const optional = plan.tools.filter((t) => t.optional);
  const [flipped, setFlipped] = useState<ToolId | null>(null);
  const [checked, setChecked] = useState<Set<ToolId>>(new Set());
  const [going, setGoing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const confirm = () => {
    if (going) return;
    setGoing(true);
    setFlipped(null);
    const all = [...required, ...optional].map((t) => t.id);
    all.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          setChecked((s) => new Set(s).add(id));
          haptic(6);
          playTick();
        }, 90 + i * 85),
      );
    });
    timers.current.push(setTimeout(() => onNext(all), 90 + all.length * 85 + 380));
  };

  const card = (id: ToolId, i: number, small?: boolean) => {
    const t = plan.tools.find((x) => x.id === id)!;
    const info = TOOL_INFO[id];
    const on = checked.has(id);
    const flip = flipped === id;
    return (
      <motion.div
        key={id}
        className={"tcard" + (small ? " small" : "") + (on ? " on" : "")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 + i * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <button className={"tcard-inner" + (flip ? " flipped" : "")} onClick={() => !going && setFlipped(flip ? null : id)} aria-label={`${info.name}. ${flip ? "Hide" : "Show"} a workaround`}>
          <span className="tface front">
            <span className="tart">
              <ToolArt id={id} size={small ? 58 : 84} />
            </span>
            <span className="tname">{info.name}</span>
            <span className="thint">{t.why ?? info.hint}</span>
            {t.included && <span className="tbadge">In the box</span>}
            <motion.span className="tcheck" initial={false} animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
              <ICheck size={16} strokeWidth={3} />
            </motion.span>
          </span>
          {/* small cards skip the title: the tool was just tapped, so the tip says enough */}
          <span className="tface back">
            {!small && <span className="tback-title">No {info.name.toLowerCase()}?</span>}
            <span className="tback-text">{small ? (info.short ?? info.alt) : info.alt}</span>
            <span className="tback-flip" aria-hidden="true">
              <IRotate size={13} strokeWidth={2.4} />
            </span>
          </span>
        </button>
      </motion.div>
    );
  };

  return (
    <div className="pane">
      <div className="pane-scroll">
        <header className="pane-head">
          <p className="eyebrow">Before you start</p>
          <h2>Grab your tools</h2>
          <p className="sub">Missing one? Tap it for a workaround.</p>
        </header>
        <div className="tgrid">{required.map((t, i) => card(t.id, i))}</div>
        {optional.length > 0 && (
          <>
            <h3 className="section-title">Nice to have</h3>
            <div className="tgrid three">{optional.map((t, i) => card(t.id, required.length + i, true))}</div>
          </>
        )}
      </div>
      <div className="pane-foot">
        <button className="btn round" onClick={onBack} aria-label="Back">
          <IArrowLeft />
        </button>
        <button className={"btn primary big" + (going ? " going" : "")} onClick={confirm} autoFocus>
          <span>{going ? "Great, let's go" : "I have everything"}</span>
          <IArrowRight />
        </button>
      </div>
    </div>
  );
}
