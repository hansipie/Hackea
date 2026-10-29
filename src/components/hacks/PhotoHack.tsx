"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import KeyModal from "../KeyModal";
import { keyHeaders, useUserKey } from "@/lib/userKey";
import { createHack, knownSlug } from "@/lib/hacks/store";
import { mineSlug } from "@/lib/hacks/draft";
import { sanitizeDraft } from "@/lib/hacks/sanitize";
import { checkDraft } from "@/lib/hacks/check";
import type { PhotoAnalysis, PhotoSelection } from "@/lib/hacks/photo";

const ERRORS: Record<string, string> = {
  photo: "Choose a JPEG, PNG or WebP photo smaller than 15 MB.", key: "Add a working OpenAI API key to analyze your photo.",
  credits: "Your OpenAI account has no available credit. Check your billing settings.", busy: "Too many requests. Wait a few minutes and try again.",
  not_furniture: "No furniture was identified. Choose a clear photo of the finished hack.",
  no_match: "No convincing match in the IKEA catalogue. Add the family name or try another angle.",
  selection: "Choose products from the suggested catalogue list.", complex: "This combination has too many parts for one photo guide. Try fewer units.",
  invalid_plan: "The proposed assembly could not be validated. Add dimensions or more detail and try again.",
  timeout: "This took too long. Try again with a clearer photo or more detail.", failed: "The photo could not be processed. Your choices are still here, so you can try again.",
};

async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) throw new Error("photo");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("photo")); img.src = url;
    });
    const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("photo");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.8);
    if (data.length > 3_000_000) throw new Error("photo");
    return data;
  } finally { URL.revokeObjectURL(url); }
}

