"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/types";
import type { StageMode } from "@/engine/stage";
import { peekThumbnail, requestThumbnail } from "@/engine/thumbs";
import { useMounted } from "@/lib/useMounted";

/**
 * A static line drawing of a plan, rendered offscreen. With `lazy`, it renders only while it is on screen
 * (or about to be): one scrolled past before its turn comes is taken off the render queue.
 */
export default function Thumb({
  id,
  plan,
  mode,
  w = 360,
  h = 270,
  className,
  alt = "",
  lazy,
}: {
  id: string;
  plan: Plan | null | (() => Plan);
  mode: StageMode;
  w?: number;
  h?: number;
  className?: string;
  alt?: string;
  lazy?: boolean;
}) {
  const key = `${id}:${JSON.stringify(mode)}:${w}x${h}`;
  const mounted = useMounted();
  const el = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(!lazy);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const url = (mounted ? peekThumbnail(key) : undefined) ?? (loaded?.key === key ? loaded.url : undefined);

  useEffect(() => {
    if (!lazy || !el.current) return;
    const io = new IntersectionObserver((e) => setNear(e[e.length - 1].isIntersecting), { rootMargin: "200px" });
    io.observe(el.current);
    return () => io.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!near || !plan || peekThumbnail(key)) return;
    let alive = true;
    const p = typeof plan === "function" ? plan() : plan;
    const cancel = requestThumbnail(key, p, mode, w, h, (u) => alive && setLoaded({ key, url: u }));
    return () => {
      alive = false;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, plan, near]);

  return (
    <span ref={el} className={"thumb " + (className ?? "") + (url ? " ready" : "")} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={alt} draggable={false} />}
    </span>
  );
}
