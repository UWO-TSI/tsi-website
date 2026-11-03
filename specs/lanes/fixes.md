# Lane: fixes (music, settings, entry loading)

Worktree `.claude/worktrees/fixes`, branch `game/fixes`, cut from origin/main. Agent type `uwotsi-lane-light`. Dev port 3333.

Four small fixes. Each one is its own commit with a test or a measured before and after. Read `specs/lanes/music-one.md` and `specs/lanes/entry-perf.md` (their "Tools and gotchas" and the proposals at the end) first.

1. **Sushi bar music on spawn.** Spawning right at the sushi bar (`/lab/island?at=-47,114.5`, or a saved position there) drops the bar's music override; arriving from a distance works. It predates v1.2. Find the root cause in `lib/game/audio.ts`, `musicSchedule.ts` or `useMusicDirector` (likely the override is set before the manager is enabled, or a first zone check clears it), fix it there, and add a unit test. Verify with the music-one probe (`specs/evidence/music-one/audible.mjs`): at the bar on spawn, the bar track is the one audible source.
2. **The Ambience slider.** On the member island the ambient channel is silent, so Settings' Ambience slider does nothing. Hide it on the member island; the applicant island keeps it (its Stream Cafe track plays on that channel). Find the settings component that renders it.
3. **Shared GLTF parses.** `gltfsOf` in Character.tsx loads each file through useGLTF's per-file cache. ACNHBuilding, ShopDisplays, InstancedNature and GridCliffs cache by the whole list instead, so a shared door GLB parses four times on entry. Move gltfsOf to a shared module and use it in those loaders, after checking each caller treats the result the same way (clones where it mutates). Measure parse counts and Play-to-move with `specs/perf/entry-trace.mjs` before and after.
4. **Pack the character GLBs.** About 2.5 MB on entry. Have `sync-character-assets.mjs` call `pack-glbs.mjs` (lossless meshopt, no quantizing, same as the entry GLBs). Prove they're identical the way entry-perf did (`specs/evidence/entry-perf/glb-pack.md`: data, texels and renders), creator and spawn stills before and after, and a skinned clip playing.

## Gates

tsc, vitest (full run once at the end), eslint on changed files. No perf:check unless frame time could change (it shouldn't). Report to the coordinator with the head SHA, gates and numbers. Fixes 1 to 3 merge once verified; 4 merges with its identical proof.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Never port 3000.
- Locks: `LANE=game/fixes /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; exit 75 means retry. Supabase env blanked on your dev server.
- New world only. Commit `[build]`, never push, never bare `git stash`. No em dashes. Ponytail code (`specs/lane-rules.md`): fix at the root, delete what you replace.

## Status

Done 2026-11-01, reported to the coordinator. Commits on game/fixes (head: the lane-file commit after 429a50f4), one per fix:

1. 180ad475 sushi bar music on spawn. Cause: SushiBar's frame loop reported "near" before its mount effect ran, then React's strict-mode effect replay ran the cleanup `onNear(false)` while the component's own near flag stayed true, so it never reported again and the override was dropped. Fix: `barEarshot` in `lib/game/sushiBar.ts` (release() resets the flag), 3 unit tests. Probe: spawn at the bar, before `night.ogg` audible, after `bar-night.mp3` the only source (`specs/evidence/fixes/bar-spawn.txt`). Strict mode is dev only: whether production ever hit it is unverified.
2. 6b1105a3 Ambience slider dropped from SettingsSheet (member-only; the applicant island has its own sound button). `settings-sliders.txt`.
3. ec25eae7 `gltfsOf` shared in `lib/game/gltfsOf.ts`, used by ACNHBuilding, ShopDisplays, InstancedNature, GridCliffs; Character.tsx's copy deleted. glTF parses 276 -> 267, repeated files 10 -> 4, the door 4x -> 1; Play to can-move 8469 -> 7990 ms campus, 3982 -> 3845 ms unthrottled (single runs, within noise). `gltfs-of.md`.
4. 429a50f4 character GLBs packed by sync-character-assets.mjs: 41 files change, brotli 7.60 -> 7.52 MB (v8_clips 428 -> 402 KB), 41 of 41 identical (data, texels, four renders). `glb-pack-characters.md`.

Gates: tsc clean, eslint clean on changed files, full vitest 3733 passed (398 files). No perf:check (nothing that changes frame time).

## David's decisions

None this round.

## Next

Coordinator merges 1 to 3 once verified; 4 with its identical proof. Still twice-parsed on entry (not touched): Crown,Trunk, acc_glasses_square, acc_glasses_round, bottom_shorts (a single-url loader in Character.tsx and the list loader both ask for them).

## Tools and gotchas

- Probe for the bar: `specs/evidence/music-one/audible.mjs` now has a `barspawn` scene (`?at=-47,114.5`).
- Entry trace needs a production build: `NEXT_PUBLIC_MEMBER_WORLD=open NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx next build`, then drop `/student/dashboard/:path*` from `.next/server/middleware-manifest.json` matchers, then `next start` with the same env. Runs are in `specs/evidence/fixes/runs/`.
- `specs/evidence/fixes/same-glb.mjs` (THREE env or the repo's three) and `stills.mjs` for the GLB proof.
- Port 3333, devserver lock held by other lanes for up to 20 minutes at a time.
