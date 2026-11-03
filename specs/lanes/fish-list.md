# Lane: fish-list (what you can catch, and why)

Worktree `.claude/worktrees/fish-list`, branch `game/fish-list`, cut from `game/fishing-depth` at 92cd709f (it has round 5's seasons; merges after fishing-depth). Agent type `uwotsi-lane`. Docs only this round.

## Round 2: David's fish list review (2026-11-03, verbatim; https://claude.ai/artifact/DLfnEVT1VFBPamnBsD25Fz)

Approved: fl-classparts, fl-models. fl-rods (approve): "the mathing of it looks pretty good". fl-roster (approve): "idk you figure it out it looks pretty good". fl-new (approve): "fill it and fix it". fl-questions (approve): "all rods will have slightly different stats even if both in uncommon". fl-creatures (approve): "L2 should be megladon with electricty aura and tech stuff like a robot megladon"
- fl-today (redo): "i want like 10 common ish, 10 uncommon ish, 8 rare ish, 5 epic ish, 2 legendary so far for each biome, so brainstorm what should be added, this is roughly so could be more or less, like river and sea would have more fish obviously but also have more common and rare type, but deep sea and cliff pool will have higher epic leg ratio to common uncommon kinda thing.  also epic will have added like lil thing that you gotta do while you reel in. also the current reel in is laggy and not smooth and affecting user experience for fishing"
- fl-gaps (redo): "fill it and fix it"
- fl-materials (redo): "these drops are rarer for common fish and almost guarenteed for legendary or divine fish drops"
- fl-odds (redo): "make it hard, cuz there will be a lot of stuff giving luck boost like sushi and bobber so dont make it too easy"

Round 2 is still the list (the laggy reel is the fishing-depth lane's fix):
1. Per biome, about 10 common, 10 uncommon, 8 rare, 5 epic and 2 legendary (river and sea larger and heavier on common and rare; deep sea and cliff pools weighted toward epic and legendary). Brainstorm the additions and fix the gaps.
2. Megabyte (the sea legendary) becomes a robot megalodon with an electric aura and tech parts.
3. Epic catches get a small extra task during the reel: propose one per epic, or a few shared kinds.
4. Material drops scale with rarity: rare from common fish, nearly certain from legendary and Divine.
5. Odds harder, assuming luck stacks from sushi, the tasting book, bobbers and rods; show the odds with and without a full stack.
6. Every rod gets slightly different stats even within a rarity (a table).

## David's call (2026-11-02)

"i need you to expand this fishing catagory". Asked what he meant, he picked: "The fish list: do for fish what the treasure page did for digging: every fish with its rarity as a percentage, where and when, what it's for (crafting materials for class gear, the tasting book, the aquarium), plus new fish to fill the gaps. A list for you to mark first, nothing built."

His treasure notes the same night set the direction (verbatim): "give the percentage too for the rarity, more rare core crafting ingredient, like a few more legendary item to make legendary gear for mage, marksman, and the classes", "legendary and divine gear digs should have like a glow or aura to it", and for the tasting book: "every new fish you find you can cook it for a very small perm fishing buff ... it can unlcok dishes taht are temp big buff but require ingredients and expensive".

## Round 1: the list (done)

1. **Read what exists:** the roster (`collection_species` rows with the rod tool, the catalogue seeds, `web/lib/collections/`), each fish's water, seasons (round 5 moved them to whole seasons), time of day, weather, size, rarity and sell price; the odds (`fishPoolFor` in peaceful.ts, the rod tiers and bait), the rarity ladder, the tasting book (`specs/lanes/tasting-book.md`), the aquarium, the museum, the treasure list (`.claude/worktrees/treasure/specs/treasure.md` on game/treasure), the classes (`specs/design-principles.md`) and the lore.
2. **The table:** every fish: name, water (Sea, River, Pond, Deep sea, Cliff pools), seasons, time and weather, rarity, chance per cast as a percentage with the starter rod (and how better rods and bait shift it), sell price, and its purposes: the tasting book (cook for the permanent buff, dish ingredient), the aquarium, the museum, crafting material (scales, fins, pearls, ink...) for class gear, a resident's favourite gift, quests. Every fish needs a reason beyond coins.
3. **Gaps and new fish:** where the roster is thin (a water, a season, a time, a rarity band, a class's materials), propose new fish to fill it, with a few legendary and Divine catches tied to class gear (mage, marksman and the others), and say which ones glow (an aura material when modelled).
4. **Modelling:** which new fish are plain text prompts (Meshy then Blender) and which are important enough for David's references.
5. Output: `specs/fish-list.md` and a short report. The coordinator puts it on a review page. Never write the gem-to-money rate. Real names never show in game.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Never fetch art references.
- Commit `[build]`, never push, never bare `git stash`. No em dashes.

## Status

Round 2 done (2026-11-03): `specs/fish-list.md` rewritten to David's round 2 marks. Docs only; no code, models or data changed. Head SHA: see `git log -1` on `game/fish-list`.

- Counts per water (common, uncommon, rare, epic, legendary, Divine): river 13/12/11/8/2, cliff pools 6/6/6/6/2, pond 10/10/8/5/2, sea 16/16/11/7/2/1, deep sea 6/6/6/8/4/1; 191 catches. 70 new this round (62 fish, 8 legendaries). Gap check by script: every water has common to epic in every season, by day and by night.
- Moves: the Electric Eel to the cliff pools; Football Fish and 7 sea epics (Barreleye, Giant Isopod, Oarfish, Coelacanth, Blue Marlin, Whale Shark, Saw Shark) to the deep sea, staying in the sea until it opens. Burbot any hour, Brook Trout winter and spring, Muskellunge spring too. Named gifts only for residents who like fish or sea creatures.
- Megabyte is the robot megalodon with an electric aura (section 4). 12 legendaries, 3 per class family (any one core makes the family's legendary look); 2 Divine unchanged.
- Epic reel tasks: six shared kinds (Leap, Run, Snag, Pry, Dark, Spark), one per epic, two for the four giants; legendaries chain 2 or 3. Built after fishing-depth's smooth reel.
- Drops on Let it go by fish rarity: 15, 30, 50, 75 (85 clean catch), 95, 98%, never two misses in a row on a creature.
- Odds proposed: rarity rolled first from per-water bands; luck lifts rare x(1+0.8L), epic 0.6, legendary 0.4, Divine 0.2; boosts (book, meal, rain, friends) cap at 0.60 together; cast cut to 0.30 (MAX gives a bigger fish). Legendary 1 in 2,500 (cliff 1,200, deep 1,000), Divine 1 in 20,000 before luck.
- Rods: a budget per rarity and a lean per rod; Fallen Star rod (legendary) proposed; Driftwood, Bamboo, Coral, Abyss as later examples only.

## David's decisions

- 2026-11-03: the round 2 review, verbatim in "Round 2" above (counts per water, robot megalodon, epic reel tasks, drops by rarity, harder odds, every rod different). Round 1's approved picks (fl-questions) are listed in `specs/fish-list.md` section 0.
- 2026-11-02 (via the coordinator): Meshy is paused: "dont use meshy as for now, just try to replicant the same output through using blender and modeling it from the multi angle designs". New fish: concept views (ElevenLabs image, from a text prompt or David's reference), then modelled in headless Blender from those views, matching our existing fish.

## Next

1. Wait for David's marks on round 2 (`specs/fish-list.md` section 12, ten questions).
2. After his marks: models for the fish he keeps, by water in batches of 10 concept sheets (route A first, then B); creatures only with his references.
3. Data, the cliff and deep waters, Let it go, the odds change and the epic tasks: their own round or lane (the tasks after fishing-depth's smooth reel).

## Tools and gotchas

- **The generator** (round 2): `specs/fish-list-src/` holds `data.mjs` (every catch: water, rarity, seasons, hours, weather, status, material, also, task), `analyze.mjs` (the proposed odds, the gap check, today's formula for comparison; writes the ignored `res.json`), `build.mjs` and `template.md`. Rebuild with `cd specs/fish-list-src && node build.mjs "$PWD/../fish-list.md"`. Edit the data or the template, never the generated tables in the spec. Plain node, no `node_modules` needed.
- The worktree has no `node_modules`. The odds were computed with `npx tsx` from `web/`, `NODE_PATH=<fishing-depth worktree>/web/node_modules NEXT_PUBLIC_GAME_WORLD=new`, importing `fishPoolFor`, `rig` and the roster; scripts in the session scratchpad (`fish-list/odds.ts`, `newodds.ts`, `gen.mjs` builds the roster table).
- Existing fish models: `web/public/assets/game/remodel/fish/` (81 files), 600 to 2,000 tris, 1 material.
