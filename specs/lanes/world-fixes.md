# Lane: world-fixes (two gameplay gaps in the new world, found on the production check)

Worktree `.claude/worktrees/world-fixes`, branch `game/world-fixes`, cut from main at 8318d75a. Agent type `uwotsi-lane`.

Production is on the new world tonight (`NEXT_PUBLIC_GAME_WORLD=new`), and David is testing it. The launch-check lane found:

1. **The new river fishes as sea.** `classifyWater` counts water that is 3 or more cells from land, and joined to the map's edge, as sea. The new river is wide and opens to the sea, so only 14 of its cells class as river, and river fish never bite in it.
   - Fix it at the source, the smallest change: mark river cells from the generator's River zone or annotation.
   - The default village's classification must not change: its tests and `cells.test` stay green, and the village's cells are byte-identical.
   - The realtime and fishing server read the same classes (`cells.json` for the server, the collections route), so regenerate the cells and keep client and server in agreement.
2. **No message-bottle spots.** The new world has no bottle objects, so the crafting bottle washes up at the centre of the land's bounds, in the middle of the island.
   - Give the generator a few bottle spots on the beach's waterline and the shore, the way the village has them, with stable ids.

**Read first:**
- `specs/lanes/launch-check.md` (Status);
- `CODEMAP.md`, the rows on water, cells and collections;
- `web/lib/game/world/generate.ts` (`gatherSpots` is the latest example of generator-placed nodes);
- `cells.test.ts`, `sealed.test.ts` and `walk.test.ts`.

**Gates:**
- tests with and without `NEXT_PUBLIC_GAME_WORLD=new`, with `cells.test` at `--testTimeout=30000`;
- tsc and eslint;
- the world regenerated reproducibly.

Then commit, update Status here, SendMessage "main" with the commit and gates, and stop.

## Status

- **Done (2026-10-26):**
  - **River:** `classifyWater` (fishingSpots.ts) takes the world's river cells, its "River" annotation (the generator writes it from the River zone), and keeps them river where the sea pass took them. The village carries them as `Village.rivers`: `villageOfWorld` reads `w.annotations`, the server's `villageOfCells` takes the world document's annotations (rolls.ts `activeVillage`). All 1724 River cells now class as river (14 before); from the banks, 548 of 550 casts land in river water (the 2 sea ones are at the mouth). The village has no `rivers`, so its classes are unchanged. `cells.json` doesn't change; client and server agree (cells.test checks both with the annotations).
  - **Bottles:** `gatherSpots` (generate.ts) places 4 bottle spots on the beach's waterline (ids `gather-bottle-0..3`, on land cells of the derived cell map, as `villageBottleSpot` requires), defaults David can move in the editor.
  - World regenerated: only `world.json` changed (the 4 bottles); a second run reproduced it byte for byte; PNGs and `cells.json` unchanged.
  - Gates: vitest 3434 passed with and without `NEXT_PUBLIC_GAME_WORLD=new` (`--testTimeout=30000`), a new cells.test case for both fixes; tsc and eslint clean.

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP. Never port 3000.
- **Locks:** `LANE=game/world-fixes /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`.
- **Generator edits:** only the water classing and the bottle spots. The sushi-bar lane edits the sushi bar's objects in the same file.
- **Git:** commit with the `[build]` prefix. Never push. Never use bare `git stash`. Work only in this worktree.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere.
- **Code:** follows the surrounding code (ponytail).
