"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { listProgress } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { IArrowRight } from "../art/Icons";

/** For someone coming back mid-build: one tap back to the step they were on. */
export default function Resume() {
  const mounted = useMounted();
  const p = useMemo(() => {
    if (!mounted) return null;
    return listProgress().find((x) => x.phase === "steps" || x.phase === "parts" || x.phase === "tools") ?? null;
  }, [mounted]);
  if (!p) return null;
  const pct = p.phase === "steps" ? p.step / Math.max(1, p.steps) : 0.04;
  const where = p.phase === "steps" ? `step ${p.step + 1} of ${p.steps}` : p.phase === "parts" ? "checking parts" : "checking tools";
  const href = `/build/${p.slug}${p.spec ? `?q=${encodeURIComponent(p.spec.name)}` : ""}`;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <Link href={href} className="resume">
        <svg viewBox="0 0 36 36" width={34} height={34} className="resume-ring" aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line-2)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${Math.max(0.04, pct) * 94.25} 94.25`} transform="rotate(-90 18 18)" />
        </svg>
        <span>
          <b>Continue {p.name}</b>
          <span>You were on {where}</span>
        </span>
        <IArrowRight size={18} />
      </Link>
    </motion.div>
  );
}
