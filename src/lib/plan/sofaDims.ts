import type { ProductSpec } from "../types";
import { clamp } from "./math";

/**
 * How an upholstered seat stands, in mm: the legs, the frame, the cushions, the armrests and the backrest. From IKEA's
 * own measurements where the product has them (seat height, armrest height and width, backrest height, room under
 * it), otherwise what most IKEA sofas measure. The backrest frame stops below the top of the back cushions, which
 * stand up above it: that is what makes a sofa read as a sofa and not a box with a board at the back.
 */
export function sofaDims(s: ProductSpec, W: number, D: number) {
  const p = s.sofa ?? {};
  const H = s.size.h * 10;
  const arms = p.arms ?? "wide";
  const a = arms === "none" ? 0 : p.armW ? clamp(p.armW * 10, 50, Math.min(400, W * 0.3)) : arms === "slim" ? 80 : Math.min(170, W * 0.12);
  // the room under the frame is what the legs show
  const legH = p.legH !== undefined ? clamp(p.legH * 10, 25, 350) : p.legs === "block" ? 70 : 110;
  const seatTop = clamp(p.seatH ? p.seatH * 10 : Math.max(420, legH + 330), legH + 200, Math.min(620, H - 150));
  const seatT = clamp(Math.round(seatTop * 0.3), 100, 170);
  const baseTop = Math.max(legH + 90, seatTop - seatT);
  const armH = clamp(p.armH ? p.armH * 10 : Math.min(H - 60, Math.max(seatTop + 180, 620)), seatTop + 80, H);
  // the backrest frame: as tall as IKEA says, or a little under the cushions' top
  const backH = clamp(p.backH ? p.backH * 10 : H - 110, seatTop + 150, H);
  const backT = Math.min(200, D * 0.22);
  // the seat cushions are as deep as the seat IKEA measures; the back cushions fill what is left
  const seatD = clamp(p.seatD ? p.seatD * 10 : D - backT - 190, 350, D - backT - 60);
  const cushT = clamp(D - backT - seatD - 10, 90, 260);
  const cushH = clamp(H - seatTop - 10, 220, 700);
  return { a, legH, seatTop, seatT, baseTop, armH, backH, backT, seatD, cushT, cushH, H };
}
