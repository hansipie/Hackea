import { fromApp, ipOf, rateLimited } from "@/lib/openai";

/**
 * "Did this match your box?" One line per answer in the server log
 * (grep for [feedback]), so wrong guides can be found and fixed.
 */
export async function POST(req: Request) {
  if (!fromApp(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(ipOf(req) + ":feedback", 12, 10 * 60_000)) return Response.json({ error: "slow down" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : undefined);
  const entry = {
    slug: str(b.slug, 80),
    name: str(b.name, 60),
    variant: str(b.variant, 80),
    match: typeof b.match === "boolean" ? b.match : undefined,
    step: typeof b.step === "number" && b.step > 0 && b.step < 200 ? Math.floor(b.step) : undefined,
    note: str(b.note, 400),
    via: str(b.via, 12),
  };
  if (!entry.slug || entry.match === undefined) return Response.json({ error: "bad" }, { status: 400 });
  console.info("[feedback]", JSON.stringify(entry));
  return Response.json({ ok: true });
}
