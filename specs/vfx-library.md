# The VFX library: auras and effects

David, 2026-11-05 (rm2-tempest): "i want you to make a mini effect library that organizes types of effects and its a standard so future vfx or effects and r eference and take the template". 2026-11-06 (rods 10): "this should be turned into its own lane artifacr called aura and effects and not in rod awakenings"; "for auras and effects make it VFX library". It is its own lane now (`specs/lanes/vfx-library.md`).

Every effect on a rod, a weapon, clothes or a big moment is built from these types. A new effect picks its types here and keeps the rules. Every type but Sway is drawn by code on **any holder** (HolderFx); the previews show one type at a time on a rod and a sword. The code is the source of truth for the numbers:

- `web/lib/game/fx/library.ts`: the types, their family, their parameters as made, and what grows with strength (`fxAt`, `fxGrow`).
- `web/components/game/fx/HolderFx.tsx` and `web/lib/game/fx/holder.ts`: the types on any holder. It reads only the holder's own shape: 64 points and normals sampled off its meshes, its long axis, its size, how fast it moves. Its draws, each only when a type it wears needs one: a glow shell, the energy lines, one particle pool in the world (the library pack, `web/public/assets/fx/fxlib-pack.webp`, through the combat particle shader and its ramps), a trail, and for water its wrap and a drops pool. Pools registered in `budget.ts` PARTICLE_POOLS (320 + 200 drops). `strength` eases; `once` throws the one-offs; `strike` plays a strike (`onHit(ms)` tells its host to freeze too).
- `web/lib/game/fx/water.ts`: the Water type's shaders (body, foam, drops on effect GLBs; `waterWrap` and `dropMaterial` on any holder).
- `web/components/game/character/RodAura.tsx`: draws an effect GLB (`rodfx-<name>.glb`) in a hand, a shop or a cutscene, at a `strength`, and springs its Sway parts. `art/pipeline/fx_library.py`: the Blender templates those GLBs are built from.
- `web/lib/game/fx/glowOn.ts`: the code-drawn glow on a whole model and the sparks spray (moments).
- Previews: `/lab/fx` (the index, by family), `/lab/fx?type=<kind>` one type on a plain rod and the iron sword moving as a hand moves them, its strength going 1, 2.5, 1; `?type=lightning` the strike every 3.6 s (the holders freeze on its hit); `?type=sway` the Cedar swung and stopped; `?k=<n>` holds a strength. Clips: `specs/evidence/vfx-library/r1/vfx1-<kind>.mp4` (`shots.mjs`).

## The rules

1. **No circle or ring glows.** Light follows the thing's own shape: its edges, its surface, its outline. Never a disc sprite, a halo or a ring drawn round it (David 2026-11-05).
2. **Colour comes from the thing** (its rung's colour or its material's), except a type that is a light or a stuff of its own: the sun's glint, the white trail, fire, embers, petals, electricity, water.
3. **One material per effect part,** so each part is one draw. A holder's effect stays within the draw budget (specs/perf/effects-cost.md; RodAura.test.ts checks GLBs).
4. **Strength 1 is as made.** Every type says what grows with strength. An awakening raises it (`auraAt` in rodMotion.ts: 1 + 0.5 per awakening).
5. **The rod stays one plain mesh, nothing emissive.** Everything that glows or moves is in its effect GLB or drawn by HolderFx.
6. **Holder-agnostic.** A type never knows what holds it: it reads the holder's surface, axis, size and motion. A new holder needs no new code. Skinned holders (clothes on a body) are not sampled yet: their effect rides a bone or a rigid accessory until they are.
7. **Every type animates.**

## The two families (David 2026-11-06: "theres like auras and effects")

**Auras** are worn on the thing's own parts. David: "aura really is just like energy and like neon with slight glow effect and is like accessory parts and effect on parts ranther than an actual aura". **Effects** happen to it or come off it.

