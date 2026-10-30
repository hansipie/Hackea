import { individualPartData } from "@/lib/part-connections";
import type { PartRow } from "@/lib/part-search";

/** Every individual part with the furniture to add it from: built once, as the parts library page is. */
export async function GET() {
  const rows: PartRow[] = individualPartData()
    .elements.map((p) => ({ key: p.key, name: p.name, names: p.names, size: p.size, material: p.material, count: p.products.length, slug: p.source.slug, ref: p.source.ref }))
    .sort((a, b) => a.name.localeCompare(b.name, "en") || a.size[0] - b.size[0] || a.size[1] - b.size[1] || a.size[2] - b.size[2] || a.key.localeCompare(b.key));
  return Response.json(rows);
}
