import { NAMES as SPELLED } from "./names";
import { isQuotaError } from "../providerError";

/** One OpenAI voice for recorded clips and live lines. */
export const TTS = {
  model: "gpt-4o-mini-tts",
  voice: "marin",
  name: "Marin",
  label: "OpenAI AI-generated voice",
  // Conservative character-based recording budget estimate, not a billing quote.
  usdPer1K: 0.02,
};

const NAMES = Object.entries(SPELLED);

/** Plain phonetic respellings, without provider-specific pronunciation markup. */
export function forTTS(text: string) {
  let t = text;
  for (const [name, spelling] of NAMES) if (t.includes(name)) t = t.replace(new RegExp(`(?<!\\p{L})${name}(?!\\p{L})`, "gu"), spelling);
  return t;
}

/** Renders an MP3 on the visitor's key, or the recording script's key. */
export async function speak(text: string, key: string) {
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS.model,
      voice: TTS.voice,
      input: text,
      instructions: "Speak in warm, clear American English at a steady pace. Read only the supplied furniture assembly instruction.",
      response_format: "mp3",
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`openai tts ${isQuotaError(r.status, body) ? 402 : r.status}: ${body.slice(0, 200)}`);
  }
  return r.arrayBuffer();
}
