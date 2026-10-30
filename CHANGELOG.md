# Changelog

All notable changes to Hackea. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-30

### Added

- Library search in the editor: hovering a result, in Furniture or Parts, shows a line drawing of the piece or part.

## [0.1.0] - 2026-10-30

First release, built on [Bygga](https://github.com/Nutlope/bygga) (MIT). See [NOTICE](NOTICE).

### Added

- Hacks: guides that combine and modify IKEA pieces, written as `custom` products with a `hack` block, played step by step in the 3D engine (`npm run hacks:check`).
- The hack editor at `/hacks/new`, a 3D workspace with a library panel, a toolbar (select, move, resize, turn, duplicate, snap, undo and redo, four views, full screen) and an inspector for each part. Assembly steps are worked out from where the parts are.
- Groups in the editor: a piece of furniture added from the library arrives as one group, which selects, moves, turns, copies and deletes together. Parts can be grouped (Ctrl+G), added to or taken out of a group, and ungrouped (Ctrl+Shift+G); a group has a name and is saved with the hack.
- Starting points for a build: a KALLAX grid, BILLY bookcases, a blank board, a copy of a curated hack, or pieces and single parts picked from the library.
- Search by size: furniture and individual parts are found by height, width and depth, on the library pages and in the editor.
- Hacks from a photo (`/api/hack-photo`), with the proposed guide opened in the editor afterwards.
- Import and export of hacks as `.hackea.json`, and share links that carry the whole hack. Anything from outside is read strictly by `src/lib/hacks/sanitize.ts`.
- An offline catalog of IKEA products with a parametric plan generator, line-art 3D stage, A4 print view, share cards and a service worker.
- A single voice (OpenAI Marin) for recorded clips and live speech, with listening for "next".
- OpenAI features on each visitor's own key: drafts for products not in the catalog, photo lookup and a help chat, using the newest model for each task.

### Changed

- The home page leads with hack creation and one large hack view.
- The logo colors are inverted.
- Beds, sofas, chairs, stools, hat and coat stands, clothes stands and outdoor benches are left out of the catalog.

[0.2.0]: https://github.com/hansipie/Hackea/releases/tag/v0.2.0
[0.1.0]: https://github.com/hansipie/Hackea/releases/tag/v0.1.0
