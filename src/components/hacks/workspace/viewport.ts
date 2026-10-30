import * as THREE from "three";
import type { CustomPart, Vec3 } from "@/lib/types";
import { boxOf } from "@/lib/plan/custom";
import { FACE, INK } from "@/engine/materials";
import type { Guide } from "@/lib/hacks/snap";

/**
 * The workspace's own viewport: a three.js scene in millimetres (x right, y up, z front, like every custom spec)
 * with one perspective view and three orthographic ones. It draws the same way the guides do (pale faces, ink
 * outlines) but is not the guide player: nothing here animates, it renders when something changes.
 */

export type ViewName = "3d" | "top" | "front" | "side";

/** What a tool does: select only picks and drags parts, move adds arrows on the selection, scale adds handles on a part's faces. */
export type Tool = "select" | "move" | "scale";

/** A line of text shown beside the pointer while something is dragged. */
export interface Readout {
  text: string;
  x: number;
  y: number;
}

export interface ViewportHandlers {
  /** a click: the part under the pointer (or none), and whether it adds to the selection */
  onPick?: (id: string | null, additive: boolean) => void;
  /** a drag of parts ended: they move by this much (mm) */
  onMove?: (ids: string[], by: Vec3) => void;
  /** a drag of a face handle ended: the part has this size and centre */
  onResize?: (id: string, size: Vec3, pos: Vec3) => void;
  /** where a move would land once held to the floor, other parts and the grid, and the lines to show for it */
  snap?: (ids: string[], by: Vec3) => { delta: Vec3; guides: Guide[] };
  onReadout?: (r: Readout | null) => void;
  onHover?: (id: string | null) => void;
  /** the camera moved or the view changed, so overlays can be placed again */
  onCamera?: () => void;
}

const FOV = 35;
const SELECTED = new THREE.Color("#bfe8cd");
const SELECTED_INK = new THREE.Color("#1f7a44");
const HOVER = new THREE.Color("#fff3c4");
const MIN_DIST = 150;
const MAX_DIST = 30000;

/** Where each view looks from: an angle around the vertical (az) and above the floor (el), in radians. */
const VIEWS: Record<ViewName, { az: number; el: number }> = {
  "3d": { az: 0.62, el: 0.5 },
  top: { az: 0, el: Math.PI / 2 },
  front: { az: 0, el: 0 },
  side: { az: Math.PI / 2, el: 0 },
};

interface Item {
  group: THREE.Group;
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  key: string;
  part: CustomPart;
}

/** A rod lies along x or z, the way the plan engine reads a cylinder that is much longer than it is wide. */
function rodAxis(p: CustomPart): 0 | 2 | null {
  if (p.shape !== "cyl" || p.pieces) return null;
  const m = Math.max(p.size[0], p.size[2]);
  if (m > p.size[1] * 1.5 && Math.abs(p.size[0] - p.size[2]) > 0.3 * m) return p.size[0] > p.size[2] ? 0 : 2;
  return null;
}

