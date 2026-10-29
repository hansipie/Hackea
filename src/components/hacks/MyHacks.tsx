"use client";

import Link from "next/link";
import { Component, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { checkDraft } from "@/lib/hacks/check";
import { draftToSpec, mineSlug, type HackDraft } from "@/lib/hacks/draft";
import { exportHack } from "@/lib/hacks/sanitize";
import { deleteHack, duplicateHack, exportBackup, exportSaved, isUnreadable, listHacks, type SavedHack, type UnreadableHack } from "@/lib/hacks/store";
import { useMounted } from "@/lib/useMounted";
import Thumb from "../Thumb";
import { IAlert, IArrowRight } from "../art/Icons";

/** Hand the person a file to keep or to send. */
export function downloadText(name: string, text: string) {
  const file = (name || "hack").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "hack";
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${file}.hackea.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The hack as JSON, or `text` when the file should hold something else (what was stored, a backup). */
export function downloadHack(d: HackDraft, text = exportHack(d)) {
  downloadText(d.name, text);
}

/** One row that fails to draw shows as a row that failed, never as a list that is gone. */
class RowGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The hacks made in this browser, newest first, and any stored record that can't be read, to export or delete. */
export default function MyHacks({ heading = "My hacks", empty }: { heading?: string; empty?: React.ReactNode }) {
  const mounted = useMounted();
  const [version, setVersion] = useState(0);
  const rows = useMemo(
    () => {
      if (!mounted) return [];
      try {
        return listHacks();
      } catch {
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, version],
  );
  if (!mounted) return null;
  if (!rows.length) return empty ? <>{empty}</> : null;
  const refresh = () => setVersion((v) => v + 1);
  return (
    <section className="hx-mine" aria-labelledby="hx-mine-h">
      <h2 id="hx-mine-h" className="hx-h2">
        {heading}
      </h2>
      <p className="hx-hint">Saved in this browser only. Export a file to keep a copy or move it to another device.</p>
      <ul className="hx-mine-list">
        {rows.map((r, i) => (
          <RowGuard key={`${i}:${r.id}`} fallback={<UnreadableRow h={{ id: r.id, unreadable: true, raw: isUnreadable(r) ? r.raw : r, reason: "It can't be shown.", updatedAt: 0 }} onDeleted={refresh} />}>
            {isUnreadable(r) ? <UnreadableRow h={r} onDeleted={refresh} /> : <HackRow h={r} onDeleted={refresh} />}
          </RowGuard>
        ))}
      </ul>
    </section>
  );
}

function DeleteButton({ id, label, onDeleted }: { id: string; label: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <>
      <button
        type="button"
        className="btn hx-btn danger"
        autoFocus
        onClick={() => {
          deleteHack(id);
          setConfirm(false);
          onDeleted();
        }}
      >
        Delete for good
      </button>
      <button type="button" className="btn hx-btn" onClick={() => setConfirm(false)}>
        Keep it
      </button>
    </>
  ) : (
    <button type="button" className="btn hx-btn" onClick={() => setConfirm(true)} aria-label={`Delete ${label}`}>
      Delete
    </button>
  );
}

/** A stored record that isn't a hack: what it is, the file as stored, and a way to remove it. Nothing else is read from it. */
function UnreadableRow({ h, onDeleted }: { h: UnreadableHack; onDeleted: () => void }) {
  return (
    <li className="hx-mine-card">
      <span className="hx-mine-art">
        <span className="hx-mine-none">Can&apos;t be read</span>
      </span>
      <span className="hx-mine-text">
        <b>Unreadable record</b>
        <span className="hx-mine-meta">
          <span className="hx-badge bad">
            <IAlert size={14} /> Can&apos;t be opened
          </span>
          <span>{h.reason}</span>
        </span>
        <span className="hx-mine-actions">
          <button type="button" className="btn hx-btn" onClick={() => downloadText("unreadable-record", exportSaved(h))}>
            Export as saved
          </button>
          <DeleteButton id={h.id} label="this unreadable record" onDeleted={onDeleted} />
        </span>
      </span>
    </li>
  );
}

function HackRow({ h, onDeleted }: { h: SavedHack; onDeleted: () => void }) {
  const router = useRouter();
  const { spec, issues, plan } = useMemo(() => {
    const { issues, plan } = checkDraft(h.id, h.draft);
    return { spec: draftToSpec(h.id, h.draft), issues: issues.length, plan };
  }, [h]);
  return (
    <li className="hx-mine-card">
      <span className="hx-mine-art">{plan ? <Thumb id={`mine-${h.id}-${h.updatedAt}`} plan={plan} mode={{ kind: "assembled" }} w={240} h={180} alt={`${spec.name} line drawing`} lazy /> : <span className="hx-mine-none">No drawing yet</span>}</span>
      <span className="hx-mine-text">
        <b>{spec.name}</b>
        <span className="hx-mine-meta">
          {h.problems ? (
            <span className="hx-badge bad">
              <IAlert size={14} /> Needs repair
            </span>
          ) : issues ? (
            <span className="hx-badge bad">
              <IAlert size={14} /> {issues} {issues === 1 ? "problem" : "problems"}
            </span>
          ) : (
            <span className="hx-badge">Yours, unverified</span>
          )}
          {h.updatedAt > 0 && <span>Edited {new Date(h.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
        </span>
        <span className="hx-mine-actions">
          <Link href={`/hacks/new?id=${h.id}`} className="btn hx-btn">
            {h.problems ? "Repair in the editor" : "Edit"}
          </Link>
          {!issues && !h.problems && (
            <Link href={`/build/${mineSlug(h.id)}`} className="btn hx-btn dark">
              Open the guide <IArrowRight size={16} />
            </Link>
          )}
          <button
            type="button"
            className="btn hx-btn"
            onClick={() => {
              const id = duplicateHack(h.id);
              if (id) router.push(`/hacks/new?id=${id}`);
            }}
          >
            Duplicate
          </button>
          <button type="button" className="btn hx-btn" onClick={() => downloadHack(h.draft, exportSaved(h))}>
            {h.problems ? "Export as saved" : "Export"}
          </button>
          {h.backup && (
            <button type="button" className="btn hx-btn" onClick={() => downloadHack(h.draft, exportBackup(h) ?? exportSaved(h))} title="What was stored before its repaired version replaced it">
              Export the original
            </button>
          )}
          <DeleteButton id={h.id} label={spec.name} onDeleted={onDeleted} />
        </span>
      </span>
    </li>
  );
}
