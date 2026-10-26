# Lane: wharf-art4 (the wharf's purpose-built buildings and beach critters)

Worktree `.claude/worktrees/wharf-art4`, branch `game/wharf-art4`, cut from `game/terrain-v3` at d258b30c. Agent type `uwotsi-lane`.

**David's notes (R2d review, 2026-10-26, verbatim in `specs/lanes/terrain-v3.md` "R2d review"):**
- on the ship houses: "houses need better use, maybe one for selling rods/equipment , with a big rod on the roof or smth and one for building ships and instead of a building its half buildign half ship floating on the water wit ha small wood bridge extended, and it wobbles with the wave?"
- on the campfire: "more crabs shells and little critters moving around in the sand occasionally"

Read the reading there (2 and 5), and `specs/lanes/wharf-art2.md`, which is how the fish market and ship houses were built, for the style and the frame (origin on the deck's top, door to +z, back over the sea on piles). The references in `specs/references/terrain/` (`dock-fish-hut.jpg`, `wharf-fishing-hut-1.jpg`, `fish-shop-2026-10-26/`) set the playful look: a big object on the roof, bright colours, chunky wood.

## Next

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
