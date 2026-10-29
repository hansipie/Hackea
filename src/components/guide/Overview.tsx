"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import type { Plan } from "@/lib/types";
import Thumb from "../Thumb";
import { ICheck, IClose } from "../art/Icons";

export default function Overview({ plan, current, doneUpTo, onPick, onClose }: { plan: Plan; current: number; doneUpTo: number; onPick: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const id = plan.spec.name + plan.spec.variant;
  return (
    <motion.div className="overlay-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="overview"
        role="dialog"
        aria-label="All steps"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overview-head">
          <div>
            <h2>All steps</h2>
            <p className="sub">Like flipping through the manual. Tap any page to jump there.</p>
          </div>
          <button className="btn round small" onClick={onClose} aria-label="Close">
            <IClose />
          </button>
        </div>
        <div className="overview-grid">
          {plan.steps.map((s, i) => (
            <motion.button
              key={i}
              className={"page" + (i === current ? " current" : "") + (i < doneUpTo ? " done" : "")}
              onClick={() => onPick(i)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(0.4, i * 0.025) }}
            >
              <span className="page-n">{i + 1}</span>
              {i < doneUpTo && (
                <span className="page-done">
                  <ICheck size={14} strokeWidth={3} />
                </span>
              )}
              <Thumb id={id} plan={plan} mode={{ kind: "step", index: i }} w={260} h={190} className="page-thumb" />
              <span className="page-title">{s.title}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
