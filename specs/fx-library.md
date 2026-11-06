# The effects library

David, 2026-11-05 (rm2-tempest): "i want you to make a mini effect library that organizes types of effects and its a standard so future vfx or effects and r eference and take the template".

Every effect on a rod, a tool or a big moment is built from these types. A new effect picks its types here, copies the template, and keeps the rules. The code is the source of truth for the numbers:

- `web/lib/game/fx/library.ts`: the types, their parameters as made, and what grows with strength (`fxAt`, `fxGrow`).
- `art/pipeline/fx_library.py`: the Blender templates (`part`, `glow`, `light`, `aura_hug`, `trail`, `particles`, `water`, `foam`, `spray`, `sheet`); `art/pipeline/trace_refs.py` traces a reference's own shapes into `traced_refs.py` for them (round 9).
- `web/components/game/character/RodAura.tsx`: draws an effect GLB in a hand, a shop or a cutscene, at a `strength`.
- `web/lib/game/fx/glowOn.ts`: the code-drawn glow on a whole model and the sparks spray.
- `web/lib/game/fx/water.ts`: the Water type's three shaders (body, foam, drops), picked by material name.
- Previews: `/lab/fx` (each type at strength 1 and 2.5), clips `specs/evidence/rod-gear/r8/rg8-fx-*.mp4` and `r9/rg9-fx-water-*.mp4`; `/lab/fx?study=water` and `?study=tidewarden` draw a study at its reference's own framing.

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
| Pulse | A part swelling and easing back | `pulse` extra (a share of its size) | the whole part's size (the Tempest's tip spark) |
| Motion | A part turning, bobbing or orbiting; a moment's whole-thing motion | `spin`, `bob`, `rate` extras; a cutscene's motion in `rodMotion.ts` | speed and reach |
| Flicker | Light crackling (lightning, a fuse) | `flicker` extra (0 to 1) on a Glow part | (as made) |
| Sparks | A one-off spray of sparks off the thing | `sparkRecipe` into the scene's glow pool | how many |
| Burst | A one-off flare: the glow peaks and turns its new colour, the screen takes that colour a moment | the kit's `Awakening` burst beat: outline glow to its peak, a full-screen tint with no shape or edge | (one-off) |
| Water | Water running along the thing (David's fx-aquatic-water-ref.png): a deep teal-blue body with darker diagonal streaks and pale lines, foam breaking along its edges with a faint cyan edge, a crown of foam crashing where it ends, drops flying off and falling | `water` (a ribbon, `Water`: uv across and along, a gate for the grown water), `foam` (a mesh, `Foam`: depth into the foam, phase, crown), `spray` (quads, `Spray`); `lib/game/fx/water.ts` draws them in flat colours with hard edges, one draw each | it runs faster, the foam widens and holds more, more of it shows (the grown water: the Tidewarden's wrap further down the shaft), more drops are thrown |

## Who uses it

- **The awakening cutscene** (RodAwakening, round 8): glow (from the old rung's colour to the new), motion (rodMotion), pulse and motion through the aura's strength, sparks and the burst.
- **The Tempest rod** (round 8): glow and flicker (lightning down the chain), pulse (the tip's spark), motion and trail (a gust winding up the chain), a hugging aura, particles. No halos.
- **The Tidewarden rod** (round 9, against epic-tidewarden-ref.png): water (the ribbon wrapping the shaft under the head, a streamer and a wisp peeling off with foam where they crash, drops trailing away; more of the shaft wrapped with strength), glow (the teal veins cracking through the gold, traced). No discs, no aura.
- **The Water type's sample** (round 9): a 1:1 study of the Aquatic sword, traced from its reference (the blade, the foam, the loose drops) with a modelled shell hilt.
- **Made before the library:** the Titanium still has `Halo` discs and a spindle aura (its redo is on its own lane). Riptide has no reference on file yet.
