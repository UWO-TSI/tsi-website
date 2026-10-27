# Lane: hair-shelf (David's free and shop hairstyles)

Worktree `.claude/worktrees/hair-shelf`, branch `game/hair-shelf`. Agent type `uwotsi-lane-light`.

David picked them on the hair shelf page (https://claude.ai/artifact/EyLDXZLTsdRVTYZeABzy3h), 2026-10-27:
- **Now sold for coins, at 350 like the other coin hairstyles:** Baby sprout (`hair_baby_sprout`), Layered shag (`hair_layered_shag`), Swept fringe (`hair_swept_fringe`), V-kei layers (`hair_vkei`).
- **Removed from the game** (his note, verbatim: "remove messy with headset, fluffy boy, wavy half up"): `hair_visor_messy`, `hair_fluffy_boy`, `hair_wavy_half_up`. Keep the separate "Visor and headset" accessory (`acc_visor`); it's a hat, not a hairstyle.
- **Unchanged:** every other hairstyle. Ribbon bob and Double buns stay at 350 coins; Curly pigtails and Emo layers stay at 200 Gems; the rest stay free. The result is 14 free and 8 in the shop.

**Production (coordinator, read-only):** nobody owns any hair from the shop yet, and no saved look wears the three removed ones. So there are no refunds, and there's no data to migrate.

**Do:**
1. **Prices:** give the four new coin hairstyles keys and `{mode: "coins", price: 350}` in `specs/wardrobe/batch2-pricing.json`, the same way `hair-23` to `hair-27` are done (their `key` in `web/data/characters/character_catalog.json`).
2. **Removals:** remove the three from the catalogue, so they're out of the creator, the wardrobe and the shop. Repoint the old-id map in `web/lib/game/character/look.ts` (`bangs_wavy` → `hair_fluffy_boy` and any others) to a hairstyle that's still free. Make sure `parseLook` turns an unknown hair id into the default, with a test. Delete their GLBs, thumbs, icons and atlas entries only if nothing else uses them. `acc_visor` was split from `hair_visor_messy`'s source, so check before deleting anything shared. If deleting an atlas cell means re-baking the atlas, don't: leave the cell and say so.
3. **Shop rows:** regenerate the catalogue seed with `web/scripts/gen-seeds.mjs` so it writes a new migration: the four new hair rows with their icons (render the missing icons the way the existing `/assets/icons/hair_*.webp` were made), and `wear-hair-wavy-half-up` set to `active = FALSE`. The generator doesn't delete removed rows, so add the deactivation the way the generator's output allows, or as one plain statement in the same new migration. Never edit an applied migration. Stop after writing it; the coordinator applies it to prod.
4. **Random looks and the starter creator** offer only the free hairstyles (`partRef`, `randomLook`); add a test.

**Read first:** `CODEMAP.md` rows "Character, avatar, hair, wardrobe" and "Economy"; `web/lib/game/character/look.ts` around `BATCH2_PRICES`, `partRef` and the old-id map; `web/lib/wallet/catalogue.ts`; `web/scripts/gen-seeds.mjs`; `specs/lanes/wardrobe-b2.md` (Status only, for how hair-22 to hair-27 were priced).

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint on changed files, `node scripts/gen-seeds.mjs` clean on a second run (no new diff). No `perf:check` (data only). Then message "main" with the head SHA, the migration's file name, the gates and anything you couldn't do, and stop.

## Status

Built, gates in progress (head SHA in the report). Done:
- Prices: `hair-28` Baby sprout, `hair-29` Layered shag, `hair-30` Swept fringe, `hair-31` V-kei layers at 350 coins in both copies of the pricing (`specs/wardrobe/batch2-pricing.json` and `web/data/characters/batch2-pricing.json`, kept identical); `hair-24` removed. Keys added to both catalogues (`art/characters/character_catalog.json`, `web/data/characters/character_catalog.json`).
- Removed: the three hairs from both catalogues, their GLBs (full, lod1, lod2, art and web), creator thumbs, `hair_wavy_half_up` icon, and their lod.json entries. `acc_visor` has its own GLB and stays. `OLD_HAIR` `bangs_wavy` now `hair_messy_boy`; Jayden and the chef (`hair_fluffy_boy`) now `hair_messy_boy`.
- Icons: the four new shop icons are copies of their creator thumbs, which is exactly what `bake-hair-thumbs.mjs` writes (the ribbon bob's icon is byte-identical to its thumb); no re-bake.
- Seed: `REMOVED_HAIR` in `lib/wallet/catalogue.ts` feeds `RETIRED`, so the new migration `web/supabase/migrations/20261027054753_catalogue_seed.sql` sets `wear-hair-wavy-half-up` inactive and upserts the four new rows (and shifts the positions of the later batch-2 rows, since positions come from catalogue order). Added to `sql-smoke.sh`; `wardrobe_b2_smoke.sql` updated (35 rows, 8 hairstyles on sale); the full chain passes.
- Tests: new "hair shelf" test in `look.test.ts`.
- Not done on purpose: atlas cells 7, 8 and 23 of `hair_colour.png` are left as empty cells (no re-bake); the importer manifests (`art/characters/hair/source/*/manifest.json`, `roblox_attachments.json`) and David's source GLBs still list the three, so re-running `import_hair.py` would bring them back (and `acc_visor` is split from `hair_visor_messy` in the manifest): remove them from the manifests first if the importer is ever re-run.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/hair-shelf /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
