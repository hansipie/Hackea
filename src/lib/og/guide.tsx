import { catalogSpec } from "@/lib/catalog";
import { ikeaType } from "@/lib/ikea";
import { buildPlan } from "@/lib/plan";
import { KIND_LABELS } from "@/lib/products";
import { kindOf } from "@/lib/search";
import { drawing, guideCard } from "./card";

/** A drawing to fall back on for each archetype. */
const BY_ARCH: Record<string, string> = { shelf: "bookcase", drawers: "chest", table: "dining", bed: "bed", cabinet: "cabinet", seat: "chair", sofa: "sofa", custom: "cabinet" };

/** The share card for /build/{slug}, shared by its opengraph and twitter images. */
export async function guideImage(slug: string) {
  const spec = catalogSpec(slug);
  if (!spec) {
    // a product we draft on the fly: its name, and the drawing of the kind IKEA sells it as, or the slug names
    const name = slug.split("-")[0].toUpperCase().slice(0, 18);
    const type = await ikeaType(name).catch(() => null);
    const kind = kindOf(type ?? "") ?? kindOf(slug.replace(/-/g, " "));
    const art = (kind && (await drawing(`kind-${kind}`))) || (await drawing("hero-bygga"));
    return guideCard({ name, variant: type ?? "Assembly, step by step", steps: null, art });
  }
  const kind = kindOf(`${spec.category} ${spec.variant}`) ?? KIND_LABELS[0].kind;
  const art = (await drawing(slug)) ?? (await drawing(`kind-${kind}`)) ?? (await drawing(`kind-${BY_ARCH[spec.archetype]}`));
  let steps: number | null = null;
  try {
    steps = buildPlan(spec).steps.length;
  } catch {
    /* the card still works without a count */
  }
  return guideCard({ name: spec.name, variant: spec.variant, steps, art });
}
