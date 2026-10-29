import { z } from "zod";
import { chatText, extractJson, fromApp, ipOf, keyTrouble, MODELS, OpenAIError, rateLimited, userKey } from "@/lib/openai";
import { compilePhotoDraft, LAYOUT_PROMPT, MATCH_PROMPT, MAX_IMAGE, OBSERVE_PROMPT, observationSchema, photoCandidates, photoImage, selectionSchema, stockUnits } from "@/lib/hacks/photo";

export const maxDuration = 180;
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), image: photoImage, hint: z.string().max(400).default("") }),
  z.object({ action: z.literal("generate"), image: photoImage, hint: z.string().max(400).default(""), selections: selectionSchema }),
]);

/** Bound the actual bytes, including for requests with no Content-Length. */
async function readBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE + 20_000) { await reader.cancel(); throw new Error("large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(req: Request) {
  if (!fromApp(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const key = userKey(req);
  if (!key) return Response.json({ error: "key" }, { status: 401 });
  if (rateLimited(ipOf(req) + ":hack-photo", 8, 10 * 60_000)) return Response.json({ error: "busy" }, { status: 429 });
  let input: z.infer<typeof requestSchema>;
  try { input = requestSchema.parse(await readBody(req)); }
  catch { return Response.json({ error: "photo" }, { status: 400 }); }
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(150_000)]);
  const ask = async (prompt: string, context: unknown, maxTokens = 1800) => {
    const { text } = await chatText({ key, models: MODELS.vision, json: true, temperature: 0.2, maxTokens, signal,
      messages: [{ role: "system", content: prompt }, { role: "user", content: [
        { type: "text", text: JSON.stringify({ notes: input.hint, context }) }, { type: "image_url", image_url: { url: input.image } },
      ] }],
    });
    return extractJson(text);
  };
  try {
    if (input.action === "analyze") {
      const observation = observationSchema.parse(await ask(OBSERVE_PROMPT, {}));
      if (!observation.furniture) return Response.json({ error: "not_furniture" }, { status: 422 });
      const candidates = photoCandidates(observation.queries);
      if (!candidates.length) return Response.json({ error: "no_match" }, { status: 422 });
      const match = await ask(MATCH_PROMPT, { description: observation.description, candidates });
      const parsed = z.object({ selections: selectionSchema }).safeParse(match);
      if (!parsed.success || parsed.data.selections.some(s => !candidates.some(c => c.slug === s.slug))) return Response.json({ error: "no_match" }, { status: 422 });
      return Response.json({ description: observation.description, uncertainties: observation.uncertainties, candidates, selections: parsed.data.selections }, { headers: { "Cache-Control": "no-store" } });
    }
    let units;
    try { units = stockUnits(input.selections); }
    catch { return Response.json({ error: "selection" }, { status: 400 }); }
    if (units.reduce((n, u) => n + u.parts.length, 0) > 90) return Response.json({ error: "complex" }, { status: 422 });
    const context = { units, notes: "All stock parts are inserted by the app. Only return placements and additional parts and steps." };
    let raw = await ask(LAYOUT_PROMPT, context, 11000);
    let draft;
    try { draft = compilePhotoDraft(raw, input.selections); }
    catch (e) {
      // One bounded repair, using the same authoritative stock geometry.
      raw = await ask(LAYOUT_PROMPT, { ...context, previous: raw, validation: (e as Error).message.slice(0, 500) }, 11000);
      try { draft = compilePhotoDraft(raw, input.selections); }
      catch { return Response.json({ error: "invalid_plan" }, { status: 422 }); }
    }
    return Response.json({ draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OpenAIError) {
      const trouble = keyTrouble(e.status);
      if (trouble) return Response.json({ error: trouble }, { status: trouble === "credits" ? 402 : 401 });
      if (e.status === 429) return Response.json({ error: "busy" }, { status: 429 });
    }
    if (signal.aborted) return Response.json({ error: "timeout" }, { status: 504 });
    return Response.json({ error: "failed" }, { status: 502 });
  }
}
