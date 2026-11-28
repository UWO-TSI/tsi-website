# Polish audit: activities (2026-10-01, read-only survey)

Short paths are relative to `web/components/game/` unless they start with `web/`, `specs/` or `lib/` (= `web/lib/game/`).

## 1. Each activity from start to finish

| Activity | What the player sees and hears | Weakest moment |
|---|---|---|
| Fishing | Hold E: a 2D power bar, no wind-up pose (`character/useWorldClips.ts:21`). Release: `Fish` clip. A red sphere flies from the chest (`FishingBobber.tsx:86,165-172`) with no rod and no line, lands with a flat `ringGeometry` ring (`:228`) and the `blip2` dialogue blip. Nibble: `blip1`. Bite: a DOM "!" plus a whole-canvas CSS shake (`FishingOverlay.tsx:185`). Reel: a DOM bar; the character only holds `FishHold`. First catch: a fullscreen gacha reveal of a PNG icon with rays and confetti. A repeat catch gets a text card while the GLB fish spins 2.1u above the head (`FishCatchFX.tsx:66`). | The cast: a sphere with no line. Then the fish floating over the head. |
| Bugs (net) | Sneak, E, `Net` clip. The bug vanishes and a text toast says "Caught X, N cm!" (`peaceful/VillageLife.tsx:112`). A flee plays the `exit` door sound and the bug slides along fixed +x (`:140,149`). | The catch: the bug just disappears. |
| Tree shake / fruit / branch | The `Forage` clip plays. The tree doesn't move and nothing falls; the branch is never drawn (`VillageLife.tsx:56`). A toast says "Got Tree branch!" (`specs/evidence/crafting/K-05`). Fruit is drawn as spheres (`:54`). | No shake and no drop. |
| Flowers, shells, rocks | Flowers are an icosahedron tuft (`:63`) and rocks a dodecahedron (`:61`); `click` and a toast. The petal burst in `FlowerPickFX.tsx` is only mounted on the applicant island. | Primitive stand-ins. |
| Digging | A dark `circleGeometry` disc (`:59`), the `Dig` clip, then the item is gone. No hole and no sand. | The whole flow. |
| Puddles | Flat tinted discs, shown only in rain (`IslandAtmosphere.tsx:98`). | Nothing reacts to them. |
| Fireflies | Each firefly is its own GLB, sprite and `useFrame` (`AmbientLife.tsx:21-58`). The glow is the sun texture. | Fine visually. Costly. |
| Workbench craft | Press Craft, hear `confirm`, read a text card: "Floor lamp / It's in your pockets." (`crafting/Workshop.tsx:134-152`, `K-03`). | No in-world moment at all. |
| Message bottle | The bottle disappears the moment you press E (`Workshop.tsx:72`); `confirm`; a text card. | No uncork, no scroll. |
| Selling | Not in the game. `SellBody` is mounted only on `web/app/student/dashboard/economy/sell/page.tsx:12`. | Missing. |
| Shop counter | Not in the game either. `ShopInterior.tsx` is only used in `/lab/interior` (`web/app/lab/interior/page.tsx:33`). | Missing. |
| Museum donation | A sheet with a curator line; no sound and no animation (`peaceful/DonateSheet.tsx:47`). The fish hang vertical and still (`peaceful/MuseumInterior.tsx:56`). The desk is a box (`:95`), the walls are flat planes (`:89`), and there are 18 `Html` plaques. | Nothing reaches the case. |
| Collection book / journal | Opens with `click` + `blip1` (`CollectionBook.tsx:121-122`). The offline catalogue uses ❔ and 🧺 emoji and an out-of-date fruit list (`:30-97`). | Placeholder emoji. |
| Trophies | A list in a sheet (`peaceful/ShowcaseSheets.tsx:25-37`). | No physical trophy case. |
| Glider | Crafting it shows "It's in your pockets." and adds a hint line (`DefaultIslandWorld.tsx:760`). | No unlock moment and no guided first glide. |

## 2. Rough edges, cheapest-feeling first

1. **Sound.** The whole SFX set is 10 files (`lib/audio.ts:69-80`). Dialogue blips stand in for effects: bobber plop, nibble, reel bounce and the book opening. The `exit` door sound plays for a missed fish (`FishingOverlay.tsx:151,203,318`) and a fleeing bug. `click` is the hook. Every success is the same `confirm`. `web/public/audio/sfx/MANIFEST.md` points to a `TreeShakeFX.tsx` that doesn't exist.
2. **Primitive stand-ins.** The bobber is two spheres at roughness 0.4, so it reads glossy against the matte look. Fruit, the dig spot, rocks and flowers are primitives. 10 roster entries have no icon (`web/lib/collections/roster.ts:180-201`). The museum desk and walls are primitives. Fireflies and rare-item sparkles reuse `sun.png` (`VillageLife.tsx:40`).
3. **Flat UI rings and screen effects.** Water rings are flat UI rings (`FishingBobber.tsx:228`). The reveal has pulse rings, rays and generic confetti (`FishReveal.tsx`, `lib/fishing.ts:303`). The canvas CSS shake can show the page edges.
4. **Missing character clips.** These exist: `Fish`, `FishHold`, `Net`, `Dig`, `Forage`, `Cheer`, `Sad`. These are missing: cast wind-up, reel/struggle, hook yank, hold-up-the-catch, tree shake, rock strike (it reuses `Dig`), craft, hand-over. Nothing listens for the bite, the catch or the escape, so `Cheer` and `Sad` never play.
5. **Abrupt transitions.**
   - A node is removed before the clip lands or the server answers (`VillageLife.tsx:102`).
   - The bottle and the bug just pop out of existence.
   - The fish over the head lasts 2.4s (`FishCatchFX.tsx:19`), shorter than a legendary reveal (about 5.9s), so it's gone before the reveal ends.
   - On first catches that fish is also hidden behind the reveal's blur.
