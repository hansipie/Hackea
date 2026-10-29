"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomFix, CustomPart, CustomStep, HwKind, PartMaterial, Plan, Pose, ToolId, WarnId } from "@/lib/types";
import type { StageMode } from "@/engine/stage";
import { checkDraft, type Issue } from "@/lib/hacks/check";
import { FIX_KINDS, LIMITS, MATERIALS, PART_ID, POSES, TOOLS, WARNINGS, boundsMm, emptyFix, mineSlug, type HackDraft } from "@/lib/hacks/draft";
import * as E from "@/lib/hacks/edit";
import { exportHack } from "@/lib/hacks/sanitize";
import { exportBackup, loadHack, saveHack, shareLink } from "@/lib/hacks/store";
import { libraryParts } from "@/lib/hacks/library";
import { searchCatalog } from "@/lib/search";
import StageView from "../StageView";
import { TOOL_INFO } from "../art/Tools";
import { IAlert, IArrowLeft, IArrowRight, ICheck, IChevronDown, IPlus, ISearch, ITrash } from "../art/Icons";
import { WARN_TEXT } from "../art/Icons";
import { Checks, Num, Pick, Text, Vec } from "./fields";
import { downloadHack } from "./MyHacks";

const SIZE_NAMES: [string, string, string] = ["Width, x", "Height, y", "Depth, z"];
const POS_NAMES: [string, string, string] = ["Left to right, x", "Up from floor, y", "Back to front, z"];

/**
 * The hack editor: the draft on the left, the same engine and 3D stage as the guide on the right.
 * Every change is saved in this browser, and the preview rebuilds a moment after typing stops.
 */
/**
 * `repaired` lists what was wrong with a saved hack that didn't read back, and `savedExport` is that record as it
 * was stored. Such a hack is never written until it is edited or saved on purpose, and its guide and share link
 * wait for that explicit save; whatever replaces the record, the store keeps the original as a backup.
 */
