import type { StepKind } from "./types";

export interface Faq {
  q: string;
  a: string;
}

const COMMON: Faq[] = [
  { q: "A part is missing or broken", a: "Note the number printed on the panel or the bag. IKEA stores and customer service usually replace small fittings for free, and you can keep building the steps that don't need it." },
  { q: "I think I did an earlier step wrong", a: "Open the overview, jump back to that step and watch it again. Most fittings come out easily if you haven't locked the cams yet." },
];

export const FAQ: Partial<Record<StepKind, Faq[]>> = {
  dowels: [
    { q: "The dowel won't go in", a: "Twist it while pushing, or tap it gently with a hammer. Don't force it sideways. If the hole has sawdust in it, blow it out first." },
    { q: "How far should dowels go in?", a: "About halfway. The other half goes into the next panel." },
    { q: "Do I need glue?", a: "No. The fit is tight on purpose. Glue makes it impossible to take apart later." },
  ],
  bolts: [
    { q: "How tight should the bolts be?", a: "Snug, then a little more. If the step says don't tighten fully yet, leave a few turns so the parts can still line up." },
    { q: "The bolt spins without tightening", a: "The thread may have stripped. Try the spare from the bag, or move the bolt slightly and turn it in slowly." },
  ],
  cams: [
    { q: "The cam lock won't turn", a: "Check the arrow on the cam points at the bolt hole before you turn. The bolt head must sit inside the cam's opening." },
    { q: "Which way do I turn it?", a: "Clockwise, about half a turn, until you feel it pull the panels together. Stop when it feels firm." },
    { q: "The panels still have a gap", a: "Push the panels together by hand while you turn the cam. If it still gaps, the bolt may not be screwed in far enough." },
  ],
  nails: [
    { q: "The nail keeps bending", a: "Hold it straight with a pair of pliers or a folded piece of cardboard, and use lighter taps." },
    { q: "How many nails do I use?", a: "Space them about every 15 cm along each edge. Start at the corners so the back stays square." },
  ],
  square: [
    { q: "The diagonals don't match", a: "Push gently on the corner of the longer diagonal until both measurements are equal. Then nail the back on straight away." },
    { q: "No tape measure?", a: "Use a piece of string. Hold it corner to corner, pinch it, and compare with the other diagonal." },
  ],
  flip: [{ q: "How do I turn it without breaking it?", a: "Keep it flat and lift by the sides, not the top. For anything tall, do this with a second person." }],
  standup: [{ q: "It feels wobbly once standing", a: "That's normal before it's against the wall. Check the floor is level and the back panel is fully nailed." }],
  shelves: [
    { q: "The shelf rocks", a: "One of the pins is in a different row. Count the holes from the top on each corner and match them." },
    { q: "Can I change shelf heights later?", a: "Yes. Lift the shelf out, move the four pins, and drop it back in." },
  ],
  anchor: [
    { q: "Do I really need to fix it to the wall?", a: "Yes for anything tall or with drawers. It stops it from tipping over, especially around children." },
    { q: "Which screws should I use?", a: "It depends on your wall. Plasterboard, brick and wood all need different plugs. A hardware store can match them if you bring the bracket." },
    { q: "I rent and can't drill", a: "Ask your landlord: most allow anchoring for safety. Some walls take adhesive anchors, but screws are always safer." },
  ],
  drawer: [
    { q: "The drawer bottom won't slide in", a: "Make sure the grooves line up on both sides. The bottom goes in shiny side up and slides along until it stops." },
    { q: "The drawer sticks or won't close", a: "Check the runners on both sides are at the same height and the open end faces the front." },
  ],
  runners: [{ q: "Which way round do the runners go?", a: "The wheel or open end goes to the front. Left and right are mirror images, so check the marks on each one." }],
  legs: [
    { q: "The table wobbles", a: "Loosen the wobbly leg a quarter turn, press the table down, then tighten again. Check the floor is level." },
    { q: "The leg won't screw in straight", a: "Back it out, line it up straight above the hole, and start turning gently. Don't force it if it catches." },
  ],
  doors: [
    { q: "The door gap is uneven", a: "Each hinge has small adjustment screws. The front one moves the door sideways, the back one moves it in and out." },
    { q: "The door won't stay closed", a: "Check both hinge arms clicked onto their plates. Press firmly until you hear the click." },
  ],
  hinges: [{ q: "The hinge doesn't sit flat", a: "Press the cup fully into the round hole before putting the screws in." }],
  slats: [{ q: "There are slats left over", a: "Check the spacing: they should be spread evenly. Some beds include a spare." }],
  join: [
    { q: "The panels don't line up", a: "Check the holes face each other and the finished edge points to the front." },
    { q: "It's hard to hold everything", a: "Lean the panels against a wall or ask someone to hold them for a minute." },
  ],
  screws: [
    { q: "The screw won't bite", a: "Push firmly while turning slowly. If it spins freely, the hole may be stripped: try the spare screw." },
    { q: "Can I use a drill?", a: "Only on the lowest setting, and finish by hand. Power tools strip the soft board easily." },
  ],
};

export function faqFor(kind: StepKind): Faq[] {
  return [...(FAQ[kind] ?? []), ...COMMON];
}
