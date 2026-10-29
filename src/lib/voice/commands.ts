/**
 * Turns what the mic heard into an intent. Only short, whole phrases count as
 * commands, so talking to a friend ("hold the back panel") never moves a step.
 */

import { numWords } from "./script";

export type Intent =
  | { kind: "next" | "back" | "repeat" | "replay" | "stop" | "needs" | "where" | "slower" | "faster" | "help" | "commands" | "off" }
  | { kind: "goto"; step: number }
  | { kind: "ask"; text: string };

type Kind = Exclude<Intent["kind"], "goto" | "ask">;

const PHRASES: Record<Kind, string[]> = {
  next: ["next", "next step", "next one", "next please", "skip", "skip it", "skip this one", "done", "im done", "i am done", "all done", "finished", "im finished", "continue", "go on", "go ahead", "keep going", "move on", "whats next", "what is next"],
  back: ["back", "go back", "previous", "previous step", "previous one", "step back", "go back one", "back one", "undo"],
  repeat: ["again", "repeat", "repeat that", "say again", "say that again", "what", "sorry", "pardon", "come again", "one more time", "what did you say", "huh"],
  replay: ["show me", "show me again", "show again", "replay", "play again", "watch again", "show"],
  stop: ["stop", "quiet", "shh", "shush", "hush", "hold on", "wait", "pause", "be quiet", "stop talking", "enough"],
  needs: ["how many", "what do i need", "what parts", "which parts", "which screws", "what screws", "parts", "what hardware"],
  where: ["where am i", "what step", "which step", "what step am i on", "which step am i on", "how many left", "how far", "how much left", "how many steps left"],
  slower: ["slower", "slow down", "too fast", "more slowly", "slowly", "speak slower", "slow"],
  faster: ["faster", "speed up", "normal speed", "quicker"],
  help: ["help", "im stuck", "i am stuck", "stuck", "i need help"],
  commands: ["what can i say", "commands", "what do i say", "options"],
  off: ["voice off", "stop listening", "turn off voice", "turn voice off", "goodbye"],
};

const LOOKUP = new Map<string, Kind>();
for (const [k, list] of Object.entries(PHRASES) as [Kind, string[]][]) for (const p of list) LOOKUP.set(p, k);

const FILLER = new Set(["um", "uh", "er", "erm", "hmm", "okay", "ok", "alright", "right", "so", "please", "now", "then", "hey", "bygga", "hackea", "thanks", "thank", "you", "and", "yeah", "yes"]);

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, first: 1, last: -1,
};

/** Words a real question about the build tends to contain. */
const BUILD_WORDS = /\b(screw|bolt|dowel|cam|panel|part|piece|hole|side|leg|drawer|door|shelf|hinge|lock|top|bottom|front|wall|tool|allen|key|hammer|nail|tight|loose|fit|wobbl|step|runner|plinth|frame|rail|slat|knob|handle|upside|way round|which way)/;
const QUESTION = /^(how|what|where|which|why|does|do|is|are|can|should|when|whats|wheres|hows)\b/;

