"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { checkDraft } from "@/lib/hacks/check";
import { draftToSpec, mineSlug } from "@/lib/hacks/draft";
import { createHack, isUnreadable, listHacks } from "@/lib/hacks/store";
import { CURATED } from "@/lib/hacks/templates";
import { useMounted } from "@/lib/useMounted";
import StageView from "../StageView";
import { IArrowRight } from "../art/Icons";

/** One hack, large and turnable: the last one made in this browser, or a hack from the library to start from. */
export default function FeaturedHack() {
  const mounted = useMounted();
  const router = useRouter();
  const pick = useMemo(() => {
    if (!mounted) return null;
    try {
      for (const h of listHacks()) {
        if (isUnreadable(h)) continue;
        const { issues, plan } = checkDraft(h.id, h.draft);
        if (plan) return { own: true as const, id: h.id, spec: draftToSpec(h.id, h.draft), plan, issues: issues.length, draft: h.draft };
      }
    } catch {
      /* storage that can't be read shows the library hack instead */
    }
    const c = CURATED[0];
    if (!c) return null;
    const draft = c.draft();
    const { plan } = checkDraft("featured", draft);
    return plan ? { own: false as const, id: "", spec: draftToSpec("featured", draft), plan, issues: 0, draft } : null;
  }, [mounted]);
  if (!pick) return null;
  const { spec } = pick;
  return (
    <section className="feat" id="mine" aria-labelledby="feat-h">
      <div className="sec-head">
        <h2 id="feat-h" className="sec-title">
          {pick.own ? "Your latest hack" : "A hack to start from"}
        </h2>
        <Link href={pick.own ? "/hacks/new" : "/hacks"} className="sec-link">
          {pick.own ? "All my hacks" : "All hacks"} <IArrowRight size={15} />
        </Link>
      </div>
      <div className="feat-card">
        <div className="feat-stage">
          <StageView plan={pick.plan} mode={{ kind: "assembled", dims: true }} options={{ interactive: true }} className="feat-canvas" />
        </div>
        <div className="feat-cap">
          <div className="feat-text">
            <b>{spec.name}</b>
            <span>{pick.draft.summary}</span>
          </div>
          <div className="feat-actions">
            {pick.own ? (
              <>
                <Link href={`/hacks/new?id=${pick.id}`} className="btn hx-btn">
                  Edit
                </Link>
                {!pick.issues && (
                  <Link href={`/build/${mineSlug(pick.id)}`} className="btn hx-btn dark">
                    Open the guide <IArrowRight size={16} />
                  </Link>
                )}
              </>
            ) : (
              <button type="button" className="btn hx-btn dark" onClick={() => router.push(`/hacks/new?id=${createHack(pick.draft)}`)}>
                Make your own version <IArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
