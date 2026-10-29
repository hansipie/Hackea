"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomPart, Plan, Vec3 } from "@/lib/types";
import type { StageMode } from "@/engine/stage";
import { autoSteps } from "@/lib/hacks/autosteps";
import { checkDraft, type Issue } from "@/lib/hacks/check";
import { boundsMm, mineSlug, type HackDraft } from "@/lib/hacks/draft";
import * as E from "@/lib/hacks/edit";
import { useHistory } from "@/lib/hacks/history";
import { exportHack } from "@/lib/hacks/sanitize";
import { exportBackup, loadHack, saveHack, shareLink } from "@/lib/hacks/store";
import StageView from "../../StageView";
import { IAlert, IArrowLeft, IArrowRight, ICheck } from "../../art/Icons";
import { downloadHack } from "../MyHacks";
import Details from "./Details";
import Inspector from "./Inspector";
import LibraryPanel from "./LibraryPanel";
import Toolbar from "./Toolbar";
import ViewportView, { type ViewportHandle } from "./ViewportView";
import type { Tool, ViewName } from "./viewport";

const ROOM = `No room for that: a build has ${120} parts at most, and every part sits within 6 m of the middle.`;

type Tab = "part" | "details" | "guide";

/**
 * The workspace: a 3D and flat view to place parts in, a toolbar, the library of supplies on the left and the
 * selected part's numbers on the right. Every change is saved in this browser; the assembly steps are worked out
 * from where the parts are (src/lib/hacks/autosteps.ts), so there is nothing to write by hand.
 *
 * `repaired` lists what was wrong with a saved hack that didn't read back, and `savedExport` is that record as it
 * was stored. Such a hack is never written until it is edited or saved on purpose, and its guide and share link
 * wait for that explicit save; whatever replaces the record, the store keeps the original as a backup.
 */
