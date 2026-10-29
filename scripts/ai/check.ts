/** Provider contract checks with mocked HTTP responses, no API key or paid calls. */
import assert from "node:assert/strict";
import { chat, chatText, DEV_KEY, MODELS, OpenAIError, userKey } from "@/lib/openai";
import { speak, forTTS, TTS } from "@/lib/voice/tts";
import { transcribe } from "@/lib/voice/stt";
import { VOICE_DIR } from "@/lib/voice/script";
import { isQuotaError } from "@/lib/providerError";
import { POST as checkKey } from "@/app/api/key/route";

const originalFetch = globalThis.fetch;
const originalEnv = { node: process.env.NODE_ENV, key: process.env.OPENAI_API_KEY };
const key = "sk-proj-" + "a".repeat(240);
const calls: { url: string; init: RequestInit }[] = [];
let replies: Response[] = [];
globalThis.fetch = async (input, init = {}) => {
  calls.push({ url: String(input), init });
  const response = replies.shift();
  assert.ok(response, "unexpected HTTP request");
  return response;
};
const json = (body: unknown, status = 200) => Response.json(body, { status });
const reset = (...responses: Response[]) => { calls.length = 0; replies = responses; };
const request = (value: string) => new Request("https://hackea.test/api/key", { method: "POST", headers: { "x-openai-key": value, "sec-fetch-site": "same-origin" } });
const opts = { key, models: ["gpt-4.1-mini"], messages: [{ role: "user" as const, content: "Return JSON with a furniture name." }] };

try {
  assert.equal(userKey(request(key)), key, "long OpenAI project keys must be accepted");
  assert.equal(userKey(request("bad key")), undefined);
  assert.equal(userKey(new Request("https://hackea.test", { headers: { "x-together-key": key } })), undefined);
  Object.assign(process.env, { NODE_ENV: "development" });
  process.env.OPENAI_API_KEY = key;
  assert.equal(userKey(request(DEV_KEY)), key);
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal(userKey(request(DEV_KEY)), DEV_KEY, "production must never substitute the server key");
  assert.ok(Object.values(MODELS).every(models => models.every(model => !model.includes("/"))));

  reset(json({ choices: [{ message: { content: '{"name":"BILLY"}' } }] }));
  assert.equal((await chatText({ ...opts, json: true })).text, '{"name":"BILLY"}');
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions");
  assert.equal(new Headers(calls[0].init.headers).get("Authorization"), `Bearer ${key}`);
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.response_format.type, "json_object");
  assert.equal(body.max_completion_tokens, 1400);
  assert.equal(body.reasoning_effort, undefined);

  reset(json({ error: { code: "insufficient_quota" } }, 429));
  await assert.rejects(chat(opts), e => e instanceof OpenAIError && e.status === 402);
  assert.equal(calls.length, 1, "quota errors must not cause paid retries");
  reset(json({ error: { code: "rate_limit_exceeded" } }, 429));
  await assert.rejects(chat(opts), e => e instanceof OpenAIError && e.status === 429);
  reset(json({ error: { code: "invalid_api_key" } }, 401));
  await assert.rejects(chat(opts), e => e instanceof OpenAIError && e.status === 401);
  reset(json({}, 404), json({ choices: [{ message: { content: "fallback" } }] }));
  assert.equal((await chatText({ ...opts, models: ["unavailable", "gpt-4.1-mini"] })).text, "fallback");
  reset(new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n'));
  assert.match(await (await chat({ ...opts, stream: true })).res.text(), /Hello/);
  assert.equal(JSON.parse(String(calls[0].init.body)).stream, true);

  reset(new Response(new Uint8Array([73, 68, 51])));
  assert.equal((await speak("Step one.", key)).byteLength, 3);
  const speech = JSON.parse(String(calls[0].init.body));
  assert.equal(calls[0].url, "https://api.openai.com/v1/audio/speech");
  assert.equal(speech.model, TTS.model);
  assert.equal(speech.voice, "marin");
  assert.equal(speech.response_format, "mp3");
  assert.equal(speech.language, undefined);
  assert.equal(speech.stream, undefined);
  assert.equal(VOICE_DIR, "/voice/marin");
  assert.equal(forTTS("Your Malm is built."), "Your Malm is built.");
  reset(json({ error: { type: "insufficient_quota" } }, 429));
  await assert.rejects(speak("Step one.", key), /tts 402:/);

  const signal = new AbortController().signal;
  reset(json({ text: " next " }));
  assert.equal(await transcribe(new ArrayBuffer(64), key, signal), "next");
  assert.equal(calls[0].url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(calls[0].init.signal, signal);
  const form = calls[0].init.body as FormData;
  assert.equal(form.get("model"), "gpt-transcribe");
  assert.equal(form.get("languages[]"), "en");
  assert.equal(form.get("language"), null);
  assert.equal(form.get("temperature"), null);
  reset(json({ error: { code: "insufficient_quota" } }, 429));
  await assert.rejects(transcribe(new ArrayBuffer(64), key), /402:/);
  assert.equal(isQuotaError(429, "invalid JSON"), false);

  reset(json({ data: [] }));
  assert.deepEqual(await (await checkKey(request(key))).json(), { ok: true });
  assert.equal(calls[0].url, "https://api.openai.com/v1/models");
  reset(json({}, 401));
  assert.equal((await (await checkKey(request(key))).json()).reason, "rejected");
  assert.equal((await (await checkKey(new Request("https://hackea.test/api/key", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))).json()).reason, "forbidden");
  console.log("OpenAI contract checks passed: chat, streaming, fallback, keys, quotas, speech and transcription.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [name, value] of [["NODE_ENV", originalEnv.node], ["OPENAI_API_KEY", originalEnv.key]]) {
    if (value === undefined) delete process.env[name!];
    else process.env[name!] = value;
  }
}
