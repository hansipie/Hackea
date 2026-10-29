"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomPart, Vec3 } from "@/lib/types";
import { SNAP, snapMove, type SnapOptions } from "@/lib/hacks/snap";
import type { Readout, Tool, ViewName, Viewport } from "./viewport";

export interface ViewportHandle {
  frame(): void;
  /** puts back what a drag in progress was moving */
  cancel(): void;
}

interface Props {
  parts: CustomPart[];
  selection: string[];
  tool: Tool;
  view: ViewName;
  snap: boolean;
  onPick: (id: string | null, additive: boolean) => void;
  onMove: (ids: string[], by: Vec3) => void;
  onResize: (id: string, size: Vec3, pos: Vec3) => void;
  onReady?: (h: ViewportHandle) => void;
}

/** The workspace's 3D and flat views. three.js is loaded when this mounts, so it stays out of the server render. */
export default function ViewportView({ parts, selection, tool, view, snap, onPick, onMove, onResize, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const vp = useRef<Viewport | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);
  // what the viewport asks for while a drag is held is answered from the latest props, never from a stale render
  const latest = useRef({ parts, snap, onPick, onMove, onResize });
  useEffect(() => {
    latest.current = { parts, snap, onPick, onMove, onResize };
  });
  const first = useRef({ parts, selection, tool, view });

  useEffect(() => {
    let alive = true;
    let v: Viewport | null = null;
    import("./viewport").then(({ Viewport }) => {
      if (!alive || !host.current) return;
      v = new Viewport(host.current, {
        onPick: (id, add) => latest.current.onPick(id, add),
        onMove: (ids, by) => latest.current.onMove(ids, by),
        onResize: (id, size, pos) => latest.current.onResize(id, size, pos),
        snap: (ids, by) => {
          const o: SnapOptions = latest.current.snap ? SNAP : { grid: 0, reach: 0, parts: false };
          return snapMove(latest.current.parts, ids, by, o);
        },
        onReadout: setReadout,
      });
      vp.current = v;
      const f = first.current;
      v.setParts(f.parts);
      v.setSelection(f.selection);
      v.setTool(f.tool);
      v.setView(f.view);
      v.frame();
      onReady?.({ frame: () => v?.frame(), cancel: () => v?.escape() });
    });
    return () => {
      alive = false;
      v?.dispose();
      vp.current = null;
    };
    // mounted once: everything after is pushed in by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => vp.current?.setParts(parts), [parts]);
  useEffect(() => vp.current?.setSelection(selection), [selection]);
  useEffect(() => vp.current?.setTool(tool), [tool]);
  useEffect(() => vp.current?.setView(view, true), [view]);

  return (
    <div className="wk-view" ref={host}>
      {readout && (
        <span className="wk-readout" style={{ left: readout.x, top: readout.y }}>
          {readout.text}
        </span>
      )}
    </div>
  );
}
