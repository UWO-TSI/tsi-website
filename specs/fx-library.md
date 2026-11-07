# The effects library

David, 2026-11-05 (rm2-tempest): "i want you to make a mini effect library that organizes types of effects and its a standard so future vfx or effects and r eference and take the template".

Every effect on a rod, a tool or a big moment is built from these types. A new effect picks its types here, copies the template, and keeps the rules. The code is the source of truth for the numbers:

- `web/lib/game/fx/library.ts`: the types, their parameters as made, and what grows with strength (`fxAt`, `fxGrow`).
- `art/pipeline/fx_library.py`: the Blender templates (`part`, `glow`, `light`, `aura_hug`, `trail`, `particles`).
- `web/components/game/character/RodAura.tsx`: draws an effect GLB in a hand, a shop or a cutscene, at a `strength`.
- `web/lib/game/fx/glowOn.ts`: the code-drawn glow on a whole model and the sparks spray.
- Previews: `/lab/fx` (each type at strength 1 and 2), clips `specs/evidence/rod-gear/r8/rg8-fx-*.mp4`.

## The rules

1. **No circle or ring glows.** Light follows the thing's own shape: its Glow parts, an aura hugging it, the outline glow. Never a disc sprite, a halo or a ring drawn round it (David 2026-11-05, on the awakening and the Tempest).
2. **Colour comes from the thing:** its rung's colour or its material's, never plain white light.
3. **One material per effect part,** so each part is one draw. A holder's effect costs at most five draws, trails included (specs/perf/effects-cost.md; RodAura.test.ts checks it).
4. **Strength 1 is as made.** Every type says what grows with strength. An awakening raises it (`auraAt` in rodMotion.ts: 1 + 0.5 per awakening).
5. **The rod stays one plain mesh, nothing emissive.** Everything that glows or moves is in the effect GLB (`rodfx-<name>.glb`), named by the rod's `rodFx` extra.

## The types

| Type | What it is | How it's made | Grows with strength |
|---|---|---|---|
| Glow | The thing's own parts lit from within, and a soft glow that follows its outline | An effect part with a `Glow` material, shaped like the edge, seam or tip it lights (`glow`); in a moment, `glowOn` on the whole model and the kit's outline glow | amount, outline reach |
| Aura | A soft shell hugging the thing's shape, brightest where it faces you and fading to nothing at its edges, breathing | `aura_hug`: the thing's main parts inflated along their path, `Aura` material. Never a sphere, a spindle or a disc | (shared material: as made) |
| Particles | Motes drifting up off the thing | `particles(...)`: the scene extras `spark`, `sparkSprite`, `sparkEvery`, `sparkSize`, `sparkRise` | how often |
| Trail | A fading ribbon behind a moving part | `trail(width, at)` extras on a moving part; RodAura draws the ribbon in the part's colour | how long it lasts |
| Pulse | A part swelling and easing back | `pulse` extra (a share of its size) | the whole part's size (the Tidewarden's pearl) |
| Motion | A part turning, bobbing or orbiting; a moment's whole-thing motion | `spin`, `bob`, `rate` extras; a cutscene's motion in `rodMotion.ts` | speed and reach |
| Flicker | Light crackling (lightning, a fuse) | `flicker` extra (0 to 1) on a Glow part | (as made) |
| Sparks | A one-off spray of sparks off the thing | `sparkRecipe` into the scene's glow pool | how many |
| Burst | A one-off flare: the glow peaks and turns its new colour, the screen takes that colour a moment | the kit's `Awakening` burst beat: outline glow to its peak, a full-screen tint with no shape or edge | (one-off) |

## Who uses it

- **The awakening cutscene** (RodAwakening, round 8): glow (from the old rung's colour to the new), motion (rodMotion), pulse and motion through the aura's strength, sparks and the burst.
- **The Tempest rod** (round 8): glow and flicker (lightning down the chain), pulse (the tip's spark), motion and trail (a gust winding up the chain), a hugging aura, particles. No halos.
- **The Titanium** (rod-titanium round 2): metal, not magic, so the rod as bought has no effect: its rainbow glisten is its material (a thin film, KHR_materials_iridescence). Its awakening is the same rod opened (`Awakening.model` in rods.ts; `rod-titanium-a1.glb`, its morph target the closed rod, which the cutscene opens), with `rodfx-titanium-a1.glb`: a blue core between its parted plates (glow) and hexagons of light round the core, turning (glow, motion). No halo, aura or sparkles.
- **Made before the library:** the Tidewarden still has `Halo` discs and a spindle aura. It stays as it is until David's reference for it lands (Tidewarden and Riptide have none on file yet).