6. **Text-only rewards.** Bugs and forage get no catch card: `tsi:peaceful-got` is dispatched but nothing listens (`VillageLife.tsx:114`). Their toasts carry no icon (`:112-113`). The craft card has no item art.
7. **Bugs.**
   - On the member island the bobber lands along the camera's forward direction, not toward the water, because `PeacefulLayer.tsx:36` doesn't pass `towardWater`. It can probably land on the bank; I couldn't confirm without running it.
   - `tsi:fish-splash` has no listener (`FishingBobber.tsx:138`).
   - Rarity colours in the journal (`JournalPages.tsx:16`) don't match the catch card (`lib/fishing.ts:41-46`).
   - The `VillageLife` act effect has no deps array, so it re-subscribes on every render (`:95-119`).
8. **Frame-loop issues.**
   - `addRing` calls `setState` from inside `useFrame` (`FishingBobber.tsx:139`).
   - The bite thrash uses `Math.random` every frame, so it's jitter rather than motion (`:151-154`).
   - `fireflyOffset` allocates 3 arrays per firefly per frame (`lib/fireflyPath.ts:16-17`).
   - `fishingSpot` allocates every frame near water.
   - The reel adds DOM droplets inside its animation loop (`FishingOverlay.tsx:680`).
9. **Unclear prompts.** The meter says "hold E" even on touch or click. A wary bug gives no tell before it flees.

## 3. Proposed specs, in priority order

**Spec 1: activity sounds and reward feedback**
- Name every SFX event: cast whoosh, line zip, plop, nibble tick, bite splash, reel ratchet loop, line snap, a catch jingle per rarity tier, net swish, bug buzz, leaf rustle, fruit thud, shovel scrape, rock clink, pickup pop, cork, paper, hammering, craft jingle, coin clink, museum chime, page turn. Put them in `SFXName` (`lib/audio.ts`) and replace every blip, `exit` and `click` misuse listed above.
- A shared catch card for bugs and forage, fed by `tsi:peaceful-got`.
- Icons on all toasts.
- One rarity palette.
- Replace the emoji in the book with silhouettes.

**Spec 2: fishing**
- A low-poly matte bobber from Blender, replacing the spheres.
- A fishing line.
- Fix the cast direction (pass `towardWater`).
- Water rings and droplets drawn as water, using the particle pack from `specs/movement-feel.md`; wire up `tsi:fish-splash`.
- Smooth noise for the bite thrash.
- A wind-up pose while charging, a reel loop, and a hook yank.
- Play `Cheer` or `Sad` on the outcome.
- A hold-up-the-catch clip, timed to the reveal.
- Replace the canvas CSS shake with a camera shake.
- Remove `setState` from `useFrame`.

**Spec 3: foraging, crafting, museum, shop**
- Tree wobble with leaf bits; fruit or a branch falls, then you pick it up.
- Fruit, rock and flower models to replace the primitives.
- A sand burst and a hole decal when digging.
- Remove the node at the clip's contact frame, not on the key press.
- A wary hop for bugs, and fleeing away from the player along an arc.
- Rain rings and step splashes on puddles.
- Instanced fireflies.
- A `Craft` clip, hammering and a puff at the bench, and a result card with the item's art.
- An uncork-and-scroll moment for the bottle.
- A glider unlock card plus a guided first glide.
- Museum: the specimen fades into its case, aquarium fish swim, and a real desk.
- A trophy case in the HQ.
- An in-game shop interior with a counter for Sell (coin count-up) and Buy.

### Need David's call
- **SFX source.** Row 125 calls for ElevenLabs or Higgsfield, which needs a key or plan; the fallback is CC0 packs.
- **Fishing line, and the fish held up in the hands.** Row 136 says no visible props.
- **Fish shadows.** Rows 151 and 195 ruled them out for v1, and you asked about them.
- **The reveal's style.** Its gacha rays and confetti sit against the matte, cozy direction.
- **Shop interior.** It needs a building interior and the shopkeeper resident (row 122).
- **Adding clips beyond row 111's 16-clip set.**
- **Museum curator and desk art.**

Spec 2's water effects and spec 3's leaf bits depend on the particle system from the movement-feel pass, so that should land first.