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
- `withlock.sh heavy|blender|devserver <cmd>` lives in the session scratchpad (`/private/tmp/claude-501/-Users-DavidLiu/62203045-4999-4738-af95-c4357660b05d/scratchpad/`). It's referenced from `specs/lane-rules.md`. If `/tmp` is cleared, recreate it from the rules there.

## Lanes as of 2026-10-18 (end of day)

| Lane | Branch | State |
|---|---|---|
| HQ interior | `game/hq-interior` | Layout A (back mezzanine) chosen; phase 2 furnishing. See `hq-interior.md` |
| Wardrobe batch 2 | `game/wardrobe-b2` | Hat-cut round 5 for review. Seed `20261017172740_catalogue_seed.sql` is unapplied. See `wardrobe-b2.md` |
| Flat UI | `game/flat-ui` | Waiting on David: the bag and collection round 2, and the first four cream menus. See `flat-ui.md` |

### Open review pages

Read them with ArtifactData:

- https://claude.ai/artifact/Qvt8ekj8cWHMY4ftTcb8U4: the flat UI round 2 bag and collection, and the micro animations.
- https://claude.ai/artifact/5VW76H2kqZJePHCobKEY9T: the first four menus in cream (journal, mission board, notice board, mailbox). David's OK on the direction unlocks the rest of step 7.
- The wardrobe round 5 page and the HQ phase 2 page, published when those lanes report.

### Merge plan

1. **Wardrobe batch 2:** once David approves the hat cut, back up prod, apply the seed, verify, and merge the branch. Then:
   - the merch catalogue rows (keychain 800, lanyard 800, sticker 200, held in `PENDING_MERCH`) get one generated catalogue migration after the wardrobe seed;
   - flat UI step 8 (the avatar creator) gets its go;
   - the body rework (slimmer, longer legs with thighs) can start.
2. **Flat UI:** merge after David approves the round 2 pages. Steps 1 and 2 are already on main.
3. **HQ:** merge after David approves phase 2.

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
