import "server-only";
import { isQuotaError } from "../providerError";

/** Short recorded pieces of microphone audio, transcribed by OpenAI. */
export const STT = {
  models: ["gpt-transcribe"],
  label: "OpenAI transcription",
};

/** Transcribes one piece of audio. Errors include the HTTP status for the route. */
export async function transcribe(wav: ArrayBuffer, key: string, signal?: AbortSignal) {
  const form = new FormData();
  form.set("file", new Blob([wav], { type: "audio/wav" }), "talk.wav");
  form.set("model", STT.models[0]);
  form.append("languages[]", "en");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal,
  });
  if (r.ok) return String(((await r.json()) as { text?: unknown }).text ?? "").trim();
  const body = await r.text();
  throw new Error(`${STT.models[0]} ${isQuotaError(r.status, body) ? 402 : r.status}: ${body.slice(0, 160)}`);
}