export default function HackEditor({ id, initial, repaired, savedExport }: { id: string; initial: HackDraft; repaired?: string[]; savedExport?: string }) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState<"saved" | "memory" | null>(null);
  const [shown, setShown] = useState(initial);
  const [openParts, setOpenParts] = useState<string[]>([]);
  const [openSteps, setOpenSteps] = useState<number[]>([]);
  const [view, setView] = useState<number | null>(null); // a step, or null for the finished piece
  const [note, setNote] = useState<{ text: string; link?: string } | null>(null);
  // a repaired hack waits for "Save the repaired version" before its guide or share link
  const [unsaved, setUnsaved] = useState(!!repaired?.length);
  // the edit not saved yet, written at once when the editor closes (a link, a reload) so nothing is lost
  const pending = useRef<HackDraft | null>(null);

  // saved a moment after each change, and the preview rebuilt
  useEffect(() => {
    // opening a hack isn't an edit: nothing is written until something changes
    if (draft === initial) return;
    pending.current = draft;
    const t = setTimeout(() => {
      pending.current = null;
      setSaved(saveHack(id, draft) ? "saved" : "memory");
      setShown(draft);
    }, 300);
    return () => clearTimeout(t);
  }, [id, draft, initial]);
  useEffect(() => {
    const flush = () => {
      if (pending.current) saveHack(id, pending.current);
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [id]);

  const { issues, plan } = useMemo(() => checkDraft(id, shown), [id, shown]);
  // while a change breaks the build, the last plan that worked stays on the stage
  const [lastPlan, setLastPlan] = useState<Plan | null>(plan);
  if (plan && plan !== lastPlan) setLastPlan(plan);
  const stagePlan = plan ?? lastPlan;
  const stepCount = stagePlan?.steps.length ?? 0;
  const at = view !== null && view < stepCount ? view : null;
  const mode: StageMode = at === null ? { kind: "assembled", dims: true } : { kind: "step", index: at };
  const size = boundsMm(draft.parts).size.map((mm) => Math.round(mm) / 10);
  const ok = issues.length === 0;

  const set = (patch: Partial<HackDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const edit = (f: (d: HackDraft) => HackDraft | null, fail?: string) => {
    const n = f(draft);
    if (n) setDraft(n);
    else if (fail) setNote({ text: fail });
  };
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const reveal = (domId: string) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
    });
  const goIssue = (i: Issue) => {
    if (i.part && draft.parts.some((p) => p.id === i.part)) {
      setOpenParts((o) => (o.includes(i.part!) ? o : [...o, i.part!]));
      reveal(`hx-part-${i.part}`);
    } else if (i.step !== undefined) {
      setOpenSteps((o) => (o.includes(i.step!) ? o : [...o, i.step!]));
      reveal(`hx-step-${i.step}`);
    } else reveal("hx-about");
  };
  // the buttons act on the draft as it is now, not on the preview that lags behind it
  const ready = () => {
    if (unsaved) {
      setNote({ text: "Save the repaired version first: until then the hack stays as it was stored." });
      return false;
    }
    // written only when something was edited: opening a hack and sharing it changes nothing in storage
    if (draft !== initial) saveHack(id, draft);
    pending.current = null;
    setShown(draft);
    const fresh = checkDraft(id, draft).issues;
    if (fresh.length) setNote({ text: `Not yet: ${fresh.length === 1 ? "one thing" : `${fresh.length} things`} to fix first.` });
    return !fresh.length;
  };
  const saveRepaired = () => {
    pending.current = null;
    setSaved(saveHack(id, draft) ? "saved" : "memory");
    setShown(draft);
    setUnsaved(false);
    setNote({ text: "Repaired version saved. What was stored before is kept as a backup: Export the original gives it back." });
  };
  const copy = async (text: string, done: string, link?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote({ text: done, link });
    } catch {
      setNote({ text: "Couldn't reach the clipboard: copy it from here.", link: text });
    }
  };

  return (
    <div className="hx-editor">
      <div className="hx-top">
        <Link href="/hacks/new" className="btn link inline hx-back">
          <IArrowLeft size={16} /> My builds
        </Link>
        {unsaved && repaired && (
          <div className="callout warn hx-repair" role="region" aria-label="Repaired hack">
            <IAlert size={18} />
            <div>
              <b>This hack didn&apos;t read back as it was saved</b>
              <span>
                The editor shows a repaired version: blanks filled in and numbers brought within bounds. Nothing is written until you edit it or save the repaired version, and the original is kept as a backup either way. What was wrong: {repaired.slice(0, 4).join("; ")}
                {repaired.length > 4 ? "; and more" : ""}.
              </span>
              <span className="hx-repair-actions">
                <button type="button" className="btn hx-btn dark" onClick={saveRepaired}>
                  Save the repaired version
                </button>
                {savedExport && (
                  <button type="button" className="btn hx-btn" onClick={() => downloadHack(draft, savedExport)}>
                    Export as saved
                  </button>
                )}
              </span>
            </div>
          </div>
        )}
        <span className={"hx-saved" + (saved === "memory" ? " warn" : "")} role="status">
          {saved === "memory" ? "This browser isn't saving: export a file before you close the tab" : saved ? "Saved in this browser" : ""}
        </span>
      </div>

      <div className="hx-layout">
        <aside className="hx-preview" aria-label="Preview">
          <div className="hx-stage">
            {stagePlan ? <StageView plan={stagePlan} mode={mode} options={{ callout: true, interactive: true }} /> : <p className="hx-stage-empty">Add a part to see it here.</p>}
          </div>
          <div className="hx-view" role="group" aria-label="What the preview shows">
            <button type="button" className={"chip" + (at === null ? " on" : "")} aria-pressed={at === null} onClick={() => setView(null)}>
              Finished
            </button>
            <button type="button" className="btn round small" aria-label="Previous step" disabled={!stepCount || at === 0} onClick={() => setView(at === null ? stepCount - 1 : at - 1)}>
              <IArrowLeft size={18} />
            </button>
            <span className="hx-view-at" aria-live="polite">
              {at === null ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}` : `Step ${at + 1} of ${stepCount}`}
            </span>
            <button type="button" className="btn round small" aria-label="Next step" disabled={!stepCount || at === stepCount - 1} onClick={() => setView(at === null ? 0 : at + 1)}>
              <IArrowRight size={18} />
            </button>
          </div>
          {at !== null && stagePlan && (
            <p className="hx-view-title">
              <b>{stagePlan.steps[at].title}</b>
              {stagePlan.steps[at].detail && <span> {stagePlan.steps[at].detail}</span>}
            </p>
          )}
          <p className="hx-size">
            {size[0]} × {size[1]} × {size[2]} cm, worked out from the parts. {draft.parts.length} parts, {draft.steps.length} steps.
          </p>

          {/* read out only when the count changes, not the whole list on every pause in typing */}
          <span className="hx-sr" role="status">
            {ok ? "Passes every check." : `${issues.length} ${issues.length === 1 ? "thing" : "things"} to fix.`}
          </span>
          <div className={"hx-issues" + (ok ? " ok" : "")}>
            {ok && unsaved ? (
              <p>
                <IAlert size={16} /> The repaired version passes every check. Save it before the guide and the share link open: the original is kept as a backup.
              </p>
            ) : ok ? (
              <p>
                <ICheck size={16} /> Passes every check. It is still yours and unverified: measure before you drill or cut.
              </p>
            ) : (
              <>
                <p>
                  <IAlert size={16} /> {issues.length} {issues.length === 1 ? "thing" : "things"} to fix before the guide opens:
                </p>
                <ul>
                  {issues.slice(0, 12).map((i, k) => (
                    <li key={k}>
                      <button type="button" className="btn link inline" onClick={() => goIssue(i)}>
                        {i.text}
                      </button>
                    </li>
                  ))}
                  {issues.length > 12 && <li>and {issues.length - 12} more</li>}
                </ul>
              </>
            )}
          </div>

          <div className="hx-actions">
            {unsaved && (
              <button type="button" className="btn primary" onClick={saveRepaired}>
                Save the repaired version
              </button>
            )}
            {ok && !unsaved ? (
              <Link href={`/build/${mineSlug(id)}`} className="btn primary" onClick={(e) => !ready() && e.preventDefault()}>
                Open the guide <IArrowRight size={18} />
              </Link>
            ) : (
              <button type="button" className="btn primary" disabled>
                Open the guide
              </button>
            )}
            <button type="button" className="btn ghost hx-btn" disabled={!ok || unsaved} onClick={async () => ready() && copy(await shareLink(id, draft), "Share link copied. It carries the whole hack, so it opens anywhere.")}>
              Copy share link
            </button>
            <button type="button" className="btn ghost hx-btn" onClick={() => downloadHack(draft)}>
              Export JSON
            </button>
            <button type="button" className="btn ghost hx-btn" onClick={() => copy(exportHack(draft), "JSON copied.")}>
              Copy JSON
            </button>
            {!unsaved && repaired && (
              <button
                type="button"
                className="btn ghost hx-btn"
                onClick={() => {
                  const h = loadHack(id);
                  const text = h && (exportBackup(h) ?? (h.problems ? savedExport : null));
                  if (text) downloadHack(draft, text);
                  else setNote({ text: "There is no backup to export." });
                }}
              >
                Export the original
              </button>
            )}
          </div>
          {note && (
            <div className="hx-note" role="status">
              <span>{note.text}</span>
              {note.link && <textarea readOnly value={note.link} aria-label="Text to copy" rows={2} onFocus={(e) => e.currentTarget.select()} />}
              <button type="button" className="btn link inline" onClick={() => setNote(null)}>
                Dismiss
              </button>
            </div>
          )}
        </aside>

        <div className="hx-form">
          <p className="callout warn hx-safety">
            <IAlert size={18} />
            <span>
              <b>Yours, unverified.</b> The starter pieces follow approximate drawings of IKEA furniture. Measure your own pieces, and check every size before you drill or cut.
            </span>
          </p>

          <section className="hx-sec" id="hx-about" aria-labelledby="hx-about-h">
            <h2 id="hx-about-h" className="hx-h2">
              About your build
            </h2>
            <Text label="Name" value={draft.name} max={LIMITS.name} required onChange={(name) => set({ name })} placeholder="KALLAX bench" />
            <Text label="One line under the name" value={draft.variant} max={LIMITS.variant} onChange={(variant) => set({ variant })} placeholder="Laid down on legs, 147 cm" />
            <Text label="What it is" value={draft.category} max={LIMITS.category} onChange={(category) => set({ category })} placeholder="Bench" hint="A word or two: bench, sideboard, wardrobe." />
            <Text label="Summary" value={draft.summary} max={LIMITS.summary} required multiline onChange={(summary) => set({ summary })} hint="What you start from and what it becomes, in a sentence or two." />
            <div className="hx-row3">
              <Num label="Time" unit="min" value={draft.minutes} min={LIMITS.minutes[0]} max={LIMITS.minutes[1]} int onChange={(minutes) => set({ minutes })} />
              <Pick label="People" value={draft.people} options={[{ id: 1, label: "One" }, { id: 2, label: "Two" }]} onChange={(people) => set({ people: people as 1 | 2 })} />
              <Pick label="Level" value={draft.difficulty} options={[{ id: 1, label: "Easy" }, { id: 2, label: "Medium" }, { id: 3, label: "Patient" }]} onChange={(difficulty) => set({ difficulty: difficulty as 1 | 2 | 3 })} />
            </div>
          </section>

          <BaseSection draft={draft} set={set} edit={edit} />

          <section className="hx-sec" aria-labelledby="hx-parts-h">
            <h2 id="hx-parts-h" className="hx-h2">
              Parts <span className="hx-count">{draft.parts.length}</span>
            </h2>
            <p className="hx-hint">Every part of what you are making, as it sits when it is finished, in millimetres: x runs left to right, y up from the floor, z from the back to the front. Pieces from the library arrive as their parts; change, move or add any of them.</p>
            <ul className="hx-list">
              {draft.parts.map((p) => (
                <PartRow
                  key={p.id}
                  part={p}
                  draft={draft}
                  open={openParts.includes(p.id)}
                  onToggle={() => setOpenParts((o) => toggle(o, p.id))}
                  edit={edit}
                  onRenamed={(to) => setOpenParts((o) => o.map((x) => (x === p.id ? to : x)))}
                  onShowStep={(s) => setView(s)}
                />
              ))}
            </ul>
            <AddParts draft={draft} edit={edit} onAdded={(pid) => setOpenParts((o) => [...o, pid])} />
          </section>

          <section className="hx-sec" aria-labelledby="hx-steps-h">
            <h2 id="hx-steps-h" className="hx-h2">
              Build order <span className="hx-count">{draft.steps.length}</span>
            </h2>
            <p className="hx-hint">Optional detail. Pieces you add get a step each; the preview shows them arriving in this order. Add fittings where parts of a step meet, or write what to do.</p>
            <ol className="hx-list">
              {draft.steps.map((s, i) => (
                <StepRow
                  key={i}
                  i={i}
                  step={s}
                  draft={draft}
                  open={openSteps.includes(i)}
                  onToggle={() => setOpenSteps((o) => toggle(o, i))}
                  edit={edit}
                  onShow={() => setView(i)}
                  onMoved={(j) => setOpenSteps((o) => o.map((x) => (x === i ? j : x === j ? i : x)))}
                  onRemoved={() => setOpenSteps((o) => o.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))}
                  onDuplicated={() => setOpenSteps((o) => o.map((x) => (x > i ? x + 1 : x)))}
                />
              ))}
            </ol>
            <button type="button" className="btn ghost hx-btn" disabled={draft.steps.length >= LIMITS.steps} onClick={() => edit(E.addStep)}>
              <IPlus size={17} /> Add a step
            </button>
          </section>

          <ListSection
            title="Also buy"
            hint="Everything else it needs, from IKEA or elsewhere: legs, hinges, boards cut to size."
            items={draft.buy}
            max={LIMITS.buy}
            onAdd={() => edit(E.addBuy, `${LIMITS.buy} at most.`)}
            onChange={(buy) => set({ buy })}
            render={(b, upd) => (
              <>
                <Text label="What" value={b.name} max={LIMITS.variant} required onChange={(name) => upd({ ...b, name })} />
                <Num label="How many" value={b.qty} min={1} max={LIMITS.qty} int onChange={(qty) => upd({ ...b, qty })} />
                <Text label="Note" value={b.note ?? ""} max={LIMITS.line} onChange={(n) => upd({ ...b, note: n || undefined })} />
              </>
            )}
          />
          <ListSection
            title="What you change"
            hint="Cuts, holes, sanding: anything done to the original pieces. Leave it empty if nothing is modified."
            items={draft.mods}
            max={LIMITS.mods}
            onAdd={() => edit((d) => E.addLine(d, "mods"), `${LIMITS.mods} at most.`)}
            onChange={(mods) => set({ mods })}
            render={(m, upd, i) => <Text label={`Change ${i + 1}`} value={m} max={LIMITS.line} onChange={upd} />}
          />
          <ListSection
            title="Watch out"
            hint="Safety notes for the cover: loads, wall fixing, hollow panels."
            items={draft.watchOut}
            max={LIMITS.watchOut}
            onAdd={() => edit((d) => E.addLine(d, "watchOut"), `${LIMITS.watchOut} at most.`)}
            onChange={(watchOut) => set({ watchOut })}
            render={(m, upd, i) => <Text label={`Note ${i + 1}`} value={m} max={LIMITS.line} onChange={upd} />}
          />
        </div>
      </div>
    </div>
  );
}

type Edit = (f: (d: HackDraft) => HackDraft | null, fail?: string) => void;

function Disclosure({ id, open, onToggle, title, meta, children }: { id: string; open: boolean; onToggle: () => void; title: React.ReactNode; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className={"hx-item" + (open ? " open" : "")} id={id}>
      <button type="button" className="hx-item-head" aria-expanded={open} aria-controls={open ? id + "-body" : undefined} onClick={onToggle}>
        <span className="hx-item-title">{title}</span>
        {meta && <span className="hx-item-meta">{meta}</span>}
        <IChevronDown size={18} className="hx-chev" />
      </button>
      {open && (
        <div className="hx-item-body" id={id + "-body"}>
          {children}
        </div>
      )}
    </li>
  );
}

function BaseSection({ draft, set, edit }: { draft: HackDraft; set: (p: Partial<HackDraft>) => void; edit: Edit }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState<E.Place>("beside");
  const [parts, setParts] = useState<string | null>(null); // the piece whose parts are listed
  const hits = useMemo(() => (q.trim().length >= 2 ? searchCatalog(q, 6) : []), [q]);
  const full = draft.parts.length >= LIMITS.parts;
  const groups = E.groupsOf(draft);
  return (
    <section className="hx-sec" aria-labelledby="hx-base-h">
      <h2 id="hx-base-h" className="hx-h2">
        Build with the library
      </h2>
      <p className="hx-hint">
        Pick furniture or single parts from the library and put them together: side by side, on top of each other, or one on legs. Each piece comes as the parts it is made of, and you can move it, then change any part below.
      </p>

      {groups.length > 0 && (
        <ul className="hx-list">
          {groups.map((g) => {
            const w = E.groupAt(draft, g);
            return (
              <li key={g.stem} className="hx-item open">
                <div className="hx-item-body">
                  <p className="hx-item-title">
                    <b>{g.label}</b> <span className="hx-hint">{g.ids.length} {g.ids.length === 1 ? "part" : "parts"}, {w.size.map((n) => Math.round(n) / 10).join(" × ")} cm</span>
                  </p>
                  <Vec legend="Where it stands (mm): middle, underside, middle" value={w.at} min={-LIMITS.pos} max={LIMITS.pos} names={["Left to right, x", "Up from floor, y", "Back to front, z"]} onChange={(to) => edit((d) => E.moveGroup(d, g, to), ROOM)} />
                  <div className="hx-item-actions">
                    <button type="button" className="btn ghost hx-btn danger" onClick={() => edit((d) => E.removeGroup(d, g))}>
                      <ITrash size={17} /> Take it out
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="hx-search">
        <label htmlFor="hx-base-q">Find furniture or a part</label>
        <div className="hx-search-box">
          <ISearch size={18} />
          <input id="hx-base-q" type="search" value={q} maxLength={60} placeholder="KALLAX, BILLY, LACK, a leg..." autoComplete="off" disabled={full} onChange={(e) => setQ(e.target.value)} aria-describedby="hx-base-n" />
        </div>
        <Pick label="Where it goes" value={at} options={[{ id: "beside", label: "Beside what is there" }, { id: "on-top", label: "On top of it" }]} onChange={(v) => setAt(v as E.Place)} />
        <span id="hx-base-n" className="hx-hint" aria-live="polite">
          {full ? `${LIMITS.parts} parts at most.` : q.trim().length >= 2 ? (hits.length ? `${hits.length} found` : "Nothing found. Type the name as IKEA writes it, or add a board below.") : ""}
        </span>
        {hits.length > 0 && (
          <ul className="hx-hits">
            {hits.map(({ entry: e }) => (
              <li key={e.slug}>
                <div className="hx-hit">
                  <span>
                    <b>{e.name}</b> {e.variant}
                  </span>
                  <span className="hx-hit-add">
                    <button type="button" className="btn link inline" aria-expanded={parts === e.slug} onClick={() => setParts(parts === e.slug ? null : e.slug)}>
                      Its parts
                    </button>
                    <button
                      type="button"
                      className="btn link inline"
                      onClick={() => {
                        edit((d) => E.addFurniture(d, e.slug, at), ROOM);
                        setQ("");
                      }}
                    >
                      <IPlus size={16} /> Add it
                    </button>
                  </span>
                </div>
                {parts === e.slug && (
                  <ul className="hx-hits">
                    {libraryParts(e.slug).map((p) => (
                      <li key={p.ref}>
                        <div className="hx-hit">
                          <span>
                            {p.name} <span className="hx-hint">{p.size.map((n) => Math.round(n)).join(" × ")} mm, {p.qty} in the box</span>
                          </span>
                          <button type="button" className="btn link inline" onClick={() => edit((d) => E.addLibraryPart(d, e.slug, p.ref, at), ROOM)}>
                            <IPlus size={16} /> Add
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h3 className="hx-h3">Made from</h3>
      <p className="hx-hint">What the build uses, kept up to date as you add. Edit the names and counts, or add something the library does not have.</p>
      {draft.base.length > 0 && (
        <ul className="hx-rows">
          {draft.base.map((b, i) => (
            <li key={i} className="hx-row">
              <Text label="Piece" value={b.name} max={LIMITS.variant} required onChange={(name) => set({ base: draft.base.map((x, j) => (j === i ? { ...x, name } : x)) })} hint={b.slug ? "Links to its own guide" : undefined} />
              <Num label="How many" value={b.qty} min={1} max={LIMITS.qty} int onChange={(qty) => set({ base: draft.base.map((x, j) => (j === i ? { ...x, qty } : x)) })} />
              <button type="button" className="btn round small hx-del" aria-label={`Remove ${b.name || "this piece"}`} onClick={() => set({ base: draft.base.filter((_, j) => j !== i) })}>
                <ITrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn link inline" disabled={draft.base.length >= LIMITS.base} onClick={() => edit((d) => E.addBase(d), `${LIMITS.base} pieces at most.`)}>
        Add one by hand
      </button>
    </section>
  );
}

function PartRow({
  part: p,
  draft,
  open,
  onToggle,
  edit,
  onRenamed,
  onShowStep,
}: {
  part: CustomPart;
  draft: HackDraft;
  open: boolean;
  onToggle: () => void;
  edit: Edit;
  onRenamed: (to: string) => void;
  onShowStep: (step: number) => void;
}) {
  const [idText, setIdText] = useState(p.id);
  const [seenId, setSeenId] = useState(p.id);
  if (seenId !== p.id) {
    setSeenId(p.id);
    setIdText(p.id);
  }
  const step = E.stepOf(draft, p.id);
  const idBad = idText !== p.id && (!PART_ID.test(idText) || draft.parts.some((x) => x.id === idText));
  const upd = (patch: Partial<CustomPart>) => edit((d) => E.updatePart(d, p.id, patch));
  const commitId = () => {
    if (idText === p.id || idBad) return setIdText(p.id);
    edit((d) => E.renamePart(d, p.id, idText));
    onRenamed(idText);
  };
  return (
    <Disclosure
      id={`hx-part-${p.id}`}
      open={open}
      onToggle={onToggle}
      title={
        <>
          {p.label && <span className="hx-letter">{p.label}</span>}
          {p.name || "Unnamed part"}
        </>
      }
      meta={
        <>
          {p.id}, {p.size.map((n) => Math.round(n)).join(" × ")} mm, {step >= 0 ? `step ${step + 1}` : <span className="hx-warn">no step</span>}
        </>
      }
    >
      <div className="hx-row3">
        <Text label="Name" value={p.name} max={LIMITS.partName} required onChange={(name) => upd({ name })} />
        <Text label="Letter" value={p.label ?? ""} max={LIMITS.label} onChange={(label) => upd({ label: label || undefined })} hint="Same letter for identical parts." />
        <div className="hx-field">
          <label htmlFor={`hx-id-${p.id}`}>Id</label>
          <input
            id={`hx-id-${p.id}`}
            type="text"
            value={idText}
            maxLength={LIMITS.id}
            aria-invalid={idBad || undefined}
            aria-describedby={`hx-id-${p.id}-hint`}
            onChange={(e) => setIdText(e.target.value.trim())}
            onBlur={commitId}
            onKeyDown={(e) => e.key === "Enter" && commitId()}
          />
          <span id={`hx-id-${p.id}-hint`} className={"hx-hint" + (idBad ? " bad" : "")}>
            {idBad ? "Letters, digits, - or _, not used by another part." : "Steps refer to it by this."}
          </span>
        </div>
      </div>
      <div className="hx-row3">
        <Pick label="Shape" value={p.shape ?? "box"} options={[{ id: "box", label: "Box" }, { id: "cyl", label: "Rod or leg (cylinder)" }]} onChange={(shape) => upd({ shape: shape as "box" | "cyl" })} />
        <Pick label="Material" value={p.material ?? "board"} options={MATERIALS} onChange={(material) => upd({ material: material as PartMaterial })} />
        <Pick
          label="Arrives in"
          value={step}
          options={[{ id: -1, label: "No step yet" }, ...draft.steps.map((s, i) => ({ id: i, label: `Step ${i + 1}: ${s.title || "untitled"}`.slice(0, 48) }))]}
          onChange={(s) => edit((d) => E.setPartStep(d, p.id, s as number))}
        />
      </div>
      <Vec legend="Size" value={p.size} min={LIMITS.size[0]} max={LIMITS.size[1]} names={SIZE_NAMES} onChange={(size) => upd({ size })} />
      <Vec legend="Centre" value={p.pos} min={-LIMITS.pos} max={LIMITS.pos} names={POS_NAMES} onChange={(pos) => upd({ pos })} />
      <div className="hx-item-actions">
        {step >= 0 && (
          <button type="button" className="btn ghost hx-btn" onClick={() => onShowStep(step)}>
            Show its step
          </button>
        )}
        <button type="button" className="btn ghost hx-btn" onClick={() => edit((d) => E.duplicatePart(d, p.id)?.draft ?? null, ROOM)}>
          Duplicate
        </button>
        <button type="button" className="btn ghost hx-btn danger" onClick={() => edit((d) => E.removePart(d, p.id))}>
          <ITrash size={17} /> Remove
        </button>
      </div>
    </Disclosure>
  );
}

function AddParts({ draft, edit, onAdded }: { draft: HackDraft; edit: Edit; onAdded: (id: string) => void }) {
  const full = draft.parts.length >= LIMITS.parts;
  return (
    <div className="hx-add">
      <button
        type="button"
        className="btn ghost hx-btn"
        disabled={full}
        onClick={() => {
          const r = E.addPart(draft);
          edit(() => r?.draft ?? null, ROOM);
          if (!r) return;
          onAdded(r.id);
        }}
      >
        <IPlus size={17} /> Add a board
      </button>
    </div>
  );
}

const ROOM = `No room for that: a hack has ${LIMITS.parts} parts and ${LIMITS.steps} steps at most, and every part sits within ${LIMITS.pos / 1000} m of the middle. Move or remove some parts first.`;

const KIND_OPTS = FIX_KINDS.map((k) => ({ id: k.id, label: k.label }));
const TOOL_OPTS = TOOLS.map((t) => ({ id: t, label: TOOL_INFO[t].name }));
const WARN_OPTS = WARNINGS.map((w) => ({ id: w, label: WARN_TEXT[w] }));
const POSE_OPTS: { id: Pose | "same"; label: string }[] = [{ id: "same", label: "As the step before" }, ...POSES];

function StepRow({
  i,
  step: s,
  draft,
  open,
  onToggle,
  edit,
  onShow,
  onMoved,
  onRemoved,
  onDuplicated,
}: {
  i: number;
  step: CustomStep;
  draft: HackDraft;
  open: boolean;
  onToggle: () => void;
  edit: Edit;
  onShow: () => void;
  onMoved: (j: number) => void;
  onRemoved: () => void;
  onDuplicated: () => void;
}) {
  const upd = (patch: Partial<CustomStep>) => edit((d) => E.updateStep(d, i, patch));
  const fixes = s.fix ?? [];
  const setFix = (j: number, f: CustomFix | null) => {
    const next = f ? fixes.map((x, k) => (k === j ? f : x)) : fixes.filter((_, k) => k !== j);
    upd({ fix: next.length ? next : undefined });
  };
  const partOpts = draft.parts.map((p) => {
    const where = E.stepOf(draft, p.id);
    return { id: p.id, label: `${p.name} (${p.id})`, note: where >= 0 && where !== i ? `now in step ${where + 1}` : undefined };
  });
  const fixDesc = fixes.map((f) => `${f.count} ${FIX_KINDS.find((k) => k.id === f.kind)?.label.toLowerCase() ?? f.kind}`).join(", ");
  return (
    <Disclosure
      id={`hx-step-${i}`}
      open={open}
      onToggle={onToggle}
      title={
        <>
          <span className="hx-letter">{i + 1}</span>
          {s.title || "Untitled step"}
        </>
      }
      meta={`${s.add?.length ?? 0} parts${fixDesc ? `, ${fixDesc}` : ""}`}
    >
      <Text label="Title" value={s.title} max={LIMITS.title} required onChange={(title) => upd({ title })} />
      <Text label="What to do" value={s.detail ?? ""} max={LIMITS.detail} multiline onChange={(detail) => upd({ detail: detail || undefined })} />
      <Checks
        legend="Parts that arrive in this step"
        options={partOpts}
        value={s.add ?? []}
        onChange={(next) =>
          edit((d) => {
            const before = d.steps[i]?.add ?? [];
            let n = d;
            for (const id of next) if (!before.includes(id)) n = E.setPartStep(n, id, i);
            for (const id of before) if (!next.includes(id)) n = E.setPartStep(n, id, -1);
            return n;
          })
        }
      />
      <fieldset className="hx-fixes">
        <legend>Fittings</legend>
        {fixes.length === 0 && <p className="hx-hint">None. Add dowels, screws, hinges and the like: the guide places them where the parts touch.</p>}
        {fixes.map((f, j) => (
          <FixRow key={j} n={j} fix={f} parts={draft.parts} onChange={(x) => setFix(j, x)} />
        ))}
        <button type="button" className="btn link inline" disabled={fixes.length >= LIMITS.fixes} onClick={() => upd({ fix: [...fixes, emptyFix()] })}>
          <IPlus size={15} /> Add a fitting
        </button>
      </fieldset>
      <Checks legend="Tools" options={TOOL_OPTS} value={s.tools ?? []} onChange={(t) => upd({ tools: t.length ? (t as ToolId[]) : undefined })} />
      <div className="hx-row3">
        <Pick label="People" value={s.people ?? 1} options={[{ id: 1, label: "One" }, { id: 2, label: "Two" }]} onChange={(people) => upd({ people: people === 2 ? 2 : undefined })} />
        <Pick label="The piece lies" value={s.pose ?? "same"} options={POSE_OPTS} onChange={(pose) => upd({ pose: pose === "same" ? undefined : (pose as Pose) })} />
      </div>
      <Checks legend="Warnings" options={WARN_OPTS} value={s.warnings ?? []} max={LIMITS.warnings} onChange={(w) => upd({ warnings: w.length ? (w as WarnId[]) : undefined })} />
      <div className="hx-item-actions">
        <button type="button" className="btn ghost hx-btn" onClick={onShow}>
          Show in 3D
        </button>
        <button
          type="button"
          className="btn ghost hx-btn"
          disabled={i === 0}
          onClick={() => {
            edit((d) => E.moveStep(d, i, -1));
            onMoved(i - 1);
          }}
        >
          Move up
        </button>
        <button
          type="button"
          className="btn ghost hx-btn"
          disabled={i === draft.steps.length - 1}
          onClick={() => {
            edit((d) => E.moveStep(d, i, 1));
            onMoved(i + 1);
          }}
        >
          Move down
        </button>
        <button type="button" className="btn ghost hx-btn" disabled={draft.steps.length >= LIMITS.steps} onClick={() => {
            edit((d) => E.duplicateStep(d, i));
            onDuplicated();
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="btn ghost hx-btn danger"
          onClick={() => {
            edit((d) => E.removeStep(d, i));
            onRemoved();
          }}
        >
          <ITrash size={17} /> Remove
        </button>
      </div>
    </Disclosure>
  );
}

function FixRow({ n, fix: f, parts, onChange }: { n: number; fix: CustomFix; parts: CustomPart[]; onChange: (f: CustomFix | null) => void }) {
  // ticked while the fitting has a list of parts, even an empty one: the state lives in the data, so it follows the row
  const narrow = f.to !== undefined;
  const screwLike = f.kind === "screw" || f.kind === "bolt" || f.kind === "nail";
  return (
    <div className="hx-fix">
      <div className="hx-fix-main">
        <Pick label={`Fitting ${n + 1}`} value={f.kind} options={KIND_OPTS} onChange={(kind) => onChange({ ...f, kind: kind as HwKind })} />
        <Num label="How many" value={f.count} min={1} max={LIMITS.fixCount} int onChange={(count) => onChange({ ...f, count })} />
        {screwLike && <Num label="Length" unit="mm, 0 to pick" value={f.len ?? 0} min={0} max={LIMITS.len[1]} int onChange={(len) => onChange({ ...f, len: len >= LIMITS.len[0] ? len : undefined })} />}
        <button type="button" className="btn round small hx-del" aria-label={`Remove fitting ${n + 1}`} onClick={() => onChange(null)}>
          <ITrash size={18} />
        </button>
      </div>
      <p className="hx-hint">{FIX_KINDS.find((k) => k.id === f.kind)?.hint}.</p>
      <label className="hx-check">
        <input type="checkbox" checked={narrow} onChange={() => onChange({ ...f, to: narrow ? undefined : [] })} />
        <span>Only into some parts</span>
      </label>
      {narrow && <Checks legend={`Fitting ${n + 1} goes into`} options={parts.map((p) => ({ id: p.id, label: `${p.name} (${p.id})` }))} value={f.to ?? []} max={LIMITS.targets} onChange={(to) => onChange({ ...f, to })} />}
    </div>
  );
}

function ListSection<T>({
  title,
  hint,
  items,
  max,
  onAdd,
  onChange,
  render,
}: {
  title: string;
  hint: string;
  items: T[];
  max: number;
  onAdd: () => void;
  onChange: (v: T[]) => void;
  render: (item: T, upd: (v: T) => void, i: number) => React.ReactNode;
}) {
  const hid = "hx-" + title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section className="hx-sec" aria-labelledby={hid}>
      <h2 id={hid} className="hx-h2">
        {title}
      </h2>
      <p className="hx-hint">{hint}</p>
      {items.length > 0 && (
        <ul className="hx-rows">
          {items.map((it, i) => (
            <li key={i} className="hx-row">
              {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
              <button type="button" className="btn round small hx-del" aria-label={`Remove ${title.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <ITrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn link inline" disabled={items.length >= max} onClick={onAdd}>
        <IPlus size={15} /> Add {items.length ? "another" : "one"}
      </button>
    </section>
  );
}
