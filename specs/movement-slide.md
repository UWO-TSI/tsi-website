# Slide and momentum tech (row 274)

David, 2026-10-01, after playing movement feel milestone 1:

> "movement getting better, i want a slide option, that allows slide off ramp or dash to slide movement tech, dash gives speed momentum and proper movement tech should carry or increase momentum, ctrl to slide/crouch"

His standing bar for movement: "feel good and seamless, not buggy ... make it fun but not too crazy, just juicy." Every small thing is a feature (row 273).

## Where it stands
`web/lib/game/movement/sim.ts`:
- **The step:** a pure 120 Hz step with modes ground, air, skid, roll, recover, mantle, splash and glide.
- **Speeds:** walk 7.4, sprint 12, a long jump to 12.7, a held bunny-hop adding 0.7 per hop up to `topSpeed` 14.8. Speed over the target bleeds at `overspeedDecay` 5 u/s² on the ground.
- **Dash:** 18 at the press, easing to 0.55 of that. A dash-jump carries it, capped at `topSpeed`.
- **World:** two queries, `{ top, wet }`. The ground's slope comes from the terrain blend (one level is a slope, two is a kit cliff; ramps cross cliffs).
- **Keys** (`keys.ts`): Space jump, Q dash, Shift sprint, C sneak (`sneakSpeed` 2.2, which bugs don't flee from).

## The slide
- **Key:** Crouch/Slide replaces Sneak as one action.
  - Default Ctrl on Mac.
  - Default C on Windows and Linux: there Ctrl+W closes the browser tab and a page cannot block it. Ctrl works on those systems in fullscreen through the browser's keyboard lock; offer it there.
  - Remappable in Settings like the rest.
  - Touch gets a slide/crouch button.
- **Crouch:** held at walking speed or slower, the character crouches and crouch-walks at sneak speed. This is the old sneak, so bugs still don't flee. It has its own crouch idle and crouch-walk clips.
- **Slide:** pressed while moving faster than walking (a sprint, a dash, a landing at speed), the character drops into a slide.
  - Low friction, keeping its speed.
  - Slow decay on flat ground: it should last about 1–1.5 s from a sprint.
  - Gentle steering.
  - It ends when speed falls to a walk, Ctrl is released, or you hit something (a bonk, never stuck).
- **Slopes and ramps:**
  - Gravity along the slope speeds a slide downhill and slows it uphill. This uses the real slope from `top()`: ACNH ramps, terrain slopes and blended half steps.
  - Sliding off a ledge or a ramp's end keeps the speed into the air.
- **Momentum tech, each carrying or adding speed:**
  - **Dash → slide:** press slide during or just after a dash (a short window) and the slide starts at the dash's speed.
  - **Slide → jump:** a slide-jump keeps the slide's speed with a lower, longer arc. Holding Space feeds the bunny-hop, which keeps it.
  - **Land → slide:** holding slide on landing at speed lands straight into a slide that keeps the landing speed. This replaces the roll and its speed loss.
  - **Hop → slide → hop:** chains that keep speed, never add more than a small amount per link.
  - **Slide → glide:** sliding off a cliff and opening the glider carries some extra speed into the glide, easing to glide speed.
- **Not too crazy:**
  - A new momentum ceiling above `topSpeed` reached only by tech: about 18 u/s on flat, more only downhill.
  - Speed over the ceiling bleeds quickly.
  - Every number is in `MOVE_TUNING` with a Slide group in the `/lab/move` panel, with presets.
- **Juice** (the movement-feel standard, using the particle pack and system already on main):
  - A slide pose clip: lean back, lead leg out, one hand trailing.
  - A dust or scuff trail from the heels, tinted by the ground; grass flecks on grass, sand spray on sand.
  - A small camera drop and an FOV kick on entry.
  - A spray burst on a dash-slide.
  - A pop of dust on the slide-jump.
  - Sounds from the existing set, re-pitched; list the missing ones.
- **Areas:**
  - On in the village, the home island and the ruins (no i-frames in the slide).
  - Off in interiors and the café (walk only, row 269).
  - The applicant island follows the village.
- **Multiplayer-forward:** slide is sim state and events like the rest: deterministic and the same at any frame rate.

## Momentum model (David, 2026-10-01)
> "it shouldnt be a dash and then the momentum is gone, momentum is gone only if you dont conserve it with a slide and hit ground without doing any movement combo"

- **The dash adds momentum that persists.** Its burst (18 u/s) eases to `dashExit` 0.9 of itself, **16.2 u/s**, and that speed stays: it no longer fades to 0.55 on its own.
- **Kept while you chain tech:** the air has no drag on horizontal speed (steering only); dash → slide, dash → jump, slide → jump, landing into a slide (key held), landing into a hop (Space held, or buffered), slide → glide, and sliding downhill (which gains).
- **Lost only on plain ground:** a landing with no slide or hop, a dash ending on the ground with nothing after it, letting go of a slide. A grace of `keepGrace` **0.12 s** holds the speed first, so a slightly late slide or jump still catches it; then it bleeds back to a run or walk at `overspeedDecay` **18 u/s²** (from 16.2 to a walk in 0.48 s, to a sprint in 0.22 s).
- **Ceilings:** `momentumCeiling` **18 u/s** on flat ground; downhill it rises by `downhillCeiling` 10 × the slope's sine; a slide over it bleeds at `ceilingBleed` 30 u/s². Every take-off is capped at the ceiling where you stand. A link adds at most `techBoost` 0.4 (a land into a slide, a slide-jump); a hop adds `hopBoost` only up to the bunny-hop's `topSpeed` 14.8 and keeps anything over it.
- **The ruins keep the dodge's shape** (`DODGE_SHAPE` in `lib/game/combat/actions.ts`: exit 0.55, bleed 5, no grace), so the arena's dodge and its balance pass are unchanged.
- **The lab readout** shows the carried speed and whether it is kept or bleeding (the sim's `keep` and `bleed`).

## Build order (a commit each)
1. **Sim:** the slide and crouch modes, the slope force, every tech transition, and the ceiling.
   - Tests: entry speeds, decay on flat, gain downhill and loss uphill, dash-slide speed, slide-jump carry, land-slide, the ceiling holding, no stuck states at walls, cliff edges, ramps and water, the same path at 30/60/144 Hz.
   - Crouch keeps sneak's bug rule.
2. **Keys:** the per-platform default and remapping, the touch button, and the keyboard lock in fullscreen.
3. **Clips:** crouch idle, crouch walk, slide and slide-exit on the v6 rig (`art/characters/base/build_clips.py`), rebuilt like the movement-feel pass did.
4. **Juice:** effects and camera through the particle system.
5. **Lab:** a slide lane in `/lab/move` with a long ramp, a terrain slope, a dash-slide straight, a gap only slide-jump clears, and a ramp launch; plus the Slide panel group and a speed readout.
6. **Integration:** the village, the home island and the ruins.

Then **movement-feel milestone 2** (`specs/movement-feel.md`):
- skid, mantle, glide, splash and roll effects;
- footprints on sand, wet sand and snow;
- the clip transition table and stride matching;
- residents' footstep dust.

## Evidence
`specs/evidence/movement-slide/`:
- frame strips of crouch, slide, slide downhill, dash-slide, slide-jump over the gap, land-slide and the ramp launch;
- a speed graph of a full tech chain;
- the tuning panel;
- FPS unchanged.
