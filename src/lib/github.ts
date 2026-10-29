import "server-only";
import { cacheLife } from "next/cache";
import { GITHUB_REPO } from "./site";

/** Star count for the repo, cached for an hour. Null when the repo can't be reached. */
export async function getStars(): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "hackea" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { stargazers_count?: unknown };
    return typeof j.stargazers_count === "number" ? j.stargazers_count : null;
  } catch {
    return null;
  }
}
