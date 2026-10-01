# Leaf glider: the first movement unlock (row 245)

David (2026-09-28) picked three later movement unlocks: the glider/leaf, swimming and diving, and sailing the boat yourself. They are "built after the core kit ships" (row 245); the kit is live on main (`b77c0d7f`). The glider comes first because it builds on the air modes the sim already has and does not touch the coast, which the terrain agent is reshaping. Swimming waits for the sloping beach.

His bar for movement still holds: "it's gotta feel good and seamless, not buggy ... make it fun but not too crazy, just juicy."

## Where it stands
- `web/lib/game/movement/sim.ts`: the pure 120 Hz step, modes ground/air/skid/roll/recover/mantle/splash, every feel value in `MOVE_TUNING`, events per step. Tests in `sim.test.ts` (any frame rate gives the same path).
- `/lab/move` (`components/game/movement/MoveLab.tsx`, course in `lib/game/movement/course.ts`): the tuning panel, presets, Copy JSON, lap timer.
- The village, home island and ruins run the sim through `PlayerAvatar` with the rigid follow camera, which frames the level the avatar stands on.
- Crafting (`lib/crafting/`): recipes in `recipes.ts`, learned from quests, residents or bottles; rods 4–5 are craft-only tools (`not_for_sale`) and their ownership gates legendary fish. Seeds reach the database through a new seed migration (`lib/seedMigrations.ts`, `scripts/gen-seeds.mjs`).

## The glider (defaults; David can change any of them)
- **Unlock**: a "Leaf glider" tool, crafted at the HQ workbench, never sold. Learned the way rods 4–5 are (pick the source that fits the existing recipe sources; write the choice in the questions file). Owning one turns gliding on; nothing else changes for players without it.
- **Open**: press Space again while airborne and falling (not the held Space of a jump or a bunny-hop, so the hop and variable jump height are untouched). Hold to keep it open; release to drop. Touch: tap the jump button again in the air.
- **Flight**: forward speed eases from whatever you opened with toward a glide speed (about 8 u/s), a slow sink (about 1.6 u/s), steering with moderate turn rate, no gaining height. Q in the air spends the air dash as a forward gust and the glide carries on if Space is still held. Off a 1.5u cliff it should clear about 10–12 tiles: a river and a short sea gap, not the whole island.
- **Landing**: always soft (no roll or recovery from any height). Over water with no land: the existing splash rule.
- **Where**: the village and the home island. Off in the ruins and interiors by default (a tuning flag per area).
- **Multiplayer-forward**: the glide is sim state (`mode: "glide"`, open/close events), deterministic like the rest, so it can later be predicted and replicated. The leaf and any wind effects draw on the avatar that moves (look spec §7.1); nothing follows "the" player.
- **Juice, not chaos**: a quick open with a little upward pop of the leaf, gentle sway and bank into turns, faint wind lines at speed, a soft landing puff. The camera eases down with the glider instead of holding the take-off level, then settles on the landing level.
- **Art**: a Glide clip on the v6 rig (`art/characters/base/build_clips.py`: both hands on the stem overhead, legs dangling, a slow sway) and a low-poly leaf model. Search the repo and the ACNH dump for an existing leaf or umbrella piece first; otherwise model it in Blender (live via the MCP bridge, or headless). No reference images collected from the web (David supplies every visual reference).

## Build order
1. Sim: the glide mode and tuning values with tests (open only while falling and on a fresh press, the hold, the release, the soft landing, no height gain, reach from a 1.5u cliff, the air-dash gust, splash over water, same path at any frame rate, the flag off = today's behaviour exactly).
2. Lab: a glide lane in `/lab/move` (a tower, a river gap and a sea gap), an "owns glider" toggle, a Glide group in the tuning panel with presets.
3. Art: the Glide clip and the leaf model, attached to the hands.
4. Unlock: the recipe and the catalogue item in a new seed migration (timestamp after `20260930142943`, added to the SQL smoke list), the ownership check feeding the sim flag, tests (cannot buy it, crafting it turns gliding on).
5. Integrate into the village and home island; the camera change; touch.

## Evidence
`specs/evidence/glider/`: frame strips of opening, a long glide over the lab's river gap, a turn, the air-dash gust and the soft landing; the same in the village off a cliff; the clip and leaf sheet; the tuning panel. Tests; FPS unchanged.
