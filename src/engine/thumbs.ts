import type { Plan, Vec3 } from "@/lib/types";
import type { Stage, StageMode } from "./stage";

export interface Shot {
  url: string;
  /** Image coordinates of the probe points, in CSS pixels of the requested size. */
  points: { x: number; y: number }[];
}

let stage: Stage | null = null;
let busy = false;
const cache = new Map<string, Shot>();
const waiting = new Map<string, ((s: Shot) => void)[]>();
const queue: { key: string; plan: Plan; mode: StageMode; w: number; h: number; probes?: Vec3[] }[] = [];

async function ensure() {
  if (stage) return stage;
  const { Stage } = await import("./stage");
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-9999px;top:0;width:10px;height:10px;pointer-events:none;";
  document.body.appendChild(host);
  stage = new Stage(host, { offscreen: true, loop: false, labels: false });
  stage.renderer.setPixelRatio(2);
  return stage;
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    const s = await ensure();
    while (queue.length) {
      const job = queue.shift()!;
      if (cache.has(job.key)) continue;
      s.setPlan(job.plan);
      s.setMode(job.mode, { instant: true });
      const url = s.snapshot(job.w, job.h);
      const shot: Shot = { url, points: (job.probes ?? []).map((p) => s.locate(p)) };
      cache.set(job.key, shot);
      waiting.get(job.key)?.forEach((cb) => cb(shot));
      waiting.delete(job.key);
      await new Promise((r) => setTimeout(r, 8));
    }
  } finally {
    busy = false;
  }
}

/** Render a static line drawing and report where the probe points landed in the image. */
export function shot(key: string, plan: Plan, mode: StageMode, w = 360, h = 270, probes?: Vec3[]): Promise<Shot> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const list = waiting.get(key) ?? [];
    list.push(resolve);
    waiting.set(key, list);
    if (!queue.some((q) => q.key === key)) queue.push({ key, plan, mode, w, h, probes });
    pump();
  });
}

/** Render a static line drawing of a plan (whole product, one part, or one step). */
export function thumbnail(key: string, plan: Plan, mode: StageMode, w = 360, h = 270): Promise<string> {
  return shot(key, plan, mode, w, h).then((s) => s.url);
}

/**
 * Like thumbnail, but the returned function takes the request back: a drawing nobody waits for any more
 * leaves the queue before it renders, so a long grid scrolled past quickly doesn't render every card.
 */
export function requestThumbnail(key: string, plan: Plan, mode: StageMode, w: number, h: number, done: (url: string) => void): () => void {
  const hit = cache.get(key);
  if (hit) {
    done(hit.url);
    return () => {};
  }
  const cb = (s: Shot) => done(s.url);
  const list = waiting.get(key) ?? [];
  list.push(cb);
  waiting.set(key, list);
  if (!queue.some((q) => q.key === key)) queue.push({ key, plan, mode, w, h });
  pump();
  return () => {
    const left = waiting.get(key);
    if (!left) return;
    const i = left.indexOf(cb);
    if (i >= 0) left.splice(i, 1);
    if (left.length) return;
    waiting.delete(key);
    const j = queue.findIndex((q) => q.key === key);
    if (j >= 0) queue.splice(j, 1);
  };
}

export function peekThumbnail(key: string) {
  return cache.get(key)?.url;
}

export function peekShot(key: string) {
  return cache.get(key);
}
