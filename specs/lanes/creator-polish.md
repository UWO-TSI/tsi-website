# Lane: creator-polish (the arrival's reflection creator: calmer water, hair dissolve)

Worktree `.claude/worktrees/creator-polish`, branch `game/creator-polish`, cut from origin/main de87c07f. Agent type `uwotsi-lane`.

Scope: the reflection character creator at the start of the game: `web/components/game/arrival/ReflectionCreator.tsx`, `ReflectionScene.tsx`, the creator controls. Context: `specs/lanes/reflection-waves.md` (the lane that built the water, the wave and the sweep).

## David's decisions

Playtest notes, 2026-10-29, verbatim: "the character creation the water ripples are too wavy it should be more chill so its easier to see the character, but the textures should be there so it looks like the water is still moving but the reflection isnt moving as much plus the back of the hair changes when changing hair while the wave is gradule so i want the back of the head hair to dissolve into new hair choice"

Coordinator's reading:
1. **Calmer reflection.** The reflected character distorts much less; the water's surface detail keeps moving. Separate the two: reflection displacement amplitude down a lot, surface detail stays. The selection wave that carries a change stays, but gentler.
2. **Hair change dissolve.** Today the back of the head swaps instantly while the wave travels gradually. Make the whole hair change a dissolve from old to new, timed with the wave (dither/noise dissolve or cross-fade, toon look). Check hats and tops for the same pop; if they pop, same dissolve.

## Status

Built 2026-10-29 on `game/creator-polish` (from de87c07f), ready for David's review. Only the arrival's reflection creator changed (`ReflectionScene.tsx`, `lib/game/arrival/reflectionPasses.ts` and its test). The applicant island doesn't use this component, so it is unchanged.

- **Calmer reflection (cp-calm):** in `WATER_FRAG` the reflection's displacement is now separate from the surface's tilt. `REFLECT_BEND`: the sea bends the reflection 0.25 of what it did, a rolling wave 0.5. The water's own light and shade (`face`, the sparkles), the swell and the chop still use the full tilt, so the surface keeps moving.
- **Gentler selection wave (cp-wave):** `SET.wave` height 0.013 to 0.009 and speed 1.8 to 1.5 m/s, so it rolls past more slowly; `waveBeats` follows. The wave, the foam and the sweep in the water are otherwise unchanged.
- **Dissolve over the side (cp-dissolve):** before, the you over the side kept the old look until the wave finished (`done`), then swapped in one frame. That is the pop David saw on the back of the hair. It hit every part: hair, tops and the rest. The creator offers no hats; its accessories are glasses, which can't be seen from behind. Now:
  - The old look's character stays mounted, hidden between waves, in the same Suspense boundary as the new one.
  - While a wave sweeps a change in, `renderReflection` draws the frame twice: the old you into `frame`, the new you into `frameNew`. Both targets are lazy and created on the first sweep.
  - The composite dissolves one into the other with `uDissolve`, which rises from 0 to 1 over the crest's crossing (`ride` to `done`). The dissolve is clumpy pixel noise in 3 px cells, with a thin edge of foam cream drawn only where the two yous differ.
  - During the sweep the old you copies the new you's bones each frame, so the dissolve changes the look and not the pose.
  - The composite blur uses `textureLod`. Implicit mip levels inside the dissolve's branch drew stray light lines along the cell edges.
- **Gates:** tsc clean; vitest 373 files / 3535 tests passed (one run, no flag); eslint clean on the changed files.
- **perf:check:** not run. No bench scene covers the arrival or the creator (perf-bench scenes are world, net, ruins, shop, hq and the like). The cost exists only in the creator's canvas: one extra frame pass and one more half-float MSAA target, and only while a wave sweeps a change in (about 1.2 s per change).
- **Evidence** in `specs/evidence/creator-polish/` (1440x900 headless, 8 choices in, the scene column only):
  - `01-rest.webp`: at rest, before and after, 3 stills 0.6 s apart.
  - `02-rest-face.webp`: the same, cropped to the reflection's face.
  - `03-hair-dissolve.webp`, `04-hair-dissolve-2.webp`: two hairstyle changes, before (the pop at about 1 s) and after (the dissolve), cropped to the back of the head.
  - `05-top-dissolve.webp`: a top change, after.
  - `06-wave.webp`: the selection wave, full scene, before and after.

## Next

1. The coordinator puts the evidence on a review page for David; visual work waits for his approval.
2. On notes, tune `REFLECT_BEND`, `SET.wave` (height, speed) or the dissolve's noise (`COMPOSITE_FRAG`: cell size 3, noise scale 6, edge 0.05).

## Tools and gotchas

- `?arrival=1` on `/lab/island` opens straight on the reflection (phase `creator`).
- Shots: browser lock, dev server on its own port (not 3000, not 3300), Supabase env blanked. Earlier scripts: `specs/evidence/reflection-waves/shoot.mjs`, `shoot3.mjs`.
- `window.__reflect.wave` tunes the wave live in dev.
- Evidence: hold the devserver lock and run a script that starts `next dev -p 3172` (Supabase env blanked), then `HOST=http://localhost:3172 node specs/evidence/creator-polish/shoot.mjs <dir>`, then kills that PID. It takes the rest stills and the strips hair-a, hair-b, top and hat (the "hat" strip is glasses: the creator has no hats).
- Hairstyle tiles by index in `section[aria-label="Hairstyles"]`. Tops are `section[aria-label="Tops"]`, with only a few tiles.
- Sampling a texture inside a branch that differs between neighbouring pixels needs `textureLod`. Implicit derivatives go wrong at the branch's edges.

## Rules

- Headless only; never `open`; never the Playwright MCP or claude-in-chrome; never port 3000 or 3300.
- Locks: `LANE=game/creator-polish /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; retry on exit 75.
- No fetched art. New world only. Applicant island's creator unchanged unless it is the same component.
- Commit `[build]`, never push.
