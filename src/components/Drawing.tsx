"use client";

import { useState } from "react";

/**
 * A catalog product's line drawing, drawn ahead of time by the engine
 * (public/og, scripts/og/render.mjs). Instant and cacheable, with no WebGL,
 * so long lists stay smooth on phones. Use <Thumb> for anything not in the catalog.
 * `fallback` is shown if this product hasn't been drawn yet (its kind, say).
 */
export default function Drawing({ name, fallback, w, h, className, alt = "", eager }: { name: string; fallback?: string; w: number; h: number; className?: string; alt?: string; eager?: boolean }) {
  const [miss, setMiss] = useState(false);
  const src = miss && fallback ? fallback : name;
  return (
    <span className={"thumb ready drawing " + (className ?? "")} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={`/og/${encodeURIComponent(src)}.png`}
        alt={alt}
        width={w}
        height={h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={(e) => (miss || !fallback ? ((e.target as HTMLImageElement).style.visibility = "hidden") : setMiss(true))}
      />
    </span>
  );
}
