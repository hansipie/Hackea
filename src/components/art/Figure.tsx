export type Pose = "stand" | "cheer" | "think" | "point" | "wave" | "read" | "lift" | "hold";

type Pt = [number, number];
type Limb = [Pt, Pt, Pt];

const INK = "var(--ink)";

/** Shoulder, elbow and hand for each arm. */
const ARMS: Record<Pose, [Limb, Limb]> = {
  stand: [[[22.5, 33], [18.5, 45], [19.5, 56]], [[37.5, 33], [41.5, 45], [40.5, 56]]],
  cheer: [[[22.5, 32], [15, 24], [12.5, 11]], [[37.5, 32], [45, 24], [47.5, 11]]],
  think: [[[22.5, 33], [18.5, 45], [19.5, 56]], [[37.5, 33], [45.5, 37], [36, 23]]],
  point: [[[22.5, 33], [18.5, 45], [19.5, 56]], [[37.5, 33], [47, 33], [57, 28]]],
  wave: [[[22.5, 33], [18.5, 45], [19.5, 56]], [[37.5, 32], [46, 27], [47, 13]]],
  read: [[[22.5, 33], [20, 44], [26.5, 46]], [[37.5, 33], [40, 44], [33.5, 46]]],
  lift: [[[22.5, 32], [14, 27], [13.5, 15]], [[37.5, 32], [46, 27], [46.5, 15]]],
  hold: [[[22.5, 33], [16.5, 41], [19.5, 47]], [[37.5, 33], [43.5, 41], [40.5, 47]]],
};
const LEGS: [Limb, Limb] = [
  [[26.4, 60], [25.6, 75], [25.2, 89]],
  [[33.6, 60], [34.4, 75], [34.8, 89]],
];

function Tube({ limb: [a, b, c], w, k, className }: { limb: Limb; w: number; k: number; className?: string }) {
  const d = `M${a[0]} ${a[1]} Q${b[0]} ${b[1]} ${c[0]} ${c[1]}`;
  return (
    <g className={className}>
      <path d={d} fill="none" stroke={INK} strokeWidth={w + 3.6 * k} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" />
    </g>
  );
}

const SHOE = "M33.2 88.4 h4.4 q4.9 0 4.9 3.3 q0 1.5 -1.5 1.5 h-8.2 q-1.4 0 -1.4 -1.7 z";

function Face({ pose }: { pose: Pose }) {
  if (pose === "cheer")
    return (
      <g>
        <path d="M26.4 13.6 q1.3 -1.6 2.6 0 M32 13.6 q1.3 -1.6 2.6 0" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
        <path d="M27.4 17 q2.9 3.4 5.8 0 z" fill={INK} />
      </g>
    );
  // thinking: eyes up, mouth flat
  const up = pose === "think";
  return (
    <g>
      <circle cx={up ? 28 : 27.6} cy={up ? 12 : 13.4} r={1.15} fill={INK} />
      <circle cx={up ? 33.4 : 33} cy={up ? 12 : 13.4} r={1.15} fill={INK} />
      {up ? <path d="M28.6 18.2 h3.4" stroke={INK} strokeWidth={1.3} strokeLinecap="round" /> : <path d="M28 17.2 q2.3 1.9 4.6 0" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />}
    </g>
  );
}

