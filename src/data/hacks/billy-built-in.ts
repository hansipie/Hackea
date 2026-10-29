import type { CustomPart, CustomStep, ProductSpec } from "@/lib/types";
import { billyFrame, boundsCm } from "./parts";

const UNITS = [
  { prefix: "a", cx: -800, name: "first" },
  { prefix: "b", cx: 0, name: "middle" },
  { prefix: "c", cx: 800, name: "last" },
] as const;

const units = UNITS.map((u) => ({ ...u, ...billyFrame(u.prefix, u.cx) }));

// a board across the fronts of the tops, 15 cm tall: it hides the gaps between the units and ties them together
const TRIM: CustomPart = { id: "trim", label: "E", name: "Trim board", size: [2400, 150, 18], pos: [0, 2020 - 75, 140 + 9], material: "wood" };

const parts: CustomPart[] = [...units.flatMap((u) => [...u.frame, ...u.shelves]), ...units.map((u) => u.back), TRIM];

const buildSteps = (): CustomStep[] =>
  units.flatMap((u): CustomStep[] => [
    { title: `Build the ${u.name} frame`, detail: "Follow the BILLY manual for the frame, but leave the back panel in the box for now.", add: u.ids.frame, fix: [{ kind: "dowel", count: 8 }, { kind: "camScrew", count: 4 }], people: 2 },
    { title: `Fit the ${u.name} shelves`, add: u.ids.shelves, fix: [{ kind: "pin", count: 16 }] },
  ]);

export const billyBuiltIn: ProductSpec = {
  slug: "hack-billy-built-in",
  name: "BILLY built-in bookcase",
  variant: "Three units and a trim, 240 cm wide",
  category: "Bookcase",
  archetype: "custom",
  size: boundsCm(parts),
  minutes: 240,
  people: 2,
  difficulty: 2,
  material: "Particleboard, fibreboard back",
  source: "catalog",
  watchOut: [
    "Measure the wall before you buy: the three units are 240 cm wide and 202 cm tall, and the trim adds a few millimetres in front.",
    "Join the units while they lie flat on the floor, with their fronts level, then stand the whole run up together.",
    "Fix the run to the wall with the anti-tip fittings. It is tall and heavy once the shelves are full.",
  ],
  hack: {
    summary: "Three BILLY side by side, screwed into one run and hidden behind a trim board: a built-in wall of shelves.",
    base: [{ name: "BILLY bookcase, 80 × 202 cm", slug: "billy-80x202", qty: 3 }],
    buy: [
      { name: "Trim board, 240 × 15 cm, 18 mm thick", qty: 1, note: "Cut to 2400 mm if it is longer." },
      { name: "Wood screws, 4 × 40 mm", qty: 12, note: "Six through each pair of neighbouring side panels." },
      { name: "Wood screws, 4 × 30 mm", qty: 12, note: "For the trim board." },
      { name: "Wall brackets for tall furniture", qty: 2 },
    ],
    mods: ["Twelve pilot holes through the side panels where two units meet.", "The trim board is cut to the width of the run."],
  },
  custom: {
    parts,
    steps: [
      ...buildSteps(),
      {
        title: "Screw the units together",
        detail: "Line up the three units with their fronts level. Clamp each pair, drill six pilot holes through the touching side panels, and drive the 4 × 40 mm screws. Keep the screws clear of the shelf pin holes.",
        tools: ["drill", "level"],
        people: 2,
        warnings: ["square", "two"],
      },
      { title: "Nail on the backs", detail: "Square each unit with the back panel as you nail it. It is what keeps the run from racking.", add: units.map((u) => u.back.id), fix: [{ kind: "nail", count: 36 }], tools: ["hammer"], warnings: ["square"] },
      { title: "Fit the trim", detail: "Hold the board across the fronts of the tops, flush with the top edge, and screw it into the front edge of every unit.", add: ["trim"], fix: [{ kind: "screw", count: 12 }], tools: ["drill", "level"] },
      { title: "Stand it up and fix it to the wall", detail: "Lift the run together, push it against the wall and fix the brackets through the trim into the wall.", fix: [{ kind: "bracket", count: 2 }], tools: ["drill", "level"], people: 2, warnings: ["two", "wall"] },
    ],
  },
};
