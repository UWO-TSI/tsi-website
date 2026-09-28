# Movement tech: momentum hops, climb and a Q dash (rows 243, 244)

David (2026-09-28) picked "momentum hops + climb" and added: "it's gotta feel good and seamless, not buggy, give character 'q' to dash, and make it fun but not too crazy, just juicy." Later unlocks (not in this build): glider, swimming and diving, sailing the boat yourself (row 245).

## Today (survey 2026-09-28)
A smooth flat walk (`PlayerAvatar.tsx`, `lib/game/locomotion.ts`): 7.4 u/s walk, unlimited ×1.85 sprint, a purely cosmetic 0.5 s hop, no gravity, falling, climbing or momentum; a 1.5 u cliff blocks both ways; the runtime `canStep` blocks ramp tops the reachability test allows; water is a wall; no jump/land/climb/roll/dash/skid clips; keyboard only; the follow camera is fixed (rows 5, 154).

## The kit
- **Jump (Space)**: real vertical physics with gravity, variable height by hold, coyote time and jump buffering, a short apex hang, moderate air control. Replaces the cosmetic hop.
- **Momentum**: sprint (Shift) builds speed over about a second; a hop timed on landing keeps speed and can add a little, up to a low cap (a few chained hops, "not too crazy"); sharp turns at speed skid; stopping slides briefly.
- **Long jump**: jumping at sprint speed gives a longer, flatter arc that clears a 2–3 tile river.
- **Q dash**: a short burst in the input direction on the ground or once in the air (resets on landing), short cooldown; dash then jump carries the dash speed.
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
