"use client";

import type { Plan } from "@/lib/types";
import { shot } from "@/engine/thumbs";

const W = 1080;
const H = 1350;

function font(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function load(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Shrinks text until it fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, family: string, weight: number) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 4;
  } while (ctx.measureText(text).width > max && s > 40);
}

/** The logo mark: an Allen bolt head seen from above. */
function mark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#ffd21f";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const hex = (rr: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  ctx.fillStyle = "#121212";
  hex(r * 0.62);
  ctx.fill();
  ctx.fillStyle = "#ffd21f";
  hex(r * 0.3);
  ctx.fill();
}

/** A 4:5 picture of the finished piece, sized for a post on X or a story. */
export async function buildCard(plan: Plan, key: string, stat: string): Promise<Blob | null> {
  try {
    await document.fonts?.ready;
    const art = await shot(`card:${key}`, plan, { kind: "assembled" }, 900, 760);
    const img = await load(art.url);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const display = font("--font-display", "system-ui, sans-serif");
    const body = font("--font-noto", "system-ui, sans-serif");

    ctx.fillStyle = "#f5f4f0";
    ctx.fillRect(0, 0, W, H);
    round(ctx, 48, 48, W - 96, H - 96, 56);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e8e6e0";
    ctx.stroke();

    // multiply, so the drawing's own white sheet melts into the card instead of showing as a box
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, 90, 96, 900, 760);
    ctx.globalCompositeOperation = "source-over";

    // the stamp: a yellow check, like a finished page in a manual
    ctx.fillStyle = "#ffd21f";
    ctx.beginPath();
    ctx.arc(W - 150, 150, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#121212";
    ctx.stroke();
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(W - 176, 152);
    ctx.lineTo(W - 156, 172);
    ctx.lineTo(W - 120, 132);
    ctx.stroke();

    ctx.fillStyle = "#8a877f";
    ctx.font = `600 30px ${body}`;
    ctx.letterSpacing = "4px";
    ctx.fillText("I BUILT", 110, 950);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#121212";
    fit(ctx, plan.spec.name, W - 220, 132, display, 800);
    ctx.fillText(plan.spec.name, 104, 1070);
    ctx.fillStyle = "#4a4945";
    fit(ctx, plan.spec.variant, W - 220, 42, body, 500);
    ctx.fillText(plan.spec.variant, 110, 1130);

    ctx.fillStyle = "#121212";
    ctx.font = `700 38px ${body}`;
    ctx.fillText(stat, 110, 1206);

    ctx.strokeStyle = "#e8e6e0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 1236);
    ctx.lineTo(W - 110, 1236);
    ctx.stroke();
    mark(ctx, 134, 1270, 22);
    ctx.fillStyle = "#121212";
    ctx.font = `800 30px ${display}`;
    ctx.fillText("Hac/<ea", 168, 1281);
    ctx.fillStyle = "#8a877f";
    ctx.font = `500 26px ${body}`;
    const host = location.host.replace(/^www\./, "");
    ctx.textAlign = "right";
    ctx.fillText(`Step by step in 3D, ${host}`, W - 110, 1280);
    ctx.textAlign = "left";

    return await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  } catch {
    return null;
  }
}
