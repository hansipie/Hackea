import type { ProductSpec } from "@/lib/types";
import { kallaxTvBench } from "./kallax-tv-bench";
import { kallaxSideboard } from "./kallax-sideboard";
import { kallaxDoors } from "./kallax-doors";
import { billyBuiltIn } from "./billy-built-in";
import { billyOpenWardrobe } from "./billy-open-wardrobe";

/** Every hack, in the order they are shown. Slugs never change: people have progress saved under them. */
export const HACKS: ProductSpec[] = [kallaxTvBench, kallaxSideboard, kallaxDoors, billyOpenWardrobe, billyBuiltIn];
