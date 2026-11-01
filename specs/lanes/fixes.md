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

Not started.

## Next

Fixes 1 to 4 in order.
