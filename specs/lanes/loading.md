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

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/loading /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
