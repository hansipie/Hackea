import type { Vec3 } from "../types";
import { HW, PlanBuilder, type FitOpts } from "./builder";

/** How far castors lift whatever stands on them, in mm. */
export const CASTOR_H = HW.castor.len;

/**
 * Castors under the bottom panel of a carcass that lies on its front: turned upside down, one castor pushed into each
 * corner. The carcass is built with its bottom at zero; liftOntoCastors raises it onto them once every step is in.
 */
export function castorStep(b: PlanBuilder, o: { bottom: string; W: number; D: number; y: number; big?: boolean }) {
  const xs = [-o.W / 2 + 50, o.W / 2 - 50], zs = [-o.D / 2 + 50, o.D / 2 - 50];
  b.step(
    {
      title: "Fit a castor under each corner",
      detail: "Turn it upside down on the flattened box. Push each castor into its hole until it clicks.",
      pose: "-y",
      kind: "legs",
      people: o.big ? 2 : 1,
      warnings: o.big ? ["two", "floor"] : ["floor"],
    },
    () => {
      const list: FitOpts[] = [];
      for (const x of xs) for (const z of zs) list.push({ on: o.bottom, at: [x, o.y, z] as Vec3, dir: [0, 1, 0] as Vec3, travel: 70, hole: false });
      b.fits(HW.castor, list, 0.12);
    },
  );
}

/** Raises everything built in the main scene by the castors' height, so it stands on them. */
export function liftOntoCastors(b: PlanBuilder) {
  const U = CASTOR_H;
  for (const it of b.items) {
    if (it.kind === "part") {
      const old = it.final.pos;
      it.final = { pos: [old[0], old[1] + U, old[2]], rot: it.final.rot };
      for (const st of it.states) if (st.scene === "main") st.pos = st.pos === old ? it.final.pos : [st.pos[0], st.pos[1] + U, st.pos[2]];
    } else if (!it.parent && it.scene === "main") it.pos = [it.pos[0], it.pos[1] + U, it.pos[2]];
  }
}
