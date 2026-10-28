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
