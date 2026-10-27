# Lane: catalogue-editor (David edits every catchable and forageable thing on one page)

Worktree `.claude/worktrees/catalogue-editor`, branch `game/catalogue-editor`, cut from main at e694d5f0. Agent type `uwotsi-lane`.

David, 2026-10-27, verbatim: "I want you to do artifat for all foraging model related, like all types of fish where i can edit rarity and price sold, and a bar to edit like what time it shows, which biome, etc, same with bug, fruit, etc"

**The data:** the launch species roster `web/lib/collections/roster.ts` (fish, sea creatures, bugs, fruit, nature: shells, mushrooms and flowers, and minerals): biome, tool, rarity, size, hours, months, weather, rainAnyHour, oneLiner, icon, model. It's seeded into the database through `web/lib/seedMigrations.ts` and `web/scripts/gen-seeds.mjs`. Find where the **sell price** comes from (a per-species value or a rarity table in `lib/collections/` or `lib/wallet/`) and where the server reads rarity, hours and biome (catch rolls: `lib/collections/rolls.ts`, the realtime server, `20260929100000_catch_rolls.sql`), so an edit lands everywhere the game uses it.

**The page** (a claude.ai artifact the coordinator publishes; you build it as a static folder):
- Tabs per kind: Fish, Sea creatures, Bugs, Fruit, Shells / mushrooms / flowers, Minerals. Each item shows its icon (the game's own icon files, or a render of its model where there's no icon), name and one-liner. Add a search box.
- Per item, editable:
  - **Rarity:** the game's five tiers.
  - **Sell price:** coins.
  - **Time:** a 24-hour bar he drags to set when it shows ("all day" a toggle; windows that wrap past midnight work).
  - **Months:** 12 toggles, plus "all year".
  - **Biome:** the game's biome list.
  - **Weather:** chips, plus "any".
  - **Rain any hour.**
  - **Size range:** for fish and the like.
  - Any other per-species field the game really uses.
  - Show the current value beside any changed one, and a per-item reset.
- Saves to the page's db: `const db = await window.claude.use("db")` (null: say it can't save). One doc per species key in collection `species`, holding only the fields he changed. It reads them on load. A "changed" badge per item and a count per tab.
- It must work inside the artifact frame: its CSP allows only the page's own files for fetch (no `data:` or `blob:` fetches, no WebAssembly). Images in `<img>` can be the page's own files or `data:` URIs. Theme tokens for light and dark, works at 390 px, no horizontal scroll, every file a served type (.html .js .json .png .webp ...). Check it headless in the emulated frame the way `specs/tools/fit-editor/check.mjs` (on game/fit-editor) does: a CSP header, a sandboxed iframe from a second origin, storage refused.

**The apply script:** `web/scripts/apply-species.mjs <export.json>` writes his values into `roster.ts` (and the price source), checks every value (known keys, tiers, biomes, hours 0 to 24, months 1 to 12, prices above 0), and regenerates the seed migration with `gen-seeds.mjs` (never edit an applied migration). Test it on a sample. The coordinator exports the db, runs it, applies the migration to prod and ships.

**Build:** a script at `specs/tools/catalogue-editor/build.mjs` writes `specs/tools/catalogue-editor/dist/` (gitignored) from the roster, so the page always shows the game's current values. Plain HTML and JS are fine; no framework is needed unless you're reusing one.

**Read first:** `CODEMAP.md` rows "Forage, bugs, trees, collections", "Fishing", "Economy"; `web/lib/collections/roster.ts`, `seed.ts`, `rolls.ts`; `web/lib/seedMigrations.ts`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new` (the roster and seed tests), tsc, eslint, the headless page check. Message "main" when the folder is ready to publish (path, file list, size, what you checked), then stop.

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/catalogue-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
