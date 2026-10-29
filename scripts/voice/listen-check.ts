/**
 * Replays recorded listening through the guide's own code, with no network:
 * the speech detector on each run's mic levels, and the decisions on what
 * transcription actually wrote back for each piece, along the voice's timeline.
 * Fails on a step moved by her or by noise, on a "next" she should hear and
 * doesn't, and on any decision that differs from the recording's.
 *
 * listen-fixtures.json comes from 283 runs of desktop Chrome's echo cancelling
 * stand-in: her lines mixed in at echo levels from as loud as the person (0
 * dB, no cancelling) to gone, with macOS and recorded voices saying "next" in
 * many ways, chatting, sound-alikes ("text", "neck"), hammering, drilling,
 * music, TV, and her alone reading lines that themselves say "next". Levels
 * are one character a 50 ms frame (40 + dB below full scale); pieces are
 * [start, end, window, what transcription wrote]. Run with `npm run voice:check`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { hearIntent } from "@/lib/voice/commands";
import { FRAME_MS, RATE, segmenter } from "@/lib/voice/talk";
import { voice } from "@/components/guide/voice";

type Run = { name: string; expect: string | null; timeline: [number, number, number][]; userAt: number[]; levels: string; pieces: [number, number, number, string][]; acted: string | null };
const { lines, runs }: { lines: string[]; runs: Run[] } = JSON.parse(readFileSync(path.join(import.meta.dirname, "listen-fixtures.json"), "utf8"));

// the voice runs on a clock this script moves along her timeline
let clock = 0;
Date.now = () => clock;
const v = voice as unknown as { set(t: string): void; now: string; said: unknown[]; ended: number };

function decide(run: Run) {
  v.now = "";
  v.said = [];
  v.ended = -1e9;
  for (const [i, start, end] of run.timeline) {
    clock = start;
    v.set(lines[i]);
    clock = end;
    v.set("");
  }
  const her = (t: number) => run.timeline.some(([, s, e]) => s <= t && t < e + 1500);
  // the first piece that acts is the decision: listening stops for that step there
  for (const [start, end, over, text] of run.pieces) {
    if (!text.trim()) continue;
    // an answer comes back a moment after the piece ends
    clock = end + 900;
    const intent = hearIntent(text, { start, end, over: !!over }, voice.linesBetween(start, end), her(end) || voice.spokeBetween(start, end));
    if (intent) return { kind: intent.kind, at: end, text };
  }
  return null;
}

// the detector on the run's levels: frames of a steady tone at each level
function pieces(run: Run) {
  const cut = segmenter();
  const out: { start: number; end: number; over: boolean }[] = [];
  const size = (RATE * FRAME_MS) / 1000;
  [...run.levels].forEach((c, i) => {
    const t = i * FRAME_MS;
    const seg = cut(new Float32Array(size).fill(10 ** (-(c.charCodeAt(0) - 40) / 20)), t, run.timeline.some(([, s, e]) => s <= t && t < e + 1500));
    if (seg) out.push(seg);
  });
  return out;
}

let bad = 0;
const tally = { caught: 0, missed: 0, quiet: 0, moved: 0 };
for (const run of runs) {
  const got = decide(run);
  const problems: string[] = [];
  if ((got?.kind ?? null) !== run.acted) problems.push(`decided ${got?.kind ?? "nothing"}, recorded ${run.acted ?? "nothing"}`);
  if (!run.expect && got && run.acted === null) problems.push(`moved by "${got.text}"`);
  if (run.expect && got && run.userAt.length && got.at < run.userAt[0] - 200) problems.push(`acted before anyone spoke, on "${got.text}"`);
  // where echo cancelling works, everyone who speaks ends up in a piece that goes to transcription
  const echo = Number(/_e(-?\d+)/.exec(run.name)?.[1] ?? NaN);
  const found = pieces(run);
  for (const at of echo <= -25 ? run.userAt : []) if (!found.some((p) => p.start <= at + 300 && p.end >= at + 300)) problems.push(`nobody listened at ${at} ms`);
  if (run.expect && got?.kind === run.expect) tally.caught++;
  else if (run.expect) tally.missed++;
  else if (got) tally.moved++;
  else tally.quiet++;
  if (problems.length) {
    bad++;
    console.log(`FAIL ${run.name}: ${problems.join("; ")}`);
  }
}
const known = runs.filter((r) => !r.expect && r.acted).map((r) => r.name);
console.log(`\n${runs.length} runs: ${tally.caught} commands caught, ${tally.missed} missed (mostly with no echo cancelling at all), ${tally.quiet} rightly left alone, ${tally.moved} moved by a sound-alike (${known.join(", ")})`);
console.log(bad ? `${bad} runs differ` : "all decisions match the recording");
if (bad) process.exit(1);
