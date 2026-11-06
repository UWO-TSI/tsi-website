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

## Rules

Same as `specs/lanes/rod-gear.md` Rules with your own lane in the locks: `LANE=game/vfx-library /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`. Headless only; never `open`; never the Playwright MCP, claude-in-chrome or blender MCP tools; Blender only as `-b --factory-startup -P`; pack GLBs after exports. Never ports 3000, 3300, 3301, 3390. Commit with `[build]`; never push; never bare `git stash`; work only in this worktree; never touch prod. No em dashes; never the gem-to-money rate. Never fetch art; flame and sparks wait for David's references. Ponytail code.