/** The builder, drawn in the same ink as the furniture. viewBox units: 60 wide, head at 4.6, soles at 93.2. `k` thins the outlines. */
function Body({ pose, k = 1 }: { pose: Pose; k?: number }) {
  const [l, r] = ARMS[pose];
  return (
    <g>
      <Tube limb={LEGS[0]} w={5.4} k={k} />
      <Tube limb={LEGS[1]} w={5.4} k={k} />
      <path d={SHOE} fill={INK} transform="translate(60 0) scale(-1 1)" />
      <path d={SHOE} fill={INK} />
      <path
        d="M23 30.5 Q30 27.6 37 30.5 Q39.6 31.6 39.2 35 L37.6 57.5 Q37.4 61.5 33.6 61.5 H26.4 Q22.6 61.5 22.4 57.5 L20.8 35 Q20.4 31.6 23 30.5 Z"
        fill="#fff"
        stroke={INK}
        strokeWidth={2.2 * k}
        strokeLinejoin="round"
      />
      <path d="M26.6 29.4 q3.4 3.4 6.8 0" fill="none" stroke={INK} strokeWidth={1.6 * k} strokeLinecap="round" />
      <path d="M22.2 52.5 H37.8" stroke={INK} strokeWidth={1.4 * k} />
      <rect x={31.4} y={38} width={4.6} height={5.2} rx={1} fill="var(--accent)" stroke={INK} strokeWidth={1.4 * k} />
      {pose === "read" && (
        <g transform="rotate(-6 30 44)">
          <rect x={22} y={39} width={16} height={11.5} rx={1.6} fill="var(--accent-soft)" stroke={INK} strokeWidth={1.8} />
          <path d="M30 39.6 v10.8" stroke={INK} strokeWidth={1.2} />
        </g>
      )}
      <Tube limb={l} w={4.2} k={k} className="arm-l" />
      <Tube limb={r} w={4.2} k={k} className="arm-r" />
      <circle cx={l[2][0]} cy={l[2][1]} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.8 * k} />
      <circle cx={r[2][0]} cy={r[2][1]} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.8 * k} />
      <g className="head">
        <path d="M21.5 13.8 q-2.6 0.6 -1.4 3.6 q0.7 1.2 2 1" fill="#fff" stroke={INK} strokeWidth={1.6 * k} strokeLinecap="round" />
        <ellipse cx={30.3} cy={14.2} rx={8.9} ry={9.4} fill="#fff" stroke={INK} strokeWidth={2.2 * k} />
        <path d="M21.6 12.8 Q21.6 4.6 30.4 4.6 Q38.8 4.6 39.1 12.2 Q35.6 8.6 30.2 9.2 Q25.4 9.6 21.6 12.8 Z" fill={INK} />
        <Face pose={pose} />
      </g>
    </g>
  );
}

/** The helper character: an original little builder. viewBox 0 0 60 100. */
export function Figure({ pose = "stand", size = 80, className, bubble }: { pose?: Pose; size?: number; className?: string; bubble?: "?" | "!" | "check" }) {
  return (
    <svg viewBox="0 0 60 100" width={(size * 60) / 100} height={size} className={"figure " + (className ?? "")} aria-hidden="true" overflow="visible">
      <Body pose={pose} />
      {bubble && (
        <g transform="translate(46 -6)" className="bubble">
          <path d="M0 10 a12 11 0 1 1 6 9 l-7 4 l2 -6 a11 11 0 0 1 -1 -7 z" fill={bubble === "check" ? "var(--accent)" : "#fff"} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          {bubble === "check" ? (
            <path d="M6.5 10.5 l4 4 l7 -8" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <text x={12} y={16} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK} fontFamily="var(--font)">
              {bubble}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/** Head to sole and nothing else, for drawing a person to scale next to furniture. */
export function ScaleFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="8 4.4 44 88.8" className={className} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <Body pose="stand" k={0.62} />
    </svg>
  );
}

/** Two builders carrying a panel together. */
export function TwoPeople({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 -4 120 100" width={(size * 120) / 100} height={size} className={className} aria-hidden="true">
      <g transform="translate(0 4)">
        <Body pose="lift" />
      </g>
      <g transform="translate(60 4)">
        <Body pose="lift" />
      </g>
      <rect x={10} y={10} width={100} height={8} rx={2} fill="var(--accent-soft)" stroke={INK} strokeWidth={2.2} />
    </svg>
  );
}

/** The two of us, holding up a board with our names on it, the way the manual draws a two-person job. */
export function Crew({ names, size = 120, className }: { names: string; size?: number; className?: string }) {
  const hands: Pt[] = [
    [19.5, 47],
    [40.5, 47],
    [85.5, 47],
    [106.5, 47],
  ];
  return (
    <svg viewBox="0 -2 126 98" width={(size * 126) / 98} height={size} className={className} aria-hidden="true" overflow="visible">
      <g className="crew-a">
        <Body pose="hold" />
      </g>
      <g className="crew-b" transform="translate(66 0)">
        <Body pose="hold" />
      </g>
      <g className="crew-board">
        <rect x={11} y={46} width={104} height={21} rx={2.5} fill="var(--accent)" stroke={INK} strokeWidth={2.2} />
        <text x={63} y={60.2} textAnchor="middle" fontSize={10} fontWeight={800} letterSpacing={-0.2} fill={INK} fontFamily="var(--display)">
          {names}
        </text>
        {hands.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.3} fill="#fff" stroke={INK} strokeWidth={1.8} />
        ))}
      </g>
    </svg>
  );
}
