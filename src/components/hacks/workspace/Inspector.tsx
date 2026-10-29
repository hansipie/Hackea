"use client";

import type { CustomPart, Vec3 } from "@/lib/types";
import { LIMITS, MATERIALS } from "@/lib/hacks/draft";
import { ITrash } from "../../art/Icons";
import { Num, Pick, Text, Vec } from "../fields";

const SIZE: [string, string, string] = ["Width, x", "Height, y", "Depth, z"];
const POS: [string, string, string] = ["Left to right, x", "Up from floor, y", "Back to front, z"];
const TURN: [string, string, string] = ["Tipping forward, x", "Around the vertical, y", "Tipping sideways, z"];

const DEG = 180 / Math.PI;
const round = (n: number) => Math.round(n * 10) / 10;

interface Props {
  selected: CustomPart[];
  onPatch: (id: string, patch: Partial<CustomPart>) => void;
  onSize: (id: string, size: Vec3) => void;
  onTurnTo: (id: string, rot: Vec3) => void;
  onMoveBy: (ids: string[], by: Vec3) => void;
  onDelete: () => void;
}

/** The selected part's numbers: where it is, how big, how it is turned, what it is made of. */
export default function Inspector({ selected, onPatch, onSize, onTurnTo, onMoveBy, onDelete }: Props) {
  if (!selected.length) return <p className="hx-hint wk-empty">Nothing selected. Click a part in the view to change it, or add one from the library.</p>;
  if (selected.length > 1)
    return (
      <div className="wk-pane">
        <p>
          <b>{selected.length} parts selected.</b> Drag them together, or nudge them here (mm).
        </p>
        <Vec legend="Move all by" value={[0, 0, 0]} min={-LIMITS.pos} max={LIMITS.pos} names={POS} onChange={(by) => onMoveBy(selected.map((p) => p.id), by)} />
        <button type="button" className="btn ghost hx-btn danger" onClick={onDelete}>
          <ITrash size={17} /> Delete them
        </button>
      </div>
    );
  const p = selected[0];
  const rot = (p.rot ?? [0, 0, 0]).map((r) => round(r * DEG)) as Vec3;
  return (
    <div className="wk-pane">
      <Text label="Name" value={p.name} max={LIMITS.partName} required onChange={(name) => onPatch(p.id, { name })} />
      <Text label="Letter" value={p.label ?? ""} max={LIMITS.label} onChange={(label) => onPatch(p.id, { label: label || undefined })} hint="Up to three characters, as the guide labels it." />
      <div className="hx-row2">
        <Pick label="Made of" value={p.material ?? "board"} options={MATERIALS.map((m) => ({ id: m.id, label: m.label }))} onChange={(material) => onPatch(p.id, { material })} />
        <Pick label="Shape" value={p.shape ?? "box"} options={[{ id: "box", label: "Box" }, { id: "cyl", label: "Round" }]} onChange={(shape) => onPatch(p.id, { shape: shape === "cyl" ? "cyl" : undefined })} />
      </div>
      <Vec legend="Size" value={p.size} min={LIMITS.size[0]} max={LIMITS.size[1]} names={SIZE} onChange={(size) => onSize(p.id, size)} />
      <Vec legend="Middle of the part" value={p.pos} min={-LIMITS.pos} max={LIMITS.pos} names={POS} onChange={(pos) => onPatch(p.id, { pos })} />
      <Vec legend="Turn" unit="degrees" value={rot} min={-360} max={360} names={TURN} onChange={(d) => onTurnTo(p.id, d.map((n) => (n / DEG)) as Vec3)} />
      <Num label="Underside above the floor" unit="mm" value={round(p.pos[1] - p.size[1] / 2)} min={-LIMITS.pos} max={LIMITS.pos} onChange={(y) => onPatch(p.id, { pos: [p.pos[0], y + p.size[1] / 2, p.pos[2]] })} />
      <button type="button" className="btn ghost hx-btn danger" onClick={onDelete}>
        <ITrash size={17} /> Delete this part
      </button>
    </div>
  );
}