export default function Workspace({ id, initial, repaired, savedExport }: { id: string; initial: HackDraft; repaired?: string[]; savedExport?: string }) {
  const h = useHistory(initial);
  const draft = h.value;
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<ViewName>("3d");
  const [snap, setSnap] = useState(true);
  const [tab, setTab] = useState<Tab>("part");
  const [preview, setPreview] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [saved, setSaved] = useState<"saved" | "memory" | null>(null);
  const [shown, setShown] = useState(initial);
  const [note, setNote] = useState<{ text: string; link?: string } | null>(null);
  const [unsaved, setUnsaved] = useState(!!repaired?.length);
  const pending = useRef<HackDraft | null>(null);
  const vp = useRef<ViewportHandle | null>(null);
  const reframe = useRef(false);
  // set by the first change, so that undoing back to what was opened still writes it back
  const edited = useRef(false);

  // saved a moment after each change, and the checks run again
  useEffect(() => {
    // opening a hack isn't an edit: nothing is written until something changes
    if (draft === initial && !edited.current) return;
    edited.current = true;
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
  const [lastPlan, setLastPlan] = useState<Plan | null>(plan);
  if (plan && plan !== lastPlan) setLastPlan(plan);
  const stagePlan = plan ?? lastPlan;
  const stepCount = stagePlan?.steps.length ?? 0;
  const at = step !== null && step < stepCount ? step : null;
  const mode: StageMode = at === null ? { kind: "assembled", dims: true } : { kind: "step", index: at };
  const size = boundsMm(draft.parts).size.map((mm) => Math.round(mm) / 10);
  const ok = issues.length === 0;
  const selected = useMemo(() => draft.parts.filter((p) => selection.includes(p.id)), [draft.parts, selection]);

  // a selection that names a part which is gone (deleted, undone) drops it
  const live = selection.filter((s) => draft.parts.some((p) => p.id === s));
  if (live.length !== selection.length) setSelection(live);

  useEffect(() => {
    if (reframe.current) {
      reframe.current = false;
      vp.current?.frame();
    }
  }, [draft.parts]);

  /** A change to the shape of the build: its steps are worked out again. */
  const apply = (f: (d: HackDraft) => HackDraft | null, opts: { key?: string; fail?: string } = {}) => {
    const n = f(draft);
    if (!n) {
      setNote({ text: opts.fail ?? ROOM });
      return null;
    }
    const next = autoSteps(n);
    h.set(next, opts.key);
    return next;
  };
  /** A change to the words (name, summary, lists): the steps are left as they are. */
  const set = (patch: Partial<HackDraft>) => h.set({ ...draft, ...patch }, "words");
  const edit = (f: (d: HackDraft) => HackDraft | null, fail?: string) => {
    const n = f(draft);
    if (n) h.set(n, "words");
    else if (fail) setNote({ text: fail });
  };

  const added = (next: HackDraft | null, before: HackDraft) => {
    if (!next) return;
    const had = new Set(before.parts.map((p) => p.id));
    setSelection(next.parts.filter((p) => !had.has(p.id)).map((p) => p.id));
    setTab("part");
    reframe.current = true;
  };

  const pick = (pid: string | null, additive: boolean) => {
    if (!pid) return additive ? undefined : setSelection([]);
    setSelection((s) => (additive ? (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]) : [pid]));
    setTab("part");
  };
  const del = () => {
    if (!selection.length) return;
    // a whole piece from the library goes with its place in "Made from"; single parts just go
    const whole = E.groupsOf(draft).filter((g) => g.ids.every((x) => selection.includes(x)));
    apply((d) => E.removeParts(whole.reduce(E.removeGroup, d), selection));
    setSelection([]);
  };
  const duplicate = () => {
    const r = E.duplicateParts(draft, selection);
    if (!r) return setNote({ text: ROOM });
    h.set(autoSteps(r.draft));
    setSelection(r.ids);
  };
  const turn = (axis: 0 | 1 | 2, by: number) => selection.length && apply((d) => E.turnParts(d, selection, axis, by), { key: `turn${axis}` });

  // keys, unless a field has the focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        return e.shiftKey ? h.redo() : h.undo();
      }
      if (mod && k === "y") {
        e.preventDefault();
        return h.redo();
      }
      if (mod && k === "d") {
        e.preventDefault();
        return duplicate();
      }
      if (mod && k === "a") {
        e.preventDefault();
        return setSelection(draft.parts.map((p) => p.id));
      }
      if (mod) return;
      if (e.key === "Escape") {
        vp.current?.cancel();
        return setSelection([]);
      }
      if (e.key === "Delete" || e.key === "Backspace") return del();
      if (k === "v") return setTool("select");
      if (k === "m") return setTool("move");
      if (k === "s") return setTool("scale");
      if (k === "f") return vp.current?.frame();
      if (k === "r") return turn(e.shiftKey ? 0 : e.altKey ? 2 : 1, Math.PI / 2);
      if (["1", "2", "3", "4"].includes(k)) return setView((["3d", "top", "front", "side"] as const)[Number(k) - 1]);
      const arrow: Record<string, Vec3> = { ArrowLeft: [-1, 0, 0], ArrowRight: [1, 0, 0], ArrowUp: [0, 0, -1], ArrowDown: [0, 0, 1], PageUp: [0, 1, 0], PageDown: [0, -1, 0] };
      const dir = arrow[e.key];
      if (dir && selection.length) {
        e.preventDefault();
        const n = e.shiftKey ? 100 : 10;
        apply((d) => E.moveParts(d, selection, [dir[0] * n, dir[1] * n, dir[2] * n]), { key: "nudge" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reveal = (domId: string) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
    });
  const goIssue = (i: Issue) => {
    if (i.part && draft.parts.some((p) => p.id === i.part)) {
      setSelection([i.part]);
      setTab("part");
    } else {
      setTab("details");
      reveal("hx-about");
    }
  };
  // the buttons act on the draft as it is now, not on the checks that lag behind it
  const ready = () => {
    if (unsaved) {
      setNote({ text: "Save the repaired version first: until then the hack stays as it was stored." });
      return false;
    }
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

  const patchPart = (pid: string, patch: Partial<CustomPart>) => apply((d) => E.updatePart(d, pid, patch), { key: `part:${pid}` });

  return (
    <div className="wk">
      <div className="hx-top">
        <Link href="/hacks/new" className="btn link inline hx-back">
          <IArrowLeft size={16} /> My builds
        </Link>
        <b className="wk-name">{draft.name || "Untitled"}</b>
        <span className={"hx-saved" + (saved === "memory" ? " warn" : "")} role="status">
          {saved === "memory" ? "This browser isn't saving: export a file before you close the tab" : saved ? "Saved in this browser" : ""}
        </span>
      </div>
      {unsaved && repaired && (
        <div className="callout warn hx-repair" role="region" aria-label="Repaired hack">
          <IAlert size={18} />
          <div>
            <b>This hack didn&apos;t read back as it was saved</b>
            <span>
              The workspace shows a repaired version: blanks filled in and numbers brought within bounds. Nothing is written until you edit it or save the repaired version, and the original is kept as a backup either way. What was wrong: {repaired.slice(0, 4).join("; ")}
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

      <Toolbar
        tool={tool}
        onTool={setTool}
        view={view}
        onView={setView}
        hasSelection={selection.length > 0}
        canUndo={h.canUndo}
        canRedo={h.canRedo}
        snap={snap}
        onSnap={() => setSnap((s) => !s)}
        onUndo={h.undo}
        onRedo={h.redo}
        onTurn={(axis, by) => turn(axis, by)}
        onDuplicate={duplicate}
        onDelete={del}
        onFrame={() => vp.current?.frame()}
      />

      <div className="wk-body">
        <LibraryPanel
          full={draft.parts.length >= 120}
          onAddFurniture={(slug, place) => added(apply((d) => E.addFurniture(d, slug, place)), draft)}
          onAddPart={(slug, ref, place) => added(apply((d) => E.addLibraryPart(d, slug, ref, place)), draft)}
          onAddShape={(preset) => added(apply((d) => E.addShape(d, preset)?.draft ?? null), draft)}
        />

        <div className="wk-stage">
          {preview && stagePlan ? (
            <StageView plan={stagePlan} mode={mode} options={{ callout: true, interactive: true }} />
          ) : (
            <ViewportView
              parts={draft.parts}
              selection={selection}
              tool={tool}
              view={view}
              snap={snap}
              onPick={pick}
              onMove={(ids, by) => apply((d) => E.moveParts(d, ids, by), { key: "move" })}
              onResize={(pid, sz, pos) =>
                apply((d) => {
                  const r = E.movePart(E.resizePart(d, pid, sz), pid, pos);
                  return r;
                })
              }
              onReady={(v) => (vp.current = v)}
            />
          )}
          {!draft.parts.length && !preview && <p className="wk-hint-empty">Add a piece from the library, or a board, to start.</p>}
          <div className="wk-stage-bar">
            <button type="button" className={"chip" + (preview ? " on" : "")} aria-pressed={preview} onClick={() => setPreview((p) => !p)} disabled={!stagePlan}>
              Guide preview
            </button>
            {preview && (
              <span className="hx-view" role="group" aria-label="What the preview shows">
                <button type="button" className={"chip" + (at === null ? " on" : "")} aria-pressed={at === null} onClick={() => setStep(null)}>
                  Finished
                </button>
                <button type="button" className="btn round small" aria-label="Previous step" disabled={!stepCount || at === 0} onClick={() => setStep(at === null ? stepCount - 1 : at - 1)}>
                  <IArrowLeft size={18} />
                </button>
                <span className="hx-view-at" aria-live="polite">
                  {at === null ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}` : `Step ${at + 1} of ${stepCount}`}
                </span>
                <button type="button" className="btn round small" aria-label="Next step" disabled={!stepCount || at === stepCount - 1} onClick={() => setStep(at === null ? 0 : at + 1)}>
                  <IArrowRight size={18} />
                </button>
              </span>
            )}
            <span className="wk-size">
              {size[0]} × {size[1]} × {size[2]} cm · {draft.parts.length} parts
            </span>
          </div>
        </div>

        <aside className="wk-panel wk-side" aria-label="Properties">
          <div className="wk-tabs" role="tablist" aria-label="Properties">
            {(["part", "details", "guide"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={"wk-tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
                {t === "part" ? "Part" : t === "details" ? "Details" : ok ? "Guide" : `Guide (${issues.length})`}
              </button>
            ))}
          </div>
          {tab === "part" && (
            <Inspector
              selected={selected}
              onPatch={patchPart}
              onSize={(pid, sz) => apply((d) => E.resizePart(d, pid, sz), { key: `size:${pid}` })}
              onTurnTo={(pid, rot) => apply((d) => E.setRotation(d, pid, rot), { key: `rot:${pid}` })}
              onMoveBy={(ids, by) => apply((d) => E.moveParts(d, ids, by), { key: "move" })}
              onDelete={del}
            />
          )}
          {tab === "details" && <Details draft={draft} set={set} edit={edit} />}
          {tab === "guide" && (
            <div className="wk-pane">
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
              <h3 className="hx-h3">Steps, worked out from the parts</h3>
              <ol className="wk-steps">
                {draft.steps.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="btn link inline"
                      onClick={() => {
                        setPreview(true);
                        setStep(i);
                      }}
                    >
                      {s.title}
                    </button>
                  </li>
                ))}
              </ol>
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
                      const r = loadHack(id);
                      const text = r && (exportBackup(r) ?? (r.problems ? savedExport : null));
                      if (text) downloadHack(draft, text);
                      else setNote({ text: "There is no backup to export." });
                    }}
                  >
                    Export the original
                  </button>
                )}
              </div>
            </div>
          )}
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
      </div>
    </div>
  );
}
