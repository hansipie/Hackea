import { OG_SIZE } from "@/lib/og/card";
import { guideImage } from "@/lib/og/guide";

export const alt = "An IKEA assembly guide on Hackea: the product drawn in 3D, with every step read out loud";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return guideImage(decodeURIComponent((await params).slug));
}
