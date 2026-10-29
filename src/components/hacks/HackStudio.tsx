"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ID_RE, mineSlug, specToDraft, type HackDraft } from "@/lib/hacks/draft";
import { parseHackText, sanitizeDraft } from "@/lib/hacks/sanitize";
import { createHack, deleteHack, exportSaved, isUnreadable, knownSlug, loadStored, storageWorks } from "@/lib/hacks/store";
import { CURATED, billyDraft, blankDraft, kallaxDraft } from "@/lib/hacks/templates";
import { cachedSpec } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import HackEditor from "./HackEditor";
import PhotoHack from "./PhotoHack";
import MyHacks, { downloadText } from "./MyHacks";
import { Num } from "./fields";
import { IAlert, IArrowRight, IUpload } from "../art/Icons";

/** /hacks/new: pick a starting point (or one of your hacks), then edit it at /hacks/new?id=... */
export default function HackStudio() {
  const id = useSearchParams().get("id");
  const mounted = useMounted();
  if (!mounted) return <p className="hx-loading">Opening the editor</p>;
  if (id) return <Open key={id} id={id} />;
  return <Start />;
}

function Open({ id }: { id: string }) {
  const router = useRouter();
  const stored = useMemo(() => (ID_RE.test(id) ? loadStored(id) : null), [id]);
  const saved = isUnreadable(stored) ? null : stored;
  // a hack someone shared with you: its link left a copy in this browser, ready to become yours
  const shared = useMemo(() => {
    if (stored || !ID_RE.test(id)) return null;
    try {
      const s = cachedSpec(mineSlug(id));
      return s?.source === "mine" ? sanitizeDraft(specToDraft(s), knownSlug).draft : null;
    } catch {
      // a copy that isn't a guide any more: as if there were none
      return null;
    }
  }, [stored, id]);
  if (isUnreadable(stored))
    return (
      <div className="hx-gone">
        <h1 className="hx-h1">This saved hack can&apos;t be read</h1>
        <p className="lead">Something stored under it in this browser isn&apos;t a hack: {stored.reason} You can export it exactly as it is stored, or delete it.</p>
        <div className="hx-gone-actions">
          <button type="button" className="btn ghost" onClick={() => downloadText("unreadable-record", exportSaved(stored))}>
            Export as saved
          </button>
          <button
            type="button"
            className="btn ghost hx-btn danger"
            onClick={() => {
              deleteHack(id);
              router.replace("/hacks/new");
            }}
          >
            Delete it
          </button>
          <button type="button" className="btn ghost" onClick={() => router.push("/hacks/new")}>
            Back to my hacks
          </button>
        </div>
      </div>
    );
  if (saved) return <HackEditor id={id} initial={saved.draft} repaired={saved.problems} savedExport={saved.problems ? exportSaved(saved) : undefined} />;
  return (
    <div className="hx-gone">
      <h1 className="hx-h1">{shared ? "A hack shared with you" : "This hack isn't here"}</h1>
      <p className="lead">
        {shared
          ? `"${shared.name}" was shared with you. Save your own copy to change it: the copy gets its own link, and the shared link keeps showing the shared version.`
          : "Hacks are saved in the browser that made them. Import its JSON file, or start a new one."}
      </p>
      <div className="hx-gone-actions">
        {shared && (
          <button
            type="button"
            className="btn primary"
            // a new id, so the sharer's later links still open their version and your edits stay yours
            onClick={() => router.replace(`/hacks/new?id=${createHack(shared)}`)}
          >
            Save a copy and edit it <IArrowRight size={18} />
          </button>
        )}
        <button type="button" className="btn ghost" onClick={() => router.push("/hacks/new")}>
          Start a new hack
        </button>
      </div>
    </div>
  );
}

