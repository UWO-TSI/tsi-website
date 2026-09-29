# Movement tech: momentum hops, climb and a Q dash (rows 243, 244)

David (2026-09-28) picked "momentum hops + climb" and added: "it's gotta feel good and seamless, not buggy, give character 'q' to dash, and make it fun but not too crazy, just juicy." Later unlocks (not in this build): glider, swimming and diving, sailing the boat yourself (row 245).

## Today (survey 2026-09-28)
A smooth flat walk (`PlayerAvatar.tsx`, `lib/game/locomotion.ts`): 7.4 u/s walk, unlimited ×1.85 sprint, a purely cosmetic 0.5 s hop, no gravity, falling, climbing or momentum; a 1.5 u cliff blocks both ways; the runtime `canStep` blocks ramp tops the reachability test allows; water is a wall; no jump/land/climb/roll/dash/skid clips; keyboard only; the follow camera is fixed (rows 5, 154).

## The kit
- **Jump (Space)**: real vertical physics with gravity, variable height by hold, coyote time and jump buffering, a short apex hang, moderate air control. Replaces the cosmetic hop.
- **Momentum**: sprint (Shift) builds speed over about a second; holding Space while sprinting hops again on every landing (the bunny-hop, row 249) and each hop adds a little speed, up to a low cap ("not too crazy"); sharp turns at speed skid; stopping slides briefly.
- **Long jump**: jumping at sprint speed gives a longer, flatter arc that clears a 2–3 tile river.
- **Q dash**: a short burst in the input direction (camera-relative; the facing with no input) on the ground or once in the air (resets on landing), short cooldown shown as a ring at the feet; dash then jump carries the dash speed.
- **Climb**: jumping into a one-level cliff edge (1.5 u) grabs the ledge and mantles up; ramps are walkable end to end.
- **Drops**: run off cliffs and fall; landing at speed rolls and keeps momentum; big drops cost a short recovery, never damage.
- **Juice, not chaos**: squash and stretch, dust, landing thumps, a slight camera lead and small FOV kick at top speed, sounds. Effects attach to the avatar that moves (allowed by §7.1 of the look spec); nothing follows "the" player.
- **Controls**: Space jump and Q dash everywhere. In the ruins Q is also the dodge (today's i-frames and cooldown), Space jumps, and weapon swap moves from Q to R (changes row 49's Space-dodge; flagged to David). Movement keys become remappable (rows 49, 220). Touch devices get on-screen jump and dash buttons plus a joystick.
- **Seamless, not buggy**: a fixed-timestep, pure step function `(state, input, dt, map) → state` with tests for coyote/buffer windows, the chain cap, ledge detection, no tunnelling through thin walls, no stuck states at cliff edges, water edges or building corners, and identical results at any frame rate. The same function later drives multiplayer prediction and reconciliation.

## Build order
1. The pure movement simulation with tests.
2. A movement lab course at `/lab/move`: a sprint lane, a hop-chain lane, river gaps of 2, 3 and 4 tiles, one- and two-level cliffs, drops, ramps, a narrow bridge, and a live tuning panel (every feel value, presets, "copy JSON") so David tunes the feel himself; a lap timer as the skill readout.
3. Animation clips on the v6 rig (`art/characters/base/build_clips.py`): jump, fall, land, roll, mantle, dash, skid.
4. Integrate into the village, home island and ruins once David approves the feel in the lab. Interiors keep their own simple controller.

## Evidence
Frame strips (or short recordings) of each move in the lab; tests; FPS unchanged; David's verdict on the feel in `/lab/move` before step 4.

