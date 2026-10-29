import type { CustomPart, ProductSpec } from "@/lib/types";
import { boundsCm, kallaxGrid } from "./parts";

const LEG = 150;
const LEG_W = 40;

const grid = kallaxGrid(2, 2, { y0: LEG });
const [W, , D] = grid.size;

// legs stand in the corners of the bottom panel, where its frame is solid and not hollow
const legX = (W - 80) / 2 - 25;
const legZ = D / 2 - 30;

const legs: CustomPart[] = (
  [
    ["fl", -1, 1],
    ["fr", 1, 1],
    ["bl", -1, -1],
    ["br", 1, -1],
  ] as const
).map(([k, sx, sz]) => ({ id: `leg-${k}`, label: "E", name: "Leg", size: [LEG_W, LEG, LEG_W], pos: [sx * legX, LEG / 2, sz * legZ], material: "wood" }));

const parts = [...grid.parts, ...legs];

export const kallaxTvBench: ProductSpec = {
  slug: "hack-kallax-tv-bench",
  name: "KALLAX TV bench",
  variant: "On legs, 2 × 2",
  category: "TV bench",
  archetype: "custom",
  size: boundsCm(parts),
  minutes: 45,
  people: 2,
  difficulty: 1,
  material: "Particleboard, fibreboard",
  source: "catalog",
  watchOut: [
    "KALLAX boards are hollow, with a solid frame only around the edge. Screw the leg plates into the corners of the bottom panel, never into the middle of it.",
    "Check the weight of your TV against the load the legs and plates are rated for.",
  ],
  hack: {
    summary: "A 2 × 2 KALLAX lifted onto four legs: a low TV bench at 92 cm, with no cutting.",
    base: [{ name: "KALLAX shelving unit, 77 × 77 cm", slug: "kallax-2x2", qty: 1 }],
    buy: [{ name: "Furniture legs, 15 cm, with mounting plate", qty: 4, note: "Screws that come with the plates are usually 4 × 16 mm." }],
    mods: ["Pilot holes in the four corners of the underside."],
  },
  custom: {
    parts,
    steps: [
      ...grid.steps,
      {
        title: "Turn it upside down",
        detail: "Lay it on a blanket, bottom face up. Mark each leg in a corner of the bottom panel, 3 cm from the front or back edge and 3 cm from the side.",
        tools: ["tape", "pencil"],
        pose: "-y",
        people: 2,
        warnings: ["two", "floor"],
      },
      { title: "Fix the leg plates", detail: "Hold each plate on its mark, drill a pilot hole for every screw, then drive them in.", fix: [{ kind: "plate", count: 4 }], tools: ["drill"] },
      { title: "Screw in the legs", detail: "Turn each leg in by hand, then give it a last quarter turn.", add: legs.map((l) => l.id), fix: [{ kind: "legScrew", count: 4 }] },
      { title: "Stand it up", detail: "Lift it together and stand it on the legs. Check it doesn't rock.", pose: "+y", people: 2, warnings: ["two", "square"] },
    ],
  },
};
