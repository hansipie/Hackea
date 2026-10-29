<h1 align="center">Hackea</h1>

<p align="center">Turn IKEA furniture into something new. Each hack lists what to buy and what to change, then plays every step in 3D, drawn like the paper manual and read out loud.</p>

Hackea is built on [Bygga](https://github.com/Nutlope/bygga) (MIT), the open source IKEA assembly guides. It keeps Bygga's 3D engine, voice and offline catalog, and adds hacks: guides that combine and modify IKEA pieces. See [NOTICE](NOTICE).

## Hacks

A hack is a product of the `custom` archetype (`src/lib/plan/custom.ts`) plus a `hack` block, written in `src/data/hacks/` and listed in `src/data/hacks/index.ts`:

- `custom.parts`: every part as a box or cylinder in the finished piece (mm, y up from the floor), and `custom.steps`: which parts each step adds and which fittings (dowels, screws, plates, leg screws) it fixes. The engine works out where each fitting goes, which way parts arrive from and which tools a step needs. A step can also turn the piece over (`pose`).
- `hack`: a summary, the IKEA products it starts from (with a link to their own guide when the catalog has it), what else to buy, and what is changed on the original pieces (cuts, holes).
- `watchOut`: what can go wrong, shown on the cover.

Hacks resolve through `catalogSpec()` in `src/lib/catalog.ts`, so they work on every page a catalog guide does: the guide, the print view, saved progress. Check them with `npm run hacks:check`.

### Making your own: the hack editor

`/hacks/new` ("Make one") lets anyone design a piece of furniture from the library without writing code. Pick one or several pieces (side by side or stacked), or single parts of them, and each arrives as the parts it is made of, converted from the same generated plans as the library pages (`src/lib/hacks/library.ts`). Then move a piece, take it out, edit any part, add boards, and set the build order and fittings if you want them. A KALLAX grid, BILLY bookcases, a blank board or a copy of a curated hack are other ways in. The 3D preview is the guide's own engine and stage, rebuilt a moment after each change, and the same checks as `hacks:check` (`src/lib/hacks/check.ts`) list what to fix, with the size always worked out from the parts.

- No server, no accounts: hacks are saved in the browser's localStorage (`src/lib/hacks/store.ts`), or kept for the tab when storage is blocked. They can be duplicated, deleted, exported and imported as `.hackea.json` files, or shared as a link that carries the whole hack in its hash (`/build/mine-<id>#h=...`).
- They open at `/build/mine-<id>` in the normal guide, marked "Yours, unverified", with the safety note that dimensions are approximate and must be measured before drilling or cutting.
- Anything from outside (a file, a pasted JSON, a link, even this browser's own storage) goes through `src/lib/hacks/sanitize.ts`: known fields only, strict types, numeric bounds, at most 120 parts and 40 steps, length limits on every text, and product links only to products the catalog has. Nothing from it is rendered as HTML.
- To turn a hack made in the editor into a curated one, check its exported file with `npm run hacks:validate -- file.hackea.json`, then write it in `src/data/hacks/`.

## Tech stack

- Next.js 16 (App Router, Cache Components), React 19 and TypeScript, plain CSS with Motion, no UI kit
- A three.js line-art stage (`src/engine`) and a parametric plan generator (`src/lib/plan`) that draw 1,171 IKEA products (2,180 sizes, UK and US ranges) offline, built from IKEA's public listings (`scripts/ikea`)
- An AI-generated OpenAI Marin voice for live speech and recorded clips, with OpenAI transcription listening for "next" through an echo-cancelled mic (`/api/listen`, `hearIntent` in `src/lib/voice/commands.ts`)
- [OpenAI](https://openai.com/) on each visitor's own key (`src/components/KeyModal.tsx`): drafts for products we don't have, photo lookup, and a help chat
- Share cards drawn by the same engine (`scripts/og/render.mjs`), an A4 print view, and a service worker so opened guides work with no signal

## Running

1. `npm install`, then `npm run dev` and open http://localhost:3000
2. Hacks: http://localhost:3000/hacks
3. Try the AI parts: `cp .env.example .env.local`, set `OPENAI_API_KEY`, then paste `hackea-dev-mock-key-000000` into the app's key box. The server swaps in your `OPENAI_API_KEY`, and only `npm run dev` accepts the mock key.
4. Checks: `npm run hacks:check` (curated hacks, plus the editor's import and templates), `npm run ikea:check`, `npm run voice:check`
5. Before pushing: `npm run lint && npm run build`

Set `NEXT_PUBLIC_SITE_URL` in production (share cards and the sitemap use it) and `NEXT_PUBLIC_GITHUB_REPO` to show the star button.

## Roadmap

- [ ] more hacks, to test that the format holds
- [ ] a French interface and voice (today everything is English)
- [ ] replace the remaining Bygga artwork (home page comparison, share card images)
- [x] an editor to combine pieces without writing a hack by hand (`/hacks/new`)

## License

MIT, see [LICENSE](LICENSE). Hackea is not affiliated with IKEA: IKEA and its product names are trademarks of Inter IKEA Systems B.V., and the license grants no rights in them (see [NOTICE](NOTICE)).

### OpenAI voice assets

Run `npm run voice -- --dry` to estimate the recording budget, then `npm run voice` with `OPENAI_API_KEY` set to generate clips under `public/voice/marin`. Recording logs are kept in `scripts/voice/clips-marin.json`. Existing clips from another voice are not used. Until Marin clips are generated, speech requires the visitor's OpenAI key and an internet connection. Optional name respellings can be generated with `npm run voice:names`.

Text and photo requests use `gpt-4.1-mini`; scan planning uses `gpt-4.1`. Each can be overridden with the model lists in `.env.example`. Transcription uses `gpt-transcribe`.

Speech uses the existing MP3 workflow with `gpt-4o-mini-tts`. OpenAI [documents its shutdown on January 6, 2027](https://developers.openai.com/api/docs/guides/text-to-speech); moving speech to Realtime will be required before that date. Transcription follows the [OpenAI file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text).

Run `npm run ai:check` for provider contract checks using mocked HTTP responses, without spending API credits.

### Make a guide from a hack photo

Open `/hacks/new` (also linked from the home page), choose a JPEG, PNG or WebP photo and optionally add known family names or measurements. Add your OpenAI key, analyze the image, then confirm catalogue variants and quantities before generating. The proposed guide opens in the existing 3D viewer; its editor, export and sharing tools remain available.

The `/api/hack-photo` endpoint first extracts search queries from the photo, retrieves candidates from the local IKEA catalogue and asks the vision model to match only those IDs. Generation resolves confirmed IDs again on the server and builds stock geometry using `src/lib/plan`. Stock sizes and references cannot be replaced by model output. IKEA base units link to their own generated assembly guides; the combined hack shows each assembled unit followed by modification steps. Added boards, legs and fittings are estimates listed separately, with checks for hidden details. This is a proposed reconstruction, not proof of the original hack's construction or load capacity.

Photos are resized locally and not stored by the app. Only a validated draft is saved in the browser. Run `npm run photo:check` for catalogue grounding and API tests with mocked provider responses.
