# Lane: world-switch (v1 on the new world, ledger row 318)

Worktree `.claude/worktrees/world-switch`, branch `game/world-switch`, cut from main at `dca352f7`. Code only: nothing here depends on the final terrain shape, and no world data file is edited by hand.

Read first: `specs/launch/v1-new-world.md` (the gap analysis), `specs/world-editor.md`, `specs/terrain-v2.md`.

## Status

Started 2026-10-23. Head: see `git log`.

| # | Task | State |
|---|---|---|
| 1 | Multiplayer bounds cover the new world (realtime needs deploy) | in progress |
| 2 | Server catch checks against the active world | todo |
| 3 | The world switch (`NEXT_PUBLIC_WORLD=new`) | todo |
| 4 | Editor: anchor picker, `water_edge` bug spots, oracle keeper off the summit | todo |
| 5 | Sealed-zone test | todo |
| 6 | Minimap and map sheet crop | todo |
| 7 | Sun shadows follow the player (new world only) | todo |
| 8 | Title screen stays on the village | todo |
| 9 | Arrival route from the active world | todo |

## David's decisions

- 2026-10-23: "i want v1 launch with the main new world". The village stays the fallback behind a switch; go/no-go Oct 28.

## Next

Tasks 1 to 3, then report to the coordinator ("main"), then 4 to 9.

## Tools and gotchas

- Lock helper: `LANE=game/world-switch /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`.
- Scratch scripts: `cd web && npx vite-node -c vitest.config.ts <script.ts>` (the `@/` alias resolves).
- The realtime server imports the shared contract from `web/lib/net` (`@net/*`), so a protocol change ships with a realtime deploy.