function Start() {
  const router = useRouter();
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [units, setUnits] = useState(2);
  const [paste, setPaste] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  // a refused file that can still be read with repairs: blanks filled, numbers clamped
  const [fixable, setFixable] = useState<HackDraft | null>(null);
  const persistent = useMemo(() => storageWorks(), []);
  const begin = (d: HackDraft) => router.push(`/hacks/new?id=${createHack(d)}`);
  const importText = (text: string) => {
    const r = parseHackText(text, knownSlug);
    if (r.draft) {
      setErrors([]);
      setFixable(null);
      begin(r.draft);
      return;
    }
    setErrors(r.errors);
    let raw: unknown = null;
    try {
      raw = text.length <= 300_000 ? JSON.parse(text) : null;
    } catch {
      /* not JSON: nothing to repair */
    }
    const fixed = raw && typeof raw === "object" && !Array.isArray(raw) ? sanitizeDraft(raw, knownSlug, { repair: true }).draft : null;
    setFixable(fixed && (fixed.parts.length || fixed.steps.length) ? fixed : null);
  };

  return (
    <div className="hx-start">
      <header className="page-head">
        <h1>Make a hack</h1>
        <p className="lead">Start from IKEA pieces drawn as parts, move and add boards, write the steps, and watch the guide build itself in 3D as you go.</p>
      </header>
      <p className="callout warn hx-safety">
        <IAlert size={18} />
        <span>
          <b>Your hacks are yours, and unverified.</b> Nobody checks them, and the starter pieces are approximate drawings of IKEA furniture. Measure your own pieces before you drill or cut.
        </span>
      </p>
      {!persistent && (
        <p className="callout note hx-safety" role="status">
          <IAlert size={18} />
          <span>This browser isn&apos;t saving anything (a private window, or storage is blocked). You can still make a hack: export it as a file before you close the tab.</span>
        </p>
      )}

      <PhotoHack />

      <MyHacks />

      <section aria-labelledby="hx-start-h">
        <h2 id="hx-start-h" className="hx-h2">
          Start a new one
        </h2>
        <ul className="hx-starts">
          <li className="hx-start-card">
            <b>A KALLAX grid</b>
            <span className="hx-hint">The frame and every divider as parts, with the steps to build it.</span>
            <div className="hx-row3">
              <Num label="Columns" value={cols} min={1} max={5} int onChange={setCols} />
              <Num label="Rows" value={rows} min={1} max={5} int onChange={setRows} />
            </div>
            <button type="button" className="btn primary" onClick={() => begin(kallaxDraft(cols, rows))}>
              Start from KALLAX {cols} × {rows}
            </button>
          </li>
          <li className="hx-start-card">
            <b>BILLY bookcases</b>
            <span className="hx-hint">80 × 202 cm units side by side, with shelves and backs.</span>
            <Num label="Bookcases" value={units} min={1} max={4} int onChange={setUnits} />
            <button type="button" className="btn primary" onClick={() => begin(billyDraft(units))}>
              Start from {units} BILLY
            </button>
          </li>
          <li className="hx-start-card">
            <b>A blank board</b>
            <span className="hx-hint">One board to build on, for anything the starters don&apos;t cover.</span>
            <button type="button" className="btn primary" onClick={() => begin(blankDraft())}>
              Start blank
            </button>
          </li>
        </ul>

        <h3 className="hx-h3">Or change one of our hacks</h3>
        <ul className="hx-copies">
          {CURATED.map((c) => (
            <li key={c.slug}>
              <button type="button" className="btn ghost hx-btn" onClick={() => begin(c.draft())}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="hx-import-h" className="hx-import">
        <h2 id="hx-import-h" className="hx-h2">
          Import a hack
        </h2>
        <p className="hx-hint">A .json file exported from Hackea. It is checked before anything is saved.</p>
        <label className="btn ghost hx-btn hx-file">
          <IUpload size={17} /> Choose a file
          <input
            type="file"
            accept=".json,application/json"
            className="hx-file-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 300_000) {
                setFixable(null);
                return setErrors(["The file is larger than 300 kB."]);
              }
              importText(await f.text());
            }}
          />
        </label>
        <div className="hx-field">
          <label htmlFor="hx-paste">Or paste its JSON</label>
          <textarea id="hx-paste" rows={4} value={paste} maxLength={300_000} onChange={(e) => setPaste(e.target.value)} spellCheck={false} />
        </div>
        <button type="button" className="btn ghost hx-btn" disabled={!paste.trim()} onClick={() => importText(paste)}>
          Import the pasted JSON
        </button>
        {errors.length > 0 && (
          <div className="hx-issues" role="alert">
            <p>
              <IAlert size={16} /> Not imported:
            </p>
            <ul>
              {errors.slice(0, 10).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {errors.length > 10 && <li>and {errors.length - 10} more</li>}
            </ul>
            {fixable && (
              <button type="button" className="btn ghost hx-btn" onClick={() => begin(fixable)}>
                Import it anyway, with these fixed
              </button>
            )}
          </div>
        )}
      </section>

      <p className="hx-hint">
        Curious how the curated ones are made? <Link href="/hacks">See all hacks</Link>.
      </p>
    </div>
  );
}
