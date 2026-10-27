# Lane: loading (load time, preloading, a new loading screen, smooth cutscenes, no lag spikes)

Worktree `.claude/worktrees/loading`, branch `game/loading`, cut from main at 5d848445. Agent type `uwotsi-lane`. Launch priority.

David, 2026-10-26, after playing production (the new world) from another computer, verbatim: "the entry loading screen takes forever to load, I need more on performance, loading speed and lag spikes, a lot of the cut scenes arent smooth and lag spikes and stuff, I want title page to already start loading everything just so that less time is spend loading the game, logging in there should be a new improved prettier loading screen for after signing in, the cut scenes needs to be smoot and pre loaded before entering"

**Order:**
1. **Measure first,** on a production build (`next build` then `next start` on your port, Supabase env blanked) in headless Chromium, cold cache and warm, with network throttled to a fast home connection and to a slower one. Break the time from the title page to walking in the world into: JS chunks, models, textures, audio, world generation, shader compiles, first frames. Record the long frames (over 50 ms) through the arrival cutscenes and the first minute of play, with what caused each. Write the table to `specs/evidence/loading/baseline.md`.
2. **The title page loads the game.** While the player is on the title page and signing in, fetch the game's code chunks and its assets into the cache (in priority order, idle-time, never blocking the title's own frames, gentler on a phone or a saver connection), so that after sign-in most of it is already there.
3. **Cutscenes ready before they start, and smooth:** everything a cutscene draws (models, textures, audio) is loaded, decoded and its shaders compiled (`renderer.compileAsync` or the existing warm-up, if there is one) before it begins; nothing loads, compiles or allocates mid-shot. Same for entering the world after the arrival.
4. **Lag spikes in play:** fix the causes the baseline found (first-sight shader compiles, texture uploads, late loads, garbage, React re-renders on the frame path), at the root.
5. **A new loading screen after sign-in,** prettier than today's (`web/components/game/IslandLoading.tsx`, `LoadGate.tsx`): built from the game's own look (our island, our characters, our palette and type in `web/styles/game-tokens.css`), with progress that's real, not a fake bar. Don't fetch art or references. Show it to the coordinator as shots for David's review before it ships.

Steps 2 to 4 are fixes and can ship once verified; step 5 is visual and waits for David's approval. Report after each.

**Where:** the title page `web/components/title/` (`TitleScene.tsx`, `TitleVillage.tsx`), `IslandLoading.tsx`, `LoadGate.tsx`, the arrival (`web/components/game/arrival/`, `web/lib/game/arrival/`), `DefaultIslandWorld.tsx`. The top-level `web/app/student/*` pages, `next.config.ts` and `middleware.ts` belong to the play.tethos.ca session: if you need a change there, message the coordinator first with the exact diff.

**Re-measure** the same table after; report before and after numbers. Run `perf:check` once at the end (`SCENES=village,v2`).

**Read first:** `CODEMAP.md` rows "Arrival", "Perf budget", "Rendering look"; `specs/perf/budget.md`; `specs/lanes/perf-newworld.md` (Status only: what was already cut).

**Gates:** vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, tsc, eslint, the production build passing. Message "main" after the baseline, after each step and at the end with the head SHA, gates, numbers and evidence.

## Status

Head: see `git log` (2026-10-27). Main f9f4dc5d merged. Nothing approved or merged yet.

- **Step 1 done:** `specs/evidence/loading/baseline.md`.
- **Steps 2 to 4 done and verified in the browser:** `specs/evidence/loading/after.md` (fast cold 20.0 -> 7.6 to 9.0 s,
  slow warm 18.7 -> 8.0 s; crossing 155 to 226 long frames -> 0 or 1; landing, walk-along, first minute -> 0) and the
  rim look check `rim-{day,evening,night}-before-after.png`. What changed:
  - title prefetch: `components/title/preloadGame.ts` (called from TitleScene's Ready), list `lib/game/preloadAssets.ts`
    (generated, 345 files, test `preloadAssets.test.ts`), plus the island's code chunks read from `/student/dashboard`;
  - rim light always mounted (`IslandAtmosphere.tsx`);
  - `WarmupProbe` compiles the whole scene (compileAsync) and uploads textures at COMPILE_AT and waits
    (`sceneGate.ts` holds the count); UltWarmup deleted (folded in);
  - the new world's `terrainOf` and `terrainShoreField` run in a worker (`lib/game/world/derive.ts`,
    `deriveWorker.ts`, seeded by `load.ts`; `derive.test.ts` proves identical bytes; coordinator asked for this);
  - `AudioManager.prepare()` behind the loading screen.
- Gates: running (tsc, vitest with and without NEXT_PUBLIC_GAME_WORLD=new, eslint on changed files).
- **Step 5 (the new loading screen) in progress:** `lib/game/loadProgress.ts` (+test, the real progress store: code,
  world, files, warm-up) is written but not wired; the component draft is in the session scratchpad (`step5/`). Idea:
  our island's map plate (the minimap's plot) coming out of the arrival's mist, Bram's boat rowing a sea line to the
  dock as the real progress, percent under it, cream kit. Shots to the coordinator for David before it ships.
- perf:check (`SCENES=village,v2`) still to run once at the end.

## Tools and gotchas

- `specs/perf/load-trace.mjs <label>` with `PORT NET=fast|slow|none CACHE=cold|warm DWELL PLAY PROFILE=1 MANIFEST=1 OUT`:
  the trace; writes `<label>.md` and `.json` (JSON is gitignored; runs kept in the session scratchpad). `MANIFEST=1`
  regenerates `web/lib/game/preloadAssets.ts` from a cold run.
- Build: `LANE=game/loading withlock.sh heavy env NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_MEMBER_WORLD=open sh
  specs/perf/measure-build.sh [--no-mangling]` (takes 3 to 5 min once the lock is free; the lock waits can be 20+ min).
  Don't edit `components/game`, `lib/game` while it runs: it rewrites and restores those files.
- Signed-out dashboard: the measurement build inlines a dead Supabase URL, so the middleware redirects
  `/student/dashboard` to the title. After each build drop the dashboard matcher from
  `web/.next/server/middleware-manifest.json` (node one-liner filtering `originalSource` starting `/student/dashboard`).
- Serve: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=perf-bench SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_MEMBER_WORLD=open npx next start -p 3151` under the devserver lock (taken by
  hand: queue line, mkdir, owner file).
- Noise: the Metal shader cache survives fresh browser profiles, so "cold" runs after the first compile faster; machine
  load moves world-ready by seconds. Compare program links and long-frame counts, not single timings.
- Playwright clicks on the creator's Yes fail (animated): click through `$eval(..., b => b.click())`.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/loading /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
