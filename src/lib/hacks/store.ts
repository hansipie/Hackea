import type { ProductSpec } from "../types";
import { catalogSpec } from "../catalog";
import { cachedSpec, loadProgress } from "../store";
import { packJson, unpackJson } from "../scan/share";
import { ID_RE, draftToSpec, mineId, mineSlug, newHackId, type HackDraft } from "./draft";
import { FORMAT, VERSION, exportHack, sanitizeDraft } from "./sanitize";
import { checkDraft } from "./check";

/**
 * Hacks made in the editor live in this browser only (no accounts, no server copy): one localStorage entry,
 * every read sanitized like an import, and every call safe when storage is blocked or full.
 * A saved hack that breaks a rule is never dropped: it comes back repaired, flagged, with what was stored kept as is.
 */

export interface SavedHack {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Ready to edit: the hack as saved, or, when it breaks a rule, repaired (blanks filled, numbers clamped). */
  draft: HackDraft;
  /** Why it needed repairing. Absent when it reads back exactly. */
  problems?: string[];
  /** What was stored, untouched, for "export as saved" while it needs repairing. */
  raw?: unknown;
  /** What was stored before its repaired version replaced it, kept under a key of its own. */
  backup?: { raw: unknown; problems: string[]; at: number };
}

/** A stored record that can't be read as a hack at all (not a record, no hack in it, a wrong id): kept whole, to export or delete, never opened. */
export interface UnreadableHack {
  id: string;
  unreadable: true;
  /** The stored value, untouched. */
  raw: unknown;
  reason: string;
  updatedAt: number;
}
export type StoredHack = SavedHack | UnreadableHack;
export const isUnreadable = (h: StoredHack | null | undefined): h is UnreadableHack => !!h && "unreadable" in h;

const KEY = "hackea:hacks";
// a record that broke a rule, as it was before its repaired version was saved over it: nothing is ever lost
const BACKUP_KEY = "hackea:hacks-backup";
/** A product link is kept only when it names something with its own guide. */
export const knownSlug = (slug: string) => !!catalogSpec(slug);

// when storage is blocked (some private windows), hacks still last until the tab is closed
let memory: Record<string, unknown> | null = null;

function readAll(): Record<string, unknown> {
  if (memory) return { ...memory };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** False when it could only be kept in memory. */
function writeAll(all: Record<string, unknown>): boolean {
  if (!memory) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch {
      /* blocked or full: fall through */
    }
  }
  memory = all;
  return false;
}

let backupMemory: Record<string, unknown> | null = null;
function readBackups(): Record<string, unknown> {
  if (backupMemory) return { ...backupMemory };
  try {
    const v = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
function writeBackups(all: Record<string, unknown>) {
  if (!backupMemory) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(all));
      return;
    } catch {
      /* blocked or full: keep it for the tab */
    }
  }
  backupMemory = all;
}
function backupOf(id: string): SavedHack["backup"] {
  const b = readBackups()[id] as Partial<NonNullable<SavedHack["backup"]>> | undefined;
  return b && typeof b === "object" && "raw" in b ? { raw: b.raw, problems: Array.isArray(b.problems) ? b.problems.filter((x): x is string => typeof x === "string") : [], at: typeof b.at === "number" ? b.at : 0 } : undefined;
}

const time = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * One stored record: read strictly, repaired and flagged when it breaks a rule, or, when not even a repair can
 * make a hack of it, unreadable. Never throws, whatever is stored. Exported for the checks.
 */
export function readStored(id: string, v: unknown): StoredHack | null {
  // no record is no hack
  if (v === undefined) return null;
  const bad = (reason: string): UnreadableHack => ({ id, unreadable: true, raw: v, reason, updatedAt: isRecord(v) ? time(v.updatedAt) : 0 });
  if (!ID_RE.test(id)) return bad("Its key is not a hack id.");
  if (!isRecord(v)) return bad("It is not a record.");
  if (v.id !== id) return bad("Its id is missing or doesn't match its key.");
  if (!isRecord(v.draft)) return bad("It holds no hack.");
  // the editor stores drafts, never export files: one with a file's own wrapper keys is not ours to guess at
  if ("format" in v.draft || "version" in v.draft) return bad("It holds an export file, not a saved hack.");
  const head = { id, createdAt: time(v.createdAt), updatedAt: time(v.updatedAt) };
  try {
    const strict = sanitizeDraft(v.draft, knownSlug);
    if (strict.draft) return { ...head, draft: strict.draft };
    const fixed = sanitizeDraft(v.draft, knownSlug, { repair: true });
    // a file's own wrapper ({ format, version }) inside a record is not something a repair can guess around
    if (!fixed.draft) return bad(fixed.errors[0] ?? "It can't be read as a hack.");
    return { ...head, draft: fixed.draft, problems: strict.errors, raw: v.draft };
  } catch {
    return bad("It can't be read as a hack.");
  }
}

/** A stored hack that can be opened (as saved, or repaired and flagged), or null. */
export function readSaved(id: string, v: unknown): SavedHack | null {
  const h = readStored(id, v);
  return h && !isUnreadable(h) ? h : null;
}

/** A saved hack with its backup, if a repaired version replaced what was stored. */
const withBackup = (h: SavedHack | null): SavedHack | null => {
  const backup = h && backupOf(h.id);
  return h && backup ? { ...h, backup } : h;
};

