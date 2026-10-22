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
- https://claude.ai/artifact/GdXdjzGaZrF9GgW6A3YF27: HQ phase 2, furnished. The head is `831f3036` on `game/hq-interior`; perf is 2.70 ms high and 1.80 ms lite.
- https://claude.ai/artifact/XY6Fs3QRo6wWy9ENZAT9XC: wardrobe hat cut round 5 (page "Wardrobe Round 6"). The head is `2ac70250` on `game/wardrobe-b2`, with main merged.
  - Known leftovers: #18 over #10 shows 3 spikes at the back; #18 over #23 has a strip of hair on the brim; #22 over #27 shows a few wisps.
  - If David approves: apply the seed to prod (back up first), merge, then the merch catalogue rows.

All three lanes are stopped at end of day with their handoff files current. Nothing is running.

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
