"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import { totals } from "@/lib/plan/contents";
import { lineup } from "@/lib/plan/lineup";
import { buildMinutes, isBuilt, listProgress, removeProgress, type Progress } from "@/lib/store";
import type { Plan, ProductSpec } from "@/lib/types";
import { useMounted } from "@/lib/useMounted";
import { peekShot, shot, type Shot } from "@/engine/thumbs";
import Thumb from "../Thumb";
import Drawing from "../Drawing";
import { Figure, ScaleFigure } from "../art/Figure";
import { fmtMin } from "../guide/CoverPanel";
import { IArrowRight, IBed, IBox, ICheck, IClock, IClose, ILibrary, IPeople, IWall } from "../art/Icons";

interface Row {
  p: Progress;
  spec: ProductSpec;
  plan: Plan;
  done: boolean;
}

function fmtTime(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Building time, only when the steps were followed (older saves only had start and end). */
function spentOf(r: Row) {
  const p = r.p;
  if (p.builtAt) return buildMinutes(p.builtMs, p.builtFull, r.spec.minutes);
  const m = p.startedAt && p.doneAt && p.doneAt > p.startedAt ? Math.round((p.doneAt - p.startedAt) / 60000) : 0;
  // a wall clock that ran overnight isn't a build time
  return m > 0 && m < r.spec.minutes * 3 ? m : null;
}

export default function Workshop() {
  const mounted = useMounted();
  const [removed, setRemoved] = useState<string[]>([]);
  const rows: Row[] = useMemo(() => {
    if (!mounted) return [];
    return listProgress()
      .filter((p) => p.phase !== "cover" && !removed.includes(p.slug))
      .map((p) => {
        const spec = p.spec ?? catalogSpec(p.slug);
        if (!spec) return null;
        try {
          return { p, spec, plan: buildPlan(spec), done: isBuilt(p) };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Row[];
  }, [mounted, removed]);

  const built = rows.filter((r) => r.done).sort((a, b) => (a.p.builtAt ?? a.p.doneAt ?? a.p.updatedAt) - (b.p.builtAt ?? b.p.doneAt ?? b.p.updatedAt));
  // a second one of something already built shows in both lists
  const going = rows.filter((r) => r.p.phase !== "done" && (!r.done || (r.p.startedAt ?? 0) > (r.p.builtAt ?? Infinity)));
  const minutes = built.reduce((s, r) => s + (spentOf(r) ?? r.spec.minutes), 0);
  const fittings = built.reduce((s, r) => s + totals(r.plan).fittings, 0);
  const panels = built.reduce((s, r) => s + totals(r.plan).panels, 0);
  const badges = earned(built);
  const remove = (slug: string) => {
    removeProgress(slug);
    setRemoved((x) => [...x, slug]);
  };

  if (!mounted) return <div className="ws-loading" />;

  return (
    <div className="workshop">
      <header className="ws-head">
        <div>
          <h1>Your workshop</h1>
          <p className="lead">Everything you&apos;ve built, side by side and to scale.</p>
        </div>
        {built.length > 0 && (
          <dl className="ws-stats">
            <div>
              <dt>Built</dt>
              <dd>{built.length}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{fmtTime(minutes)}</dd>
            </div>
            <div>
              <dt>Panels</dt>
              <dd>{panels}</dd>
            </div>
            <div>
              <dt>Fittings</dt>
              <dd>{fittings}</dd>
            </div>
          </dl>
        )}
      </header>

      {rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          {built.length > 0 ? <Showroom rows={built} /> : <EmptyFloor note="Your first finished build will stand here." />}

          {going.length > 0 && (
            <section className="ws-section">
              <div className="ws-sec-head">
                <h2>Still building</h2>
                <span>{going.length}</span>
              </div>
              <div className="ws-going">
                <AnimatePresence initial={false}>
                  {going.map((r) => (
                    <GoingRow key={r.p.slug} r={r} onRemove={() => remove(r.p.slug)} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {built.length > 0 && (
            <section className="ws-section">
              <div className="ws-sec-head">
                <h2>Built</h2>
                <span>{built.length}</span>
              </div>
              <div className="ws-grid">
                <AnimatePresence initial={false}>
                  {[...built].reverse().map((r) => (
                    <BuiltCard key={r.p.slug} r={r} onRemove={() => remove(r.p.slug)} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          <section className="ws-section">
            <div className="ws-sec-head">
              <h2>Badges</h2>
              <span>
                {badges.size} of {BADGES.length}
              </span>
            </div>
            <div className="badges">
              {BADGES.map((b) => {
                const on = badges.has(b.id);
                return (
                  <div key={b.id} className={"badge" + (on ? " on" : "")}>
                    <span className="badge-ico">{b.icon}</span>
                    <span className="badge-text">
                      <b>{b.name}</b>
                      <span>{b.hint}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------- the lineup: one drawing, one camera, real scale ---------- */

const VIEW = { az: 0.34, el: 0.3 };
const PERSON = 1750;

function Showroom({ rows }: { rows: Row[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth)));
    ro.observe(el);
    setW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const line = useMemo(() => lineup(rows.map((r) => r.plan)), [rows]);
  const personX = line.span[0] - 520;
  const h = w < 640 ? 300 : 400;
  const key = `lineup:${rows.map((r) => r.p.slug).join(",")}:${w}x${h}`;
  const mode = useMemo(
    () => ({
      kind: "assembled" as const,
      view: VIEW,
      frame: [
        [personX - 300, 0, 0],
        [personX - 300, PERSON, 0],
        [line.span[1] + 300, 0, 0],
        // room under the floor line for the name tags
        [line.span[0], -420, 0],
      ] as [number, number, number][],
    }),
    [personX, line],
  );
  const probes = useMemo(
    () => [
      [personX, 0, 0] as [number, number, number],
      [personX, PERSON, 0] as [number, number, number],
      ...rows.map((r, i) => [line.centers[i], 0, (r.spec.size.d * 10) / 2] as [number, number, number]),
    ],
    [rows, line, personX],
  );
  const [res, setRes] = useState<{ key: string; s: Shot } | null>(null);
  const cached = w ? peekShot(key) : undefined;
  const s = cached ?? (res?.key === key ? res.s : null);

  useEffect(() => {
    if (!w || peekShot(key)) return;
    let alive = true;
    shot(key, line.plan, mode, w, h, probes).then((x) => alive && setRes({ key, s: x }));
    return () => {
      alive = false;
    };
  }, [key, w, h, line, mode, probes]);

  const feet = s?.points[0], head = s?.points[1];
  const figH = feet && head ? feet.y - head.y : 0;

  return (
    <section className="showroom" aria-label="Everything you built, to scale">
      <div className="sr-stage" ref={wrap} style={{ height: h }}>
        {s && (
          <motion.div className="sr-img" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {feet && <div className="sr-floor" style={{ top: feet.y }} aria-hidden="true" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="" draggable={false} />
            {feet && figH > 20 && (
              <div className="sr-person" style={{ left: feet.x, top: feet.y, height: figH }}>
                <ScaleFigure className="scale-person" />
                <span>You, about 175 cm</span>
              </div>
            )}
            {rows.map((r, i) => {
              const pt = s.points[i + 2];
              if (!pt) return null;
              return (
                <Link key={r.p.slug} href={`/build/${r.p.slug}`} className="sr-tag" style={{ left: pt.x, top: pt.y }}>
                  <b>{r.spec.name}</b>
                  <span>{r.spec.size.w} &times; {r.spec.size.h} cm</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ---------- lists ---------- */

function GoingRow({ r, onRemove }: { r: Row; onRemove: () => void }) {
  const p = r.p;
  const pct = p.phase === "steps" ? p.step / Math.max(1, p.steps) : p.phase === "parts" ? 0.06 : 0.03;
  const href = `/build/${p.slug}${p.spec ? `?q=${encodeURIComponent(p.spec.name)}` : ""}`;
  const status = p.phase === "steps" ? (p.step + 1 >= p.steps ? "On the last step" : `Step ${p.step + 1} of ${p.steps}`) : p.phase === "parts" ? "Checking parts" : "Checking tools";
  return (
    <motion.div className="going" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.3 }}>
      <Link href={href} className="going-link">
        {r.spec.source === "catalog" && !r.spec.hack ? <Drawing name={p.slug} w={150} h={112} className="going-thumb" /> : <Thumb id={"go-" + p.slug} plan={r.plan} mode={{ kind: "assembled" }} w={150} h={112} className="going-thumb" />}
        <span className="going-text">
          <b>{r.spec.name}</b>
          <span>{r.spec.variant}</span>
        </span>
        <span className="going-progress">
          <span className="going-status">{status}</span>
          <span className="going-bar">
            <i style={{ width: `${Math.max(4, pct * 100)}%` }} />
          </span>
        </span>
        <span className="going-go">
          Continue <IArrowRight size={15} />
        </span>
      </Link>
      <button className="x-btn" onClick={onRemove} aria-label={`Remove ${r.spec.name}`} title="Remove">
        <IClose size={15} />
      </button>
    </motion.div>
  );
}

function BuiltCard({ r, onRemove }: { r: Row; onRemove: () => void }) {
  const p = r.p;
  const when = new Date(p.builtAt ?? p.doneAt ?? p.updatedAt);
  const spent = spentOf(r);
  return (
    <motion.div className="built" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
      <Link href={`/build/${p.slug}${p.spec ? `?q=${encodeURIComponent(p.spec.name)}` : ""}`} className="built-link">
        {r.spec.source === "catalog" && !r.spec.hack ? <Drawing name={p.slug} w={360} h={270} className="built-thumb" /> : <Thumb id={"bt-" + p.slug} plan={r.plan} mode={{ kind: "assembled" }} w={360} h={270} className="built-thumb" />}
        <span className="built-text">
          <b>{r.spec.name}</b>
          <span>{r.spec.variant}</span>
          <span className="built-meta">
            <span>
              <ICheck size={14} strokeWidth={2.4} /> {when.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
            {spent && (
              <span>
                <IClock size={14} /> {fmtTime(spent)}
              </span>
            )}
          </span>
        </span>
      </Link>
      <button className="x-btn" onClick={onRemove} aria-label={`Remove ${r.spec.name}`} title="Remove">
        <IClose size={15} />
      </button>
    </motion.div>
  );
}

/* ---------- empty ---------- */

// times come from the catalog, so they can't drift from the guides
const STARTERS = [
  { slug: "lack-side-table", note: (s: ProductSpec) => `${fmtMin(s.minutes)}, a good first build` },
  { slug: "kallax-2x2", note: (s: ProductSpec) => `${s.category}, ${fmtMin(s.minutes)}` },
  { slug: "malm-3-drawers", note: (s: ProductSpec) => `${s.category}, ${fmtMin(s.minutes)}` },
].flatMap(({ slug, note }) => {
  const s = catalogSpec(slug);
  return s ? [{ slug, name: s.name, note: note(s) }] : [];
});

function EmptyFloor({ note }: { note: string }) {
  return (
    <div className="ws-floor">
      <div className="ws-floor-row">
        <span className="ws-floor-fig">
          <Figure pose="wave" size={150} />
        </span>
        <svg viewBox="140 50 440 160" aria-hidden="true" className="ws-ghosts">
          <g fill="none" stroke="var(--line-2)" strokeWidth="2" strokeDasharray="6 6" strokeLinejoin="round">
            <path d="M150 178 V70 L196 56 L262 76 V186 L216 200 Z M150 70 L216 90 L262 76 M216 90 V200" />
            <path d="M330 186 V120 L370 108 L430 126 V194 L390 206 Z M330 120 L390 138 L430 126 M390 138 V206 M330 142 L390 160 L430 148 M330 164 L390 182 L430 170" />
            <path d="M490 150 h70 M498 150 v42 M552 150 v42 M490 150 l12 -8 h70 l-12 8 M572 142 v36" />
          </g>
        </svg>
      </div>
      <p>{note}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="ws-empty">
      <EmptyFloor note="Nothing here yet" />
      <div className="ws-empty-copy">
        <h2>Your finished builds will stand here</h2>
        <p>Side by side and to scale, next to a person for size. Pick something to build first.</p>
        <div className="ws-starters">
          {STARTERS.map((s) => (
            <Link key={s.slug} href={`/build/${s.slug}`} className="starter">
              <b>{s.name}</b>
              <span>{s.note}</span>
              <IArrowRight size={16} />
            </Link>
          ))}
        </div>
        <Link href="/browse" className="ws-browse">
          Or browse all guides
        </Link>
      </div>
    </div>
  );
}

/* ---------- badges ---------- */

const BADGES: { id: string; name: string; hint: string; icon: React.ReactNode }[] = [
  { id: "first", name: "First build", hint: "Finish anything", icon: <ICheck size={19} strokeWidth={2.4} /> },
  { id: "drawers", name: "Drawer whisperer", hint: "Build something with drawers", icon: <IBox size={19} /> },
  { id: "anchor", name: "Safe and sound", hint: "Fix a build to the wall", icon: <IWall size={19} /> },
  { id: "team", name: "Team player", hint: "Finish a two-person build", icon: <IPeople size={19} /> },
  { id: "fast", name: "Quick hands", hint: "Beat the typical time", icon: <IClock size={19} /> },
  { id: "bed", name: "Sweet dreams", hint: "Build a bed", icon: <IBed size={19} /> },
  { id: "books", name: "Bookworm", hint: "Build a bookcase or shelf", icon: <ILibrary size={19} /> },
  { id: "five", name: "Regular", hint: "Finish five builds", icon: <span className="bi">5</span> },
];

function earned(built: Row[]) {
  const s = new Set<string>();
  if (built.length) s.add("first");
  if (built.length >= 5) s.add("five");
  for (const r of built) {
    if (r.spec.archetype === "drawers") s.add("drawers");
    if (r.plan.steps.some((x) => x.kind === "anchor")) s.add("anchor");
    if (r.spec.people === 2) s.add("team");
    if (r.spec.archetype === "bed") s.add("bed");
    if (r.spec.archetype === "shelf") s.add("books");
    const spent = spentOf(r);
    if (spent && spent < r.spec.minutes && spent >= r.spec.minutes * 0.2) s.add("fast");
  }
  return s;
}
