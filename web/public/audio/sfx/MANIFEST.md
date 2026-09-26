# SFX map

Audio pass, item 3 (ledger row 125): peaceful, crafting and combat events
mapped onto the existing CC0 files (`CREDITS.md`) so nothing is silent while
real generated SFX are pending. This is a naming/documentation map, not new
runtime code — combat is out of this pass's scope (see
`specs/audio-pass-questions.md`), so nothing here is wired into
`web/lib/game/combat/**`; a combat agent can read this table when it adds
its own `AudioManager.playSFX(...)` calls.

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

## Combat (mapped, not yet wired — combat is out of scope for this pass)

| Event | Suggested existing SFX | Notes |
|---|---|---|
| Hit landed | `blip3` | Placeholder tone, not a real impact sound |
| Dodge | `footstep` | Placeholder whoosh |
| Ability cast | `click` | Placeholder |
| Mission start / accept | `enter` | Matches building-enter cue |
| Mission complete | `confirm` | Matches existing success chime |
| Enemy defeated | `confirm` | Same chime as other completions — needs a distinct sound |
| Boss stagger / enrage | — | No good existing match; generate |
| Level up | — | No good existing match; generate |

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
