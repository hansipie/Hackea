import { PRODUCTS } from "@/lib/catalog";
import { KIND_ARCH } from "@/lib/products";

/** Dev only: what scripts/og/render.mjs should draw: every kind, then every catalog product. */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const picks = PRODUCTS.map((p) => ({ slug: p.slug }));
  return Response.json([...Object.keys(KIND_ARCH).map((kind) => ({ kind })), ...picks]);
}