| Type | Family | What it is | How it's drawn | Grows with strength |
|---|---|---|---|---|
| Energy | aura | Bright neon running along the thing's own edges and parts, a slight glow round each line, pulses travelling along them | its feature edges (faces turning sharply, 28 degrees, 12 if few) as tubes facing you: near-white core, its colour round it, a soft falloff; additive, one draw | brightness, line width, pulses |
| Sun glint | aura | Sunlight glistening off it: a sheen sweeping along it, breaking into fractured facets with a faint rainbow at their edges, star glints where it catches | the glow shell: 3D Voronoi facets in its own space, lit inside a leaning band (`sweepAt`), cel steps; the pool's flare at points under the band | brightness, sweeps a second, glints |
| Pulse | aura | Its glow beating, lub-dub | the glow shell lit at its rim, a band running up it | its size |
| Particles | effect | Motes drifting up in a slow swirl, twinkling, a few big soft ones | the pool, steered round its axis then let go | how often |
| Trail | effect | A faint white sweep behind it as it swings, a crisp bright line along the tip's path | its outer half's path, white, additive | how long it lasts |
| Motion | effect | Comets whipping up round it, easing in and out, long tails shedding sparkle, a flash as each leaves the tip | the pool: heads, streaked tails, sparkle | speed and reach |
| Sparks | effect | A one-off spray off it | the pool (unchanged: waits for David's references) | how many |
| Burst | effect | A one-off flare: its glow peaks, the screen takes the colour a moment | the glow shell and the pool; a moment's tint | (one-off) |
| Water | effect | Water wrapped round it and running fast (the Aquatic sword's water, not its blade): crash foam bursting in and carried off, a water trail on its swing (Tanjiro's Water Breathing), lots of drops flung as it swings, drips falling | `waterWrap` (two ribbons spiralling up its outer part, the `Water` shader), the trail in the `Water` shader (its end breaking into foam), the drops pool (`dropMaterial`, solid, flat colours, stretched along their fall) | flow, foam, crash and drops |
| Electricity | effect | Arcs you can watch crawl up it, crackling; the charge builds (more, faster, brighter, sparks drawn in, the shell lit) and zaps the length of it | the pool: crawlers hopping point to point, each piece lingering; the zap a jagged arc base to tip, a flare, sparks | arcs, charges a second, arcs out |
| Embers | effect | Bright yellow sparks, fast and random, every way, never in a ring | the pool: streaks along their own flight, a yellow ramp | how many, how fast |
| Flame | effect | Fire tongues licking up it | the pool (unchanged: waits for David's references) | more, taller |
| Sakura petals | effect | A few glowing petals swirling round it on a wind, carried with it, lifting; never falling | the pool: a petal and its glow, steered round its axis, then let go on the wind | more petals |
| Gather | effect | Power drawn in: streaks spiralling in faster as they come, beams into the tip, big orbs, flashes where light lands, its glow building | the pool (steered in to its axis), the glow shell | more of it |
| Sway | effect | Soft parts swinging after it like a spring | a `sway` extra on an effect GLB part (RodAura) | how far it swings |
| Strike: lightning | effect | The charge builds at the tip, faster and reaching down it, a held breath, then the bolt; it flashes white, freezes, shakes, and arcs crawl over it after | `throwStrike` (HUSH 0.22 s), HolderFx: white 1 frame on, FREEZE 0.12 s, SHAKE 0.32 s, `onHit` | (one-off) |

Deleted in round 1 (David): Flicker ("remove") and the wave strike ("yeah just delete ts"). RodAura still honours a GLB node's `flicker` extra (the Tempest's chain) until the rods lane remodels it.

## Who uses it

- **The awakening cutscene** (RodAwakening): gather on the old form, the lightning strike on the Tempest (it wears electricity after), the burst; motion in rodMotion.ts. The Tidewarden's awakening has no strike since the wave went (its water still grows).
- **Effect GLBs** (rods): the Cedar's foliage (Sway), the Tempest (glow, flicker, pulse, motion, trail, aura shell, particles), the Tidewarden (its water parts through water.ts, its veins as Glow). The Titanium (rod-titanium round 2) is metal, not magic: the rod as bought has no effect, its rainbow glisten is its material (a thin film, KHR_materials_iridescence); its awakening is the same rod opened, with `rodfx-titanium-a1.glb` (a blue core between its parted plates, glow, and hexagons of light round the core, turning).
