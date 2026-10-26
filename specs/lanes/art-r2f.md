# Lane: art-r2f (the fish market, the shipwright's ship and the river trees, from David's R2e notes)

Worktree `.claude/worktrees/art-r2f`, branch `game/art-r2f`, cut from `game/terrain-v3` at 4cd9604d. Agent type `uwotsi-lane`.

**David's notes (R2e review, 2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R2e review"):**
- market-front: "make building a bit wider, remodel the sword fish coming out so it looks proper"
- shipwright: "i was thinking of making the building a boat or the building part of a boat, like a big boat docked to the side you can go in the guys a shipwright and you can ask if he can build you a ship kinda thing"
- river: "redo these tree models"

The current models are `fish-market` (`art/buildings/build_fish_market.py`), `shipwright-shed` and `shipwright-boat` (`art/wharf/build_wharf_shops.py`), and `river-tree-*` (`art/trees/build_forest_trees.py`). In-game views: `specs/evidence/terrain-v3/r2e/23-market-front.webp`, `24-shipwright.webp` and `10-river-and-meadow.webp`. In the river view the crowns sit like lollipops on thin, bent trunks, and the willow is stringy. References: `specs/references/terrain/plan-2026-10-23/wharf-fishing-hut-1.jpg` (the marlin shop) and `fish-shop-2026-10-26/`.

## Status

All three batches done, waiting on review (2026-10-26). Head is the commit after 5aa9bc5b, which updates this file.
- **6ad9ee5f, the fish market:** 7.8 wide by 4.2 deep (was 5.2). The swordfish now bursts up through the front slope toward +x, pitched 46 degrees, with its back third inside. Smashed shingles, laths and snapped rafters spring up round the hole, with more thrown into the air.
  - 11,798 tris, 911 KB.
  - Bounds: x -4.84 to 5.59, z -3.31 to 4.0, top 11.97.
  - PROP_FOOTPRINT [4.4, 3.6], PROP_TOP 11.97.
  - Preview: `specs/evidence/art-r2f/fish-market.webp`.
- **432fb95e, shipwright-ship** (new, in `art/wharf/build_wharf_shops.py`): it uses the shed's edge-shop frame and is in EDGE_SHOPS.
  - 11,746 tris, 819 KB.
  - The hull runs x -7.1 to 10.6 and z -0.35 to -5.2. The deck is at y 0.35 and the mast top at 9.45.
  - The gangway runs from (1.3, 0, 1.7) to (1.3, 0.37, -0.8). The bollards are at (5.6, 0.55) and (-6, 0.55).
  - Not solid, and it doesn't bob.
  - Preview: `specs/evidence/art-r2f/shipwright-ship.webp`.
  - The shed, the boat and ShipwrightBoat.tsx stay until terrain-v3 switches generate.ts SHOPS to it. Then delete:
    - the shed and boat GLBs;
    - ShipwrightBoat.tsx and its use in DefaultIslandWorld;
    - their propModels, PROP_FOOTPRINT, PROP_TOP and EDGE_SHOPS entries;
    - shipwright_shed, shipwright_boat, hull, BB/LH, BOAT_AT and PLANK_END in the builder.
  - Check: wharf.ts SHED_CLEAR (4.2) is shorter than the ship (plus or minus 7 along the edge).
- **5aa9bc5b, the river trees** (`river-tree-*`, same names):
  - willow: 1,104 tris, 7.7 tall, 7.5 across, dense curtains;
  - alder: 1,002 tris, a group of three, 9.3 tall;
  - oak: 1,040 tris, spreading, 8.3 tall, 9.8 across;
  - lean: 678 tris, 8.7 tall, out to x 6.8.
  - PROP_FOOTPRINT grew to 0.7, 0.65, 0.75 and 0.6.
  - Preview: `specs/evidence/art-r2f/river-trees.webp`.
  - The forest trees rebuild byte-identical after the `lump()` refactor.
- **Gates:** the propModels, modelMaterials, budget and walk tests pass, and eslint is clean on the changed TS. I didn't run perf:check or check them in game.

## Next

1. **The fish market, wider,** replacing `fish-market`:
   - about 1.5x wider along its front, same depth and style, so it reads as the wharf's main building rather than a tall narrow hut.
   - Remodel the swordfish so it properly bursts out through the roof: a big, well-shaped swordfish breaking out of the roof diagonally, with smashed shingles and rafters round the hole, and its tail or body still inside. It should look like it launched out of the building, not like it's sitting on the roof.
   - Keep the porch and the sell stall's spot at the front (+z).
   - Report the new footprint and top.
2. **The shipwright's ship,** a new model `shipwright-ship` replacing the shed and boat:
   - a big wooden ship docked alongside the wharf's edge, its deck about level with the wharf;
   - a workshop built on and into it: a cabin with a door, tools, planks, a ship's wheel, maybe scaffolding on one side where it's being repaired or built;
   - a gangway from the wharf to its deck.

   Nobody goes inside for launch (a door that reads as an entrance). Going in and asking the shipwright to build you a ship comes after launch. Give the origin, the side that docks to the wharf, the gangway's end, and a footprint for the solid part over the wharf, if any. Say whether it should bob (only if the gangway can stay attached).
3. **The river trees, redone,** replacing `river-tree-*`:
   - full, natural crowns sized to their trunks, with trunks thick enough to carry them;
   - no lollipops or umbrella pines;
   - a proper weeping willow with a dense crown and long hanging curtains;
   - an alder or birch group and a spreading riverside oak;
   - keep the tint material (`mForestCrown`) and the foot and sink.

## Rules

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>` under `LANE=game/art-r2f /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`; `withlock.sh heavy` for vitest and tsc. Never open the Blender app; never use the `blender` MCP tools.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **Art:** never fetch art, textures or references; never use asset libraries or generators. The default village stays unchanged.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Work only inside this worktree. Don't edit `generate.ts` or `web/data/world/`.
- **Text:** no em dashes; real names never show in game.
- **Code:** follows the surrounding code (ponytail). Keep triangles sensible; the new world is at the village's frame cost.
- **Per asset:** the builder in `art/`, the GLB, a preview in `specs/evidence/art-r2f/`, registered with footprints, and the propModels, modelMaterials and budget tests green.
- **Reporting:** after each batch, SendMessage "main" with the commit, triangles, size, the preview and placement notes. At the end, update Status here, send the full list, and stop.
