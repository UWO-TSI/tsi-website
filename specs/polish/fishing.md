# Polish: fishing

Audit: `audit-activities.md` (fishing row, items 2–8) and its spec 2. Paths under `web/components/game/` unless noted. The standard is in `README.md`. Needs the particle pack and system from `specs/movement-feel.md`.

## Problems
- **Cast:** a 2D power bar with no wind-up pose (`character/useWorldClips.ts:21`). The meter says "hold E" on touch and click too.
- **Bobber:** a red sphere flies from the chest (`FishingBobber.tsx:86, 165-172`) with no rod and no line. It's two glossy spheres (roughness 0.4) and lands with a flat `ringGeometry` ring (`:228`) and the `blip2` dialogue sound.
- **Aim:** on the member island the bobber lands along the camera's forward direction, not toward the water (`peaceful/PeacefulLayer.tsx:36` doesn't pass `towardWater`).
- **Bite:**
  - `blip1` for the nibble.
  - A DOM "!" plus a whole-canvas CSS shake (`FishingOverlay.tsx:185`) that can show the page edges.
  - The thrash uses `Math.random` per frame (`FishingBobber.tsx:151-154`).
  - `addRing` calls `setState` inside `useFrame` (`FishingBobber.tsx:139`).
  - `tsi:fish-splash` has no listener (`FishingBobber.tsx:138`).
- **Reel:** a DOM bar; the character only holds `FishHold`; DOM droplets are added inside the animation loop (`FishingOverlay.tsx:680`). A missed fish plays the `exit` door sound (`:151, 203, 318`).
- **Catch:**
  - The first catch is a fullscreen gacha reveal of a PNG icon with rays and confetti (`FishReveal.tsx`, `lib/fishing.ts:303`).
  - A repeat catch gets a text card while the GLB fish spins 2.1u over the head (`FishCatchFX.tsx:66`) for 2.4 s, which is shorter than a legendary reveal, and the fish is hidden behind the reveal's blur.
  - `Cheer` and `Sad` never play.
  - Rarity colours differ between the journal (`JournalPages.tsx:16`) and the card (`lib/fishing.ts:41-46`).
- **Frame loop:** `fishingSpot` allocates every frame near water.

## Deliverable, in order (a commit each)
1. **Aim and logic fixes.**
   - Cast toward the water (pass `towardWater`).
   - Wire `tsi:fish-splash`.
   - Smooth noise for the thrash.
   - No `setState` in the frame loop, no per-frame allocation.
   - The meter's input label follows the device (E / tap / click).
   - Tests for the cast landing in water from every shore angle.
2. **The rod moment.**
   - A wind-up pose while charging that deepens with power.
   - A cast swing, a reel loop while reeling, a hook yank on the bite.
   - `Cheer` on a catch, `Sad` on an escape.
   - New clips on the v6 rig (`art/characters/base/build_clips.py`), blended cleanly.
3. **The bobber and water.**
   - A low-poly matte bobber modeled in Blender.
   - Landing makes droplets plus a ripple drawn as water, on the surface, from the particle pack.
   - Nibbles make small ripples, the bite a splash.
   - A camera shake instead of the CSS canvas shake.
4. **Line.** A thin line from the rod tip to the bobber that sags and goes taut on the bite, if David approves (row 136 said no visible props). Until then, build it behind a flag and show both in evidence.
5. **The catch.**
   - The character holds the fish up in both hands, timed to the reveal; behind a flag like the line, same row.
   - The reveal restyled in the cozy cream direction (no gacha rays, softer confetti) for every catch, first or repeat, with the fish's real model shown.
   - One rarity palette across the card, the journal and the book.
6. **Sounds:**
   - Wire what exists.
   - List the missing ones in the questions file: cast whoosh, line zip, plop, nibble tick, bite splash, reel ratchet, line snap, a catch jingle per rarity.
   - Never a dialogue blip or a door sound for an effect.

## Evidence
`specs/evidence/polish-fishing/`:
- a slow-motion frame strip of the whole loop, before and after;
- the bobber and its ripples close up;
- line and hold-up on and off;
- the reveal per rarity.