export class Viewport {
  readonly host: HTMLElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly persp = new THREE.PerspectiveCamera(FOV, 1, 20, 80000);
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -80000, 80000);
  view: ViewName = "3d";
  target = new THREE.Vector3(0, 400, 0);
  dist = 3000;
  az = VIEWS["3d"].az;
  el = VIEWS["3d"].el;

  private items = new Map<string, Item>();
  private selected = new Set<string>();
  private hovered: string | null = null;
  private raf = 0;
  private size = { w: 1, h: 1 };
  private ro: ResizeObserver;
  private disposed = false;
  private face = new THREE.MeshBasicMaterial({ color: FACE.board, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  private faceSelected = new THREE.MeshBasicMaterial({ color: SELECTED, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  private faceHover = new THREE.MeshBasicMaterial({ color: HOVER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  private ink = new THREE.LineBasicMaterial({ color: INK });
  private inkSelected = new THREE.LineBasicMaterial({ color: SELECTED_INK });
  private grid: THREE.Group;
  private ray = new THREE.Raycaster();
  private parts: CustomPart[] = [];
  private tool: Tool = "select";
  private gizmo = new THREE.Group();
  private guides = new THREE.Group();
  private handles: THREE.Object3D[] = [];
  private axes = makeAxes();
  private axesCam = new THREE.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 20);

  constructor(host: HTMLElement, private h: ViewportHandlers = {}) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "wk-canvas";
    host.appendChild(this.renderer.domElement);
    this.grid = this.makeGrid();
    this.scene.add(this.grid, this.gizmo, this.guides);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.bind();
    this.resize();
  }

  /* ---------- scene ---------- */

  private makeGrid() {
    const g = new THREE.Group();
    const cells = new THREE.GridHelper(8000, 80, 0xb8b4ab, 0xdedad1);
    (cells.material as THREE.Material).depthWrite = false;
    g.add(cells);
    // the floor's axes: x (left to right) and z (back to front)
    const axes = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4000, 0, 0), new THREE.Vector3(4000, 0, 0), new THREE.Vector3(0, 0, -4000), new THREE.Vector3(0, 0, 4000)]);
    g.add(new THREE.LineSegments(axes, new THREE.LineBasicMaterial({ color: 0x8d897f })));
    return g;
  }

  private geometry(p: CustomPart): { geo: THREE.BufferGeometry; rot: THREE.Euler } {
    const [x, y, z] = p.size;
    if (p.shape === "cyl") {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      const rod = rodAxis(p);
      if (rod === 0) {
        geo.scale(y, x, z);
        return { geo, rot: new THREE.Euler(0, 0, Math.PI / 2) };
      }
      if (rod === 2) {
        geo.scale(x, z, y);
        return { geo, rot: new THREE.Euler(Math.PI / 2, 0, 0) };
      }
      geo.scale(x, y, z);
      return { geo, rot: new THREE.Euler() };
    }
    return { geo: new THREE.BoxGeometry(x, y, z), rot: new THREE.Euler() };
  }

  private build(p: CustomPart): Item {
    const { geo, rot } = this.geometry(p);
    const mesh = new THREE.Mesh(geo, this.face);
    mesh.rotation.copy(rot);
    mesh.userData.id = p.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), this.ink);
    edges.rotation.copy(rot);
    const group = new THREE.Group();
    group.add(mesh, edges);
    this.scene.add(group);
    return { group, mesh, edges, key: sizeKey(p), part: p };
  }

  /** Brings the scene to these parts: new ones are built, changed ones moved or rebuilt, gone ones disposed. */
  setParts(parts: CustomPart[]) {
    this.parts = parts;
    const seen = new Set<string>();
    for (const p of parts) {
      seen.add(p.id);
      let it = this.items.get(p.id);
      if (it && it.key !== sizeKey(p)) {
        this.drop(p.id);
        it = undefined;
      }
      if (!it) {
        it = this.build(p);
        this.items.set(p.id, it);
      }
      it.part = p;
      it.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
      it.group.rotation.set(p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, p.rot?.[2] ?? 0, "XYZ");
    }
    for (const id of [...this.items.keys()]) if (!seen.has(id)) this.drop(id);
    this.paint();
    this.placeGizmo();
  }

  private drop(id: string) {
    const it = this.items.get(id);
    if (!it) return;
    this.scene.remove(it.group);
    it.mesh.geometry.dispose();
    it.edges.geometry.dispose();
    this.items.delete(id);
  }

  setSelection(ids: string[]) {
    this.selected = new Set(ids);
    this.paint();
    this.placeGizmo();
  }

  setTool(t: Tool) {
    this.tool = t;
    this.placeGizmo();
  }

  private paint() {
    for (const [id, it] of this.items) {
      const on = this.selected.has(id);
      it.mesh.material = on ? this.faceSelected : id === this.hovered ? this.faceHover : this.face;
      it.edges.material = on ? this.inkSelected : this.ink;
    }
    this.render();
  }

  /* ---------- camera ---------- */

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.view === "3d" ? this.persp : this.ortho;
  }

  setView(v: ViewName, keepTarget = true) {
    this.view = v;
    this.az = VIEWS[v].az;
    this.el = VIEWS[v].el;
    if (!keepTarget) this.frame();
    else this.render();
    this.h.onCamera?.();
  }

  /** Looks at everything there is, from far enough that it all fits. */
  frame() {
    const boxes = [...this.items.values()].map((i) => boxOf(i.part));
    if (!boxes.length) {
      this.target.set(0, 400, 0);
      this.dist = 3000;
    } else {
      const lo = [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k])));
      const hi = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k])));
      this.target.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
      const r = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
      this.dist = Math.min(MAX_DIST, Math.max(900, (r * 2.4) / Math.tan((FOV * Math.PI) / 360)));
    }
    this.render();
    this.h.onCamera?.();
  }

  private placeCamera() {
    const cam = this.camera;
    const cosEl = Math.cos(this.el);
    cam.position.set(this.target.x + this.dist * cosEl * Math.sin(this.az), this.target.y + this.dist * Math.sin(this.el), this.target.z + this.dist * cosEl * Math.cos(this.az));
    // looking straight down, "up" on the screen is the back of the room
    cam.up.set(0, this.view === "top" ? 0 : 1, this.view === "top" ? -1 : 0);
    cam.lookAt(this.target);
    if (cam === this.ortho) {
      const half = this.dist * Math.tan((FOV * Math.PI) / 360);
      const aspect = this.size.w / this.size.h;
      this.ortho.left = -half * aspect;
      this.ortho.right = half * aspect;
      this.ortho.top = half;
      this.ortho.bottom = -half;
    } else this.persp.aspect = this.size.w / this.size.h;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** Screen position (px, in the viewport) of a point in the scene, or null behind the camera. */
  locate(p: Vec3): { x: number; y: number } | null {
    this.placeCamera();
    const v = new THREE.Vector3(p[0], p[1], p[2]).project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * this.size.w, y: ((1 - v.y) / 2) * this.size.h };
  }

  /** The point in the scene under a screen position, on the plane through `through` facing the camera (or the floor when `floor`). */
  pointAt(px: number, py: number, through: THREE.Vector3 = this.target, floor = false, height = 0): THREE.Vector3 | null {
    this.placeCamera();
    this.ray.setFromCamera(new THREE.Vector2((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1), this.camera);
    const normal = floor ? new THREE.Vector3(0, 1, 0) : this.camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, floor ? new THREE.Vector3(0, height, 0) : through);
    return this.ray.ray.intersectPlane(plane, new THREE.Vector3());
  }

  /** The part under a screen position, nearest first. */
  pick(px: number, py: number): string | null {
    this.placeCamera();
    this.ray.setFromCamera(new THREE.Vector2((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects([...this.items.values()].map((i) => i.mesh), false)[0];
    return hit ? (hit.object.userData.id as string) : null;
  }

  /* ---------- gizmos: arrows on the selection (move), handles on a part's faces (scale) ---------- */

  private selectedParts(): CustomPart[] {
    return this.parts.filter((p) => this.selected.has(p.id));
  }

  /** The middle of the selection, as the arrows and the readout sit on it. */
  private center(ps: CustomPart[]): THREE.Vector3 | null {
    if (!ps.length) return null;
    const boxes = ps.map((p) => boxOf(p));
    const c = [0, 1, 2].map((k) => (Math.min(...boxes.map((b) => b.min[k])) + Math.max(...boxes.map((b) => b.max[k]))) / 2);
    return new THREE.Vector3(c[0], c[1], c[2]);
  }

  /** mm that make about `px` pixels where `at` is, so a handle keeps its size on screen. */
  private perPixel(): number {
    const half = this.dist * Math.tan((FOV * Math.PI) / 360);
    return (half * 2) / this.size.h;
  }

  private placeGizmo() {
    for (const o of [...this.gizmo.children]) {
      this.gizmo.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
    }
    this.handles = [];
    const ps = this.selectedParts();
    if (this.tool === "move") {
      const c = this.center(ps);
      if (c) {
        const u = this.perPixel() * 80;
        const colors = [0xd23b3b, 0x2f9e57, 0x3566d6];
        for (const k of [0, 1, 2] as const) {
          const dir = new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
          const arrow = new THREE.Group();
          const mat = new THREE.MeshBasicMaterial({ color: colors[k], depthTest: false, transparent: true });
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.035, u * 0.035, u, 8), mat);
          shaft.position.y = u / 2;
          const head = new THREE.Mesh(new THREE.ConeGeometry(u * 0.11, u * 0.28, 12), mat);
          head.position.y = u + u * 0.14;
          arrow.add(shaft, head);
          arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          arrow.position.copy(c);
          arrow.traverse((o) => {
            o.renderOrder = 999;
            o.userData.handle = { kind: "axis", axis: k };
          });
          this.gizmo.add(arrow);
          this.handles.push(shaft, head);
        }
      }
    } else if (this.tool === "scale" && ps.length === 1) {
      const p = ps[0];
      // a turned part is resized in the inspector: the handles sit on the unturned box
      if (!p.rot?.some((n) => n)) {
        const u = this.perPixel() * 9;
        for (const k of [0, 1, 2] as const)
          for (const sign of [-1, 1]) {
            const pos: Vec3 = [...p.pos];
            pos[k] += (sign * p.size[k]) / 2;
            const box = new THREE.Mesh(new THREE.BoxGeometry(u, u, u), new THREE.MeshBasicMaterial({ color: 0x3566d6, depthTest: false, transparent: true }));
            box.position.set(pos[0], pos[1], pos[2]);
            box.renderOrder = 999;
            box.userData.handle = { kind: "face", axis: k, sign };
            this.gizmo.add(box);
            this.handles.push(box);
          }
      }
    }
    this.render();
  }

  private showGuides(gs: Guide[], around: THREE.Vector3 | null) {
    for (const o of [...this.guides.children]) {
      this.guides.remove(o);
      (o as THREE.Line).geometry.dispose();
    }
    const c = around ?? this.target;
    const R = 6000;
    const mat = new THREE.LineBasicMaterial({ color: 0xd6336c, depthTest: false });
    for (const g of gs) {
      const pts: THREE.Vector3[] =
        g.axis === 0
          ? [new THREE.Vector3(g.at, c.y, -R), new THREE.Vector3(g.at, c.y, R), new THREE.Vector3(g.at, -R, c.z), new THREE.Vector3(g.at, R, c.z)]
          : g.axis === 1
            ? [new THREE.Vector3(-R, g.at, c.z), new THREE.Vector3(R, g.at, c.z), new THREE.Vector3(c.x, g.at, -R), new THREE.Vector3(c.x, g.at, R)]
            : [new THREE.Vector3(c.x, -R, g.at), new THREE.Vector3(c.x, R, g.at), new THREE.Vector3(-R, c.y, g.at), new THREE.Vector3(R, c.y, g.at)];
      const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.renderOrder = 998;
      this.guides.add(line);
    }
    this.render();
  }

  private hitHandle(px: number, py: number): { kind: "axis" | "face"; axis: 0 | 1 | 2; sign?: number } | null {
    if (!this.handles.length) return null;
    this.placeCamera();
    this.ray.setFromCamera(new THREE.Vector2((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.handles, false)[0];
    return hit ? (hit.object.userData.handle as { kind: "axis" | "face"; axis: 0 | 1 | 2; sign?: number }) : null;
  }

  /** Where a pointer is along one axis through `origin`: the closest point of the ray to that line. */
  private alongAxis(px: number, py: number, origin: THREE.Vector3, axis: 0 | 1 | 2): number | null {
    this.placeCamera();
    this.ray.setFromCamera(new THREE.Vector2((px / this.size.w) * 2 - 1, -(py / this.size.h) * 2 + 1), this.camera);
    const a = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    const d = this.ray.ray.direction;
    const w = origin.clone().sub(this.ray.ray.origin);
    const b = a.dot(d);
    const den = 1 - b * b;
    if (den < 1e-6) return null;
    return (b * d.dot(w) - a.dot(w)) / den;
  }

  /* ---------- pointer: orbit, pan, zoom, click, drag ---------- */

  private bind() {
    const dom = this.renderer.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let mode: "orbit" | "pan" | "drag" | null = null;
    let last = { x: 0, y: 0 };
    let pinch = 0;
    let drag: {
      kind: "body" | "axis" | "face";
      ids: string[];
      base: CustomPart[];
      grab: THREE.Vector3;
      axis?: 0 | 1 | 2;
      sign?: number;
      origin?: THREE.Vector3;
      from?: number;
      vertical: boolean;
      by: Vec3;
      size?: Vec3;
      pos?: Vec3;
      moved: boolean;
    } | null = null;
    let pickedOnDown = false;
    const rect = () => dom.getBoundingClientRect();
    const local = (e: PointerEvent) => {
      const r = rect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const finish = (commit: boolean) => {
      const d = drag;
      drag = null;
      this.showGuides([], null);
      this.h.onReadout?.(null);
      if (!d) return;
      if (!commit || !d.moved) {
        this.setParts(d.base);
        return;
      }
      if (d.kind === "face" && d.size && d.pos) this.h.onResize?.(d.ids[0], d.size, d.pos);
      else this.h.onMove?.(d.ids, d.by);
    };

    dom.addEventListener("pointerdown", (e) => {
      dom.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
      pickedOnDown = false;
      if (pts.size === 2) {
        finish(false);
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        mode = "pan";
        return;
      }
      mode = e.button === 1 || e.button === 2 || (e.shiftKey && !e.ctrlKey) ? "pan" : this.view !== "3d" ? "pan" : "orbit";
      if (e.button !== 0 || e.shiftKey) return;
      const { x, y } = local(e);
      const handle = this.hitHandle(x, y);
      const ps = this.selectedParts();
      if (handle && ps.length) {
        const c = this.center(ps)!;
        if (handle.kind === "axis") {
          const from = this.alongAxis(x, y, c, handle.axis);
          if (from !== null) {
            drag = { kind: "axis", ids: ps.map((p) => p.id), base: this.parts, grab: c, axis: handle.axis, origin: c, from, vertical: false, by: [0, 0, 0], moved: false };
            mode = "drag";
          }
        } else if (ps.length === 1) {
          const p = ps[0];
          const origin = new THREE.Vector3(...p.pos);
          const from = this.alongAxis(x, y, origin, handle.axis);
          if (from !== null) {
            drag = { kind: "face", ids: [p.id], base: this.parts, grab: origin, axis: handle.axis, sign: handle.sign, origin, from, vertical: false, by: [0, 0, 0], size: p.size, pos: p.pos, moved: false };
            mode = "drag";
          }
        }
        return;
      }
      const id = this.pick(x, y);
      if (!id) return;
      // a part that is not selected is picked as the drag starts; one that is, drags with the rest
      if (!this.selected.has(id)) {
        this.h.onPick?.(id, e.ctrlKey || e.metaKey);
        pickedOnDown = true;
        this.selected = e.ctrlKey || e.metaKey ? new Set([...this.selected, id]) : new Set([id]);
      }
      const ids = this.selectedParts().map((p) => p.id);
      const item = this.items.get(id)!;
      const grab = this.pointAt(x, y, item.group.position, this.view === "3d" && !e.altKey, item.group.position.y) ?? item.group.position.clone();
      drag = { kind: "body", ids, base: this.parts, grab, vertical: e.altKey, by: [0, 0, 0], moved: false };
      mode = "drag";
    });

    dom.addEventListener("pointermove", (e) => {
      const { x, y } = local(e);
      if (!pts.has(e.pointerId)) {
        if (e.pointerType === "mouse") {
          this.setHover(this.pick(x, y));
          dom.style.cursor = this.hitHandle(x, y) ? "grab" : "";
        }
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const r = rect();
        const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoom(pinch / dd, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = dd;
        this.pan(dx / 2, dy / 2);
      } else if (mode === "drag" && drag) {
        if (moved < 4 && !drag.moved) return;
        const d = drag;
        let by: Vec3 = [0, 0, 0];
        if (d.kind === "body") {
          const now = this.view === "3d" && !d.vertical ? this.pointAt(x, y, d.grab, true, d.grab.y) : this.pointAt(x, y, d.grab);
          if (!now) return;
          const raw = now.clone().sub(d.grab);
          by = [raw.x, raw.y, raw.z];
          if (d.vertical) by = [0, raw.y, 0];
          // the flat views move along their own plane only
          if (this.view === "top") by[1] = 0;
          if (this.view === "front") by[2] = 0;
          if (this.view === "side") by[0] = 0;
        } else if (d.axis !== undefined && d.origin && d.from !== undefined) {
          const at = this.alongAxis(x, y, d.origin, d.axis);
          if (at === null) return;
          by = [0, 0, 0];
          by[d.axis] = at - d.from;
        }
        d.moved = true;
        if (d.kind === "face" && d.axis !== undefined && d.sign !== undefined) {
          const base = d.base.find((p) => p.id === d.ids[0])!;
          const raw = by[d.axis];
          const grid = 10;
          const change = Math.round((d.sign * raw) / grid) * grid;
          const len = Math.max(1, Math.min(4000, base.size[d.axis] + change));
          const real = len - base.size[d.axis];
          const size: Vec3 = [...base.size];
          size[d.axis] = len;
          const pos: Vec3 = [...base.pos];
          pos[d.axis] += (d.sign * real) / 2;
          d.size = size;
          d.pos = pos;
          this.setParts(d.base.map((p) => (p.id === base.id ? { ...p, size, pos } : p)));
          this.h.onReadout?.({ text: `${Math.round(len)} mm`, x: x + 14, y: y - 14 });
          return;
        }
        const snapped = this.h.snap?.(d.ids, by);
        const out = snapped?.delta ?? by;
        d.by = out;
        const set = new Set(d.ids);
        this.setParts(d.base.map((p) => (set.has(p.id) ? { ...p, pos: [p.pos[0] + out[0], p.pos[1] + out[1], p.pos[2] + out[2]] as Vec3 } : p)));
        this.showGuides(snapped?.guides ?? [], this.center(this.selectedParts()));
        this.h.onReadout?.({ text: `x ${Math.round(out[0])}  y ${Math.round(out[1])}  z ${Math.round(out[2])} mm`, x: x + 14, y: y - 14 });
      } else if (mode === "orbit") {
        this.az -= dx * 0.008;
        this.el = Math.max(-1.4, Math.min(1.5, this.el + dy * 0.008));
        this.render();
        this.h.onCamera?.();
      } else if (mode === "pan") this.pan(dx, dy);
    });

    const up = (e: PointerEvent) => {
      const wasOne = pts.size === 1;
      pts.delete(e.pointerId);
      const { x, y } = local(e);
      const click = wasOne && moved < 5 && e.type === "pointerup" && !pickedOnDown;
      if (mode === "drag") finish(e.type === "pointerup");
      if (click) this.h.onPick?.(this.pick(x, y), e.shiftKey || e.ctrlKey || e.metaKey);
      if (!pts.size) mode = null;
      pinch = 0;
    };
    dom.addEventListener("pointerup", up);
    dom.addEventListener("pointercancel", up);
    dom.addEventListener("pointerleave", () => this.setHover(null));
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
    dom.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const r = rect();
        this.zoom(Math.pow(1.0016, e.deltaY), e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
    dom.addEventListener("dblclick", () => this.frame());
    this.escape = () => finish(false);
  }

  /** Esc while something is dragged puts it back. */
  escape: () => void = () => {};

  private setHover(id: string | null) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.paint();
    this.h.onHover?.(id);
  }

  /** Moves the view sideways by a drag of dx, dy pixels, so what was under the pointer stays under it. */
  private pan(dx: number, dy: number) {
    this.placeCamera();
    const a = this.pointAt(0, 0);
    const b = this.pointAt(dx, dy);
    if (!a || !b) return;
    this.target.add(a.sub(b));
    this.render();
    this.h.onCamera?.();
  }

  /** Dolly by `factor` (below 1 is closer), keeping the point under the pointer where it is. */
  private zoom(factor: number, px: number, py: number) {
    const before = this.pointAt(px, py);
    this.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, this.dist * factor));
    const after = this.pointAt(px, py);
    if (before && after) this.target.add(before.sub(after));
    this.render();
    this.h.onCamera?.();
  }

  /* ---------- drawing ---------- */

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.render();
    this.h.onCamera?.();
  }

  render() {
    if (this.disposed || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.disposed) return;
      this.placeCamera();
      this.renderer.render(this.scene, this.camera);
      this.drawAxes();
    });
  }

  /** The small x, y, z reminder in the top right corner: it turns with the camera. */
  private drawAxes() {
    const side = Math.min(AXES_SIZE, this.size.w / 2, this.size.h / 2);
    const x = this.size.w - side - AXES_GAP;
    const y = this.size.h - side - AXES_GAP;
    const cam = this.camera;
    this.axesCam.quaternion.copy(cam.quaternion);
    this.axesCam.position.set(0, 0, 8).applyQuaternion(cam.quaternion);
    const r = this.renderer;
    r.autoClear = false;
    r.clearDepth();
    r.setScissorTest(true);
    r.setViewport(x, y, side, side);
    r.setScissor(x, y, side, side);
    r.render(this.axes, this.axesCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, this.size.w, this.size.h);
    r.autoClear = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const id of [...this.items.keys()]) this.drop(id);
    for (const m of [this.face, this.faceSelected, this.faceHover, this.ink, this.inkSelected]) m.dispose();
    this.grid.traverse((o) => {
      const l = o as THREE.LineSegments;
      l.geometry?.dispose();
      (l.material as THREE.Material | undefined)?.dispose();
    });
    this.axes.traverse((o) => {
      const m = o as THREE.Mesh | THREE.Sprite;
      (m as THREE.Mesh).geometry?.dispose();
      const mat = m.material as (THREE.Material & { map?: THREE.Texture | null }) | undefined;
      mat?.map?.dispose();
      mat?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const AXES_SIZE = 96;
const AXES_GAP = 10;

/** Three arrows (x red, y green, z blue, as in most editors) with a letter at each tip. Units are not mm here: it is an icon. */
function makeAxes(): THREE.Scene {
  const scene = new THREE.Scene();
  const defs: { name: string; color: number; dir: THREE.Vector3 }[] = [
    { name: "X", color: 0xd64545, dir: new THREE.Vector3(1, 0, 0) },
    { name: "Y", color: 0x3a9a4f, dir: new THREE.Vector3(0, 1, 0) },
    { name: "Z", color: 0x3b6fd6, dir: new THREE.Vector3(0, 0, 1) },
  ];
  const up = new THREE.Vector3(0, 1, 0);
  for (const d of defs) {
    const mat = new THREE.MeshBasicMaterial({ color: d.color });
    const q = new THREE.Quaternion().setFromUnitVectors(up, d.dir);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), mat);
    rod.position.copy(d.dir).multiplyScalar(0.4);
    rod.quaternion.copy(q);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 12), mat);
    tip.position.copy(d.dir).multiplyScalar(0.92);
    tip.quaternion.copy(q);
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#" + d.color.toString(16).padStart(6, "0");
      g.font = "bold 46px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(d.name, 32, 36);
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    label.position.copy(d.dir).multiplyScalar(1.3);
    label.scale.setScalar(0.5);
    label.renderOrder = 2;
    scene.add(rod, tip, label);
  }
  return scene;
}

/** What a part's shape depends on: when it changes the geometry is rebuilt, otherwise only moved. */
const sizeKey = (p: CustomPart) => `${p.shape ?? "box"}|${p.size.join("x")}`;
