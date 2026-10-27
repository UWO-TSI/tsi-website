# Lane: clothing-v2 (universal garments that fit, designs as paint)

Worktree `.claude/worktrees/clothing-v2`, branch `game/clothing-v2`, cut from main at 5d848445. Agent type `uwotsi-lane`.

David, 2026-10-26, verbatim: "we need better clothing models that are like universal like universal tee hoodie etc and just need to hcange the paint over it like design, current clothes pants shoes pop out the body and poorly modeled."

What that means:
- **One universal model per garment type:** a tee, a hoodie, a long-sleeve, a sweater, trousers, joggers, shorts, a skirt, sneakers, boots, and so on. Each fits the base body exactly through every animation clip: no skin or body poking through, no garment floating off it.
- **A design is paint, not a new model:** a stripe tee, a TSI crew tee and a plain tee are the same tee mesh with a different texture (a design layer on the garment's UVs over its tint). New clothes are then a new design, not new modelling.
- **The body never pokes through:** fit each garment over the base body in Blender, transfer the body's weights, and hide the body under the clothes where it can't show (the usual way: mask or cut the covered body regions per garment), checked in the stretchiest poses of every clip.
- **Cleanly modelled:** soft cartoony shapes (ACNH style), good silhouettes at game distance, cheap (keep each garment's triangles at or under today's), shared materials.

**Round 1 (review with David before more):** the starter set first (`STARTER_PARTS` in `web/lib/game/character/look.ts`: tee, hoodie, striped long-sleeve, shorts, trousers, joggers, slip-ons, sneakers), each rebuilt on its universal model, the striped long-sleeve as a design on the long-sleeve, and the design-paint path working in the game (catalogue entry → mesh + design texture). Then the rest of `art/characters/outfits/` on the same models in round 2. Saved looks must keep working: keep the part ids, or map old ids to new ones in `parseLook`.

**Evidence:** headless Blender renders and in-game headless shots of each garment on the body, front, side and back, in a run, a jump and a sit; before and after the current models; in `specs/evidence/clothing-v2/`. The coordinator puts them on a review page for David; nothing merges before he approves.

**Read first:** `CODEMAP.md` rows "Character, avatar, hair, wardrobe" and "Art pipeline"; `specs/character-set.md`, `specs/character-in-engine.md`, `specs/characters/head-v10.md` (only for the body and rig); `art/characters/outfits/build_outfits.py`; `art/characters/base/`; the outfit parts in `web/data/characters/character_catalog.json`. If a garment's look needs a reference David hasn't given, ask the coordinator; don't find one yourself.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint; one `perf:check` at the end (`SCENES=village,v2,cafe`, characters changed). Message "main" when round 1's renders are ready, with the head SHA, gates and evidence paths, then stop.

## Status

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/clothing-v2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
