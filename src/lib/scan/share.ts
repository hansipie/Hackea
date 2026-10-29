import type { ProductSpec } from "../types";
import { parseScan } from "./parse";

/** JSON, deflated and base64url'd, short enough for the hash of a link. */
export async function packJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The other way. Throws on anything that isn't one; callers check what comes out. */
export async function unpackJson(s: string, maxChars = 400_000): Promise<unknown> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  // read it in chunks, so a small link that inflates to something huge stops early
  const reader = ds.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxChars * 4) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer());
  if (text.length > maxChars) throw new Error("too large");
  return JSON.parse(text);
}

/** Pack a scanned guide into a link, so it opens on another device without a server copy. */
export function encodeSpec(spec: ProductSpec): Promise<string> {
  return packJson(spec);
}

export async function decodeSpec(s: string): Promise<ProductSpec | null> {
  try {
    const raw = (await unpackJson(s)) as ProductSpec;
    if (!raw || raw.archetype !== "custom" || !raw.custom?.parts?.length) return null;
    // a link is someone else's data: run it through the same checks as a fresh scan
    const r = parseScan({ ...raw, parts: raw.custom.parts, steps: raw.custom.steps, fromCover: raw.custom.fromCover });
    return r.spec ? { ...r.spec, variant: raw.variant ?? r.spec.variant } : null;
  } catch {
    return null;
  }
}
