import type { HwKind } from "@/lib/types";

const METAL = "#e3e5e7";
const WOOD = "#f1e2c3";
const PLASTIC = "#f4f4f1";

interface Drawn {
  w: number;
  h: number;
  node: React.ReactNode;
  scalable: boolean;
}

const stroke = { stroke: "var(--ink)", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const fine = { stroke: "var(--ink)", strokeWidth: 0.9, vectorEffect: "non-scaling-stroke", opacity: 0.55, strokeLinecap: "round" } as const;

function thread(x0: number, x1: number, r: number, pitch: number) {
  let d = `M${x0} ${-r}`;
  let up = true;
  for (let x = x0 + pitch / 2; x <= x1 + 0.01; x += pitch / 2) {
    d += ` L${Math.min(x, x1)} ${up ? -r * 0.78 : -r}`;
    up = !up;
  }
  d += ` L${x1} ${r}`;
  up = true;
  for (let x = x1 - pitch / 2; x >= x0 - 0.01; x -= pitch / 2) {
    d += ` L${Math.max(x, x0)} ${up ? r * 0.78 : r}`;
    up = !up;
  }
  return d + " Z";
}

function draw(kind: HwKind, len: number, dia: number): Drawn {
  const r = dia / 2;
  switch (kind) {
    case "dowel": {
      const lines = [-r / 2, 0, r / 2].map((y) => <path key={y} d={`M${dia * 0.45} ${y} H${len - dia * 0.45}`} {...fine} />);
      return { w: len, h: dia, scalable: true, node: <g><rect x={0} y={-r} width={len} height={dia} rx={r * 0.55} fill={WOOD} {...stroke} />{lines}</g> };
    }
    case "camScrew":
      return {
        w: 35,
        h: 8,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 11, 2.9, 1.4)} fill={METAL} {...stroke} />
            <rect x={11} y={-3.8} width={1.6} height={7.6} rx={0.6} fill={METAL} {...stroke} />
            <rect x={12.6} y={-2.2} width={15.6} height={4.4} fill={METAL} {...stroke} />
            <circle cx={31.4} cy={0} r={3.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "cam":
      return {
        w: 15,
        h: 16,
        scalable: true,
        node: (
          <g transform="translate(0 -4)">
            <path d="M0 0 V9.5 A7.5 3.2 0 0 0 15 9.5 V0" fill={METAL} {...stroke} />
            <ellipse cx={7.5} cy={0} rx={7.5} ry={3.2} fill="#f2f3f4" {...stroke} />
            <path d="M3.4 -1.1 L11.6 1.1" {...stroke} strokeWidth={2.2} />
            <path d="M10.6 -1.9 L13 -0.6 L11.2 0.6" fill="none" {...stroke} strokeWidth={1.1} />
          </g>
        ),
      };
    case "screw": {
      const hr = Math.max(dia * 1.05, 3.4);
      const ticks = [];
      for (let x = 3.4; x < len - 3; x += 1.7) ticks.push(<path key={x} d={`M${x} ${-r * 0.9} L${x + 0.9} ${r * 0.9}`} {...fine} />);
      return {
        w: len + 2,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <path d={`M2 ${-r * 0.9} H${len - 1.5} L${len + 1.6} 0 L${len - 1.5} ${r * 0.9} H2 Z`} fill={METAL} {...stroke} />
            {ticks}
            <path d={`M2 ${-hr} C0.4 ${-hr} 0 ${-hr * 0.6} 0 0 C0 ${hr * 0.6} 0.4 ${hr} 2 ${hr} Z`} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "nail":
      return {
        w: len,
        h: dia * 3.4,
        scalable: true,
        node: (
          <g>
            <path d={`M0.8 ${-r} H${len - 1.8} L${len} 0 L${len - 1.8} ${r} H0.8 Z`} fill={METAL} {...stroke} />
            <rect x={0} y={-dia * 1.7} width={0.9} height={dia * 3.4} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "pin":
      return {
        w: 17.4,
        h: dia + 2.4,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-r} width={8.4} height={dia} rx={0.8} fill={METAL} {...stroke} />
            <rect x={9.6} y={-r} width={7.8} height={dia} rx={r * 0.8} fill={METAL} {...stroke} />
            <rect x={8.2} y={-r - 1.2} width={1.6} height={dia + 2.4} rx={0.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "legScrew": {
      const mid = 12;
      const a = (len - mid) / 2;
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, a, r, 1.6)} fill={METAL} {...stroke} />
            <rect x={a} y={-r * 0.82} width={mid} height={r * 1.64} fill={METAL} {...stroke} />
            <path d={thread(a + mid, len, r, 1.6)} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "bolt": {
      const hr = dia * 0.85;
      const t0 = 5 + len * 0.45;
      return {
        w: len + 5,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <rect x={5} y={-r} width={t0 - 5} height={dia} fill={METAL} {...stroke} />
            <path d={thread(t0, len + 5, r, 1.2)} fill={METAL} {...stroke} />
            <rect x={0} y={-hr} width={5.2} height={hr * 2} rx={1} fill={METAL} {...stroke} />
            <path d={`M1.4 ${-hr * 0.42} H3.6 M1.4 ${hr * 0.42} H3.6`} {...fine} />
          </g>
        ),
      };
    }
    case "plate":
      return {
        w: 70,
        h: 70,
        scalable: true,
        node: (
          <g transform="translate(0 -35)">
            <rect x={0} y={0} width={70} height={70} rx={4} fill={METAL} {...stroke} />
            {[
              [7, 7],
              [63, 7],
              [63, 63],
              [7, 63],
            ].map(([x, y]) => (
              <circle key={x + "-" + y} cx={x} cy={y} r={2.6} fill="#fff" {...stroke} />
            ))}
            <circle cx={35} cy={35} r={10} fill="#eef0f1" {...stroke} />
            <circle cx={35} cy={35} r={4.6} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "bracket":
      return {
        w: 46,
        h: 46,
        scalable: true,
        node: (
          <g transform="translate(0 -23)">
            <path d="M6 30 L30 44 L46 34 L22 20 Z" fill={METAL} {...stroke} />
            <path d="M22 20 L22 2 L46 16 L46 34 Z" fill="#eef0f1" {...stroke} />
            <ellipse cx={34} cy={18} rx={2.6} ry={3.2} fill="#fff" {...stroke} />
            <ellipse cx={21} cy={31} rx={3} ry={1.8} fill="#fff" {...stroke} />
            <ellipse cx={31} cy={37} rx={3} ry={1.8} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "runner":
      return {
        w: 120,
        h: 22,
        scalable: false,
        node: (
          <g>
            <path d="M0 -6 H114 L120 0 L114 6 H0 Z" fill={METAL} {...stroke} />
            <path d="M0 -10 H112 V-6 H0 Z" fill="#eef0f1" {...stroke} />
            {[16, 60, 104].map((x) => (
              <circle key={x} cx={x} cy={0} r={2} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "knob":
      return {
        w: 26,
        h: 30,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-5.5} width={12} height={11} rx={1.5} fill={WOOD} {...stroke} />
            <path d="M12 -14 C22 -14 26 -8 26 0 C26 8 22 14 12 14 C10.5 14 10.5 -14 12 -14 Z" fill={WOOD} {...stroke} />
          </g>
        ),
      };
    case "handle":
      return {
        w: len + 24,
        h: 34,
        scalable: true,
        node: (
          <g transform="translate(0 -6)">
            <rect x={12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} transform={`translate(0 0)`} />
            <rect x={len + 12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} />
            <rect x={0} y={-14} width={len + 24} height={12} rx={6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "hinge":
      return {
        w: 78,
        h: 40,
        scalable: true,
        node: (
          <g>
            <rect x={28} y={-7} width={42} height={14} rx={3} fill={METAL} {...stroke} />
            <rect x={66} y={-20} width={10} height={40} rx={2} fill="#eef0f1" {...stroke} />
            <circle cx={17.5} cy={0} r={17.5} fill={METAL} {...stroke} />
            <circle cx={17.5} cy={0} r={12} fill="#eef0f1" {...stroke} />
            <circle cx={3} cy={-15} r={2} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "glide":
      return { w: 20, h: 10, scalable: true, node: <g><path d="M0 -1 V2 A10 3.6 0 0 0 20 2 V-1" fill={PLASTIC} {...stroke} /><ellipse cx={10} cy={-1} rx={10} ry={3.6} fill={PLASTIC} {...stroke} /></g> };
    case "plug": {
      const ribs = [];
      for (let x = 5; x < len - 3; x += 4) ribs.push(<path key={x} d={`M${x} ${-r} L${x + 1.6} 0 L${x} ${r}`} fill="none" {...fine} />);
      return {
        w: len,
        h: dia + 3,
        scalable: true,
        node: (
          <g>
            <path d={`M1.5 ${-r} H${len - 2} L${len} 0 L${len - 2} ${r} H1.5 Z`} fill={PLASTIC} {...stroke} />
            {ribs}
            <rect x={0} y={-r - 1.5} width={1.6} height={dia + 3} rx={0.5} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    }
    case "castor":
      // standing up: the pin on top, the wheel underneath
      return {
        w: 52,
        h: 80,
        scalable: false,
        node: (
          <g>
            <rect x={21.5} y={-40} width={9} height={21} rx={2} fill={METAL} {...stroke} />
            <rect x={15} y={-20} width={22} height={4} rx={1.5} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={25} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={6} fill="#fff" {...stroke} />
            <path d="M8 -16 H40 C46 -16 48 -12 48 -6 L46 4 H10 L6 -8 C6 -13 6 -16 8 -16 Z" fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "flatHinge":
      // two leaves with screw holes, the pin between them
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            {[0, len / 2 + 3].map((x) => (
              <rect key={x} x={x} y={-dia / 2} width={len / 2 - 3} height={dia} rx={2} fill={METAL} {...stroke} />
            ))}
            <rect x={len / 2 - 4} y={-dia / 2 - 1} width={8} height={dia + 2} rx={4} fill={METAL} {...stroke} />
            {[len * 0.17, len * 0.83].flatMap((x) => [-dia / 4, dia / 4].map((y) => <circle key={`${x}:${y}`} cx={x} cy={y} r={2.2} fill="#fff" {...stroke} />))}
          </g>
        ),
      };
    case "roller":
      // a plate with two screw holes, an arm, and the wheel on top
      return {
        w: len,
        h: dia + 26,
        scalable: true,
        node: (
          <g transform={`translate(0 ${(dia + 26) / 2 - 4})`}>
            <rect x={len / 2 - 4} y={-22} width={8} height={20} rx={2} fill={METAL} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={dia / 2} fill={PLASTIC} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={3} fill="#fff" {...stroke} />
            <rect x={0} y={-3} width={len} height={7} rx={2} fill={METAL} {...stroke} />
            {[len * 0.18, len * 0.82].map((x) => (
              <circle key={x} cx={x} cy={0.5} r={1.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "hook":
      // lying down: the thread on the left, the plate, the stem and its ball
      return {
        w: len + 12,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-2.5} width={12} height={5} rx={1} fill={METAL} {...stroke} />
            <rect x={12} y={-dia * 0.28} width={3} height={dia * 0.56} rx={1} fill={METAL} {...stroke} />
            <rect x={15} y={-4} width={len - 18} height={8} rx={3} fill={METAL} {...stroke} />
            <circle cx={len + 12 - dia * 0.42} cy={0} r={dia * 0.42} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "connector":
      // a flat strip with a screw hole at each end
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={3} fill={METAL} {...stroke} />
            {[len / 4, (3 * len) / 4].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "clip":
      // side on: the flat head on the left, the stem with its barbs
      return {
        w: 18,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={3.5} height={dia} rx={1} fill={PLASTIC} {...stroke} />
            <path d="M3.5 -2.6 H14 L18 0 L14 2.6 H3.5 Z" fill={PLASTIC} {...stroke} />
            <path d="M8 -2.6 L10 -4 M12 -2.6 L14 -4 M8 2.6 L10 4 M12 2.6 L14 4" fill="none" {...fine} />
          </g>
        ),
      };
    case "strap":
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={4} fill={PLASTIC} {...stroke} />
            {[10, len - 10].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "nut": {
      const R = dia * 0.95;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => `${R + R * Math.cos((k * Math.PI) / 3)},${R * Math.sin((k * Math.PI) / 3)}`).join(" ");
      return { w: R * 2, h: R * 1.8, scalable: true, node: <g><polygon points={pts} fill={METAL} {...stroke} /><circle cx={R} cy={0} r={dia / 2} fill="#fff" {...stroke} /></g> };
    }
    case "washer":
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={METAL} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 5} fill="#fff" {...stroke} /></g> };
    case "stud":
      return {
        w: len,
        h: dia * 1.25,
        scalable: true,
        node: (
          <g>
            <path d={thread(3, len, (dia / 2) * 0.8, 1.4)} fill={METAL} {...stroke} />
            <rect x={0} y={(-dia * 1.25) / 2} width={3} height={dia * 1.25} rx={1} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "clamp":
      return { w: len, h: 10, scalable: true, node: <path d={`M0 -5 V5 H${len} V-5 H${len - 2.5} V2.5 H2.5 V-5 Z`} fill={METAL} {...stroke} /> };
    case "angle":
      return {
        w: len,
        h: len,
        scalable: true,
        node: (
          <g transform={`translate(0 ${-len / 2})`}>
            <path d={`M0 0 H2.5 V${len - 2.5} H${len} V${len} H0 Z`} fill={METAL} {...stroke} />
            <circle cx={len * 0.6} cy={len - 1.2} r={0.9} fill="#fff" {...fine} />
          </g>
        ),
      };
    case "foot":
      return {
        w: len + 14,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 14, 4, 1.6)} fill={METAL} {...stroke} />
            <rect x={14} y={-dia / 2} width={len} height={dia} rx={3} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "spacer":
      return { w: len, h: dia, scalable: true, node: <rect x={0} y={-dia / 2} width={len} height={dia} rx={2} fill={PLASTIC} {...stroke} /> };
    case "cap":
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={PLASTIC} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 2 - 2} fill="none" {...fine} /></g> };
    case "gasLift":
      // lying down: the narrow end that drops into the base on the left, the rod for the seat on the right
      return {
        w: 132,
        h: 26,
        scalable: false,
        node: (
          <g>
            <rect x={0} y={-7} width={26} height={14} rx={2} fill={METAL} {...stroke} />
            <rect x={24} y={-13} width={82} height={26} rx={3} fill={METAL} {...stroke} />
            <path d="M34 -6 H96" {...fine} />
            <rect x={104} y={-9} width={6} height={18} rx={1.5} fill={PLASTIC} {...stroke} />
            <rect x={110} y={-5.5} width={22} height={11} rx={2} fill={METAL} {...stroke} />
          </g>
        ),
      };
  }
}

/**
 * Hardware drawing. `fit` draws it inside a square box of that many pixels;
 * `pxPerMm` draws it at real size.
 */
export function HwArt({ kind, len, dia, fit = 72, pxPerMm, className }: { kind: HwKind; len: number; dia: number; fit?: number; pxPerMm?: number; className?: string }) {
  const d = draw(kind, len, dia);
  const pad = Math.max(d.w, d.h) * 0.06 + 1;
  const vbW = d.w + pad * 2, vbH = d.h + pad * 2;
  let width: number, height: number;
  if (pxPerMm && d.scalable) {
    width = vbW * pxPerMm;
    height = vbH * pxPerMm;
  } else {
    const k = fit / Math.max(vbW, vbH * 1.15);
    width = vbW * k;
    height = vbH * k;
  }
  return (
    <svg className={className} viewBox={`${-pad} ${-d.h / 2 - pad} ${vbW} ${vbH}`} width={width} height={height} aria-hidden="true" overflow="visible">
      {d.node}
    </svg>
  );
}

export function canActualSize(kind: HwKind) {
  return kind !== "runner" && kind !== "castor" && kind !== "gasLift";
}