export function normalize(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function parse(raw: string): Intent | null {
  const all = normalize(raw);
  // drop fillers only at the edges: "okay next please" is "next"
  let a = 0,
    b = all.length;
  while (a < b && FILLER.has(all[a])) a++;
  while (b > a && FILLER.has(all[b - 1])) b--;
  const words = all.slice(a, b);
  if (!words.length) return null;
  const text = words.join(" ");

  const hit = LOOKUP.get(text);
  if (hit) return { kind: hit };

  const go = text.match(/^(?:go to |jump to |skip to )?(?:step|number) (\w+)$/);
  if (go) {
    const n = NUM[go[1]] ?? Number(go[1]);
    if (n && Number.isFinite(n)) return { kind: "goto", step: n };
  }

  if (/^how many steps/.test(text)) return { kind: "where" };
  if (/^(how many|what do i need)\b/.test(text) && words.length <= 7) return { kind: "needs" };

  if (words.length >= 4 && QUESTION.test(text) && BUILD_WORDS.test(text)) return { kind: "ask", text: raw.trim() };
  return null;
}

// how a recognizer may write back what the voice said: digits and sound-alikes
const ALIKE: Record<string, string> = { won: "one", to: "two", too: "two", for: "four", fore: "four", ate: "eight" };

/** Words of a line the way a recognizer might write them, for telling her words from the person's. */
export function canon(text: string) {
  return normalize(text).flatMap((w) => (/^\d+$/.test(w) ? numWords(Number(w)).split("-") : [ALIKE[w] ?? w]));
}

/** Small words that belong to whoever said the words around them. */
const GLUE = new Set(["the", "a", "an", "and", "to", "two", "in", "into", "on", "of", "it", "its", "is", "you", "your", "youll", "i", "im", "this", "that", "with", "for", "four", "at", "by", "up", "out", "then", "so", "now", "just", "we", "be"]);

/** Words that can come with a plain "next" ("what's next", "next please"); not "step", which is how "last step" is misheard. */
const PLAIN = new Set(["next", "whats", "lets", "go", "yep", "yup", "ok", "okay"]);

/** One of her lines and when she said it (Date.now() times), for telling her words from the person's. */
export interface Said {
  words: string[];
  start: number;
  end: number;
}

/** A piece of mic audio: when it was heard, and whether it was a window taken while she read. */
export interface Piece {
  start: number;
  end: number;
  over: boolean;
}

/**
 * One letter added, dropped or changed, how a recognizer mishears her ("bottom" as "bottoms"). Only for
 * longer words: short ones are too close to each other ("step" and "stop") and to the commands.
 */
function close(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** When she said a word of a line, roughly: lines are read at an even pace. */
function wordAt(l: Said, i: number) {
  return l.start + ((i + 0.5) / l.words.length) * (l.end - l.start);
}

/**
 * Which words of a transcript were hers. A word only counts as hers next to
 * another of her words, so "back" alone is the person's even while she reads
 * "the back panel"; in a window under her reading every match counts. "next"
 * also has to be one she said inside the piece: "...before starting the next"
 * a second earlier doesn't hide a "next" said now.
 */
function herMask(words: string[], piece: Piece, lines: Said[]) {
  const match = words.map((w) => {
    if (GLUE.has(w)) return false;
    const parts = canon(w);
    return lines.some((l) => parts.every((p) => l.words.some((h) => close(p, h))));
  });
  const mask = words.map((w, i) => {
    if (!match[i]) return false;
    if (!piece.over && !match.some((m, j) => m && j !== i && Math.abs(j - i) <= 2)) return false;
    if (w !== "next") return true;
    return lines.some((l) => l.words.some((h, k) => h === "next" && wordAt(l, k) >= piece.start - 900 && wordAt(l, k) <= piece.end + 400));
  });
  // in a window of her reading, a "next" right up against her words is a mishearing of her: "last step" heard as "next step"
  return { match, mask: words.map((w, i) => mask[i] || (piece.over && w === "next" && (match[i - 1] || match[i + 1]))) };
}

/**
 * What a piece of talk from the mic asks for. Her own words are set aside
 * first (the mic can still catch a little of her), then "next" anywhere in
 * what's left moves on, so it works mid-sentence or said in passing.
 * Anything else has to be the whole phrase ("go back", "again"), and
 * questions wait until she isn't `talking`. A window taken under her reading,
 * or a piece that turns out to be mostly her, can only move on, and only for
 * a "next" standing nearly alone: Transcription can finish a line of hers cut off
 * mid-word with words of its own ("when you're done, go to the next slide").
 */
export function hearIntent(transcript: string, piece: Piece, lines: Said[], talking: boolean): Intent | null {
  const words = normalize(transcript);
  // a piece that's mostly her words is her echo, however it started: it gets the same care as a window.
  // only longer words count here, since "do" and "one" turn up in anyone's sentence, and "next" itself doesn't
  const long = (w: string) => w.length >= 4 && !GLUE.has(w) && w !== "next";
  const content = words.filter(long).length;
  const first = herMask(words, piece, lines);
  const hersMostly = !piece.over && content >= 2 && words.filter((w, i) => long(w) && first.match[i]).length * 2 >= content;
  if (hersMostly) piece = { ...piece, over: true };
  const { mask } = hersMostly ? herMask(words, piece, lines) : first;
  const own = words.filter((_, i) => !mask[i]);
  if (own.includes("next")) {
    if (!piece.over) return { kind: "next" };
    // under her reading, only a plain "next" said on its own: "next", "okay, next", "what's next?"
    return own.every((w) => GLUE.has(w) || FILLER.has(w) || PLAIN.has(w)) ? { kind: "next" } : null;
  }
  if (piece.over) return null;
  const intent = parse(own.join(" "));
  if (!intent || (intent.kind === "ask" && talking)) return null;
  // a question goes to the helper as it was said, punctuation and all
  return intent.kind === "ask" ? { kind: "ask", text: transcript.trim() } : intent;
}