## Built: steps 1 to 3 (branch `game/movement`, 2026-09-28)
- **Sim** `web/lib/game/movement/sim.ts`: `stepMove(state, input, dt, world, tuning)` at a fixed 120 Hz, `advanceMove` drives it per frame and `interpolated` draws between steps. Modes: ground, air, skid, roll, recover, mantle, splash. Every feel value is `MOVE_TUNING`. The world is `{ top(x, z), wet(x, z) }`, which `islandOf` (`lib/game/defaultIsland.ts`) now answers for any village, so the lab course and the village share one adapter. Tests: `sim.test.ts` (coyote, buffer, variable height, chain cap, long jump, rivers, dash, skid, drops, mantle, ramps, tunnelling at 30/60/144 Hz, fuzzed edges and the whole course, same path at any frame rate, a scripted lap).
- **Lab** `/lab/move` (`web/components/game/movement/MoveLab.tsx`, `MoveAvatar.tsx`, course in `lib/game/movement/course.ts`): tuning panel with presets and Copy JSON, per-move numbers, slow motion, key remap, touch joystick and buttons, lap timer.
- **Clips** Jump, Fall, Land, Roll, Mantle, Dash, Skid in `art/characters/base/build_clips.py`; the character plays them through a `move` state channel and one-shots.
- **Controls** `lib/game/movement/keys.ts` (remappable, this device); ruins: Q dodges, swap on R.
- **Step 4 (integration)**: move `MoveAvatar`'s frame loop into `PlayerAvatar` in place of `advanceMotion` and the cosmetic hop, keeping seats, tap-to-walk, world clips, emotes, nameplate and `onMove`; village world = `villageIsland()`; home and ruins need a `{ top, wet }` from their walkers; the ruins pass the dodge's `DODGE` timings as the dash tuning with i-frames, and Space becomes jump there. Questions: `specs/movement-questions.md`.

## Refine pass (branch `game/movement-refine`, 2026-09-29; rows 249, 250)
David after playing: "Refine movements still, its a lot better tho, i dont understand the jump chain"; picked camera & juice and dash, and "hold to bunny-hop" for the chain.
- **Bunny-hop** (replaces the timed 0.12 s window): sprinting (Shift, moving at 90% of walking pace or more) with Space held, each landing launches the next hop on the same step. A hop adds `hopBoost` 0.7 u/s, up to `hopChainMax` 3 hops over the long jump: 12.7 (the long jump off a full sprint), 13.4, 14.1, then **14.8 u/s** (`topSpeed`), reached about 1 s after the press, a hop every 0.33 s. Letting go ends it on the next landing; a tap is one jump; holding at a walk lands and stays down; a press just before landing is a plain (buffered) jump. `hopChainMax` 0 turns it off ("Today's walk"). The HUD shows a speed pip per hop's worth of speed over the long jump (they fill as it builds and drain as it bleeds off) and "max" at the cap.
- **Dash**: near-instant burst then an ease-out: `dashSpeed` 18 at the press eases (`dashEase` 2) to `dashExit` 0.55 of it, or to the speed you came in with, over `dashTime` 0.2 s: the same 2.5u reach, with no step at the end (the first cut dropped from 14 to 9.8 in one step). The facing snaps to the dash direction. An air dash floats up (`airDashLift` 2 u/s easing to an apex, 0.2u) and then falls, instead of a flat hover. A dash-jump carries the dash up to `topSpeed`. Cooldown 0.5 s from the press, shown by a ring at the feet that fills clockwise and flashes when the dash is back (empty while an air dash is spent). Speed lines (PlayerAvatar's sprint wind rods) through the dash, faint at bunny-hop speed; an FOV punch (`dashKick` 2°). Dash presets in the panel: Burst (default), Glide, Blink, First cut (the previous dash).
- **Camera** (lab only, `useMoveCamera` in `MoveLab.tsx`): the shipped framing set rigidly on a focus the avatar writes, so it neither lags at top speed nor swings sideways (the shipped `useFollowCamera` lerps its position at 5/s and looks at the target, which trails about 3u at 14.8 u/s and turns the view on sideways runs). The focus leads along the velocity (0.1 s, at most 1.5u, eased) and sits at the level the avatar stands on: hops never lift it, landing on a new level, mantling (to the top) and falling below it reframe, a respawn pans. FOV widens up to 2.5° with speed. Yaw stays fixed (rows 5, 154).
- **Juice**: a bunny-hop landing is a quick squash that springs into the stretch; take-off and landing puffs grow with speed and add a trailing puff at a run; a landing ends a short hop's Jump clip (`CharacterMotion.stop`) so it never slides on its feet; a hop's landing leaves its thump to the hop. No new sounds.
- **Evidence**: `specs/evidence/movement-refine/` (bunny-hop with the HUD, camera-top-speed, hop-no-bob, dash, dash-jump, air-dash, tuning-panel, lap), shot by `specs/evidence/movement/shots.mjs`. Lab 144 FPS (display cap), scripted lap 17.1 s.
- **Integration note**: the village keeps `useFollowCamera` until step 4; the rigid follow and level lock come with `MoveAvatar`. Questions: `specs/movement-questions.md` (refine pass).
