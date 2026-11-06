# The effects library

David, 2026-11-05 (rm2-tempest): "i want you to make a mini effect library that organizes types of effects and its a standard so future vfx or effects and r eference and take the template".

Every effect on a rod, a tool, a weapon, clothes or a big moment is built from these types. A new effect picks its types here, copies the template, and keeps the rules. David, 2026-11-06 (rg8-fx): "non of these have proper animation i need you to redo them, and add more and show me one by one the animation, have a pedals animation liek sakura flower pedals, electricity, puslign fire sparks, flame, water allat. this wont only be for fishing rod but for weapon, vfx clothes etc". So since round 10 every type but Water and Sway is also drawn by code on **any holder** (HolderFx), and the previews show one type at a time on a rod and a sword. The code is the source of truth for the numbers:

- `web/lib/game/fx/library.ts`: the types, their parameters as made, and what grows with strength (`fxAt`, `fxGrow`).
- `art/pipeline/fx_library.py`: the Blender templates (`part`, `glow`, `light`, `aura_hug`, `trail`, `particles`, `water`, `foam`, `spray`, `sheet`); `art/pipeline/trace_refs.py` traces a reference's own shapes into `traced_refs.py` for them (round 9).
- `web/components/game/fx/HolderFx.tsx` and `web/lib/game/fx/holder.ts`: the types drawn by code on any holder (a rod, a sword, a hat). It reads only the holder's own shape: 64 points and normals sampled off its meshes, its long axis, its size. At most four draws: a glow shell (glow, pulse, flicker, the burst's flare), an aura shell, one particle pool in the world (the library pack, `web/public/assets/fx/fxlib-pack.webp`: the combat pack's mote, spark burst, flare, bolt, flame, wave and droplet rows cut out by `art/fx/build_pack.py fxlib`, and a sakura petal painted there), and a trail. `strength` eases; `once` throws the one-offs; `strike` plays a strike. Its pool is registered in `budget.ts` PARTICLE_POOLS (320).
- `web/components/game/character/RodAura.tsx`: draws an effect GLB in a hand, a shop or a cutscene, at a `strength` (and springs its Sway parts).
- `web/lib/game/fx/glowOn.ts`: the code-drawn glow on a whole model and the sparks spray.
- `web/lib/game/fx/water.ts`: the Water type's three shaders (body, foam, drops), picked by material name.
- Previews: `/lab/fx?type=<kind>`, one type at a time on a plain rod and a sword moving as a hand moves them, its strength going 1, 2.5, 1 (clips `specs/evidence/rod-gear/r10/rg10-fx-<kind>.mp4`); `?type=lightning` and `?type=wave` the strikes; `?type=sway` the Cedar swung and stopped; `/lab/fx?study=water` and `?study=tidewarden` draw a study at its reference's own framing.

## The rules

1. **No circle or ring glows.** Light follows the thing's own shape: its Glow parts, an aura hugging it, the outline glow. Never a disc sprite, a halo or a ring drawn round it (David 2026-11-05, on the awakening and the Tempest).
2. **Colour comes from the thing:** its rung's colour or its material's, never plain white light.
3. **One material per effect part,** so each part is one draw. A holder's effect costs at most five draws, trails included (specs/perf/effects-cost.md; RodAura.test.ts checks it).
4. **Strength 1 is as made.** Every type says what grows with strength. An awakening raises it (`auraAt` in rodMotion.ts: 1 + 0.5 per awakening).
5. **The rod stays one plain mesh, nothing emissive.** Everything that glows or moves is in the effect GLB (`rodfx-<name>.glb`), named by the rod's `rodFx` extra, or drawn by HolderFx.
6. **Holder-agnostic.** A type never knows what holds it: it reads the holder's surface, axis and size. A new holder (a sword, a hat) needs no new code. Skinned holders (clothes on a body) are not sampled yet: their effect rides a bone or a rigid accessory until they are.
7. **Every type animates.** Nothing in the library is a still: it runs, flows, breathes, beats, crackles, falls or rises.

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
| Electricity | Lightning crawling over the thing: short jagged bolts jumping between points on it, re-struck 16 times a second, a spark where each lands, now and then an arc out into the air | HolderFx: the pack's bolt laid between two surface points in jagged pieces, its flare at the end | more bolts at once, longer jumps, more arcs |
| Fire sparks | Fire sparks thrown off in pulses, rising, flickering and drifting, a few between the pulses | HolderFx: mote and spark burst through the fire ramp | more a pulse, quicker pulses |
| Flame | Fire tongues all along it rising and tearing off at the tip, embers off the top | HolderFx: the pack's looping fire tongue standing on surface points, the fire ramp | more tongues, taller |
| Sakura petals | Cherry petals letting go, tumbling, drifting on the breeze and fluttering down | HolderFx: the pack's painted sakura petal, a pink ramp | more petals |
| Gather | Light drawn in to the thing from all round, each mote arriving as it fades (a moment's build-up) | HolderFx: motes thrown at its surface from a ball round it | more motes |
| Sway | Soft parts (leaves, cloth, hair) swinging after the thing like a spring as it moves, stirring a little on their own | a `sway` extra on an effect GLB part; RodAura springs it after its holder's motion, each vertex bent by its reach from the axis | how far it swings |
| Strike (lightning, a wave) | An outside thing acting on the thing in a moment: the tip crackles, then a bolt comes down out of the sky onto it, forks and strikes twice more; or a crest rises beside it, curls and crashes over it, its spray flung up and falling | HolderFx `strike`, `throwStrike` in holder.ts (the pack's bolt and flare; its wave and droplets) | (one-off) |
| Water | Water running along the thing (David's fx-aquatic-water-ref.png): a deep teal-blue body with darker diagonal streaks and pale lines, foam breaking along its edges with a faint cyan edge, a crown of foam crashing where it ends, drops flying off and falling | `water` (a ribbon, `Water`: uv across and along, a gate for the grown water), `foam` (a mesh, `Foam`: depth into the foam, phase, crown), `spray` (quads, `Spray`); `lib/game/fx/water.ts` draws them in flat colours with hard edges, one draw each | it runs faster, the foam widens and holds more, more of it shows (the grown water: the Tidewarden's wrap further down the shaft), more drops are thrown |

The code-drawn versions of the older types (HolderFx): **glow** a shell a hair off its shape, lit at its rim, a band of light running up it, breathing; **aura** a shell further off, its edge licking upward, tongues of its colour rising off it; **particles** motes drifting up off its whole surface; **trail** a blade of light swept behind its outer half as it swings (the weapon trail's shader); **pulse** the glow shell beating lub-dub; **motion** three comets spiralling up round it with short tails; **flicker** the glow shell crackling; **sparks** a flare and a burst of streaks at its tip, sparks off its surface; **burst** the shell flaring, a big four-point flare and streaks.

## Who uses it

- **The awakening cutscene** (RodAwakening, rounds 8 and 10): glow (from the old rung's colour to the new), motion (rodMotion) with a tremble that grows, gather (light drawn in through the glow and the pulse), the hush, the impact frames, the burst, and a strike from outside when the awakening brings a new look or effect (rodMotion `AWAKEN_FX`: the Tempest is struck by lightning and wears electricity after; the Tidewarden takes a wave and its water reaches further).
- **The Cedar rod** (round 10): its foliage is its effect (`rodfx-cedar.glb`), Sway.
- **The Tempest rod** (round 8): glow and flicker (lightning down the chain), pulse (the tip's spark), motion and trail (a gust winding up the chain), a hugging aura, particles. No halos.
- **The Tidewarden rod** (round 9, against epic-tidewarden-ref.png): water (the ribbon wrapping the shaft under the head, a streamer and a wisp peeling off with foam where they crash, drops trailing away; more of the shaft wrapped with strength), glow (the teal veins cracking through the gold, traced). No discs, no aura.
- **The Water type's sample** (round 9): a 1:1 study of the Aquatic sword, traced from its reference (the blade, the foam, the loose drops) with a modelled shell hilt.
- **The Titanium** (rod-titanium round 1): metal, not magic, so its effect is quiet: a glint on its point (light, pulse) and a few glints off it (particles). Its awakening is the first with its own model (`Awakening.model` in rods.ts; `rod-titanium-a1.glb`, `rodfx-titanium-a1.glb`): cyan energy in its plates' panel lines (glow, flicker), a core in its ring hub (glow, pulse), solid energy blades (glow, pulse), sparks. No aura and no additive light on it: on the shop's white they washed its plates pale (round 1b).
- **Made before the library:** the reserved rod (the old Titanium, `rod-reserved-slate`) still has `Halo` discs and a spindle aura. Riptide has no reference on file yet.
