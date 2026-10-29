# title-perf: before (59ef45b9) and after (226ae4f4)

Measurement build (`specs/perf/measure-build.sh`, NEXT_PUBLIC_MEMBER_WORLD=open), `specs/perf/load-trace.mjs`, the
same lines as the loading lane's rounds 1 and 2 (fast cold, slow warm; 10 s on the title, then the arrival and a
minute of play). Real time (night, 2026-10-28). Traces: `before-*.md`, `after-*.md` here.

## Causes

1. **The title's long frames:** 61 point lights (TitleVillage's Lanterns: one per lamp on the island, plus the HQ's
   two porch lights). Every lit fragment looped over all 61, so the title held 49 to 56 ms per frame for as long as it
   was up. Its 61-light shaders also made the 400 to 500 ms compile frames at first canvas. The models were not the
   cause. In a headless dev A/B at day, with everything on, the median frame was 62 ms; without the lamp lights it was
   6.9 ms; without the scenery models it was still 48 ms. Of the "503 models", 304 are the island prefetch
   (`preloadGame`, by design).
   The slow frames also starved the prefetch: it waits for idle time, and on the fast cold line it never ran.
2. **The play spike:** a butterfly that flees fades (VillageLife `fade`), so its materials blend, and three draws a
   blended two-sided material in two passes, with a program for each. Its body and wings needed 4 new programs, which
   the warm-up had never compiled (482 ms in round 2). The 146 ms link of a flower's petals at 65 s was a program three
   had deleted after the last material using it was disposed, then needed again.

## Fixes

- The title lights only the lamps whose light sphere (its 5 u reach) can show in its frame. The test is the bent view
  (`lib/game/curvedCull.ts`) at nine stops along the dolly of all four phases' shots, at the canvas's aspect
  (`titleView` in `components/title/shots.ts`). That leaves 7 of 59 lamps at 1280 x 800. A point light adds exactly
  0 past its reach, so the look is unchanged.
- The warm-up (`LoadGate` `warmHidden`) also compiles the blended programs of things that fade (`userData.fades`, the
  bugs), for both light counts. It then keeps every program it made for the session.

## Numbers

| | before fast cold | after fast cold | before slow warm | after slow warm |
|---|---|---|---|---|
| Title long frames (over 50 ms) | 143 | **6** | 13 (median 48.6 ms, just under) | **4** |
| Title median frame, from 2 s after ready | 55.4 ms | **6.9 ms** | 48.6 ms | **6.9 ms** |
| Point lights in the title's shaders | 61 | **9** | 61 | **9** |
| Models the title loads itself / island prefetch | 199 / 0 (prefetch starved) | 199 / 304 | 199 / 304 | 199 / 304 |
| World ready | 8.6 s | **7.5 s** | 9.1 s | 8.9 s |
| Downloaded after Let's Play | 25.0 MB | **4.6 MB** | 6.7 MB | 6.7 MB |
| Long frames, first minute of play | 0 | 0 | 0 | 0 |
| Programs linked in play | 1 (knife_Handle) | **0** | 4 (P_Paint, M_Wings: a fleeing butterfly) | **0** (2 PMREM: the sky's environment rebake) |

- The play spike depends on a butterfly fleeing during the scripted walk, so long frames in play were 0 in all four
  runs. The link count is the stable measure: the butterfly's blended programs linked in play before the fix and not
  after.
- Models on the title: the model cull was dropped with the coordinator's agreement. An exact view-plus-sun-shadow
  cull (sun at 12° or more, so a low sun throws shadows into view from far off) keeps 87 of the 120 scenery URLs
  (8.4 of 11.4 MB). It needs each model's bounds before loading. Bounds by kind keep 118 of 120.
- Play on the new world was already capped at 9 point lights: `LampPool` (the 4 nearest) and the fixed lights, shown
  as point9 in every program in play. Lanterns, one light per lamp, only draws on the cell islands and for an event's
  own lamps.

## Pixel comparison (`specs/perf/title-probe.mjs still`)

Deterministic stills, 1280 x 800, at dolly t = 0, 14 and 28 s, every phase, plus night at 2560 x 1080. They use the
Playwright clock (paused), the R3F clock set to the dolly time, and a seeded Math.random.
- Two runs of the before build against each other: at most 934 pixels differ, by at most 2/255.
- Before against after, at 1280 x 800, all four phases: dawn 25 to 132 px, day 0 to 6, evening 237 to 1018, night
  111 to 271. No pixel differs by more than 2/255.
- Ultrawide night: 19k to 91k pixels differ by exactly 1/255, spread evenly over the lit ground and the HQ
  (`diff-mask-wide-night-t0.webp`). That is float rounding from a shader with fewer light loops. A lamp left dark
  would show as a bright, local blob.
- Side by side: `before-after-*.webp`.

## Gates (226ae4f4 plus this evidence)

tsc clean. vitest: 3473 passed, 2 failed (the known `lib/seedMigrations.test.ts` pair). eslint clean on changed
files. `npm run build` passes. perf:check SCENES=v2 passed: high 4.7 ms median (-2.1%), 361 draws; lite 2.9 ms,
290 draws.
