/**
 * Finds the bits of the mic worth listening to: someone talking, cut into
 * short pieces with a little audio from just before, so a word's start isn't
 * lost. Frames are 50 ms of 16 kHz audio.
 *
 * The mic can still hear a little of the voice even with echo cancelling, so
 * while she speaks the bar is how loud she has sounded in it lately, plus a
 * margin: a person close by is much louder than what is left of her. Noise
 * that clears the bar costs one look and nothing else: only words count.
 */

export const RATE = 16000;
export const FRAME_MS = 50;

export interface Segment {
  /** Date.now() at the first and last frame. */
  start: number;
  end: number;
  pcm: Float32Array;
  /** A window taken while she was talking, whatever its level: only "next" may act on it. */
  over: boolean;
}

export function level(frame: Float32Array) {
  let e = 0;
  for (const v of frame) e += v * v;
  return 10 * Math.log10(e / frame.length + 1e-10);
}

/** Mic audio at any rate in, 50 ms frames at 16 kHz out: the same as public/listen-worklet.js, for browsers without worklets. */
export function downsampler(rate: number, onFrame: (pcm: Float32Array) => void) {
  const step = rate / RATE;
  const size = (RATE * FRAME_MS) / 1000;
  let pos = 0,
    sum = 0,
    n = 0,
    k = 0,
    out = new Float32Array(size);
  return (input: Float32Array) => {
    for (let i = 0; i < input.length; i++) {
      // each output sample is the average of the input samples it covers: a plain low-pass before dropping the rate
      sum += input[i];
      n++;
      if (++pos >= step) {
        pos -= step;
        out[k++] = sum / n;
        sum = 0;
        n = 0;
        if (k === size) {
          onFrame(out);
          out = new Float32Array(size);
          k = 0;
        }
      }
    }
  };
}

/** How loud is loud, given the room and what's left of her in the mic. */
function bars() {
  let floor = NaN;
  // her loudest in this mic lately, fading 1 dB a second (held while someone talks), so it lasts from one step to the next; learned before it's trusted
  let peak = -90;
  let learned = 0;
  // the last few frames wait before they teach her level, so a person's first syllables don't
  const recent: { db: number; her: boolean }[] = [];
  return (db: number, her: boolean, talking: boolean) => {
    // the room's own noise follows quiet at once and noise slowly, slower still while someone talks
    floor = Number.isNaN(floor) || db < floor ? db : floor + Math.min(talking ? 0.05 : 0.25, (db - floor) * 0.05);
    recent.push({ db, her });
    if (recent.length > 4) {
      const old = recent.shift()!;
      if (old.her && !talking) {
        peak = Math.max(peak - 0.05, old.db);
        learned++;
      } else if (!talking) peak = Math.max(floor, peak - 0.05);
    }
    return {
      floor,
      // her voice stands far above the room in the mic: echo cancelling isn't doing its job here
      loudHer: learned >= 8 && peak > floor + 25,
      // until her level is known, she might be all it hears
      start: her && learned < 8 ? Infinity : Math.max(floor + 10, -58, her ? peak + 4 : -Infinity),
      keep: Math.max(floor + 6, -64, her ? peak + 2 : -Infinity),
    };
  };
}

const PRE = 8; // 400 ms kept from before the start
const WIN = 30; // while she talks, 1.5 s windows...
const STEP = 20; // ...every second, so a word cut by one is whole in the next
const TAIL = 4; // 200 ms of quiet ends a piece
const LONG = 60; // a piece is at most 3 s; talk that runs on is cut, overlapping by PRE
const MIN = 3; // at least 150 ms of it loud, or it was a knock

/**
 * Feed it every frame; it returns a piece of talk when one ends. `her` says
 * whether the voice is playing (or only just stopped).
 *
 * Someone much louder than her starts a piece. Where echo cancelling fails
 * and she comes through loud, a "next" said no louder than her starts
 * nothing, so then the mic is also looked at in overlapping windows while she
 * talks. Only then: a window of her reading is where a recognizer mishears
 * her ("last step" as "next step"), so it's never used when it isn't needed.
 */
export function segmenter() {
  const bar = bars();
  type F = { t: number; pcm: Float32Array; db: number };
  let pre: F[] = [];
  let cur: F[] | null = null;
  let win: F[] = [];
  let up = 0;
  let quiet = 0;
  let loud = 0;
  let floor = 0;

  const piece = (frames: F[], over = false): Segment => {
    const pcm = new Float32Array(frames.length * frames[0].pcm.length);
    frames.forEach((f, i) => pcm.set(f.pcm, i * f.pcm.length));
    return { start: frames[0].t, end: frames[frames.length - 1].t, pcm, over };
  };
  // a window worth a look has something in it besides the room's own hush
  const heard = (frames: F[]) => frames.some((f) => f.db > Math.max(floor + 10, -62));

  return (pcm: Float32Array, t: number, her: boolean): Segment | null => {
    const db = level(pcm);
    const b = bar(db, her, !!cur);
    floor = b.floor;
    const f = { t, pcm, db };
    if (!cur) {
      pre.push(f);
      if (pre.length > PRE) pre.shift();
      up = db > b.start ? up + 1 : 0;
      if (up >= 2) {
        cur = pre;
        pre = [];
        win = [];
        quiet = 0;
        loud = up;
        return null;
      }
      if (!her || !b.loudHer) {
        // she has just stopped: the last of the window still gets its look
        const rest = win;
        win = [];
        return rest.length >= 10 && heard(rest) ? piece(rest, true) : null;
      }
      win.push(f);
      if (win.length < WIN) return null;
      const w = win;
      win = w.slice(STEP);
      return heard(w) ? piece(w, true) : null;
    }
    cur.push(f);
    if (db > b.keep) {
      quiet = 0;
      loud++;
    } else quiet++;
    if (quiet < TAIL && cur.length < LONG) return null;
    const done = cur;
    const enough = loud >= MIN;
    if (quiet < TAIL) {
      // still talking: send what there is, and carry on from a little before the cut
      cur = done.slice(-PRE);
      loud = 0;
    } else {
      cur = null;
      pre = done.slice(-PRE);
      up = 0;
      // under her reading, the next window starts a little before this piece ended, so a word cut off here is whole there
      if (her) win = done.slice(-10);
    }
    return enough ? piece(quiet >= TAIL ? done.slice(0, done.length - TAIL + 2) : done) : null;
  };
}

/** 16-bit mono WAV, turned up so a quiet voice across the room reads as clearly as a close one. */
export function toWav(pcm: Float32Array) {
  let peak = 0;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? Math.min(16, 0.7 / peak) : 1;
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const d = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  d.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, RATE, true);
  d.setUint32(28, RATE * 2, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  str(36, "data");
  d.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i] * gain)) * 32767, true);
  return buf;
}
