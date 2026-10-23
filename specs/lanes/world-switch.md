# Lane: world-switch (v1 on the new world, ledger row 318)

Worktree `.claude/worktrees/world-switch`, branch `game/world-switch`, cut from main at `dca352f7`. Code only: nothing here depends on the final terrain shape, and no world data file is edited by hand.

Read first: `specs/launch/v1-new-world.md` (the gap analysis), `specs/world-editor.md`, `specs/terrain-v2.md`.

## Status

Started 2026-10-23. Head: see `git log`.

| # | Task | State |
|---|---|---|
| 1 | Multiplayer bounds cover the new world (realtime needs deploy) | done `4817b59a` |
| 2 | Server catch checks against the active world (`web/data/world/cells.json`) | done `c594cdbc` |
| 3 | The world switch (`NEXT_PUBLIC_GAME_WORLD=new`) | done `b56c7b94`, merged to main 51a9f7e9, realtime v7 deployed |
| 4 | Editor: anchor picker, `water_edge` bug spots, oracle keeper off the summit | done `ab349b70` |
| 5 | Sealed-zone test (`lib/game/world/sealed.test.ts`) | done |
| 6 | Minimap and map sheet crop (smooth world: open landmarks + spawn + 14 u) | done |
| 7 | Sun shadows follow the player (new world only) | todo |
| 8 | Title screen stays on the village | todo |
| 9 | Arrival route from the active world | todo |

## David's decisions

- 2026-10-23: "i want v1 launch with the main new world". The village stays the fallback behind a switch; go/no-go Oct 28.

## Next

Tasks 1 to 3 reported to the coordinator. Now 4 to 9, then the final gates and report.

## Tools and gotchas

- Lock helper: `LANE=game/world-switch /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`.
- Scratch scripts: `cd web && npx vite-node -c vitest.config.ts <script.ts>` (the `@/` alias resolves).
- The switch: `NEXT_PUBLIC_GAME_WORLD=new` (build time, client and server). `lib/game/world/load.ts loadGameWorld` swaps the island in `DefaultIslandWorld` before it mounts, unless a lab already swapped it (`villageSwapped`).
- `web/data/world/cells.json` is derived (the server's cell view); every editor save writes it, `scripts/world-cells.ts` rewrites it after a merge, `cells.test.ts` fails when stale.
- Sealed zones: `cd web && npx vitest run lib/game/world/sealed.test.ts` prints the leaks (zone, points reached, first entry coordinates); it fails on a leak only when `NEXT_PUBLIC_GAME_WORLD=new`. On the world as of 2026-10-23 the summit, the forest ruins and the cave leak; the north island holds.
- The realtime server imports the shared contract from `web/lib/net` (`@net/*`), so a protocol change ships with a realtime deploy.
