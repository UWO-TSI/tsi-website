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
