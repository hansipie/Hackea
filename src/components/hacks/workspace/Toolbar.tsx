"use client";

import { Box, Copy, Magnet, MousePointer2, Move3d, Redo2, RotateCw, Scale3d, Trash2, Undo2, Maximize2 } from "lucide-react";
import type { Tool, ViewName } from "./viewport";

const TOOLS: { id: Tool; label: string; key: string; Icon: typeof Box }[] = [
  { id: "select", label: "Select and drag", key: "V", Icon: MousePointer2 },
  { id: "move", label: "Move with arrows", key: "M", Icon: Move3d },
  { id: "scale", label: "Resize by the faces", key: "S", Icon: Scale3d },
];

const VIEWS: { id: ViewName; label: string }[] = [
  { id: "3d", label: "3D" },
  { id: "top", label: "Top" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
];

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  view: ViewName;
  onView: (v: ViewName) => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snap: boolean;
  onSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTurn: (axis: 0 | 1 | 2, by: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFrame: () => void;
}

/** The workspace's toolbar: tools, undo, turning, copying, and the four views. */
export default function Toolbar(p: Props) {
  const btn = (label: string, Icon: typeof Box, onClick: () => void, opts: { on?: boolean; disabled?: boolean; key?: string } = {}) => (
    <button key={label} type="button" className={"wk-btn" + (opts.on ? " on" : "")} aria-label={label} aria-pressed={opts.on} title={opts.key ? `${label} (${opts.key})` : label} disabled={opts.disabled} onClick={onClick}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
  return (
    <div className="wk-toolbar" role="toolbar" aria-label="Tools">
      <div className="wk-group" role="group" aria-label="Tool">
        {TOOLS.map((t) => btn(t.label, t.Icon, () => p.onTool(t.id), { on: p.tool === t.id, key: t.key }))}
      </div>
      <div className="wk-group" role="group" aria-label="History">
        {btn("Undo", Undo2, p.onUndo, { disabled: !p.canUndo, key: "Ctrl+Z" })}
        {btn("Redo", Redo2, p.onRedo, { disabled: !p.canRedo, key: "Ctrl+Shift+Z" })}
      </div>
      <div className="wk-group" role="group" aria-label="Selection">
        {btn("Turn a quarter around the vertical", RotateCw, () => p.onTurn(1, Math.PI / 2), { disabled: !p.hasSelection, key: "R" })}
        <button type="button" className="wk-btn text" disabled={!p.hasSelection} title="Turn a quarter, tipping forward (Shift+R)" onClick={() => p.onTurn(0, Math.PI / 2)}>
          X
        </button>
        <button type="button" className="wk-btn text" disabled={!p.hasSelection} title="Turn a quarter, tipping sideways (Alt+R)" onClick={() => p.onTurn(2, Math.PI / 2)}>
          Z
        </button>
        {btn("Duplicate", Copy, p.onDuplicate, { disabled: !p.hasSelection, key: "Ctrl+D" })}
        {btn("Delete", Trash2, p.onDelete, { disabled: !p.hasSelection, key: "Delete" })}
      </div>
      <div className="wk-group" role="group" aria-label="Snapping">
        {btn("Snap to the floor, faces and grid", Magnet, p.onSnap, { on: p.snap })}
      </div>
      <div className="wk-group wk-views" role="group" aria-label="View">
        {VIEWS.map((v, i) => (
          <button key={v.id} type="button" className={"wk-btn text" + (p.view === v.id ? " on" : "")} aria-pressed={p.view === v.id} title={`${v.label} view (${i + 1})`} onClick={() => p.onView(v.id)}>
            {v.label}
          </button>
        ))}
        {btn("Fit everything in view", Maximize2, p.onFrame, { key: "F" })}
      </div>
    </div>
  );
}
