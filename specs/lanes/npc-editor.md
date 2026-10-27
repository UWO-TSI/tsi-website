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

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/npc-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
