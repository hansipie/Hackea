"use client";

import { motion } from "motion/react";

/** Round check that fills and draws its tick. */
export function CheckDot({ on, size = 28 }: { on: boolean; size?: number }) {
  return (
    <span className={"checkdot" + (on ? " on" : "")} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <motion.circle
          cx="12"
          cy="12"
          r="10.5"
          initial={false}
          animate={{ fill: on ? "var(--ink)" : "rgba(255,255,255,1)", stroke: on ? "var(--ink)" : "var(--line-2)" }}
          strokeWidth="1.8"
          transition={{ duration: 0.18 }}
        />
        <motion.path
          d="M7 12.4l3.3 3.3L17.2 8.8"
          fill="none"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={{ duration: on ? 0.32 : 0.12, ease: [0.65, 0, 0.35, 1], delay: on ? 0.05 : 0 }}
        />
      </svg>
    </span>
  );
}

export function Count({ n }: { n: number }) {
  return (
    <span className="count" key={n}>
      <motion.span key={n} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
        {n}
      </motion.span>
    </span>
  );
}

export function Ring({ value, size = 44, label }: { value: number; size?: number; label?: React.ReactNode }) {
  const r = size / 2 - 3;
  const c = Math.PI * 2 * r;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={value >= 1 ? "var(--ink)" : "var(--accent)"}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label">{label}</span>
    </span>
  );
}

export function Dots({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="dots" aria-label={`Difficulty ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? "on" : ""} />
      ))}
    </span>
  );
}
