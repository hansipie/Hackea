import type { CustomPart, ProductSpec } from "@/lib/types";
import { billyFrame, boundsCm } from "./parts";

// one BILLY with a clothes rail under the top and a single shelf for shoes
const billy = billyFrame("a", 0, 1);
// the only shelf goes low down, for shoes
const shoes: CustomPart = { ...billy.shelves[0], pos: [0, 400, -10] };
const RAIL_Y = 1800;

// two plates screwed to the inside of the sides, each with a cup for the rail
const holders: CustomPart[] = [
  { id: "holder-l", label: "E", name: "Rail holder", size: [6, 40, 40], pos: [-(385 - 3), RAIL_Y, 0], material: "metal" },
  { id: "holder-r", label: "E", name: "Rail holder", size: [6, 40, 40], pos: [385 - 3, RAIL_Y, 0], material: "metal" },
];
const rail: CustomPart = { id: "rail", label: "F", name: "Clothes rail", size: [758, 20, 20], pos: [0, RAIL_Y, 0], shape: "cyl", material: "metal" };

const parts = [...billy.frame, shoes, billy.back, ...holders, rail];

export const billyOpenWardrobe: ProductSpec = {
  slug: "hack-billy-open-wardrobe",
  name: "BILLY open wardrobe",
  variant: "With a clothes rail, 80 cm",
  category: "Wardrobe",
  archetype: "custom",
  size: boundsCm(parts),
  minutes: 75,
  people: 2,
  difficulty: 1,
  material: "Particleboard, fibreboard back",
  source: "catalog",
  watchOut: [
    "The rail carries the weight of your clothes on two small plates. Use screws long enough to bite into the side panels without coming through.",
    "Fix the bookcase to the wall: it is tall, and a rail full of clothes makes it top-heavy.",
  ],
  hack: {
    summary: "A BILLY with the shelves taken out and a clothes rail hung under the top: an open wardrobe for a small room.",
    base: [{ name: "BILLY bookcase, 80 × 202 cm", slug: "billy-80x202", qty: 1 }],
    buy: [
      { name: "Clothes rail, 20 mm round, 75 cm", qty: 1, note: "Cut a longer rail to 758 mm." },
      { name: "Rail holders with cups", qty: 2 },
      { name: "Wall bracket for tall furniture", qty: 1 },
    ],
    mods: ["Four pilot holes in the sides for the rail holders.", "The rail is cut to length if needed."],
  },
  custom: {
    parts,
    steps: [
      { title: "Build the frame", detail: "Follow the BILLY manual for the frame. Keep one shelf for shoes and put the others aside.", add: billy.ids.frame, fix: [{ kind: "dowel", count: 8 }, { kind: "camScrew", count: 4 }], people: 2 },
      { title: "Fit the shoe shelf", add: [shoes.id], fix: [{ kind: "pin", count: 4 }] },
      { title: "Nail on the back", detail: "Square the frame with the back panel as you nail it.", add: [billy.back.id], fix: [{ kind: "nail", count: 18 }], tools: ["hammer"], warnings: ["square"] },
      { title: "Fix the rail holders", detail: "Mark both holders at the same height, 20 cm under the top, drill pilot holes and screw them to the inside of the sides.", add: holders.map((h) => h.id), fix: [{ kind: "screw", count: 4, len: 16 }], tools: ["tape", "pencil", "drill", "level"] },
      { title: "Place the rail", detail: "Slide the rail into the cups and check that it sits level.", add: ["rail"] },
      { title: "Fix it to the wall", detail: "Stand it against the wall and fix the bracket to the top.", fix: [{ kind: "bracket", count: 1 }], tools: ["drill", "level"], warnings: ["wall"] },
    ],
  },
};
