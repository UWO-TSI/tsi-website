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

## Loading screen round 2 (David's review, 2026-10-27; https://claude.ai/artifact/9QsGi2EJnicwiskGHsUygx)

Every item was a redo. His note, verbatim: "looks ugly i dont want to show our map because it looks bad, i want it to be simple maybe show our logo loading or the fishing boat thing, idk the loading screen needs to be aesthetic with taste. maybe like a idle shot of the island or smth idk, or like we need a proper tethos island design thing. just keep it simpel for now"
- **No map and no sea chart.**
- **Simple and tasteful:** the Tethos logo while loading, or Bram's boat, or a calm idle shot of the island (a pre-rendered still from the game's own camera at golden hour, small and fast to load), with the real progress as a thin, quiet line.
- **Build 2 or 3 simple options** as shots so he can pick one, all in the cream kit's type and colours, with plenty of space and no clutter.
- The logo is the one the site already uses (find it in the repo; don't draw a new one).
Merge main first (steps 2 to 4 are on main). Message the coordinator with the shots.

## Status

Head: see `git log` (2026-10-27). Main has steps 2 to 4 and the crossing warm-up (pushed: d9a48a35 + e65df2df).

- Step 1: `specs/evidence/loading/baseline.md`. Steps 2 to 4: `specs/evidence/loading/after.md` (fast cold 20.0 -> 7.4
  to 9.0 s, slow warm 18.7 -> 8.0 s; crossing 155 to 226 long frames -> 1).
- **Rim re-verify done, not yet merged (coordinator cherry-picks after the report):** a3f1ef69..14699fd2. The rim is
  per phase again (always on cost v2 +4%); the warm-up compiles the other light count; it compiles for the PostFX
  target's linear output (it had been compiling sRGB programs the frame never used); object by object; the golden
  island starts aboard. Numbers in `after.md` "Re-verify". tsc clean after it.
- **Step 5, round 2 built, waiting for David's pick (not to ship before he picks):** three simple looks, no map
  (`specs/evidence/loading/loading-screen.md`; shots `screen-logo-1280.png`, `screen-boat-1280.png`,
  `screen-island-1280.png`; all three side by side in `screen-options-sheet.webp`). Gates: tsc clean, vitest
  (loadProgress, title) with and without `NEXT_PUBLIC_GAME_WORLD=new`, eslint clean. `?loading=logo|boat|island` switches them (logo default). Round 1's chart, mist and boat
  SVG are deleted, and so are its shots. Stills: `web/public/assets/loading/{boat,island}.webp` (23 KB, 38 KB).
- Also fixed: the title backdrop never faded in under `next dev` (Strict Mode's remount ran `Ready`'s cleanup first, so
  `onReady` and the title's game prefetch never fired in dev). Production was unaffected.
- **Next, when David picks:** keep his look, delete the other two, the `?loading=` switch and the unused still; add
  the kept still (if any) to the title's prefetch list (`web/lib/game/preloadAssets.ts`).
- perf baseline: left to the coordinator's combined check (asked).

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
- To see three's program cache in a page: an init script setting `window.__THREE_DEVTOOLS__ = new EventTarget()` that
  collects `observe` events gets every renderer and scene (`renderer.info.programs[i].cacheKey`, `renderer.properties`).
- `load-trace.mjs` takes `TIME=night|day|evening`; each linked program is recorded with its defines.
- `specs/perf/loading-stills.mjs`: `still <name>=<x,z,yaw,eye,pitch,fov> ...` takes title-camera frames at 1920 x 1080 with
  no UI; `screen <look>` shoots the loading screen at 40%+ (through `?arrival=1`, otherwise the character creator
  covers it). Works on `next dev`. Hold the devserver lock only through `withlock.sh devserver` (the old queue file
  is gone); for several steps, run a holder script in the background that keeps the dev server up until a done file.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/loading /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
