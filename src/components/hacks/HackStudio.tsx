"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ID_RE, mineSlug, specToDraft, type HackDraft } from "@/lib/hacks/draft";
import { parseHackText, sanitizeDraft } from "@/lib/hacks/sanitize";
import { createHack, deleteHack, exportSaved, isUnreadable, knownSlug, loadStored, storageWorks } from "@/lib/hacks/store";
import { libraryDraft } from "@/lib/hacks/templates";
import type { Place } from "@/lib/hacks/edit";
import { searchCatalog } from "@/lib/search";
import { cachedSpec } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import HackEditor from "./HackEditor";
import PhotoHack from "./PhotoHack";
import MyHacks, { downloadText } from "./MyHacks";
import { Num, Pick } from "./fields";
import { IAlert, IArrowRight, IPlus, ISearch, ITrash, IUpload } from "../art/Icons";

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
          : "Builds are saved in the browser that made them. Import its JSON file, or start a new one."}
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
  const [paste, setPaste] = useState("");
  const [q, setQ] = useState("");
  const [picks, setPicks] = useState<{ slug: string; name: string; qty: number }[]>([]);
  const [at, setAt] = useState<Place>("beside");
  const [noRoom, setNoRoom] = useState(false);
  const hits = useMemo(() => (q.trim().length >= 2 ? searchCatalog(q, 6) : []), [q]);
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
        <h1>Make one</h1>
        <p className="lead">Design your own piece of furniture from the library: take one or several pieces, put them side by side or on top of each other, add or swap parts, and see it take shape in 3D.</p>
      </header>
      <p className="callout warn hx-safety">
        <IAlert size={18} />
        <span>
          <b>Your builds are yours, and unverified.</b> Nobody checks them, and the library pieces are approximate drawings of IKEA furniture. Measure your own pieces, and check that it holds, before you drill or cut.
        </span>
      </p>
      {!persistent && (
        <p className="callout note hx-safety" role="status">
          <IAlert size={18} />
          <span>This browser isn&apos;t saving anything (a private window, or storage is blocked). You can still make one: export it as a file before you close the tab.</span>
        </p>
      )}

      <section aria-labelledby="hx-lib-h" className="hx-lib">
        <h2 id="hx-lib-h" className="hx-h2">
          Start from the library
        </h2>
        <p className="hx-hint">Pick the furniture you want to build from. Each comes as its parts, ready to move, cut or combine in the editor.</p>
        {picks.length > 0 && (
          <ul className="hx-rows">
            {picks.map((p) => (
              <li key={p.slug} className="hx-row">
                <span className="hx-pick-name">{p.name}</span>
                <Num label="How many" value={p.qty} min={1} max={8} int onChange={(qty) => setPicks(picks.map((x) => (x.slug === p.slug ? { ...x, qty } : x)))} />
                <button type="button" className="btn round small hx-del" aria-label={`Remove ${p.name}`} onClick={() => setPicks(picks.filter((x) => x.slug !== p.slug))}>
                  <ITrash size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="hx-search">
          <label htmlFor="hx-lib-q">Find furniture</label>
          <div className="hx-search-box">
            <ISearch size={18} />
            <input id="hx-lib-q" type="search" value={q} maxLength={60} placeholder="KALLAX, BILLY, LACK..." autoComplete="off" onChange={(e) => setQ(e.target.value)} />
          </div>
          {hits.length > 0 && (
            <ul className="hx-hits">
              {hits.map(({ entry: e }) => (
                <li key={e.slug}>
                  <button
                    type="button"
                    className="hx-hit"
                    disabled={picks.length >= 8 || picks.some((p) => p.slug === e.slug)}
                    onClick={() => {
                      setPicks([...picks, { slug: e.slug, name: `${e.name} ${e.variant}`, qty: 1 }]);
                      setNoRoom(false);
                      setQ("");
                    }}
                  >
                    <span>
                      <b>{e.name}</b> {e.variant}
                    </span>
                    <span className="hx-hit-add">
                      <IPlus size={16} /> Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {picks.length > 1 || picks.some((p) => p.qty > 1) ? <Pick label="Put them" value={at} options={[{ id: "beside", label: "Side by side" }, { id: "on-top", label: "Stacked" }]} onChange={(v) => setAt(v as Place)} /> : null}
        <button
          type="button"
          className="btn primary"
          disabled={!picks.length}
          onClick={() => {
            const d = libraryDraft(picks, at);
            if (d) begin(d);
            else setNoRoom(true);
          }}
        >
          Start building <IArrowRight size={18} />
        </button>
        {noRoom && (
          <p className="hx-hint bad" role="alert">
            None of these could be placed. Try fewer pieces, or start from one.
          </p>
        )}
        <p className="hx-hint">Or start from a photo of a hack, or from one of your saved builds. You can add library pieces to any of them in the editor.</p>
      </section>

      <PhotoHack />

      <MyHacks />

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

    </div>
  );
}
