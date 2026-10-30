export type From = "furniture" | "photo" | "json";

/** The four ways to begin a hack, in the order they are offered. "empty" starts at once; the others open their form. */
export const STARTS: { id: "empty" | From; title: string; text: string }[] = [
  { id: "empty", title: "Empty project", text: "A blank workspace: add boards and blocks yourself." },
  { id: "furniture", title: "Existing furniture", text: "One or several pieces from the library, as their parts." },
  { id: "photo", title: "Photo or diagram", text: "A picture of a hack, turned into a build." },
  { id: "json", title: "JSON import", text: "A file exported from Hackea." },
];

export const isFrom = (v: string | null): v is From => v === "furniture" || v === "photo" || v === "json";
