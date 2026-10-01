# SFX map

Audio pass, item 3 (ledger row 125): peaceful, crafting and combat events
mapped onto the existing CC0 files (`CREDITS.md`) so nothing is silent while
real generated SFX are pending.

## Peaceful loop (already wired)

| Event | Existing SFX | Where |
|---|---|---|
| Bug catch | `confirm` | `VillageLife.tsx` |
| Bug flees | `exit` | `VillageLife.tsx` |
| Clue nearby | `blip3` | `VillageLife.tsx` |
| Flower pick | `confirm` | `FlowerPickFX.tsx` |
| Fish bite / land | `blip1` / `blip2` | `FishingBobber.tsx` |
| Fish reveal | `confirm` | `FishReveal.tsx` |
| Tree shake | `exit` (knock) → `confirm` (drop) | `TreeShakeFX.tsx` |
| Collection page turn | `click` / `blip1` | `CollectionBook.tsx` |

## Crafting (already wired)

| Event | Existing SFX | Where |
|---|---|---|
| Recipe learned | `confirm` | `Workshop.tsx` |
| Craft complete | `confirm` | `Workshop.tsx` |

## Combat (wired 2026-10-01, combat polish 3)

The encounter pushes cues (`rt.cues`, `lib/game/combat/runtime.ts`) and the
ruins scene plays them (`CUE_SOUND` in `components/game/combat/RuinsScene.tsx`)
through `AudioManager.playSFX(name, { rate, gain })`, so the Sound settings
(master, effects, mute) apply. `rate` re-pitches a file (below 1 is lower and
longer), which is how one CC0 file serves two cues. One of each cue per frame;
a crit replaces the hit; windups play only within 10 units. Chosen without
listening: they need ears at the playtest.

| Event | SFX (rate, gain) | Notes |
|---|---|---|
| Swing: sword, wraps | `footstep` (1.5, 0.7) | The manifest's placeholder whoosh, quicker |
| Shot: bow, revolver | `click` (0.7, 0.7) | |
| Bolt: staff | `blip2` (0.8, 0.5) | |
| Charm wisp | `blip1` (1.2, 0.5) | |
| Hit landed | `blip3` (0.8, 0.9) | As mapped |
| Crit | `blip3` (0.62) + `click` (0.85) | Lower hit plus a crisp tick |
| Hurt | `exit` (1.35, 0.75) | The door knock, shorter: a thud |
| Dodge | `blip4` | The kit's dash sound: one dash everywhere |
| Enemy windup | `blip1` (0.7, 0.4) | Quiet; within 10 units |
| Enemy defeated | `confirm` (0.75, 0.6) | As mapped, lower than the crafting chime |
| Boss stagger | `exit` (0.6, 1) | Deep knock |
| Boss defeated | `enter` (0.6) + `confirm` (0.6) | |
| Ability cast, mission start/complete | not wired | Outside combat polish 3 |

## Still to generate (Higgsfield or ElevenLabs; CC0 packs remain the fallback per row 125)

Keep this list as the manifest: prompt, model and loudness noted once
generated, normalised to match the existing CC0 set (SFX target
**-16 LUFS integrated, true peak ≤ -3 dBFS**, mono, short one-shots).

- Footsteps per surface: grass (have — generic `footstep.ogg`), wood/plank,
  stone/tile, sand, water splash
- Combat: sword swing (light/heavy), hit/impact, block/parry, dodge whoosh,
  enemy defeat (distinct from crafting's `confirm`), boss stagger, enrage
  roar, level-up fanfare
- Crafting: hammer tap, saw/whittle, distinct "item crafted" chime (current
  `confirm` is shared with too many other events)
- Cafe bell (block-end chime currently reuses `confirm` — row 169 wants a
  bell specifically; see `specs/audio-pass-questions.md`)
- Doors: a second door variant (current `enter`/`exit` are shared across
  every building)
- Rustle (bushes/tall grass), pickup (generic item get, distinct from
  `blip1`), forage dig
- Seasonal ambience beds: rain, wind/snow, gentle breeze — layered under the
  time-of-day bed, so far unauthored (see `web/lib/game/audio.ts`
  `ambientCandidates`, which already tries `{phase}-{weather}.ogg` /
  `{phase}-{season}.ogg` before the base file and stays silent-extra until
  they exist)
