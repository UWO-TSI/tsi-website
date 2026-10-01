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

## Built: steps 1 to 6 (branch `game/movement-slide`, 2026-10-01)
- **Sim** (`lib/game/movement/sim.ts`): `mode: "slide"` and a `crouch` flag; events `slide`, `dashslide`, `landslide`, `slidejump`, `stand` (and `bonk`). The crouch key held at a walk or slower crouch-walks at `sneakSpeed` 2.2 (bugs read it as before: under their 2.4 line). Held faster than `slideEnterAt` 1.12 × walk (8.3 u/s) it slides: `slideFriction` 3.5 u/s² (a sprint slides **1.32 s over 12.8 tiles**), `slideSlope` 20 × the slope's sine from `top()` (`slopeAt`: ramps, terrain banks, half steps; a step steeper than 1.6 is an edge), `slideTurn` 2.2/s; it ends at a walk (`slideEndAt` 1, into the crouch), on letting go (into the run, the grace holding its speed) or on a bonk. Tech: a dash plays its 0.2 s burst, then slides at its kept **16.2**; a slide-jump adds `techBoost` 0.4 on its own arc (`slideJumpHeight` 0.55, `slideJumpApexTime` 0.26: 0.48 s in the air) and also fires within the grace after letting go or coyote time after sliding off an edge; landing with the key held at speed slides at the landing's speed + 0.4 (no roll or recovery); sliding off a ledge keeps the speed into the air and into the glider. Momentum as above (`keepGrace`, `overspeedDecay` 18, `momentumCeiling` 18, `downhillCeiling` 10, `ceilingBleed` 30); `keep`, `bleed` and `slid` on the state. Distances on flat ground: long jump 4.2 tiles, dash-jump 5.4, a sprint's slide-jump 5.9, a dash-slide's slide-jump 7.9. Tests (1204 in all, 1177 before): entries, flat decay, gain downhill and loss uphill on a long ramp, a steep ramp and banks, the ceiling, dash-slide, slide-jump, land-slide, hop-slide-hop links, slide into the glider, the walk-only café, bonks, the momentum rules, the slide lane, fuzzed edges, the same chain at 30/60/144 Hz.
- **Keys** (`lib/game/movement/keys.ts`): one "Crouch / slide" action (`crouch`), Ctrl on macOS, C elsewhere; outside macOS, Settings offers "Play fullscreen with Ctrl" (`navigator.keyboard.lock`, Chromium), C standing in outside fullscreen. Only crouch can take Ctrl. With Ctrl bound, the key binder treats Ctrl combos as play. Touch: a held Slide button. Hints: "Crouch, at speed slide" (ruins: "Slide").
- **Clips** (`art/characters/base/build_clips.py`, v7 head, `v7_clips.glb`): CrouchIdle, CrouchWalk (measured footfalls), SlideIn, SlideInDash (sharper, lower), Slide (a loop), SlideUp, SlideJump, SlideStand, SlideBonk. The engine leans the slide into the steer and lies it back deeper with speed; a transition table (`crossfade` in `lib/game/character/clips.ts`) hands run → slide → slide-jump → air → land-slide over in 0.03 to 0.08 s.
- **Juice** (`lib/game/movement/juice.ts`, `PlayerAvatar`): a trail every half tile (dust off the heels, the ground's spray from the lead heel, a scuff every third beat), a spray on a dash- or land-slide, a pop on the slide-jump, an FOV punch (1.5°, 2° from a dash or landing) and a 0.18u camera drop while sliding, the bonk's stumble, dip, thud and puff; crouch steps throw half the dust at half the volume. Juice panel: slideTrail, slideBurst, slideKick, slideDrop.
- **Lab** (`/lab/move`, "Slide lane"): a shelf north-east of the lap with the dash-slide straight to a 7-tile water gap (only a slide-jump clears it; a dash-jump at best catches the far ledge), the ramp launch off a two-level tower, a long ramp and a terrain slope with an 8-tile run-up. Slide and Momentum groups with presets; the HUD says kept or bleeding and traces the last 3 s of speed.
- **Areas:** the village, the home island, the applicant island and the ruins all run `PlayerAvatar`, so the slide is on in each; in the ruins the dodge keeps its shape and a slide faces its travel, not the aim. The café is walk only: crouch works, a slide can't start. Interiors keep their own walker.
- **Questions:** `specs/movement-slide-questions.md`.
