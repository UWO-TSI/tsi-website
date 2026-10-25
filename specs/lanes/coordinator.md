# Coordinator handoff

For the next coordinator session. Start fresh from this file, `STATE.md` and the lane files beside it. Don't start from old chat history.

## Who does what

- **The coordinator:**
  - runs the lanes as background agents, one worktree each, under `.claude/worktrees/`;
  - publishes every visual change to David as a review page with Approve/Redo and a note per item;
  - reads his decisions back;
  - merges approved work into `feat/game-default-island` and pushes it to main;
  - applies prod migrations.
- **Lanes:** never push and never talk to David.
- **Restarting lanes:** done automatically, fresh from their file in `specs/lanes/`, when a lane has run for hours, its context is huge, or it's idle after a review (David, 2026-10-18).

## Helpers

All in `~/.claude/jobs/62203045/tmp/`, which survives reboots.

- `push-main.sh`: fetches, refuses if origin moved, runs tsc if `web/` TS changed, then pushes feat and main.
- `build-approvals.py out.html "Title" items.json`:
  - each item is `{id, label, facts, img}`, where `img` is a local webp, png or jpg path;
  - it uses `approve-template.html` and stores decisions in the `approvals` collection;
  - publish with `capabilities: {"db": {}}`, then read the decisions with ArtifactData `list approvals`.
- `prod-dump.sh <label>`, `prod-query.sh <sql>` and `verify.sql` are for prod migrations. The procedure is in `STATE.md` and the memory files.
- `withlock.sh heavy|blender|devserver <cmd>` (set `LANE=game/<lane>`): takes a lock, waiting while swap is high and another lock is held. It lives in `~/.claude/jobs/62203045/tmp/`, the same folder as the helpers above, and is referenced from `specs/lane-rules.md`.

## Now (2026-10-25): v1 launches on the NEW world (row 318)

Read `specs/launch/v1-new-world.md` first, then `specs/launch/terrain-v3.md`. The launch is Oct 31, go/no-go Oct 28, and the village stays as the fallback behind the world switch (`NEXT_PUBLIC_GAME_WORLD=new`, merged; realtime v7 deployed).

- **David answered the terrain plan** (all 11 sections, 2026-10-23): https://claude.ai/artifact/J6fE1DjDqxt732R8JPvpxs, collection `sections`. His answers, verbatim, and the build are in `specs/launch/terrain-v3.md`; his 20 references are in `specs/references/terrain/plan-2026-10-23/`. Open on Oct 31: the wharf, the west beach and the village. Everything else stays visible but closed naturally (broken bridges, landslides, a guard). He said cut nothing, so the work is ordered, not cut.
- **Lane `terrain-v3`** (`game/terrain-v3`), running: ponytail fixes done, now R1c then R2, one review for both.
  - **R1** (e8675d5e): David redid every item on 2026-10-24.
  - **R1b merged** (cbf729af, with the ponytail fixes 2e9ae1bf): David approved it 2026-10-25 ("terrain approved read feedback") with notes on the review page https://claude.ai/artifact/GEg5mHuG6ACN95UdZiLJou (collection `approvals`). It holds:
    - a compact map; deck 1, quay 2, village 3; a bigger plaza with the buildings moved; the mountain moved in;
    - the meadow at village level behind an invisible border that reads "This area is releasing soon." (`barriers.ts` model `border`, `BorderNotice.tsx`, drop feature `meadow`).
  - **R1c** (David's R1b notes, verbatim with my reading in `specs/lanes/terrain-v3.md`): the map very slightly longer (he clarified "the cut" is the horizontal band taken out to shorten it); one bigger islet with small ones close by; the wharf half to two thirds as deep and slightly shorter; the path way shorter so the village sits by the wharf; the beach tapering into the wharf; a more gradual forest.
  - **R2** straight after, on the R1c ground: plank flooring and the fish market, the jetty at 1 with ladders, stairs, fences, lamps, houses in the plaza gaps, the campfire, chairs and palms, broken bridges and rockfall, the lighthouse.
  - **When the lane reports:** build one review page from its `specs/evidence/terrain-v3/r2/` images. Over 300 new code lines again means a ponytail review before the merge.
- **HQ round 4 merged** (71135930, David approved all four items 2026-10-23), with the ponytail cleanup. Later items are logged as A14. `hq-notice-board.glb` is no longer rendered but is still in the propModels table; delete both together after launch.
- **Upper-floor fix merged** (72a9b9c5). Remote players in rooms stand at the height they sent, with no realtime deploy needed.
- **Still open:** the shop is offline for multiplayer (`netReady = inside !== "shop"`, DefaultIslandWorld.tsx:722), so players in the shop vanish for others.
- **Waiting on David:**
  - the speed-test quiet window (script on `game/perf-v1`: `specs/perf/window-ab.sh`);
  - the editor session after R2 (resident anchors, gather and bug spots, mailbox, boards);
  - the play-through with a friend;
  - the MacBook Air check.

## Merge check: ponytail

Before merging a lane branch that adds more than about 300 lines of code, run a read-only ponytail review of its diff. Use an Explore agent: `git diff main...<branch> -- web realtime`, judged against `~/.claude/skills/ponytail/SKILL.md`. It looks for:
- duplicates of existing code;
- dead code left behind;
- unrequested abstractions;
- new dependencies.

Fix what's cheap before the merge, and log the rest in the current ponytail audit (`specs/ponytail-audit-*.md`). The codebase audit runs as its own lane (`specs/lanes/ponytail.md`).

## Waiting on David

- **Merch:** close-ups of the lanyard's snap hook (face-on and side-on) and the D-ring, and a recording of the keychain click.
- **Yearly flag designs:** for the HQ banners.
- **Stock limits** for the merch, if any.
- **The Roblox Studio attachment values,** from the Lua script; the hats are estimates until then.
- **Photos of real tees and prints** for the shop pegboard's stand-ins.
- **Writing only he does:** Bram's and Wren's lines, and the Founder's plaque text.
- **Building exteriors:** remodelled later. HQ's outside stays as it is for now.
- **Profile customisation price:** 5,000 gems, flagged as high.

## Queued after today

- Fallen leaf piles under trees.
- One combined perf:check on a quiet machine, then a baseline refresh.
- The MacBook Air speed check, at the very end.

## Standing rules (short)

The full set is in `CLAUDE.md`, `specs/lane-rules.md` and the memory files.

- Never reveal the gem rate anywhere public. The repo is public; specs carry gem prices only.
- Never open windows, apps or tabs on David's screen. Never use the Playwright MCP.
- David supplies every art reference.
- Real names never show.
- Never edit applied migrations.
- Stop for anything destructive, costing money or irreversible. Otherwise merge and deploy verified, approved work without asking.
- No idle polling.
