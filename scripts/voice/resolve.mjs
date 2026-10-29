import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../../src/", import.meta.url);

const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

export async function resolve(spec, ctx, next) {
  let url = null;
  if (spec.startsWith("@/")) url = new URL(spec.slice(2), SRC).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) url = new URL(spec, ctx.parentURL).href;
  if (url) {
    const p = fileURLToPath(url);
    for (const c of [p, p + ".ts", p + ".tsx", p + "/index.ts"]) if (isFile(c)) return next(pathToFileURL(c).href, ctx);
  }
  return next(spec, ctx);
}