export default function PhotoHack() {
  const router = useRouter();
  const key = useUserKey();
  const [image, setImage] = useState("");
  const [hint, setHint] = useState("");
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [selections, setSelections] = useState<PhotoSelection>([]);
  const [busy, setBusy] = useState<"photo" | "analyze" | "generate" | null>(null);
  const [error, setError] = useState("");
  const [askKey, setAskKey] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const photoVersion = useRef(0);
  useEffect(() => () => { controller.current?.abort(); photoVersion.current++; }, []);

  async function run(action: "analyze" | "generate") {
    if (!key) { setAskKey(true); return; }
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setBusy(action); setError("");
    try {
      const res = await fetch("/api/hack-photo", { method: "POST", headers: { "Content-Type": "application/json", ...keyHeaders() },
        body: JSON.stringify({ action, image, hint, ...(action === "generate" ? { selections } : {}) }), signal: current.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      if (action === "analyze") { setAnalysis(data); setSelections(data.selections); }
      else {
        const parsed = sanitizeDraft(data.draft, knownSlug);
        if (!parsed.draft || checkDraft("photohack", parsed.draft).issues.length) throw new Error("invalid_plan");
        const id = createHack(parsed.draft);
        router.push(`/build/${mineSlug(id)}`);
      }
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message in ERRORS ? (e as Error).message : "failed");
    } finally { if (controller.current === current) setBusy(null); }
  }

  const total = selections.reduce((n, s) => n + s.qty, 0);
  const valid = selections.length > 0 && total <= 4 && new Set(selections.map(s => s.slug)).size === selections.length;
  return (
    <section className="hx-photo" aria-labelledby="photo-hack-heading">
      <h2 id="photo-hack-heading" className="hx-h2">From a photo to a build guide</h2>
      <p className="hx-hint">Upload a finished IKEA hack. Find its base pieces in our catalogue, confirm them, then get a parts list and an editable 3D assembly guide.</p>
      <div className="hx-photo-layout">
        <div>
          <label className="btn ghost hx-file">
            Choose a hack photo
            <input type="file" className="hx-file-input" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
              const version = ++photoVersion.current;
              setError(""); setAnalysis(null); setSelections([]); setImage(""); setBusy("photo");
              try { const prepared = await preparePhoto(file); if (version === photoVersion.current) setImage(prepared); }
              catch { if (version === photoVersion.current) setError("photo"); }
              finally { if (version === photoVersion.current) setBusy(null); }
            }} />
          </label>
          <div className="hx-field">
            <label htmlFor="photo-hack-notes">What do you know about this hack? (optional)</label>
            <textarea id="photo-hack-notes" rows={3} maxLength={400} value={hint} disabled={!!busy} placeholder="For example: two BILLY units, about 160 cm wide, with a wood top" onChange={e => { setHint(e.target.value); setAnalysis(null); setSelections([]); }} />
          </div>
          <button type="button" className="btn primary" disabled={!image || !!busy} onClick={() => run("analyze")}>
            {busy === "photo" ? "Preparing photo..." : busy === "analyze" ? "Finding IKEA pieces..." : "Find IKEA pieces"}
          </button>
          <p className="hx-hint">Your photo goes to OpenAI using your own key. We do not save the photo. The generated guide is saved in this browser.</p>
        </div>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="hx-photo-preview" src={image} alt="Your IKEA hack reference" />
        )}
      </div>
      {analysis && (
        <div className="hx-photo-results">
          <h3 className="hx-h3">Confirm the IKEA pieces</h3>
          <p>{analysis.description}</p>
          <p className="hx-hint">These are visual matches, not verified product identities. Compare the variant and dimensions with your furniture. Up to four units per guide.</p>
          {analysis.uncertainties.length > 0 && <ul>{analysis.uncertainties.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          {selections.map((selection, index) => (
            <div className="hx-photo-choice" key={index}>
              <label> IKEA piece {index + 1}
                <select aria-label={`IKEA piece ${index + 1}`} value={selection.slug} disabled={!!busy} onChange={e => { setError(""); setSelections(rows => rows.map((s, i) => i === index ? { ...s, slug: e.target.value } : s)); }}>
                  {analysis.candidates.map(c => <option key={c.slug} value={c.slug}>{c.name}, {c.variant} ({c.size.w} × {c.size.h} × {c.size.d} cm)</option>)}
                </select>
              </label>
              <label>Quantity
                <input aria-label={`Quantity ${index + 1}`} type="number" min={1} max={4} value={selection.qty} disabled={!!busy} onChange={e => { setError(""); setSelections(rows => rows.map((s, i) => i === index ? { ...s, qty: Math.min(4, Math.max(1, Number(e.target.value) || 1)) } : s)); }} />
              </label>
              <Link href={`/build/${selection.slug}`} target="_blank" rel="noreferrer">View base guide</Link>
              <button className="btn ghost" disabled={!!busy} type="button" onClick={() => setSelections(rows => rows.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          {selections.length < 4 && <button type="button" className="btn ghost" disabled={!!busy || !analysis.candidates.some(c => !selections.some(s => s.slug === c.slug))} onClick={() => { const next = analysis.candidates.find(c => !selections.some(s => s.slug === c.slug)); if (next) setSelections(rows => [...rows, { slug: next.slug, qty: 1 }]); }}>Add another IKEA piece</button>}
          {!valid && <p role="status">Choose distinct products with a total quantity between one and four.</p>}
          <p className="hx-hint">Added boards, fittings and hidden joints are estimates to check. Base dimensions come from our catalogue; its generated part drawings are approximate.</p>
          <button type="button" className="btn primary" disabled={!valid || !!busy} onClick={() => run("generate")}>
            {busy === "generate" ? "Building your assembly guide..." : "Confirm pieces and generate guide"}
          </button>
        </div>
      )}
      {busy && <p role="status" aria-live="polite">{busy === "photo" ? "Preparing your photo." : busy === "analyze" ? "Analyzing the hack and searching the catalogue. This can take a minute." : "Placing catalogue parts and checking the proposed assembly. This can take two minutes."}</p>}
      {error && <div className="hx-issues" role="alert"><p>{ERRORS[error]}</p>{(error === "key" || error === "credits") && <button type="button" className="btn ghost" onClick={() => setAskKey(true)}>Check OpenAI key</button>}</div>}
      {askKey && <KeyModal why="draft" trouble={error === "key" || error === "credits" ? error : undefined} onClose={() => setAskKey(false)} onSaved={() => { setAskKey(false); setError(""); }} />}
    </section>
  );
}
