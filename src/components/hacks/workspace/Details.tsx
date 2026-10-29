"use client";

import { LIMITS, type HackDraft } from "@/lib/hacks/draft";
import * as E from "@/lib/hacks/edit";
import { IPlus, ITrash } from "../../art/Icons";
import { Num, Pick, Text } from "../fields";

type Edit = (f: (d: HackDraft) => HackDraft | null, fail?: string) => void;

interface Props {
  draft: HackDraft;
  set: (patch: Partial<HackDraft>) => void;
  edit: Edit;
}

/** What the guide says about the build: its name, summary, what it is made from, what to buy, what to watch. */
export default function Details({ draft, set, edit }: Props) {
  return (
    <div className="wk-pane wk-details">
      <section className="hx-sec" id="hx-about" aria-labelledby="hx-about-h">
        <h2 id="hx-about-h" className="hx-h2">
          About your build
        </h2>
        <Text label="Name" value={draft.name} max={LIMITS.name} required onChange={(name) => set({ name })} placeholder="KALLAX bench" />
        <Text label="One line under the name" value={draft.variant} max={LIMITS.variant} onChange={(variant) => set({ variant })} placeholder="Laid down on legs, 147 cm" />
        <Text label="What it is" value={draft.category} max={LIMITS.category} onChange={(category) => set({ category })} placeholder="Bench" hint="A word or two: bench, sideboard, wardrobe." />
        <Text label="Summary" value={draft.summary} max={LIMITS.summary} required multiline onChange={(summary) => set({ summary })} hint="What you start from and what it becomes, in a sentence or two." />
        <div className="hx-row3">
          <Num label="Time" unit="min" value={draft.minutes} min={LIMITS.minutes[0]} max={LIMITS.minutes[1]} int onChange={(minutes) => set({ minutes })} />
          <Pick label="People" value={draft.people} options={[{ id: 1, label: "One" }, { id: 2, label: "Two" }]} onChange={(people) => set({ people: people as 1 | 2 })} />
          <Pick label="Level" value={draft.difficulty} options={[{ id: 1, label: "Easy" }, { id: 2, label: "Medium" }, { id: 3, label: "Patient" }]} onChange={(difficulty) => set({ difficulty: difficulty as 1 | 2 | 3 })} />
        </div>
      </section>

      <ListSection
        title="Made from"
        hint="What the build uses, kept up to date as you add from the library. Edit the names and counts, or add something the library does not have."
        items={draft.base}
        max={LIMITS.base}
        onAdd={() => edit((d) => E.addBase(d), `${LIMITS.base} pieces at most.`)}
        onChange={(base) => set({ base })}
        render={(b, upd) => (
          <>
            <Text label="Piece" value={b.name} max={LIMITS.variant} required onChange={(name) => upd({ ...b, name })} hint={b.slug ? "Links to its own guide" : undefined} />
            <Num label="How many" value={b.qty} min={1} max={LIMITS.qty} int onChange={(qty) => upd({ ...b, qty })} />
          </>
        )}
      />
      <ListSection
        title="Also buy"
        hint="Everything else it needs, from IKEA or elsewhere: legs, hinges, boards cut to size."
        items={draft.buy}
        max={LIMITS.buy}
        onAdd={() => edit(E.addBuy, `${LIMITS.buy} at most.`)}
        onChange={(buy) => set({ buy })}
        render={(b, upd) => (
          <>
            <Text label="What" value={b.name} max={LIMITS.variant} required onChange={(name) => upd({ ...b, name })} />
            <Num label="How many" value={b.qty} min={1} max={LIMITS.qty} int onChange={(qty) => upd({ ...b, qty })} />
            <Text label="Note" value={b.note ?? ""} max={LIMITS.line} onChange={(n) => upd({ ...b, note: n || undefined })} />
          </>
        )}
      />
      <ListSection
        title="What you change"
        hint="Cuts, holes, sanding: anything done to the original pieces. Leave it empty if nothing is modified."
        items={draft.mods}
        max={LIMITS.mods}
        onAdd={() => edit((d) => E.addLine(d, "mods"), `${LIMITS.mods} at most.`)}
        onChange={(mods) => set({ mods })}
        render={(m, upd, i) => <Text label={`Change ${i + 1}`} value={m} max={LIMITS.line} onChange={upd} />}
      />
      <ListSection
        title="Watch out"
        hint="Safety notes for the cover: loads, wall fixing, hollow panels."
        items={draft.watchOut}
        max={LIMITS.watchOut}
        onAdd={() => edit((d) => E.addLine(d, "watchOut"), `${LIMITS.watchOut} at most.`)}
        onChange={(watchOut) => set({ watchOut })}
        render={(m, upd, i) => <Text label={`Note ${i + 1}`} value={m} max={LIMITS.line} onChange={upd} />}
      />
    </div>
  );
}

function ListSection<T>({
  title,
  hint,
  items,
  max,
  onAdd,
  onChange,
  render,
}: {
  title: string;
  hint: string;
  items: T[];
  max: number;
  onAdd: () => void;
  onChange: (v: T[]) => void;
  render: (item: T, upd: (v: T) => void, i: number) => React.ReactNode;
}) {
  const hid = "hx-" + title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section className="hx-sec" aria-labelledby={hid}>
      <h2 id={hid} className="hx-h2">
        {title}
      </h2>
      <p className="hx-hint">{hint}</p>
      {items.length > 0 && (
        <ul className="hx-rows">
          {items.map((it, i) => (
            <li key={i} className="hx-row">
              {render(it, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}
              <button type="button" className="btn round small hx-del" aria-label={`Remove ${title.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <ITrash size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn link inline" disabled={items.length >= max} onClick={onAdd}>
        <IPlus size={15} /> Add {items.length ? "another" : "one"}
      </button>
    </section>
  );
}
