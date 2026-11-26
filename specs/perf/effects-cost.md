# What each character effect costs

David, 2026-10-08: "for character effects, i want you to let me know if having them decrease performance". This is the
answer, per effect, measured on the other players at 1, 12 and 24 in the village, and (after the 2026-10-13 merge of
`feat/game-default-island` at 8a8d0bea) what the cinematic pass's sky dome and flowing grass, the terrain v2 world
and the title screen cost. Nothing about any look changed in this pass: every effect draws as it did; the cheaper
versions are proposals for David.

> **v1 pass (2026-10-14, `2026-10-v1-results.md`):** the four effects over their share below were fixed as proposed
> here: held items merged per look class with shadows only from Full players within 10 u (a tool +68 → +19 draws at 24
> players), no fishing rig on other players until casts replicate (+201 → +19), the leaf one mesh with no shadow on
> other players' (+64 → +21), other players' afterimages the body alone at LOD 1, and no face shadow. The weapon is
> still over (+84 → +49: a mesh per look class and glow) and hidden until v3. The tables below are the October
> measurement, kept as it was.

## Headline

**On the reference Mac mini (M4) a crowded village is limited by the main thread, and the main thread's cost is draw
calls: about 5 µs each here (and about as much GPU time). The effects that cost are the models in players' hands,
drawn part by part on everyone in view; the particle, aura and overlay effects cost close to nothing. The sky dome and
the flowing grass cost nothing measurable at the default settings; the v2 world's own size is the next thing to
watch.**

24 players on High, 12 of them Full (merged build, a quiet machine):

