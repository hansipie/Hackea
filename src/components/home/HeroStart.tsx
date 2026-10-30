"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { STARTS } from "@/components/hacks/starts";
import { createHack } from "@/lib/hacks/store";
import { blankDraft } from "@/lib/hacks/templates";

/** The first thing on the home page: the four ways to begin a hack. */
export default function HeroStart() {
  const router = useRouter();
  return (
    <ul className="hx-from hero-start" aria-label="Make a hack">
      {STARTS.map((o) =>
        o.id === "empty" ? (
          <li key={o.id}>
            <button type="button" className="hx-from-card" onClick={() => router.push(`/hacks/new?id=${createHack(blankDraft())}`)}>
              <b>{o.title}</b>
              <span>{o.text}</span>
            </button>
          </li>
        ) : (
          <li key={o.id}>
            <Link href={`/hacks/new?from=${o.id}`} className="hx-from-card">
              <b>{o.title}</b>
              <span>{o.text}</span>
            </Link>
          </li>
        ),
      )}
    </ul>
  );
}
