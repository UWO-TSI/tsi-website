# Lane: fish-list (what you can catch, and why)

Worktree `.claude/worktrees/fish-list`, branch `game/fish-list`, cut from `game/fishing-depth` at 92cd709f (it has round 5's seasons; merges after fishing-depth). Agent type `uwotsi-lane`. Docs only this round.

## David's call (2026-11-02)

"i need you to expand this fishing catagory". Asked what he meant, he picked: "The fish list: do for fish what the treasure page did for digging: every fish with its rarity as a percentage, where and when, what it's for (crafting materials for class gear, the tasting book, the aquarium), plus new fish to fill the gaps. A list for you to mark first, nothing built."

His treasure notes the same night set the direction (verbatim): "give the percentage too for the rarity, more rare core crafting ingredient, like a few more legendary item to make legendary gear for mage, marksman, and the classes", "legendary and divine gear digs should have like a glow or aura to it", and for the tasting book: "every new fish you find you can cook it for a very small perm fishing buff ... it can unlcok dishes taht are temp big buff but require ingredients and expensive".

## Round 1: the list

1. **Read what exists:** the roster (`collection_species` rows with the rod tool, the catalogue seeds, `web/lib/collections/`), each fish's water, seasons (round 5 moved them to whole seasons), time of day, weather, size, rarity and sell price; the odds (`fishPoolFor` in peaceful.ts, the rod tiers and bait), the rarity ladder, the tasting book (`specs/lanes/tasting-book.md`), the aquarium, the museum, the treasure list (`.claude/worktrees/treasure/specs/treasure.md` on game/treasure), the classes (`specs/design-principles.md`) and the lore.
2. **The table:** every fish: name, water (Sea, River, Pond, Deep sea, Cliff pools), seasons, time and weather, rarity, chance per cast as a percentage with the starter rod (and how better rods and bait shift it), sell price, and its purposes: the tasting book (cook for the permanent buff, dish ingredient), the aquarium, the museum, crafting material (scales, fins, pearls, ink...) for class gear, a resident's favourite gift, quests. Every fish needs a reason beyond coins.
3. **Gaps and new fish:** where the roster is thin (a water, a season, a time, a rarity band, a class's materials), propose new fish to fill it, with a few legendary and Divine catches tied to class gear (mage, marksman and the others), and say which ones glow (an aura material when modelled).
4. **Modelling:** which new fish are plain text prompts (Meshy then Blender) and which are important enough for David's references.
5. Output: `specs/fish-list.md` and a short report. The coordinator puts it on a review page. Never write the gem-to-money rate. Real names never show in game.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Never fetch art references.
- Commit `[build]`, never push, never bare `git stash`. No em dashes.

## Status

Round 1 done (2026-11-02): `specs/fish-list.md` written and committed (listed in `specs/INDEX.md`). Docs only; no code, models or data changed. Head SHA: see `git log -1` on `game/fish-list`.

- What exists: 91 rod catches (river 30, cliff pool 4, pond 13, sea 44; no legendary or Divine), how a cast picks (season, hour, weather, `hookCap`, weights, luck), the rarity bands per rod tier, every current use.
- The roster table: all 91 with water, seasons, hours and weather, rarity, coins, size, chance per cast (starter, first rod that hooks it, best gear), and a proposed purpose (material on release, gift, dish, today's recipes).
- Gaps, 47 crafting materials (common to Divine) with a per-subclass gear map (all 16), 24 new fish plus 4 moved to the deep sea and one salvage catch, 4 legendary (one per class family) and 2 Divine with gold and holographic auras, fixed-share odds for legendary (1 in 600) and Divine (1 in 6,000), the modelling route (no Meshy: ElevenLabs concept views, then headless Blender), the later code list, 10 open questions.
- Findings for the coordinator (not fixed): the starter rod can't feel a MAX cast; rod luck barely moves odds next to cast power; cliff pool fish already bite in the river while the tasting book says "Opens later"; the shut pond makes the Golden Koi (Koi kimono recipe) uncatchable; a stale comment in `fishing.ts`'s header.

## David's decisions

- 2026-11-02 (via the coordinator): Meshy is paused: "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs". New fish: concept views (ElevenLabs image, from a text prompt or David's reference), then modelled in headless Blender from those views, matching our existing fish.

## Next

1. Wait for David's marks on `specs/fish-list.md` section 10 (the list, let it go, cliff pools, the six creatures, odds, gear as look or stats, the legendary rod, the MAX cast, references, gifts).
2. Round 2 (after his marks): models only for the fish he keeps, route A first (reshaped from existing fish), then B; creatures only with his references.
3. Data, the deep sea water, let it go and the odds change: their own round or lane, after the models.

## Tools and gotchas

- The worktree has no `node_modules`. The odds were computed with `npx tsx` from `web/`, `NODE_PATH=<fishing-depth worktree>/web/node_modules NEXT_PUBLIC_GAME_WORLD=new`, importing `fishPoolFor`, `rig` and the roster; scripts in the session scratchpad (`fish-list/odds.ts`, `newodds.ts`, `gen.mjs` builds the roster table).
- Existing fish models: `web/public/assets/game/remodel/fish/` (81 files), 600 to 2,000 tris, 1 material.
