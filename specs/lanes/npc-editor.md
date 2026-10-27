# Lane: npc-editor (David customises every resident: who, where, what they do, how they look)

Worktree `.claude/worktrees/npc-editor`, branch `game/npc-editor`, cut from `game/fit-editor` at 726421be (so it has Face Fit's artifact bundle tooling: `specs/tools/fit-editor/`, the game's character code bundled for a claude.ai artifact, the CSP-safe model loading and `check.mjs`'s emulated frame). Agent type `uwotsi-lane`.

David, 2026-10-27, verbatim: "make a artifact for me to customize all the npc, what they do where they are and their looks etc"

**The data:** every resident (Alice the HQ lead, Mayor Eliza, Toren, Odile, Bram, Sable, Pim, Juniper, Marlo, Nell, the sushi chef and server, Jayden, the new-world staff, and anyone else): `web/lib/content/residentRoster.ts` (`RESIDENT_LOOKS`, `RESIDENT_TALK`, `PROPOSED_RESIDENTS`), the prod table `npc_personas` (seeded through `web/lib/seedMigrations.ts` and `gen-seeds.mjs`: display_name, post, bio, tone, schedule, canned_dialogue, talk), `web/lib/game/keepers.ts` (posts and stations), `web/lib/game/residentRoutine.ts` and `residentSpace.ts` (where a schedule's places are in each world), and `web/lib/npc/`. Find every source a resident's name, look, lines, schedule and post come from, in the new world.

**The page** (a claude.ai artifact the coordinator publishes; build it the way Face Fit is built, reusing its build script and loader, with its own entry):
- A list of every resident with a live 3D portrait (the game's own Character), searchable.
- Per resident, editable:
  - **Name and role:** display name, title/post, bio, tone. Internal ids stay.
  - **Look:** the creator's own options (skin, hair and hair colour, face, outfit pieces, accessories), drawn live on the 3D character, turnable by drag like Face Fit's Look around view.
  - **Where and when:** their schedule by time of day (dawn, day, evening, night), each a list of places from the world's real place names, plus their home. Show the places on a small top-down map of the new world (the minimap's own drawing), with a pin per place.
  - **What they say:** their idle lines and their talk sets (the conversations), editable as text, each with an add and a remove. The mood tags the game already uses (`[happy]` and so on) stay as written.
  - Show the current value beside a changed one, a per-field reset, and a "changed" badge per resident.
- Saves to the page's db, collection `residents`, one doc per resident slug, holding only the fields he changed.
- It must work in the artifact frame like Face Fit: no data: or blob: fetches, no WebAssembly, only served file types, an error line, error boundaries. Pass the emulated-frame check.

**The apply script:** `web/scripts/apply-residents.mjs <export.json>`. It writes his values into the roster source(s) and regenerates the seed migration with `gen-seeds.mjs` (never edit an applied migration). It refuses unknown slugs, places, parts or empty names. Real names never show in game: residents' names are fictional. Test it on a sample. The coordinator exports, applies and ships.

**Read first:** `specs/lanes/fit-editor.md` (Status: how the bundle and its frame check work), `CODEMAP.md` row "Villagers", the files above.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, the frame check. Message "main" when the folder is ready to publish (path, file list or which files changed, size, what you checked), then stop.

## Status

**Ready to publish (2026-10-27).** Code at 00376496; this lane-file commit is the head. Main merged at 71a43b41 (Alice).
- Gates: web tsc clean; both editor pages tsc clean (scratch tsconfig); eslint clean on the changed web files; vitest 3502 passed (4 skipped) with and without NEXT_PUBLIC_GAME_WORLD=new; npc-editor check.mjs PASS. Face Fit after the frame move: rebuilt, its check.mjs failed only its "saves once after a burst" counts, differently on two runs (the clicks land over 300 ms apart with swap at 11 GB), with the right final values; its Editor.tsx diff is only the two import lines.
- **Place fix (own commit 2f772f42, coordinator: "fix the root cause for the new world only"):** world.json has no `anchor` objects, so every schedule place but plaza (the spawn), home and bench was skipped. `residentRoutine.ts placeAt(key, v)`: the anchor object; on a terrain world the landmark of the same name (a building's exit step, the wharf's landing, the plaza's or beach's middle, the temple only once DROPS.oracle opens); the village unchanged. pond and path have no landmark: skipped until David places anchors in /lab/map. Tests in residentRoutine.test.ts on the shipped world.
- **Sources (web/scripts/residentSources.ts, shared by the page and the script):** the roster (`residentRoster.ts` PROPOSED_RESIDENTS: name, post, bio, tone, schedule, idle lines; RESIDENT_TALK; RESIDENT_LOOKS), Rosa (`cafe.ts` CAFE_OWNER name, look, lines; SWEEPER_LINES), the sushi chef and server (`sushiBar.ts` CHEF_LOOK, SERVER_LOOK, look only). Names also live in `welcome.ts` HQ_LEAD (and its copy of the HQ lead's look), `arrival/hq/lines.ts` WREN, `arrival/lines.ts` BRAM: the apply script keeps them in step. Prod: names, posts, bios, tones, schedules, lines and talk come from npc_personas rows (seeded); looks only from RESIDENT_LOOKS. Jayden (applicant island, recruitment code) is off the page (coordinator).
- **Page:** `specs/tools/npc-editor/` (Editor.tsx, index.html `<title>Residents</title>`, check.mjs). Built by `node specs/tools/fit-editor/build.mjs npc-editor` (build.mjs now takes the tool folder; Face Fit's frame code moved to `specs/tools/fit-editor/frame.tsx`, imported by both). dist: `specs/tools/npc-editor/dist/` (gitignored), about 223 files, 29 MB, editor.js 1.9 MB, plus `data/world/{height,surface}.png` for the map. Publish with `capabilities: {"db": {}}`; collection `residents`, one doc per slug, only the changed fields (a doc reset to the source is deleted).
- **Apply:** `node scripts/apply-residents.mjs <export.json>` from web/: checks every doc (unknown slug, field, place, building, time of day, part, empty name, talk limits refuse the whole export), writes only the changed values into the TS sources with the TypeScript AST (comments and layout elsewhere stay), runs gen-seeds (a new migration; tried on two samples and reverted), then lists every string in lib/ and components/ that still says an old name, to reword by hand (story lines like "I'm Alice").
- check.mjs PASS (frame CSP, sandboxed second origin, stand-in db, storage refused): 13 residents, Alice listed, a saved doc read, a name burst saves once alone, reset deletes the doc, an empty name flagged, a hairstyle redraws the 3D view and saves the look, a colour saves, the pond marked skipped, a place adds a pin, a conversation saves, search, the chef look-only, Rosa's out-front lines and no schedule, no db says it can't save, no sideways scroll at 1280 and 390. Evidence: `specs/evidence/npc-editor/`.

## David's decisions

- 2026-10-27 (via the coordinator): the HQ lead is Alice (slug `wren`), no surname; Jayden stays off; Rosa, the chef and the server are in, chef and server look only; fix new-world places for the new world only.

## Next

1. Report to the coordinator. After David edits: the coordinator exports collection `residents` and runs `node scripts/apply-residents.mjs <export.json>` from web/, rewords the listed old-name lines, ships the new migration.

## Tools and gotchas

- Build and check are separate calls, each under `withlock.sh devserver` (never chained).
- Typecheck the pages: scratch tsconfig extending web/tsconfig.json with `files` [both Editor.tsx], `typeRoots` and `paths` (`@/*` to web, `*` to web/node_modules/@types then web/node_modules).
- Never run a sample apply and then `git checkout lib/` blindly: it reverts your own edits in lib/ too.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/npc-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
