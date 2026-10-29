import type { PartPiece, ProductSpec, Vec3 } from "../types";
import { PlanBuilder } from "./builder";
import { clamp, rotate } from "./math";

/**
 * Highchairs (ANTILOP, BLÅMES): a seat shell with a back and armrests, four splayed legs pushed into it from below
 * while it lies upside down, then turned over, and the tray slid onto the armrests last.
 */
export function buildHighchair(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const seatY = clamp((s.seat?.seatH ?? 55) * 10, 450, 650); // top of the seat
  const st = 30;
  const sw = clamp(W * 0.62, 320, 420), sd = clamp(D * 0.55, 300, 380);
  const backH = clamp(H - seatY, 200, 400);
  const armH = 140;
  const zs = -30; // the shell sits a little back, so the tray can reach out in front
  const shell: PartPiece[] = [
    { shape: "box", size: [sw, st, sd], pos: [0, seatY - st / 2, zs] },
    { shape: "box", size: [sw, backH, st], pos: [0, seatY + backH / 2 - st, zs - sd / 2 + st / 2] },
    { shape: "box", size: [st, armH, sd - st], pos: [-sw / 2 + st / 2, seatY + armH / 2, zs + st / 2] },
    { shape: "box", size: [st, armH, sd - st], pos: [sw / 2 - st / 2, seatY + armH / 2, zs + st / 2] },
  ];
  const sc = b.compound("Seat shell", shell);
  const seat = b.place(sc.type, sc.mid);

  // legs splay out to a footprint as wide and deep as the chair
  const ld = 30;
  const top = (sx: number, sz: number): Vec3 => [sx * (sw / 2 - 40), seatY - st, zs + sz * (sd / 2 - 40)];
  const foot = (sx: number, sz: number): Vec3 => [sx * (W / 2 - ld), 0, sz * (D / 2 - ld)];
  const legs = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ].map(([sx, sz]) => {
    const a = top(sx, sz), f = foot(sx, sz);
    const v: Vec3 = [a[0] - f[0], a[1] - f[1], a[2] - f[2]];
    const len = Math.hypot(...v);
    // tilt the leg's long axis (local y) from straight up onto the line from its foot to the seat
    const rx = Math.atan2(v[2], v[1]), rz = -Math.asin(v[0] / len);
    const rot: Vec3 = [rx, 0, rz];
    return { len, rot, mid: [(a[0] + f[0]) / 2, (a[1] + f[1]) / 2, (a[2] + f[2]) / 2] as Vec3 };
  });
  const legT = b.part("Leg", [ld, Math.round(Math.max(...legs.map((l) => l.len))), ld], { shape: "cyl", material: "wood" });
  const legKeys = legs.map((l) => ({ ...l, key: b.place(legT, l.mid, l.rot) }));

  const withTray = s.seat?.tray !== false;
  const tw = sw + 120, td = 220;
  const tray: PartPiece[] = [
    { shape: "box", size: [tw, 16, td], pos: [0, 8, 0] },
    { shape: "box", size: [tw, 30, 14], pos: [0, 15, td / 2 - 7] },
    { shape: "box", size: [14, 30, td - 14], pos: [-tw / 2 + 7, 15, -7] },
    { shape: "box", size: [14, 30, td - 14], pos: [tw / 2 - 7, 15, -7] },
  ];
  const tc = withTray ? b.compound("Tray", tray) : undefined;
  const trayKey = tc && b.place(tc.type, [tc.mid[0], seatY + armH + tc.mid[1], zs + sd / 2 + td / 2 - 60 + tc.mid[2]]);

  b.step(
    {
      title: "Lay the seat upside down",
      detail: "On the flattened box, so it doesn't scratch.",
      pose: "-y",
      kind: "general",
      warnings: ["floor"],
    },
    () => b.add(seat, [0, 220, 0]),
  );
  b.step(
    {
      title: "Push the legs into the seat",
      detail: "Each one goes into its own socket. Push firmly until it clicks, and check it won't pull out.",
      pose: "-y",
      kind: "legs",
    },
    () => {
      b.stagger(0.3);
      legKeys.forEach((l) => b.add(l.key, rotate([0, -320, 0], l.rot)));
    },
  );
  b.step(
    {
      title: "Turn it over",
      detail: "Stand it on a flat floor and check that it doesn't rock.",
      pose: "+y",
      kind: "flip",
    },
    () => {},
  );
  if (withTray)
    b.step(
      {
        title: "Slide the tray onto the armrests",
        detail: "Push it on until it clicks. Always use the safety belt, and never leave a child alone in it.",
        kind: "general",
      },
      () => b.add(trayKey!, [0, 0, 260]),
    );
  else
    b.step(
      {
        title: "Fit the safety belt",
        detail: "Thread it through the slots in the seat and clip it shut. Always use it, and never leave a child alone in it.",
        kind: "general",
      },
      () => {},
    );
}
