# Lane: remote-height (launch fix)

Worktree `.claude/worktrees/remote-height`, branch `game/remote-height`, cut from main. Agent type `uwotsi-lane-light`.

**The bug:** another player standing on an upper floor (the HQ's upper level, the shop's club-merch floor) draws at ground-floor height on everyone else's screen. Found by the coordinator in the Oct 22–23 two-account test; recorded as "presence sends no y". The pose packet does carry `y` (`web/lib/net/protocol.ts`, `POSE_FIELDS`), so first find where the height is lost:
- the sender (what it puts in `y` indoors);
- the server (`realtime/src/rooms/state.ts`, `IslandRoom.ts`, bounds and sanity);
- the receiver (`web/components/game/net/drive.ts`, `RemoteAvatars.tsx`: a ground snap that ignores upper floors).

Fix it at the source, the smallest change that makes remote players stand on the floor they're on. Keep the ground snap outdoors if it's there for a reason (cosmetic hop, slopes).

**Read first:** `CODEMAP.md` row "Multiplayer client"; the files above; `RemoteAvatar.test.ts` and `drive.test.ts`.

## Status

Not started.

## Next

1. Find where the height is lost and fix it, with a test that a remote pose on an upper floor renders at that floor's height and an outdoor one still follows the ground.
2. Gates (under the heavy lock):
   - web tsc;
   - vitest on `components/game/net` and `lib/net`;
   - realtime vitest, if you touched `realtime/`.
3. If the fix needs a realtime change, say so in your report: the coordinator deploys realtime.
4. Update this file and SendMessage to "main": what was wrong (file:line), the fix, the gate results, and whether realtime must be deployed.

## Tools and gotchas

- **Locks:** `LANE=game/remote-height /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`.
- **Headless only:** never open windows on David's screen, never the Playwright MCP, never port 3000.
- **Git:** never push; commit with the `[build]` prefix.
