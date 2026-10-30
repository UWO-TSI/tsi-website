# Lane: music-one

Worktree `.claude/worktrees/music-one`, branch `game/music-one`, from origin/main 82a3c70b.

## Status

Started 2026-10-30. Nothing done yet.

## David's decisions

- 2026-10-30: "i want you to fix the music, theres liek 3 overlapping music its kidna obnotious".

## The problem (coordinator's read, verify it)

`web/lib/game/audio.ts` (AudioManager) runs two channels plus loop layers, and on the member island every one of them can be music at the same time:

1. **ambient**: the time-of-day loop, `/audio/ambient/{dawn,day,dusk,night}.ogg`. These are not ambience. They're Ninja Adventure music tracks ("Peaceful", "Calm Village", "Chill", "Dream"), CC0 (web/public/audio/CREDITS.md).
2. **music**: the hourly block (`lib/game/musicSchedule.ts`). Only `bar-evening.mp3` and `bar-night.mp3` exist, so every outdoor block falls back to the applicant's Stream Cafe tracks (Ocean Railway by day, Willow Tree by night). Their licence for the member world is unverified (musicSchedule.ts says so).
3. **loops** (`setLoop`): the campfire drum song and the soft beat near dancers, on the music bus.

David hears three at once. Find every source that can play: the AudioManager channels and loops, plus any other `new Audio`, `<audio>`, AudioContext or Howler use anywhere in the member game, the title screen, the loading screen and the overlays. Check the pending branches too (`git grep` on game/volleyball, game/tutorial-v2, game/fishing-depth, game/daily-social), since they ship in v1.2 alongside this. Also rule out a duplicate: two AudioManager instances, a channel started twice (StrictMode double mount, HMR, enable() racing setAmbience), or a crossfade that never stops the old element.

## The rule to build

Exactly one music bed is audible at any moment.

- The bed's priority: an interior or bar override, then the hourly block's own file when it exists, then the time-of-day track. On the member island the fallback is the CC0 time-of-day track, never the Stream Cafe tracks, which stay applicant-only.
- The ambient channel carries only real ambience (sea, wind). There is none in the repo, so on the member island it plays nothing. Don't source new ambience in this lane.
- Musical loop layers (the campfire drums, the soft beat) duck the bed while they're audible, so the drums replace the bed instead of stacking on it, and the bed comes back when you walk away.
- Minigames and screens with their own music (if any exist on the pending branches) take over the bed the same way, and hand it back when they end.
- Crossfades stay. A crossfade is two tracks for its fade only, then one.

Keep the change small and in the one place every caller goes through (AudioManager and musicSchedule). Delete whatever becomes dead. The applicant island's audio is out of scope: it must sound exactly as it does now.

## Proof

- Unit tests: the bed's priority (override, block file, time-of-day fallback, the applicant path unchanged) and the duck while a loop layer is audible.
- A headless check on a dev server (your own port, under the devserver lock): patch `HTMLMediaElement.prototype.play` and `AudioBufferSourceNode.prototype.start` in an init script to log every source with its gain, then sample which sources are audible at 5, 20 and 60 seconds in: on the title, on the island by day and at night (`?at=` and the clock override if one exists), next to the campfire with dancers if you can trigger it, and in the cafe or bar. Report a small table: place, sources audible. Each row must show one music source.
- No audio plays on David's screen. Headless only.

## Report

Message the coordinator ("main") when done: the head SHA, what the three sources were, what changed, the table, and the tests. Keep the branch mergeable into game/release-v12 (the coordinator merges it there).

## Tools and gotchas

- withlock: `LANE=game/music-one /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; exit 75 means retry. Never create a queue file.
- Swap is nearly full. One headless browser at a time; close it and your dev server after each run. Kill only PIDs you started.
- Port 3321. Never 3000, 3300 or 3301.
- No perf:check (audio only). tsc, vitest on the audio tests, eslint on changed files.
- Don't push. Don't touch prod.
