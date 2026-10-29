import type { ProductSpec } from "../types";

/** A hand-written scan result, used by the dev-only mock and tests. A record player stand from a made-up brand. */
export const SAMPLE_SCAN: ProductSpec = {
  name: "LOOP",
  brand: "Nordwood",
  variant: "Record player stand",
  category: "Media stand",
  archetype: "custom",
  size: { w: 70, h: 66, d: 40 },
  minutes: 35,
  people: 1,
  difficulty: 2,
  source: "scan",
  custom: {
    parts: [
      { id: "S1", label: "1", name: "Side panel", size: [18, 660, 400], pos: [-341, 330, 0] },
      { id: "S2", label: "1", name: "Side panel", size: [18, 660, 400], pos: [341, 330, 0] },
      { id: "T", label: "2", name: "Top", size: [664, 18, 400], pos: [0, 651, 0] },
      { id: "M", label: "3", name: "Shelf", size: [664, 18, 380], pos: [0, 330, -10] },
      { id: "B", label: "4", name: "Bottom", size: [664, 18, 380], pos: [0, 60, -10] },
      { id: "D", label: "5", name: "Record divider", size: [18, 252, 380], pos: [0, 195, -10] },
      { id: "R", label: "6", name: "Back rail", size: [664, 80, 18], pos: [0, 602, -191] },
      { id: "P", label: "7", name: "Plinth", size: [664, 51, 18], pos: [0, 25.5, 191] },
    ],
    steps: [
      { title: "Tap the dowels into one side", detail: "Lay the side flat with the holes facing up.", fix: [{ kind: "dowel", count: 6, to: ["S1"] }], tools: ["hammer"], warnings: ["floor"] },
      { title: "Fit the top, shelf and bottom", detail: "Press each panel onto the dowels. The holes face the side.", add: ["S1", "T", "M", "B"], fix: [{ kind: "camScrew", count: 6 }], pose: "+z" },
      { title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it bites.", fix: [{ kind: "cam", count: 6, to: ["T", "M", "B"] }], pose: "+z" },
      { title: "Screw in the record divider", detail: "It sits in the middle of the bottom shelf.", add: ["D"], fix: [{ kind: "screw", count: 4, len: 30 }], pose: "+z" },
      { title: "Add the other side", add: ["S2"], fix: [{ kind: "dowel", count: 6 }, { kind: "camScrew", count: 6 }], pose: "+z" },
      { title: "Lock the other cams", fix: [{ kind: "cam", count: 6, to: ["S2"] }], pose: "+z" },
      { title: "Screw on the back rail", detail: "It keeps the stand from wobbling.", add: ["R"], fix: [{ kind: "screw", count: 4, len: 40 }], pose: "-z" },
      { title: "Fit the plinth", add: ["P"], fix: [{ kind: "dowel", count: 2 }], pose: "-z" },
      { title: "Stand it up", detail: "Lift from the top and set it down on all four corners.", pose: "+y" },
      { title: "Stick on the felt pads", fix: [{ kind: "glide", count: 4 }], pose: "+y" },
    ],
  },
};
