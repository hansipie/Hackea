import { notFound } from "next/navigation";
import Renderer from "./Renderer";

/** Dev only: lets scripts/og/render.mjs draw product pictures with the real engine. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Renderer />;
}
