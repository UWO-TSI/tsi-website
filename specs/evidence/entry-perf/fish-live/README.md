# Packed fish, caught live (coordinator's check, 2026-10-30)

`next dev` on :3322, headless, signed out with Supabase blanked, `/student/dashboard?time=day&weather=clear` (the member
island, the member reel). specs/evidence/entry-perf/fish-check.mjs: the cast's answer is routed to the species asked for
(as the fish-tiers evidence did), a bot plays the reel; stand at -191.5, -275.5 (the river), yaw 0.

| catch | file | bite, reel, card | the rig's Catch on the line (loaded) / held (drawn) | checksum, texture |
|---|---|---|---|---|
| Horse Mackerel 31 cm (common) | remodel/fish/horse-mackerel.glb, packed | yes | 1 mesh, 407 verts / shown | 356857663, 256x128 |
| Anchovy 12 cm (common) | remodel/fish/anchovy.glb, packed | yes | 1 mesh, 213 verts / shown | 614001955, 128x64 |
| Sea Bass 66 cm (common) | remodel/fish/sea-bass.glb, packed | yes | 1 mesh, 475 verts / shown | 581816885, 256x256 |
| Salmon 70 cm (uncommon) | remodel/fish/salmon.glb, not packed (control) | yes | 1 mesh, 541 verts / shown | 770135424, 256x128 |

The same three packed catches with origin/main's unpacked files served in their place (ORIG): the same meshes, vertices,
checksums (every attribute and index the loaded meshes hold) and texture sizes. Console: no errors in any run beyond
the signed-out API answers (500 /api/admin/me, 503 on the Supabase-backed routes).

Stills: packed-fish_*-hooked.png (on the line), packed-fish_*-card.png and orig-fish_*-card.png (the card with the
catch held), held-unpacked-vs-packed.png (the held fish cropped, unpacked left, packed right; the splash behind it
moves between runs). The card's picture is the species icon (/assets/icons, unchanged), not the GLB.

Views: packed-collection.png (B after the four catches: icons), demo-collection.png and demo-museum.png
(`collections=demo`: the aquarium's tanks hold the demo's donations, salmon and dace, which are not packed files).
