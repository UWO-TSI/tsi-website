# Remodel round 3 (David's review of round 2, 2026-10-27)

## Step 1: the fish facing the same way

David: "make sure the orientation of these fish models are correct".

**What was wrong.** The dump exports 71 of the 81 fish "raw": 10x size, head along +z, back up. The game turned them a quarter turn the wrong way at render (`rotation.x = +PI/2` where it needed `-PI/2`). So everywhere the game levels or holds a fish, those 71 came out head down and belly out. In the tank and the trophy case that meant upside down and tail first; in the catch hold, head down. The icon stage hid this by turning them over (a half turn in the picture's plane), which put their bellies on the other side from the 10 calibrated fish. The golden arowana was the dump's trophy (the fish on a pillar), so it was the wrong way in every view. The icons also stood every fish on its tail.

**The fix (new world only; the village keeps the dump's).**
- `art/remodel/build_fish.py` bakes all 81 into the game's own frame: head up, back toward -z, game scale. That is the frame the catch hold (FishingRig), the tank and trophy case (TankFish `levelFish`) and FishCatchFX already assume. The trophy arowana loses its pillar. The counter-shade now runs back to belly (before, it ran head to tail on the 10 calibrated fish).
- `lib/game/fishing.ts`: in the new world no fish is raw, because ours are already in frame.
- Leaping fish (`AmbientFauna` `fishBody`): a fish that hangs (ours) is laid level, nose along +z and back up.
- Icons (`app/lab/icons`, `lib/icons/manifest.ts`): each fish is drawn as the tank shows it (`levelFish`), nose left, back up. The ray, the dab, the olive flounder and the mitten crab are seen from above, because a profile shows only an edge. All 81 re-rendered.

| File | What |
|---|---|
| `fish-icons-before.webp` / `fish-icons-after.webp` | The 81 icons. Before: standing on their tails, with the bellies on two different sides. After: all nose left, back up. |
| `fish-3d-before.webp` | Our 81 3D fish as the tank levels them, seen from the side, before the fix. The 71 raw ones face right; their backs are down, though that is hard to read at this size. |
| `fish-3d-before-detail.webp` | Before, side / from above / from below: the tuna and the shark (raw) belly up; the carp and the bass (calibrated) right. |
| `fish-3d-after.webp` | After: every fish's side view (nose left, back up) next to the view from above (its back). |

Not changed: the village. The dump's raw fish there are still upside down in the hold, the tank and the trophy case. The fix there would be one sign in four places (`rotation.x = Math.PI / 2` for raw in FishingRig `prepareFish`, TankFish `levelFish`, FishCatchFX and FishPreview).

Not orientation: the betta's fins render as a pale square (the dump's own texture, the same in the old model).

## Step 2: the flyers keep their old wing outline

David: "shape should still replicate the before like gneral overall shape of wings".

`art/remodel/build_critters.py` traces each species' wings from the old model. It takes the wing triangles seen flat (unfolded about the body's axis), rasters them, opens away the antennae and legs, follows the outline round, simplifies it to about 20 points a side (4 per dragonfly wing) and cuts that polygon into triangles. The forewing and hindwing lobes, the proportions and the tiger and peacock tails are the old ones'. Our body, our paint per species (mapped onto the traced outline), one shared 256 x 128 atlas.

The dump's butterflies face -z, so they flew tail first. Ours face +z, where the game flies them, and the traced wings are turned end for end to match. The old ones in these shots are turned the same way, so the outlines compare.

| File | What |
|---|---|
| `flyers-before.webp` / `flyers-after.webp` | The 8 flyers, each from above and at three-quarters: the old one (the close-ups keep it) and ours (the world's). |
| `flyers-side-by-side.webp` | Each species with old and new next to each other. |

Triangles, old -> new: butterflies 770 to 824 -> 100 to 104; darner 778 -> 114; red dragonfly 360 -> 116 (round 2: 116 and 128).

## The sea creatures facing right (new world)

The 10 sea creatures are raw dump exports in both worlds. `lib/game/fishing.ts` RAW_TURN_X now gives the new world the right quarter turn (-90 degrees: head up, back toward -z). The hold, the tank, the trophy case and FishCatchFX all take it from there. The village keeps its +90. The icons are re-rendered nose left and back up; the scallop, sea star, abalone and pearl oyster are seen from above.

| File | What |
|---|---|
| `sea-icons-before.webp` / `sea-icons-after.webp` | The 10 icons. |

## The plaza benches (new world)

David via the coordinator: "sitable remodel". The four plaza benches, bench-0 to bench-3, had no model, so they drew nothing and had no collision.

Ours (`art/remodel/build_bench.py`, `game/props/plaza-bench.glb`, 900 triangles, no textures) is a backless park bench: three soft wooden slats on two painted green iron ends. It is backless because a bench seats you facing the side you walk up from. The seat top is at 0.5 (BENCH_SEAT_TOP, the sit height), the seat runs along x across the two sit slots (+-0.42), and it fits inside the log bench's footprint. A bench the map gives no model (only the new world has them) draws this one (`lib/game/defaultIsland.ts` propsOf), with its footprint and top in `defaultIsland.ts` (PROP_FOOTPRINT, PROP_TOP), so it is solid. `data/world/world.json` is untouched.

| File | What |
|---|---|
| `plaza-bench-before.webp` | bench-0 in game before: nothing there. |
| `plaza-bench-after.webp` | The same camera after, and the Blender views. |
