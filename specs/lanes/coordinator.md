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

## Now (2026-10-23): v1 launches on the NEW world (row 318)

Read `specs/launch/v1-new-world.md` first: the gap analysis, the blockers and the smallest viable scope. The launch is Oct 31, go/no-go Oct 28, and the village stays as the fallback behind a world switch.

- **Terrain plan with David:** https://claude.ai/artifact/J6fE1DjDqxt732R8JPvpxs. Read it with ArtifactData `list`, collection `sections`; add follow-ups to a document's `followups: [{q, a}]`. Each finished section becomes a build spec for the terrain rebuild lane, which hasn't started yet: it waits for David's answers, at least sections whole, wharf, village and launch.
- **The `game/world-switch` lane is running (code only):**
  - multiplayer bounds (needs a realtime v7 deploy by the coordinator);
  - server catch checks on the active world;
  - the NEXT_PUBLIC_WORLD switch;
  - editor anchor names and water_edge bugs;
  - the sealed-zone test;
  - the minimap crop;
  - follow-camera shadows;
  - the arrival route from the world.
- **Done Oct 22–23:**
  - the flat UI and themes, ponytail Phase B, the launch two-account test and the visor logo are merged;
  - the merch catalogue is applied (the tote and sticker pack off sale);
  - prod Supabase resized Nano to Small (David OK'd it; about $5/mo net);
  - realtime v6 (join retry, db_read logs); 23 cold joins passed.
- **Waiting on David:**
  - HQ round 4 review: https://claude.ai/artifact/8Nbrs8noRNY2isXrAQkMjM (HQ code is on `game/hq-interior`, head d4b10ddc);
  - the speed-test quiet window, whose script is on `game/perf-v1` (`specs/perf/window-ab.sh`);
  - the terrain plan answers.
- **Open launch fix:** other players on upper floors (HQ, shop) draw at ground height because presence sends no y. Add the height to presence.

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
