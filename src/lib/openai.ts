import "server-only";
import { isQuotaError } from "./providerError";

const BASE = "https://api.openai.com/v1";

export const MODELS = {
  // laying out a scanned manual: the strongest reasoning we can afford per scan
  plan: list(process.env.OPENAI_PLAN_MODEL, "gpt-6.1-sol,gpt-4.1"),
  // product lookups and the "Stuck?" chat: cheap and quick
  text: list(process.env.OPENAI_TEXT_MODEL, "gpt-6-luna,gpt-4.1-mini"),
  // box labels, loose parts and photo hacks
  vision: list(process.env.OPENAI_VISION_MODEL, "gpt-6.1-terra,gpt-4.1-mini"),
  // reading manual pages, where small print matters most
  read: list(process.env.OPENAI_READ_MODEL, "gpt-6.1-terra,gpt-4.1-mini"),
};

function list(env: string | undefined, fallback: string) {
  return (env?.trim() || fallback).split(",").map((m) => m.trim()).filter(Boolean);
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export interface Msg {
  role: "system" | "user" | "assistant";
  content: Content;
}

interface ChatOpts {
  models: string[];
  messages: Msg[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  /** The person's own key: every call runs on it, and there is no other. */
  key: string;
  reasoning?: "low" | "medium" | "high";
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Calls OpenAI's chat completions, falling back through the model list when one is unavailable. */
export async function chat(o: ChatOpts): Promise<{ res: Response; model: string }> {
  const key = o.key?.trim();
  if (!key) throw new OpenAIError("missing key", 401);
  let lastErr: OpenAIError | null = null;
  for (const model of o.models.map((m) => m.trim()).filter(Boolean)) {
    const reasoning = /^(?:o[134](?:-|$)|gpt-5(?:[.-]|$)|gpt-6(?:[.-]|$))/.test(model) ? { reasoning_effort: o.reasoning ?? "low" } : {};
    for (const withExtras of [true, false]) {
      const body = {
        model,
        messages: o.messages,
        max_completion_tokens: o.maxTokens ?? 1400,
        ...(!Object.keys(reasoning).length ? { temperature: o.temperature ?? 0.3 } : {}),
        stream: !!o.stream,
        ...(o.json && withExtras ? { response_format: { type: "json_object" } } : {}),
        ...(withExtras ? reasoning : {}),
      };
      let res: Response;
      try {
        res = await fetch(`${BASE}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: o.signal,
        });
      } catch (e) {
        if (o.signal?.aborted) throw e;
        lastErr = new OpenAIError((e as Error).message, 502);
        break;
      }
      if (res.ok) return { res, model };
      const text = await res.text().catch(() => "");
      lastErr = new OpenAIError(text.slice(0, 300) || res.statusText, isQuotaError(res.status, text) ? 402 : res.status);
      if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) throw lastErr;
      // 400 may be an unsupported extra parameter: retry once without extras, otherwise move on
      if (res.status !== 400) break;
    }
  }
  throw lastErr ?? new OpenAIError("no model available", 503);
}

export async function chatText(o: Omit<ChatOpts, "stream">) {
  // a model can spend its whole budget thinking and answer nothing: the next one in the list gets a go
  for (let models = o.models; ; ) {
    const { res, model } = await chat({ ...o, models });
    const j = await res.json();
    const text: string = j?.choices?.[0]?.message?.content ?? "";
    const rest = models.slice(models.indexOf(model) + 1);
    if (text.trim() || !rest.length) return { text, model };
    models = rest;
  }
}

export function extractJson(text: string): unknown {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Tiny in-memory rate limiter. Pass a bucket per route ("1.2.3.4:voice") so a
 * chatty route can't use up another's allowance; refused calls don't count.
 */
const hits = new Map<string, number[]>();

export function rateLimited(bucket: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(bucket, arr);
    return true;
  }
  arr.push(now);
  hits.set(bucket, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** Only for trying the app locally: stands in for the key in .env.local. Never accepted in production. */
export const DEV_KEY = "hackea-dev-mock-key-000000";

export function isDevKey(req: Request) {
  return process.env.NODE_ENV !== "production" && req.headers.get("x-openai-key")?.trim() === DEV_KEY;
}

/** The key the person pasted into the app, sent along with each request. Never stored or logged, and the only key any AI call runs on. */
export function userKey(req: Request) {
  if (isDevKey(req)) return process.env.OPENAI_API_KEY?.trim() || undefined;
  const k = req.headers.get("x-openai-key")?.trim() ?? "";
  return k.length >= 20 && k.length <= 512 && /^[\w.-]+$/.test(k) ? k : undefined;
}

/** What a turned-away call tells the person: their key was refused, or their account is out of credit. */
export function keyTrouble(status: number) {
  return status === 401 || status === 403 ? "key" : status === 402 ? "credits" : null;
}

/**
 * True for requests from this site's own pages. Other sites can't make their visitors'
 * browsers spend the key: browsers say where a request came from, and a JSON body
 * can't be sent across sites without a preflight we never answer.
 */
export function fromApp(req: Request, json = true) {
  if (json && !(req.headers.get("content-type") ?? "").includes("application/json")) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function ipOf(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
