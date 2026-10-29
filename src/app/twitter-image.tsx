import { OG_SIZE, siteCard } from "@/lib/og/card";

export const alt = "Hackea: Hack IKEA furniture, step by step. A KALLAX step drawn in the paper booklet style, next to the same step on Hackea. Powered by OpenAI";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteCard();
}
