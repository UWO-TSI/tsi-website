# Asset Needs — what is still programmer art (2026-07-26)

> David ask: "make a note of everything that still needs a proper asset and not
> something made by you."
>
> Everything below is geometry built out of boxes, spheres, cylinders and
> planes in TSX, or a placeholder texture. It is not sourced art. Counts come
> from grepping `*Geometry` against GLB usage per component; the shortlist at
> the bottom is my ranking, and it is a ranking, not a decision.

## How to read the tiers

- **T1 — the player looks straight at it.** Procedural here is the main thing
  making the world read as a prototype.
- **T2 — noticeable, but background.** Worth replacing once T1 is done.
- **T3 — effects and helpers.** Procedural is arguably CORRECT for these;
  buying a model would make them worse. Listed so nobody re-audits them later.

---

## T1 — replace first

| What | File | Currently | Why it matters |
|---|---|---|---|
| **All four building interiors** | `HQInterior.tsx`, `ShopInterior.tsx`, `OracleInterior.tsx`, `WharfShackInterior.tsx` | Zero GLBs between them. HQ is 8 boxes + 4 planes, Shop 4+3, Oracle 4+2+1 sphere, Wharf 2 planes | Every interior in the game is literally boxes. A member who walks inside any building sees the least finished thing we have, right after being sold a 3D world. The dump has 1,822 `Idr*` interior room assets and 698 `Room*` parts we have never touched. |
| **Interior fittings** | `interiorShared.tsx` | 5 spheres, 3 cylinders, 2 planes, 1 circle — the shared counter/stool/lamp set, plus the `InteriorKeeper` NPC | Same problem, and it is the furniture the player stands closest to. |
| **NPC bodies** | `NPC.tsx` | Billboard plane with a sprite when `persona.sprite_url` is set, procedural fallback when it is not | The fallback ships whenever an NPC has no sprite, which is most of them. Blocked on the Nano Banana sprite pipeline, not on modelling. |
| **Player avatar** | `PlayerAvatar.tsx` | `/assets/characters/prototype_character.png` — a CC0 Ninja Adventure walk sheet | The file is named prototype and it is not us. This is the single asset every member sees for their entire session. |

## T2 — background, replace after T1

| What | File | Currently |
|---|---|---|
| Building exteriors, procedural fallbacks | `Building.tsx` | 35 primitives. The ACNH GLBs load over them, but the `GableRoof` / `HQBuilding` / `ShopBuilding` / `OracleTemple` composites are still the Suspense fallback and the ultimate fallback if a GLB fails |
| Wharf pier structure | `WharfPier.tsx` | 4 primitives, no GLB. The dump has `Strc*` pier and deck assets |
| Isla Chica islet dressing | `IslaChica.tsx` | 14 primitives alongside 10 GLBs — the islet's own landforms and props are hand-built |
| S7 Reedmarsh + Flats | `S7Pockets.tsx` | 9 primitives alongside 8 GLBs — pond rims, tide pools, reeds |
| Temple Rise rock band | `TempleRise.tsx` | 4 primitives. This one is a cover for a smooth radial cone; the real ACNH cliff kit (44 pieces, extracted in M1) replaces it once the grid lands |
| Plaza sparrows + shorebirds | `PlazaSparrows.tsx` | 4 primitives. **Now the odd one out — the seagulls got a real rigged model, these did not** |
| Ambient props | `AmbientProps.tsx` | 4 primitives beside 11 GLBs — signposts and lanterns |
| Ghost replay bodies | `GhostReplay.tsx` | 1 primitive per ghost. Will be seen constantly once multiplayer lands |

## T3 — procedural is probably right

Listed so they are not re-audited. Buying models for these would be worse, not
better: they are effects, UI in world space, or things that must be generated.

`MoveTargetIndicator` · `FishingBobber` · `TreeShakeFX` · `SandFootprints` ·
`RainFX` · `FlowerPickFX` · `IdleFireflies` · `BlobShadows` · `Ocean` surface ·
`AmbienceFX` particles · butterflies, fireflies and leaf drift in
`AmbientLife.tsx` · the sky dome and cloud shells in `GameWorld.tsx`

---

## Not modelling problems, but still missing art

- **Ambient audio.** `audio.ts` and the mixer shipped as infrastructure in
  sprint A7 with the note "audio files defer to content drop". The four
  time-of-day loops do not exist. The SFX set is CC0 placeholders.
- **Sky.** `assets/sky/` is a placeholder gradient set; `specs/sky-art-prompts.md`
  exists and David's AI sky art was still pending as of `asset-flags.md`.
- **Shop item sprites.** The shop reads `sprite_url` per item; there is no art
  for any of them.
- **Fish and critter icons beyond the 91 extracted.** The Sea King tier is
  explicitly vacant pending marquee models (`rulings-2026-07-24-launch.md`).

## Sourced and done, for contrast

Not everything is programmer art. These are real assets: the ACNH terrain kits
(cliff 44, river 45, fall 47), road tiles, buildings, plants, fish, critters,
props, the CC0 audio set, and now `fauna/seagull.glb` — a rigged, animated
low-poly bird David supplied, slimmed 944KB to 153KB with the skin and flap
animation kept.

---

## My shortlist, if only three get done

1. **The four interiors.** Biggest gap between promise and delivery, and the
   dump already contains 1,822 interior assets we have not touched. This is
   extraction work, not commissioning.
2. **The player avatar.** A file called `prototype_character.png` is the
   protagonist of every session.
3. **Ambient audio.** The system is built and waiting. Silence is doing real
   damage to a "cozy hangout" that has never made a sound.

Note that (1) is mostly free — it is the same extractor that produced the
terrain kits. (2) and (3) need someone to actually make or buy something.