const readOne = readSaved;

/** What is stored under an id, unreadable records included: for the list, the editor's "can't be read" state and the guide. */
export function loadStored(id: string): StoredHack | null {
  const h = readStored(id, readAll()[id]);
  return isUnreadable(h) ? h : withBackup(h);
}

/** Whether this browser keeps what is saved (private windows and blocked storage don't). */
export function storageWorks(): boolean {
  if (memory) return false;
  try {
    const k = "hackea:probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Every stored record, newest first: hacks to open, and unreadable ones to export or delete. */
export function listHacks(): StoredHack[] {
  return Object.entries(readAll())
    .map(([id, v]): StoredHack | null => {
      const h = readStored(id, v);
      return isUnreadable(h) ? h : withBackup(h);
    })
    .filter((h): h is StoredHack => !!h)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadHack(id: string): SavedHack | null {
  return withBackup(readOne(id, readAll()[id]));
}

/** True when it is in the browser's storage, false when it is only kept for this tab. */
export function saveHack(id: string, draft: HackDraft): boolean {
  if (!ID_RE.test(id)) return false;
  const all = readAll();
  const old = all[id];
  // writing over a record that broke a rule: keep it first, once, as it was
  const before = readStored(id, old);
  const kept = isUnreadable(before) ? { raw: before.raw, problems: [before.reason] } : before?.problems ? { raw: before.raw, problems: before.problems } : null;
  if (kept && !backupOf(id)) writeBackups({ ...readBackups(), [id]: { ...kept, at: Date.now() } });
  all[id] = { id, createdAt: isRecord(old) && typeof old.createdAt === "number" ? old.createdAt : Date.now(), updatedAt: Date.now(), draft };
  return writeAll(all);
}

export function deleteHack(id: string): boolean {
  const all = readAll();
  delete all[id];
  const backups = readBackups();
  if (id in backups) {
    delete backups[id];
    writeBackups(backups);
  }
  return writeAll(all);
}

/** A new hack from a draft (a template, an import, a copy). Returns its id. */
export function createHack(draft: HackDraft): string {
  const id = newHackId();
  saveHack(id, draft);
  return id;
}

/** A copy. One that needs repairing is copied as it was stored, so the copy needs repairing too and keeps the original. */
export function duplicateHack(id: string): string | null {
  const h = loadHack(id);
  if (!h) return null;
  if (!h.problems) return createHack({ ...h.draft, name: `${h.draft.name} (copy)`.slice(0, 60) });
  const nid = newHackId();
  const all = readAll();
  all[nid] = { id: nid, createdAt: Date.now(), updatedAt: Date.now(), draft: h.raw };
  writeAll(all);
  return nid;
}

/** The guide for /build/mine-<id>, when this browser made it and it passes every check. */
export function mineSpec(slug: string): ProductSpec | null {
  const id = mineId(slug);
  const h = id ? loadHack(id) : null;
  if (!h || h.problems) return null;
  return checkDraft(h.id, h.draft).issues.length ? null : draftToSpec(h.id, h.draft);
}

/** A hack's export file. While it needs repairing, the file holds exactly what was stored, so nothing is lost by exporting. */
export function exportSaved(h: StoredHack): string {
  // an unreadable record is exported exactly as it is stored
  if (isUnreadable(h)) return JSON.stringify(h.raw ?? null, null, 2);
  return h.problems ? JSON.stringify({ format: FORMAT, version: VERSION, hack: h.raw ?? null }, null, 2) : exportHack(h.draft);
}

/** The backup of what was stored before a repaired version replaced it, as a file. */
export function exportBackup(h: SavedHack): string | null {
  return h.backup ? JSON.stringify({ format: FORMAT, version: VERSION, hack: h.backup.raw ?? null }, null, 2) : null;
}

/**
 * The guide a browser has for a slug that isn't in the catalog, the same for the guide and its print view.
 * One of this browser's own hacks comes only from the hack as saved now, and only while it passes every check
 * (`own` and no spec: it needs fixing first), never from an older copy. Anything else (a scan, a hack opened from
 * someone's link, an AI draft) comes from the copy kept when it was opened, or from the build in progress.
 */
export function localSpec(slug: string): { spec: ProductSpec | null; own: boolean } {
  const id = mineId(slug);
  // one of ours, even unreadable: it shows as needing a fix, never as an older copy
  const h = id ? loadStored(id) : null;
  if (h) return { spec: isUnreadable(h) ? null : mineSpec(slug), own: true };
  return { spec: cachedSpec(slug) ?? loadProgress(slug)?.spec ?? null, own: false };
}

/* ---------- share links: /build/mine-<id>#h=<the hack, packed> ---------- */

export async function shareLink(id: string, draft: HackDraft): Promise<string> {
  return `${location.origin}/build/${mineSlug(id)}#h=${await packJson({ format: FORMAT, version: VERSION, hack: draft })}`;
}

/** A hack from a link: someone else's data, so it goes through the same checks as an import. */
export async function readShared(slug: string, packed: string): Promise<ProductSpec | null> {
  const id = mineId(slug);
  if (!id || !ID_RE.test(id)) return null;
  try {
    const { draft } = sanitizeDraft(await unpackJson(packed), knownSlug);
    if (!draft) return null;
    return checkDraft(id, draft).issues.length ? null : draftToSpec(id, draft);
  } catch {
    return null;
  }
}
