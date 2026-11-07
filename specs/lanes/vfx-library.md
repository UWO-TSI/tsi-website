# Lane: vfx-library (the VFX library: auras and effects)

Worktree `.claude/worktrees/vfx-library`, branch `game/vfx-library`, cut from `game/rod-gear` at 544018464 (rods round 10). Agent type `uwotsi-lane`. Dev port 3500.

The effects library was built inside the rods lane (rounds 8 to 10). David moved it out: "this should be turned into its own lane artifacr called aura and effects and not in rod awakenings", and named it: "for auras and effects make it VFX library". This lane owns it now: `web/lib/game/fx/library.ts`, `water.ts` and the effect types and shaders, `art/pipeline/fx_library.py`, `/lab/fx`, `specs/fx-library.md` (rename it `specs/vfx-library.md` and the library's names to VFX). rod-gear (rods) and rod-titanium use its types; they don't change them. Read `specs/lanes/rod-gear.md` (Status rounds 8 to 10, Tools) and the spec first.

## Round 1: David's VFX notes from rods 9 and rods 10 (2026-11-06, verbatim)

Approved: rg10-fx-pulse, rg10-fx-sway.
- rg10-fx-aura (redo): "no aura just a glow and make it bright, aura really is just like energy and like neon with slight glow effect and is like accessory parts and effect on parts ranther than an actual aura maybe call it energy, theres like auras and effects"
- rg10-fx-electricity (redo): "make it move slower and more crackly not flashing mut you can see the movement of the elctricity, it feels the charge up build up before zaping"
- rg10-fx-embers (redo): "should not feel liek firewarks, like its bright yellow sparks that are fask and randomized not in a circle"
- rg10-fx-flame (redo): "horrible i will give references"
- rg10-fx-flicker (redo): "remove"
- rg10-fx-gather (redo): "not epic enough and boring"
- rg10-fx-glow (redo): "i want sun glistening off it like light fractures kinda thing"
- rg10-fx-lightning (redo): "charge with more suspense, the weapon needs a flash frame when struck, more juice, freeze frame in turn white and slight shake"
- rg10-fx-motion (redo): "refine and improve to be more juicy"
- rg10-fx-particles (redo, no note)
- rg10-fx-petals (redo): "less pedals and make it looks like its glowing cuz its a effect sho it should be bring with glow, make it swirl with the blade and doesnt fall from gravity cuz it feels like theres wind effects that lifts the pedals and moves it with the blade"
- rg10-fx-sparks (redo): "remake to be better i will provide general referecnes for effects"
- rg10-fx-trail (redo): "white, less opacity, make the tip a more opacity line"
- rg10-fx-water (redo): "take the water texture and effect not the actual blade, and water internally should move vaster and the foam too and have lots of water droplets like tanjiro water breathing demon slayer"
- rg10-fx-wave (redo): "yeah just delete ts"
- rg9-fx-water (redo): "water effect needs to be faster, the lighter blue white s are the foam from crashing, make the water flwo faster and make the cashing of the water naturally create the foam and make it faster and crash harder. and water dripping off should feel natural"

Build (coordinator):
1. **Two families, as David names them:** effects (things that happen: sparks, lightning, water, petals, trails) and auras, which he says are really **energy**: bright neon glow on the thing's own parts, like accessory parts lit up, not a shell around it. Rename "Aura" to Energy and rebuild it that way.
2. **Each type as noted:** glow becomes sunlight glinting and fracturing off the surface; electricity slower, crackling, visibly travelling, with a charge-up before it zaps; embers as bright yellow sparks, fast and random, never a ring or fireworks; gather made epic; lightning with more suspense in the charge, a flash frame on the strike, a white freeze frame and a slight shake; motion juicier; petals fewer, glowing, swirling with the blade on a wind (not falling); trail white, fainter, with a stronger line at the tip; water as the effect and texture only (not the sword), moving much faster inside, foam made by the water crashing, harder crashes, natural drips, and lots of droplets in the style of Tanjiro's Water Breathing. Particles: best guess (no note).
3. **Delete** flicker and wave. **Flame and sparks wait for David's references**: leave them as they are and say so.
4. Keep the holder-agnostic design (rods, swords, later clothes) and the draw budget (specs/perf/effects-cost.md).
5. **The review page is its own, "VFX Library":** one card per type, each a clip on a rod and a sword at strength 1 and 2.5, plus a questions card.

Evidence `vfx1-*` in `specs/evidence/vfx-library/r1/`.

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, headless clips (record on the GPU headless as rods r10 did), one perf:check at the end.

## Status

- **Round 1 built** (on 21226b285; the build e53167bf0, lane file after). Gates: tsc clean; full vitest 3812 passed + 4 skipped both with and without `NEXT_PUBLIC_GAME_WORLD=new`; eslint clean on changed files; perf:check v2 with the Tidewarden held (SKIP_BUILD after measure-build.sh, HELD_ROD=rod-5.glb, 3 runs, load 4.7 to 4.9) passed: high 5.00 ms, 358 draws; lite 3.00 ms, 285 (specs/perf/effects-cost.md).
  - **The VFX library** (specs/vfx-library.md, renamed from fx-library.md; `FX[kind].family`): auras (Energy, Sun glint, Pulse) and effects (the rest). Code names stay (FxKind, fxAt, HolderFx) so the rods lanes don't break.
  - **Energy** (was Aura): the holder's feature edges (40 degrees, 20 if few; at most 900) as neon tubes facing you, a coloured core and a slight glow, pulses running up them (HolderFx `energyLines`, ENERGY shaders).
  - **Sun glint** (was Glow): the glow shell lit by a band of sun sweeping along it (`sweepAt`), broken into 3D Voronoi facets with rainbow fractures and twinkles; star glints (flare) where it catches.
  - **Electricity**: crawlers hopping point to point up its surface, each piece lingering 0.22 s; a charge cycle (`chargeAt`, `ZAP_AT` 0.86): more arcs, faster, the shell lit, sparks drawn in, then one jagged arc base to tip with a flare and sparks.
  - **Embers**: bright yellow streaks (the pool's new `streak`), random directions, no pulses or ring. **Petals**: 3 a second, each a petal over a larger faint copy (`twin`), steered round the axis (`bind`, `orbit`, `swirl`, `lift`; `step(dt, axis)`), let go on the wind, never falling. **Gather**: steered spiral streaks, beams into the tip (a delayed flare where each lands: `delay`), big orbs, landing flashes, the glow shell building. **Motion**: eased comets, streaked tails, sparkle, a flash at the tip. **Particles**: swirling, twinkling (`twinkle`), a few big soft ones. **Trail**: white, 0.22 opacity, a bright tip line (its own shader; the combat trail untouched).
  - **Lightning strike**: the charge builds faster and reaches down it, a held breath (`HUSH` 0.22 s), then the bolt; HolderFx flashes the holder white, holds its particles still (`FREEZE` 0.12 s), then shakes it (`SHAKE` 0.32 s); `Strike.onHit(ms)` lets the host freeze too (the lab does).
  - **Water on any holder**: `waterWrap` (two ribbons spiralling up its outer part), the trail drawn in the Water shader (its end breaking into foam), a 200-drop solid pool (`dropMaterial`; `throwWater`: flung with the swing's speed, thrown up at the top's crash, drips swelling then falling). The Water shaders run faster (flow 1.5) with crash foam bursting in from an edge and carried off, colour b an end that foams and breaks; Foam and Spray faster (the Tidewarden's GLB shares them).
  - **Deleted**: Flicker; the wave strike and `AWAKEN_FX.rod_tidewarden` (the Tidewarden awakens with no strike; `aw-wave` is unused, left for the rods lane); the Aquatic study (`fxlib-water.glb`, `aquatic()` and `samples` in fx_library.py, `aquatic()` and four helpers in trace_refs.py, `AQUATIC` in traced_refs.py, its budget exception, `?study=water`); the pack's wave row (fxlib-pack.webp rebuilt, 7 rows).
  - Flame and Sparks unchanged: they wait for David's references.
  - Evidence `specs/evidence/vfx-library/r1/` (shots.mjs): `vfx1-<kind>.mp4` and `-poster.png` (strength 1 | 2.5) for all 16, `vfx1-lightning-strip.png`, `vfx1-questions.png`.

## David's decisions

- 2026-11-06 (rods 9 and 10 review, verbatim in Round 1 above). Approved: rg10-fx-pulse, rg10-fx-sway.

## Next

0. David reviews the "VFX Library" page (round 1); his notes come back as round 2.
1. Flame and Sparks when David's references land.
2. On his answers: the families split, the Tempest GLB's `flicker` extra, a water look for the Tidewarden's awakening, the hit-stop's reach in the game, parts that never light with Energy.

## Tools and gotchas

- Shots: `specs/evidence/vfx-library/r1/shots.mjs` (PW, SHELL_BIN, BASE; ONLY=fx,cards; FX=kind,...; SEC; OUTDIR for probes). Clips on the GPU headless (ANGLE Metal). It waits for the strength to flip down to 1, so each clip runs 1, 2.5, 1. Pass it as an absolute path: the dev-shoot wrapper cds into web.
- Dev-shoot wrapper: scratchpad `vfx/devshoot.sh` (port 3500, Supabase blanked, one command, kills only its own PIDs), inside `withlock.sh devserver`. Locks are contended: run it with `run_in_background` and wait for the notice; never wrap it in `timeout` (the lock wait alone can pass 10 minutes).
- The lab canvas must be opaque (`<color attach="background">`): an additive effect writes alpha 1, so on a clear canvas the page shows through it as a black band.
- A pool streak's quad is `size + path * (1 + (fill - 1) / 2)` long: the mote sprite's shape fills a quarter of its cell.
- GLSL in water.ts shares one scope per shader: a new name can clash with the bubbles' `cell` (it did).
- `measure-build.sh` refuses uncommitted changes in gated files: commit first. perf:check deletes web/.next after.

## Rules

Same as `specs/lanes/rod-gear.md` Rules with your own lane in the locks: `LANE=game/vfx-library /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`. Headless only; never `open`; never the Playwright MCP, claude-in-chrome or blender MCP tools; Blender only as `-b --factory-startup -P`; pack GLBs after exports. Never ports 3000, 3300, 3301, 3390. Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; never touch prod. No em dashes; never the gem-to-money rate. Never fetch art; flame and sparks wait for David's references. Ponytail code.
