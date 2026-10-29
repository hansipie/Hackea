import type { CustomPart, ProductSpec } from "@/lib/types";
import { boundsCm, kallaxGrid } from "./parts";

const LEG = 100;
const LEG_W = 40;

// a 2 × 4 KALLAX laid on its side is a 4 × 2 grid, 147 cm wide
const grid = kallaxGrid(4, 2, { y0: LEG });
const [W, , D] = grid.size;
const legX = (W - 80) / 2 - 25;
const legZ = D / 2 - 30;

// six legs: four in the corners of the bottom panel, where its frame is solid, and two under the middle divider
const legs: CustomPart[] = (
  [
    ["fl", -legX, 1],
    ["fm", 0, 1],
    ["fr", legX, 1],
    ["bl", -legX, -1],
    ["bm", 0, -1],
    ["br", legX, -1],
  ] as const
).map(([k, x, sz]) => ({ id: `leg-${k}`, label: "E", name: "Leg", size: [LEG_W, LEG, LEG_W], pos: [x, LEG / 2, sz * legZ], material: "wood" }));

const parts = [...grid.parts, ...legs];

export const kallaxSideboard: ProductSpec = {
  slug: "hack-kallax-sideboard",
  name: "KALLAX sideboard",
  variant: "Laid down on legs, 147 cm",
  category: "Sideboard",
  archetype: "custom",
  size: boundsCm(parts),
  minutes: 60,
  people: 2,
  difficulty: 1,
  material: "Particleboard, fibreboard",
  source: "catalog",
  watchOut: [
    "The unit is 147 cm long: have a second person support the middle when you turn it over, so the frame doesn't flex.",
    "The two middle legs sit under a divider with the hollow bottom around it. Put their plates close to the divider, and check the board is solid there.",
    "Check the load the legs and plates are rated for before you put anything heavy on it.",
  ],
  hack: {
    summary: "A KALLAX 2 × 4 laid on its side on six legs: a 147 cm sideboard with eight open cubbies.",
    base: [{ name: "KALLAX shelving unit, 77 × 147 cm", slug: "kallax-2x4", qty: 1 }],
    buy: [{ name: "Furniture legs, 10 cm, with mounting plate", qty: 6, note: "Four go under the corners, two under the middle." }],
    mods: ["Pilot holes under the four corners and the middle."],
  },
  custom: {
    parts,
    steps: [
      ...grid.steps,
      {
        title: "Turn it upside down",
        detail: "Lay it on a blanket, bottom face up. Mark a leg in each of the four corners, 3 cm from the front or back edge and 3 cm from the side, and one at the front and back of the central divider.",
        tools: ["tape", "pencil"],
        pose: "-y",
        people: 2,
        warnings: ["two", "floor"],
      },
      { title: "Fix the leg plates", detail: "Hold each plate on its mark, drill a pilot hole for every screw, then drive them in.", fix: [{ kind: "plate", count: 6 }], tools: ["drill"] },
      { title: "Screw in the legs", add: legs.map((l) => l.id), fix: [{ kind: "legScrew", count: 6 }] },
      { title: "Stand it up", detail: "Lift it together and stand it on the legs. Check it doesn't rock.", pose: "+y", people: 2, warnings: ["two", "square"] },
    ],
  },
};
