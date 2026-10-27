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

Head: see `git log -1` on game/catalogue-editor (the lane file commit after 0c9c9495). Ready to publish; reported to main.

Done:
- **The page:** `specs/tools/catalogue-editor/{index.html,app.js,build.mjs,check.mjs}`. `node specs/tools/catalogue-editor/build.mjs` writes `dist/` (gitignored): index.html, app.js, data.js (the roster, SELL_PRICES, biome/weather lists, the GUI rarity colours), icons/<key>.webp (141 species, all with the game's icons). 144 files, 0.76 MB. Tabs per kind with changed counts, search across every kind, per species: rarity, sell price (own price or the rarity table, "Use the rarity table" clears it), 24-hour bar (handles, paint across, keyboard arrows, all day, wraps midnight), months + all year, biome (water biomes for rod catches, land for the rest), weather + any, rain any hour, size (where it has one), one-liner; "was ..." beside each change, per-species reset. db: collection `species`, one doc per key holding only changed fields; deleted on reset; read on load (unknown keys and fields equal to the game dropped). db null: an alert says it can't save.
- **The apply script:** `web/scripts/apply-species.mjs <export.json> [--dry]` (from web/). Takes `{ key: fields }` or a list of `{ id, data }` / `{ id, ...fields }`. Checks every value (known keys and fields, tiers, biome per tool, hours [0-23, 1-24] start != end, months 1-12 once, weather list, sizes, prices whole and > 0 or null, one-liner <= 200 chars and no em dash), rewrites each species' row in roster.ts (other fields' source text kept), imports the result and compares every species and field, then runs gen-seeds. Tested in `scripts/apply-species.test.ts` and end to end on a sample (reverted).
- **One source for the game:** the reel's rarity, size, zone and hours (`when`, `whenLabel`) now derive from the roster in `lib/game/fishing.ts` (the duplicates deleted from fishing.ts and fishCatalog.ts rows; `FishRow` type). Forage and bug rolls already read the roster.
- **Per-species sell price:** roster `price?` overrides SELL_PRICES (category x rarity). TS: `speciesSellPrice(key)` in `lib/wallet/rules.ts`, used by the service's sell list, the memory store, the bag and the demo. Server: migration `20261027180000_species_sell_price.sql` adds `collection_species.sell_price` and replaces `economy_sell` to pay it first; seed `species-prices` (lib/seedMigrations.ts, `speciesPricesSql` in lib/collections/seed.ts) keeps it equal to the roster. Smoke `web/supabase/tests/species_sell_price_smoke.sql`, in sql-smoke.sh.
- Gates: tsc 0, vitest 3479 passed in both worlds, eslint clean on changed files, sql-smoke chain clean, `check.mjs` ok.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/catalogue-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.

## Next

1. Coordinator publishes `specs/tools/catalogue-editor/dist/` with `capabilities: {db: {}}`, and applies `20261027180000_species_sell_price.sql` to prod with the merge.
2. When David has edited: export the db's `species` collection to JSON, `cd web && node scripts/apply-species.mjs <export.json> --dry`, then without `--dry`; it writes roster.ts and a new `_catalogue_seed.sql` (add it to sql-smoke.sh GAME); run vitest both worlds; rebuild the page.

## Tools and gotchas

- Build: `node specs/tools/catalogue-editor/build.mjs`. Check (browser lock): `node specs/tools/catalogue-editor/check.mjs [port]` (ports 3483/3484). Evidence: `specs/evidence/catalogue-editor/`.
- The sql-smoke chain re-runs older migrations in earlier smokes, so the species price smoke re-applies its migration with `\ir` first.
- Seasonal event fish (yellow perch, sturgeon, giant trevally) bite only while their event runs, whatever their months say.
- Names are not editable on purpose: fishing.ts rows carry their own name and "a Dace" label.
- New migrations from gen-seeds are stamped after 20261027180000 (it is later than the clock today).
