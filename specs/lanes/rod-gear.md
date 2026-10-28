# Lane: rod-gear (rods, add-ons, the hex radar, the rarity ladder)

Worktree `.claude/worktrees/rod-gear`, branch `game/rod-gear`, cut from main at fdd7a901. Agent type `uwotsi-lane`. The launch date moved later; the new date isn't set yet.

Items **f-rods, x-shop and m4's rod shop** in `specs/launch/v1-gameplay.md`. Existing: `web/lib/game/rods.ts` (5 tiers: Flimsy, Cedar, Glass, Lighthouse, Tidewarden), `web/lib/wallet/catalogue.ts` (prices, sell prices), the shop UI, `FishingRig.tsx`, and the rarity in `web/lib/collections/roster.ts` and `fishing.ts`.

1. **The rarity ladder** for items and fish: common, uncommon, rare, epic, legendary, Divine, Contraband. Contraband is for mods and T0/T1 only; how it's earned is still open, so build the tier and gate it behind a flag. Colours in the GUI kit. Update every place rarity shows. Commit it first and report it, because other lanes use it.
2. **5 rods at launch:** from the starter through Cedar to an intermediate rod, each with 5 or 6 stats (for example bite window, line strength, luck or rare odds, cast distance, reel speed). Map the existing tier effects onto them, and show what each stat does.
3. **Add-on slots:** each rod has slots for bait and a bobber (and more later). Each add-on raises stats; for example, the lucky bobber raises luck and bait raises bite time. Add-ons are owned items. Make the existing "Lucky bobber" real.
4. **The rod shop:**
   - each rod's 3D model, turnable;
   - a hex radar chart of its stats, with the equipped add-ons' gains layered on in a different colour over the base;
   - also shown wherever you equip gear.
5. **Hollow items:** hide or replace any shop item that does nothing (the "Basic rod" with no tool, net and shovel tiers with no effect, furniture while homes are closed).

Prices go into the existing catalogue and seed, with a new migration I apply.

**Read first:** `specs/launch/v1-gameplay.md` (David's notes verbatim, your items), `CODEMAP.md` rows for your area, and the files named below. Search before building; most systems exist.

**Shared pieces, one owner each:**
- the guide arrow (`tutorial-v2` builds it first and reports);
- the quest dropdown and tracker (`main-quest`);
- the rarity ladder (`rod-gear`).

Others use these once they land. Ask the coordinator to merge the owner's commit into your branch, and don't build a second copy.

**Migrations:** write new ones only (timestamped after the newest on main), and stop for the coordinator to apply them. Prices and rewards go in the existing economy tables and rules. Never write the gem-to-money rate anywhere.

**Visual work** (UI, models, the tour) goes to David as screenshots on a review page before it merges. Pure fixes can merge once verified.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, plus headless shots or an in-game run for anything a player sees. One `perf:check` at the end only if you change what renders. Report at each milestone and at the end with the head SHA, gates, evidence and anything you couldn't verify.

## Status

- **Rarity ladder done** (step 1, cb7bed43, reported). `web/lib/rarity.ts` is the one ladder (`RARITIES`, `OBTAINABLE`, `RARITY_RANK`, `RARITY_LABEL`, `isRarity`, `mayHoldContraband`). Sea King became Divine (holographic in the GUI kit, `--gui-holo`); Contraband is dark. Fish weight Divine 0.4 vs legendary 2.5; Divine sells at 2.5x legendary; Contraband has no price.
- **Contraband is staff tools** (David): never obtainable from any shop, drop, catch, quest, recipe or reward; only an admin grant to a staff account. `lib/rarity.test.ts` holds every obtainable source to `OBTAINABLE`; the admin shop editor offers only `OBTAINABLE`; the shop_items check leaves contraband out. Showing the tier stays behind `NEXT_PUBLIC_CONTRABAND=1`.
- **Steps 2 to 5 built and committed** (gates: tsc clean, full vitest both worlds, eslint clean on changed files; shots in `specs/evidence/rod-gear/`):
  - `lib/game/rods.ts`: six stats per rod on a 0-10 radar (`STAT_KEYS`, `STAT_INFO` says what each does), `effects()` maps them onto the loop (luck, bite window, line strength = drain, reel speed = fill, lure = wait, control = bar width), five rods from Flimsy to Tidewarden (top at 7 to 8 of 10: more rods later). Add-ons `TACKLE` (Sweet bait: +2 bite, +1 lure; Lucky bobber: +2 luck), `rig()`, `ownedRig()` (the server's roll: only owned add-ons count).
  - Wiring: reel fill and bar width (`fishingReel.ts`), wait (`FishingOverlay`), the cast sends `tackle` (`castLine`), the server rolls with `ownedRig` (`collections/service.ts`), the client reads equipped add-ons (`usePeacefulContext`, event `tsi:gear-changed`).
  - Equip: member_inventory.equipped with new slots `bait` and `bobber` (one per slot).
  - Rod shop: the Tools shelf lists the five rods by tier (Flimsy "Yours", Lighthouse and Tidewarden "Made at the workbench", synthesized in `lib/wallet/service.ts rodShelf`), then the add-ons. Detail: the turning model, the hex radar (`components/gui/flat/HexRadar.tsx`, add-on gains in orange), the add-on slots, and the spec band says what each stat does (`components/economy/RodGear.tsx`). The new world's tackle-shop door says "Browse rods" and opens the same panel (`section="rods"`). The Bag's rod detail shows the radar and slots (no hollow Equip on rods).
  - Hollow items: `rod-basic`, `net-mid`, `shovel-mid` off sale (`HOLLOW_TOOLS`); furniture, wallpaper and flooring off the shelves and out of the specials until homes open (`isOnSale`, `dailySpecials`, drop 4); empty shelves hide; the shop's plinths show specials that have a model, then fill up.
  - Art: `bait-sweet.glb` (`art/props-enemies/build_items.py -- only bait-sweet`); its icon `public/assets/icons/bait-sweet.webp` (render-icons).
- Migrations for the coordinator, in order: `20261027140000_rarity_ladder.sql`, `20261027183120_catalogue_seed.sql`, `20261027183200_rod_tackle_slots.sql`, `20261027183713_catalogue_seed.sql`.

## Next

1. The `/lab/gui` shots (badges, tiles, radar: `gui-*.png`) once the devserver lock frees; the showroom's fixed layers cover its sections, so the script hides them first (scratchpad `shots-gui.mjs`).
2. David's review of the shots; perf:check not needed (UI and data only; the tackle shop door adds no rendering).

## Tools and gotchas

- Locks are contended: there is no queue file (the coordinator removed it); retry `withlock.sh heavy|devserver` in a loop while it exits 75, and keep each hold to one short batch.
- `node scripts/gen-seeds.mjs` writes the catalogue seed migration after a catalogue change; a hand migration that widens a check must sort before it.
- Dev harness: `/dev/economy?view=overlay&section=rods` (memory store, a cedar rod and an equipped lucky bobber).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/rod-gear /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
