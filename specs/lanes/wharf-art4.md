# Lane: wharf-art4 (the wharf's purpose-built buildings and beach critters)

Worktree `.claude/worktrees/wharf-art4`, branch `game/wharf-art4`, cut from `game/terrain-v3` at d258b30c. Agent type `uwotsi-lane`.

**David's notes (R2d review, 2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R2d review"):**
- on the ship houses: "houses need better use, maybe one for selling rods/equipment , with a big rod on the roof or smth and one for building ships and instead of a building its half buildign half ship floating on the water wit ha small wood bridge extended, and it wobbles with the wave?"
- on the campfire: "more crabs shells and little critters moving around in the sand occasionally"

Read the reading there (2 and 5), and `specs/lanes/wharf-art2.md`, which is how the fish market and ship houses were built, for the style and the frame (origin on the deck's top, door to +z, back over the sea on piles). The references in `specs/references/terrain/` (`dock-fish-hut.jpg`, `wharf-fishing-hut-1.jpg`, `fish-shop-2026-10-26/`) set the playful look: a big object on the roof, bright colours, chunky wood.

## Status

Done; not yet reviewed by David. Batches e7da4bc0 (tackle shop), a1262f4a (shipwright), beb8e438 (shells), then this file. Gates: propModels, modelMaterials and budget tests green (41); tsc and eslint clean. Previews in `specs/evidence/wharf-art4/`. Placement is terrain-v3's. Not verified in the game: placement, scale beside the character, the boat's bob against the gangplank.

1. **Tackle shop** (`art/wharf/build_wharf_shops.py`, `game/wharf/tackle-shop.glb`): 11,322 tris, 830 KB, 6 materials. The ship houses' frame (origin on the deck's top at the floor's middle, door +z, back over the sea on piles to -3.4). Walls z -2.45 to 1.15, porch under a striped awning to z 2.45; a giant rod in a holder on the ridge, bent as if a fish were on, its line hanging a bobber and a lure off the porch's +x corner (x 2.35, z 3.05, down to y 1.6). Footprint [2.3, 2.45], top 6.741. Preview `tackle-shop.webp`.
2. **Shipwright** (same builder): `shipwright-shed` 7,966 tris, 560 KB; footprint [2.0, 2.1], top 4.68; a ship's wheel on the front gable, a side pier along +x (x 2.15 to 3.45, z -2.25 to 0.4) and the gangplank, which is the shed's, ending at `PLANK_END` (4.3, 0.16, -2) in the shed's frame. `shipwright-boat` 3,456 tris, 195 KB, not solid: origin on the waterline at its middle, bow to -z, placed at `BOAT_AT` (5.4, -1.078, -3.6) in the shed's frame with the shed's yaw; keep its bob small near the plank. Preview `shipwright.webp`.
3. **Beach critters:** no crab modelled. Crabs already exist: `ambientFauna.ts crabsFor` (6, Lite 4) with the dump's `crab-gazami` and `crab-hermit` (926 and 802 tris), which sidle along the waterline, dash from avatars and dig in (`crabStep`); "more crabs" is a count and site change in `AmbientFauna.tsx` for terrain-v3. New shells (`art/props/build_beach_shells.py`, `game/props/`, scenery, not forage, one P_Paint each, not solid): `starfish` 464 tris 45 KB, `sand-dollar` 770 tris 36 KB, `conch` 456 tris 21 KB. Preview `beach-shells.webp`.

## Next

All done (above). Waiting on review.


1. **The tackle shop** (`tackle-shop`): a wharf shop for rods and fishing gear, with a giant fishing rod on the roof as its sign. Rods racked out front, a lure board, a bait bucket. Our style, playful, low detail where it doesn't show. Nobody enters it for launch. Give its footprint and front.
2. **The shipwright** (`shipwright-shed` and `shipwright-boat`): two separate models.
   - The shed stands half on the deck and half on piles, with tools, planks, a sawhorse and a lantern.
   - The boat is a ship being built, half planked with its ribs showing, floating on the water beside the shed, with a small wooden bridge or gangplank from the shed's deck to it.

   terrain-v3 makes the boat bob with the waves, so give it a clean origin at the waterline and make the gangplank part of the shed, so it doesn't bob. Say the bridge's end point.
3. **Beach critters:** first check `web/public/assets/` and the critter or ambient-fauna code (`ambientFauna`) for an existing crab.
   - If none exists, model a small crab (a few hundred triangles) with legs that can wiggle cheaply. Either split the legs, or say how terrain-v3 can fake a scuttle with a bob and a sideways glide.
   - Model two or three more shell kinds if the existing shells (`art/nature/build_shells.py`) don't cover it.

## Rules

- **Blender, headless only:** `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>` under `wharf-art4=game/wharf-art4 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh blender <cmd>`; `withlock.sh heavy` for vitest and tsc. Never open the Blender app; never use the `blender` MCP tools.
- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **Art:** never fetch art, textures or references; never use asset libraries or generators. The default village stays unchanged.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Don't touch other worktrees. Don't edit `generate.ts` or `web/data/world/`; placement is terrain-v3's job.
- **Code and text:** no em dashes; real names never show in game; code follows the surrounding code (ponytail).
- **Per asset:**
  - a builder in `art/`;
  - the GLB in `web/public/assets/game/`;
  - a preview in `specs/evidence/wharf-art4/`;
  - registered in `SCENERY_URLS`, with footprints where solid;
  - the propModels, modelMaterials and budget tests green.
- **Reporting:** after each batch, SendMessage "main" with the commit, each asset's triangles, size, preview path and placement notes. At the end, update Status, send the full list, and stop.

## Tools and gotchas

- `build_wharf_shops.py -- review <dir> [model ...] [az:el ...]` renders the named models (all by default) on a deck edge over the sea, the boat at `BOAT_AT` beside its shed; azimuth 180 is the front.
- `build_beach_shells.py -- review <dir>` renders the three shells on sand.
- The shops import the ship houses' helpers (`Wall`, `boards`, `platform`, `gable`, `lantern`), so a change there changes these too.
