"use client";

import { useId, useState } from "react";
import type { Vec3 } from "@/lib/types";

/** Form pieces for the hack editor: every input has a visible label, and numbers are typed as text so "-" or "1," never fight back. */

export function Text({
  label,
  value,
  onChange,
  max,
  placeholder,
  multiline,
  hint,
  required,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  required?: boolean;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = hint ? fid + "-hint" : undefined;
  return (
    <div className="hx-field">
      <label htmlFor={fid}>
        {label}
        {required && <span className="hx-req"> (needed)</span>}
      </label>
      {multiline ? (
        <textarea id={fid} value={value} maxLength={max} rows={3} placeholder={placeholder} aria-describedby={hid} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={fid} type="text" value={value} maxLength={max} placeholder={placeholder} aria-describedby={hid} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <span id={hid} className="hx-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Num({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  int,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
  int?: boolean;
  className?: string;
}) {
  const fid = useId();
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // a change from outside (undo a template, a rename) shows up, while typing keeps what is typed
  if (seen !== value) {
    setSeen(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  const parsed = Number(text.replace(",", "."));
  const bad = text.trim() === "" || !Number.isFinite(parsed) || parsed < min || parsed > max || (int && !Number.isInteger(parsed));
  return (
    <div className={"hx-field num" + (className ? " " + className : "")}>
      <label htmlFor={fid}>
        {label}
        {unit && <span className="hx-unit"> ({unit})</span>}
      </label>
      <input
        id={fid}
        type="text"
        inputMode={int ? "numeric" : "decimal"}
        value={text}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          const t = e.target.value.slice(0, 12);
          setText(t);
          const n = Number(t.replace(",", "."));
          if (t.trim() !== "" && Number.isFinite(n)) {
            const v = Math.min(max, Math.max(min, int ? Math.round(n) : Math.round(n * 10) / 10));
            setSeen(v);
            onChange(v);
          }
        }}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}

export function Vec({ legend, value, onChange, min, max, names }: { legend: string; value: Vec3; onChange: (v: Vec3) => void; min: number; max: number; names: [string, string, string] }) {
  return (
    <fieldset className="hx-vec">
      <legend>{legend} (mm)</legend>
      {names.map((n, k) => (
        <Num
          key={n}
          label={n}
          value={value[k]}
          min={min}
          max={max}
          onChange={(v) => {
            const next: Vec3 = [...value];
            next[k] = v;
            onChange(next);
          }}
        />
      ))}
    </fieldset>
  );
}

export function Pick<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const fid = useId();
  return (
    <div className="hx-field">
      <label htmlFor={fid}>{label}</label>
      <select
        id={fid}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.id) === e.target.value);
          if (o) onChange(o.id);
        }}
      >
        {options.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A set of checkboxes, as a fieldset, for tools, warnings and the parts a step adds. */
export function Checks<T extends string>({
  legend,
  options,
  value,
  onChange,
  max,
}: {
  legend: string;
  options: { id: T; label: string; note?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  max?: number;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <fieldset className="hx-checks">
      <legend>
        {legend}
        {max !== undefined && <span className="hx-unit"> ({max} at most)</span>}
      </legend>
      {options.length === 0 && <p className="hx-hint">Nothing to pick yet.</p>}
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <label key={o.id} className={"hx-check" + (on ? " on" : "")}>
            <input type="checkbox" checked={on} disabled={!on && full} onChange={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} />
            <span>
              {o.label}
              {o.note && <em> {o.note}</em>}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
