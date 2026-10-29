"use client";

import { getPref, setPref } from "@/lib/store";

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;

export function soundOn() {
  if (enabled === null) enabled = getPref("sound", true);
  return enabled;
}
export function setSound(v: boolean) {
  enabled = v;
  setPref("sound", v);
}

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function blip(freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.92, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A soft wooden click, like a dowel seating. */
export function playTick() {
  if (!soundOn()) return;
  blip(880, 0, 0.06, 0.05, "triangle");
  blip(1320, 0.012, 0.05, 0.025, "sine");
}

/** Step done: two quick rising notes. */
export function playStep() {
  if (!soundOn()) return;
  blip(660, 0, 0.12, 0.06, "triangle");
  blip(990, 0.07, 0.16, 0.05, "triangle");
}

/** Finished: a small chord. */
export function playDone() {
  if (!soundOn()) return;
  [523, 659, 784, 1047].forEach((f, i) => blip(f, i * 0.07, 0.5, 0.045, "triangle"));
}