| Effect | Cost (24 players) | Over its share? | Cheaper version (same look up close) |
|---|---|---|---|
| **Fishing rig, line and cast** | **+200 draws, +0.89 ms** main thread, +0.84 ms GPU. The rod alone (rig idle): +67 draws, +0.35 ms; the cast adds the bobber's 5 parts and their shadows and the line: ~11 draws per angler | **Yes: 2.4× its draws, 3× its CPU** | Don't mount a remote's rig until remote casts are sent (no remote shows a cast today); the bite's "!" as a slot in the pooled nameplate layer, not a drei `<Html>` per rig; the rod's and the bobber's parts baked into one mesh each (vertex colours, as the clothes are), and no sun shadow from the bobber. About 200 → 70 draws |
| **Weapon in hand** | **+83 draws, +0.48 ms**, +0.39 ms GPU (3.9 a player in view; up to 12 parts a weapon) | **Yes: 2× its draws, 1.9× its CPU** | Merge each weapon's parts into one mesh at load; the sun shadow only from a Full player's in-hand weapon within ~10 u, never from one on the back. About 83 → 33 draws (−0.25 ms) |
| **Held tool** | **+64 draws, +0.39 ms**, +0.50 ms GPU (3.0 a player) | **Yes: 1.5× its draws, 1.6× its CPU** | The same merge (rods, nets and shovels are 3–5 parts), the same shadow rule. About 64 → 33 |
| **Leaf glider** | **+63 draws, +0.33 ms**, +0.37 ms GPU (3.0 a player, while gliding) | **Yes: 1.5× its draws, 1.3× its CPU** | The leaf's 3 parts in one mesh; a remote's leaf casts no sun shadow (yours keeps it). About 63 → 21 |
| Dash afterimages | +12 draws, **+19k triangles** while dashing; +0.08 ms | Within (the triangle cost is the largest of any effect) | On other players: the body only (not the face), from the LOD 1 mesh, none past ~10 u. About 19k → 8k triangles |
| Character sun shadows | +23 draws, +39k triangles (2 a Full player: body and face); +0.19 ms (±0.27) | Within | The face never needs to cast (its shadow falls inside the head's): −1 draw a player; cast from LOD 1 past ~10 u |
| Subclass aura | +16 draws for 8 auras (2 each: the scene and the ambient occlusion's transparency pass), +0.04 ms | Within | All auras in one instanced draw (8 × 11 motes), all family motes in one points draw, both kept out of the AO's transparency pass: 16 → 2 |
| Family aura | +15 draws for 8 auras, +0.05 ms | Within | As above |
| Step dust and prints | +2 draws (the scene's shared pools), +0.20 ms (±0.20) | Within | – |
| Movement juice (jump, land, dash, slide, glide, splash) | +1 draw, +0.3k triangles, +0.06 ms | Within | – |
| The bite's "!" by tier (fish-tiers, 2026-10-27) | 0 draws: a DOM label in the label layout (the rig's existing slot); a legendary bite adds 30 short-lived DOM sparks, a divine 48 plus a beam, rays and two rings, all finite (under 2.2 s), only on your own bite. The legendary and divine bite also burst the catch's crown (fishLeaps) once: the existing pool | Within | – |
| Boss creatures (fish-tiers, behind NEXT_PUBLIC_FISH_BOSSES, off) | 0 when the flag is off (not mounted). On: two placeholder groups of spheres (about 21 meshes, shared materials, no shadows) parked below the world and frustum-culled until a boss surfaces | Not measured with the flag on | Merge each placeholder into one mesh when real models replace them |

## The sky's clouds, the wind and the motes (sky-ambient round 3, 2026-11-05)

From the round's runs (specs/sky-ambient.md §R3 "Cost", raw runs in `specs/evidence/sky-ambient/r3/cost/`), Apple M4,
1280 × 800, v2 with 24 bots, the sky tipped 20° up (mostly sky), GPU ms against the shipped lit sprites:

| Effect | Draws | Triangles | GPU, pixel finish | GPU, full resolution |
|---|---|---|---|---|
| Lit sprite clouds (shipped pick) and the dome together | 2 | about 6k | lost in noise (dome off: -0.00) | about 0.12 |
| Painted clouds in the dome (direction a) | 1 | about 6k | +0.08 | +0.92 |
| Cloud models (direction b) | 2 | +60k to 94k | +0.08 | +0.13 |
| Round 2's traced clouds | 1 | about 6k | +0.07 | +0.75 |

The cloud field is about 0.01 ms of CPU a frame. The wind's marks (one ribbon draw and one leaf draw, at most 24 and 96
instances) and golden hour's motes (one draw of 160 points, hidden outside golden hour) are inside the round's
back-to-back noise: High 5.00 / 7.40 / 4.40 ms against main's 4.90 / 7.40 / 4.40 at perf:check with the sky in view.

## The sky (sky-ambient round 2, 2026-11-05)

The dome rebuilt (single-scattering atmosphere per vertex, sun, moon, stars and ball-cluster cumulus per pixel, drawn
at the far plane after the opaque meshes so only sky pixels shade), measured against main a8a03985 back to back on
the v2 scene, 24 bots, measurement builds (`specs/evidence/sky-ambient/r2/cost/`). `perf:check`: High 4.70 / 7.20 /
4.10 ms against main's 4.80 / 7.20 / 4.20, 357 against 358 draws; Lite 2.90 / 5.40 / 2.60 against 2.90 / 5.40 / 2.70.
The dome's own share (world bench `domeOff`, 3 valid pairs each): at the follow camera nothing measurable on either
branch; with a band of sky in view (pitch 0.35) about 0.1 ms GPU with the pixel finish (main's about 0), about 0.3 ms
GPU at full resolution (main's about 0); the main thread unchanged. One draw as before, 5,952 triangles (main's
3,072). The five COZY cloud sheets and the 2048 star sheet are gone: about 50 MB less video memory. Wind swirls, windy
days only: one more draw of up to 14 strips. The lamp halos stay one draw (instanced quads in place of points).
| Rare and epic rods' effect (rods round 2, `RodAura.tsx`, game/tool-pipeline) | Per holder: Tempest 3 meshes (464 triangles) and 2 halo sprites, Titanium 3 (380) and 2, Tidewarden 3 (400) and 1, Riptide 1 (112): 5, 5, 4 and 1 draws; unlit, no lights, no shadows, no shader compiled into anything lit; sparks in the scene's shared glow pool (Tempest about 18 alive, the most). perf:check v2 with the Tempest held (HELD_ROD, one run, load 5.2 to 5.7, swap 10.4 GB): 364 draws (+5 on the 2026-10-14 baseline), triangles flat, median frame 7.0 ms high and 3.8 lite (+46% and +31%, over the 6.5 budget); the frame time not attributable to five draws on a loaded machine, for the coordinator's combined check | Within its draws | Only the nearest few holders' effects, if many epic rods show at once |
| The Water type on the Tidewarden (rods round 9, `lib/game/fx/water.ts`, `rodfx-tidewarden.glb`) | Per holder 4 draws (veins Glow, the water ribbon, the crash foam, the drops), 984 triangles (round 9b); three small unlit shaders (no lights, no blending, no shadows), each holder's own material copy (its strength). Replaces the Tidewarden's 3 meshes and 1 halo (4 draws). perf:check v2 with the Tidewarden held (HELD_ROD=rod-5.glb, 3 runs, load 4.7 to 5.1): high 5.10 ms median, 361 draws; lite 3.00 ms, 286 draws; passed (baseline 4.80 / 2.90 ms, 359 / 289 draws); round 9b (the rod 560 tris, one draw in hand), 5 runs at load 6.1 to 6.2 and swap over 10 GB: high 5.50 ms, 359 draws; lite 3.20 ms, 286; failed on frame time only (+14.6% / +10.3%), draws flat, not rerun (noise rule), for the coordinator's combined check | Within its draws | The drops' and the foam's vertex motion is per vertex, no CPU |
| The Cedar's swaying foliage and HolderFx (rods round 10, `RodAura.tsx` Sway, `components/game/fx/HolderFx.tsx`) | The Cedar's foliage moved from the rod into its effect (`rodfx-cedar.glb`, 772 triangles, 2 draws: one lit material copy per green per holder, bent in the vertex shader by a spring; no shadow from the leaves). HolderFx (any holder, not mounted in the world yet: the lab, the awakening): at most 4 draws (glow shell, aura shell, one 320-particle pool in the world, the swept trail), no lights, CPU only for the particles alive. perf:check v2 with the Cedar held (HELD_ROD=rod-2.glb, 3 runs, load 3.7): high 4.70 ms median, 356 draws; lite 2.80 ms, 281 draws; passed (baseline 4.80 / 2.90 ms, 359 / 289 draws) | Within its draws | A held rod wearing HolderFx in the world (next round): only the nearest few holders |
| The awakened Tidewarden and Tempest (rods round 11, `rodfx-tidewarden-a1.glb`, `rodfx-tempest-a1.glb`; the base Tidewarden now veins only, `rodfx-tidewarden.glb` 1 draw, 392 triangles) | Tidewarden awakened: per holder 4 draws (veins and rim Glow, the water ribbons, foam, drops), 1,412 triangles, the water node spinning (one matrix), motes dripping in the shared glow pool; drawn at `fxStrength` 1.5. Tempest awakened: 4 draws (bolts, crown spark, gust with its trail, aura), 510 triangles. Rods 598 and 542 triangles, one draw in hand. perf:check v2 with the awakened Tidewarden held (HELD_ROD=rod-tidewarden-a1.glb, SKIP_BUILD after measure-build.sh, high 5 runs and lite 3, load 7.4 to 8): high 5.00 ms median, 358 draws; lite 3.00 ms, 286 draws; passed (baseline 4.80 / 2.90 ms, 359 / 289 draws) | Within its draws | Only the nearest few holders, if many awakened rods show at once |
| The awakened Titanium's floating sections (rod-titanium round 3, `RodSections.tsx`, `rodfx-titanium-a1.glb`; the shut rod 594 triangles, one draw in hand, no effect) | Per holder 5 draws: the rod (264 triangles, its reel and claws a morph target) and its effect's 4 meshes, 1,188 triangles: the 21 plates (one lit mesh in the rod's own material, moved in the vertex shader: each section's lean, stand-off, turn and offset are 2 uniform vectors; a spring per section on the CPU, 7 a holder), the beam (Glow), its haze (Light, additive), the rings (Glow, spinning). The film's grazing weight is one line in three's shared light chunk (only the Titanium carries a film). In the awakening only: grey smoke puffs into the scene's movement particles. perf:check v2 with the awakened Titanium held (HELD_ROD=rod-titanium-a1.glb, 5 runs, load 3.8 rising to 4.9, swap 26.7 GB): high 5.30 ms median, 363 draws; lite 3.30 ms, 286 draws; failed on frame time only (+10.4% / +13.8% on 4.80 / 2.90), draws +1.1% and -1.0%, triangles -1.8% and -2.0%; not rerun (noise rule), for the coordinator's combined check | Within its draws | Only the nearest few holders, if many awakened rods show at once |
| The VFX library round 1 (`components/game/fx/HolderFx.tsx`, `lib/game/fx/holder.ts`, `water.ts`; specs/vfx-library.md) | HolderFx per holder, only the draws its types need: the glow shell (sun glint: a 27-cell Voronoi per fragment, only while worn), the energy lines (feature edges as quads, at most 900 segments), the 320-particle pool, the trail, and for water its wrap (2 ribbons, 768 tris) and a 200-drop solid pool: water alone 3 draws, any other type 1 to 2. Still not mounted in the world (the lab, the awakening). The Water shaders (the Tidewarden's GLB too) gained crash foam and breaking ends, same draws. perf:check v2 with the Tidewarden held (SKIP_BUILD after measure-build.sh, HELD_ROD=rod-5.glb, 3 runs, load 4.7 to 4.9): high 5.00 ms median, 358 draws; lite 3.00 ms, 285 draws; passed (baseline 4.80 / 2.90 ms, 359 / 289) | Within its draws | The glint's Voronoi is the costliest fragment here: on a phone, fewer cells or the glint only on the hero holder |
