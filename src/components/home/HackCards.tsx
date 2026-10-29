"use client";

import Link from "next/link";
import { HACKS } from "@/data/hacks";
import { buildPlan } from "@/lib/plan";
import { Dots } from "../guide/ui";
import Thumb from "../Thumb";
import { IArrowRight, IClock } from "../art/Icons";

/** Hacks have no pre-rendered drawing, so each card draws its plan live (offscreen, only while on screen). */
export default function HackCards({ limit }: { limit?: number }) {
  return (
    <div className="pgrid">
      {HACKS.slice(0, limit).map((h) => (
        <Link key={h.slug} href={`/build/${h.slug}`} className="pcard">
          <span className="pcard-art">
            <Thumb id={"hack-" + h.slug} plan={() => buildPlan(h)} mode={{ kind: "assembled" }} w={420} h={320} className="pcard-thumb" alt={`${h.name} line drawing`} lazy />
          </span>
          <span className="pcard-text">
            <span className="pcard-top">
              <b>{h.name}</b>
              <span className="pcard-go">
                <IArrowRight size={17} />
              </span>
            </span>
            <span className="pcard-variant">{h.hack?.summary}</span>
            <span className="pcard-meta">
              <span>
                <IClock size={15} /> {h.minutes < 60 ? `${h.minutes} min` : `${Math.round(h.minutes / 6) / 10} h`}
              </span>
              <Dots value={h.difficulty} />
              <span className="pcard-cat">{h.hack?.base.map((b) => b.name.split(" ")[0]).join(" + ")}</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
