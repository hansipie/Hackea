"use client";

import { useEffect, useRef } from "react";
import type { Plan } from "@/lib/types";
import type { Stage, StageMode, StageOptions } from "@/engine/stage";

export interface StageHandle {
  replay(): void;
  resetView(): void;
  setSpeed(s: number): void;
  setPaused(p: boolean): void;
}

export default function StageView({
  plan,
  mode,
  highlight,
  options,
  className,
  onReady,
  onIntroDone,
  onHover,
  onUserView,
  paused,
  speed,
}: {
  plan: Plan | null;
  mode: StageMode;
  highlight?: string[] | null;
  options?: Omit<StageOptions, "onIntroDone" | "onHover" | "onUserView">;
  className?: string;
  onReady?: (h: StageHandle) => void;
  onIntroDone?: () => void;
  onHover?: (ref: string | null) => void;
  onUserView?: (changed: boolean) => void;
  paused?: boolean;
  speed?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const cbs = useRef({ onIntroDone, onHover, onUserView, onReady });
  useEffect(() => {
    cbs.current = { onIntroDone, onHover, onUserView, onReady };
  });
  const modeKey = JSON.stringify(mode);
  const latest = useRef({ plan, mode, highlight });
  useEffect(() => {
    latest.current = { plan, mode, highlight };
  });

  useEffect(() => {
    let alive = true;
    let s: Stage | null = null;
    import("@/engine/stage").then(({ Stage }) => {
      if (!alive || !host.current) return;
      s = new Stage(host.current, {
        ...options,
        onIntroDone: () => cbs.current.onIntroDone?.(),
        onHover: (r) => cbs.current.onHover?.(r),
        onUserView: (c) => cbs.current.onUserView?.(c),
      });
      stage.current = s;
      const { plan: p, mode: m, highlight: h } = latest.current;
      if (p) {
        s.setPlan(p);
        s.setMode(m);
      }
      s.setHighlight(h ?? null);
      cbs.current.onReady?.({
        replay: () => s?.replay(),
        resetView: () => s?.resetView(),
        setSpeed: (v) => s?.setSpeed(v),
        setPaused: (v) => s?.setPaused(v),
      });
    });
    return () => {
      alive = false;
      s?.dispose();
      stage.current = null;
    };
    // options are read once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = stage.current;
    if (!s || !plan) return;
    const fresh = s.plan !== plan;
    s.setPlan(plan);
    if (fresh) s.setMode(latest.current.mode);
  }, [plan]);

  useEffect(() => {
    const s = stage.current;
    if (!s || !s.plan) return;
    s.setMode(latest.current.mode);
  }, [modeKey]);

  useEffect(() => {
    stage.current?.setHighlight(highlight ?? null);
  }, [highlight]);

  useEffect(() => {
    stage.current?.setPaused(!!paused);
  }, [paused]);
  useEffect(() => {
    stage.current?.setSpeed(speed ?? 1);
  }, [speed]);

  return <div ref={host} className={"stage " + (className ?? "")} />;
}
