import type { CustomPart, ProductSpec } from "@/lib/types";
import { boundsCm, kallaxGrid } from "./parts";

const grid = kallaxGrid(2, 2);
const [W, , D] = grid.size;
const DOOR_T = 18;

// two doors across the whole bottom row, hung on the outside of the side panels
const doors: CustomPart[] = [
  { id: "door-l", label: "E", name: "Door", size: [W / 2, 385, DOOR_T], pos: [-W / 4, 385 / 2, D / 2 + DOOR_T / 2], material: "board" },
  { id: "door-r", label: "E", name: "Door", size: [W / 2, 385, DOOR_T], pos: [W / 4, 385 / 2, D / 2 + DOOR_T / 2], material: "board" },
];

const parts = [...grid.parts, ...doors];

export const kallaxDoors: ProductSpec = {
  slug: "hack-kallax-cabinet-doors",
  name: "KALLAX cabinet with doors",
  variant: "Two doors on the bottom row, 2 × 2",
  category: "Cabinet",
  archetype: "custom",
  size: boundsCm(parts),
  minutes: 60,
  people: 1,
  difficulty: 2,
  material: "Particleboard, fibreboard",
  source: "catalog",
  watchOut: [
    "Hinge screws only hold in the solid frame around the edge of the KALLAX panels. Put them within a few centimetres of the front edge of the side panel, never in the middle of a hollow board.",
    "Doors this size are light, but let the hinges rest on an even edge: shim the unit level before you hang them.",
  ],
  hack: {
    summary: "A KALLAX 2 × 2 with two doors over the bottom row: closed storage below, open cubbies above.",
    base: [{ name: "KALLAX shelving unit, 77 × 77 cm", slug: "kallax-2x2", qty: 1 }],
    buy: [
      { name: "Door panels, 38.5 × 38.5 cm, 18 mm thick", qty: 2, note: "Cut to size at a hardware store, or from a larger board." },
      { name: "Flat hinges", qty: 4 },
      { name: "Knobs", qty: 2 },
    ],
    mods: ["Eight pilot holes in the side panel edges for the hinges."],
  },
  custom: {
    parts,
    steps: [
      ...grid.steps,
      { title: "Hang the left door", detail: "Hold the door flush with the bottom and the left edge. Screw the hinges to the door first, then to the front edge of the left side panel.", add: ["door-l"], fix: [{ kind: "hinge", count: 2, to: ["left"] }], tools: ["drill", "screwdriver"], warnings: ["hand"] },
      { title: "Hang the right door", detail: "Leave 2 mm between the two doors so they don't rub.", add: ["door-r"], fix: [{ kind: "hinge", count: 2, to: ["right"] }], tools: ["drill", "screwdriver"] },
      { title: "Fit the knobs", detail: "Put a knob in the middle of each door, level with the other.", fix: [{ kind: "knob", count: 1, to: ["door-l"] }, { kind: "knob", count: 1, to: ["door-r"] }], tools: ["screwdriver", "pencil", "tape"] },
    ],
  },
};
