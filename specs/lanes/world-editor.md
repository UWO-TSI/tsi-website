# Lane: world-editor (a creative-mode editor for placing the world)

Worktree `.claude/worktrees/world-editor`, branch `game/world-editor`, cut from origin/main a8a03985. Agent type `uwotsi-lane`. Dev port 3482.

## Round 1: David's ask (2026-11-05, verbatim; on f8-board-wide, https://claude.ai/artifact/HZ1DSnZgB2dCFaaWtMCh71)

- "i should just  have a editor screen like minecraft creative for me to place everything"

Build (a working first version plus one pitch; nothing ships until David marks it):
1. Map how the world's things are placed today: positions in code, inside the island GLBs, or in data. List what can move without re-exporting a model and what can't, in a short table.
2. A creative-mode editor for the Founder, admin only:
   - Reuse the gating and the UI kit of the existing admin editors (catalogue, fit, NPC). Check them before writing anything new.
   - Fly the camera freely.
   - Click a placed prop to select it, then move, rotate, raise or lower, or delete it.
   - Place a new prop from the catalogue.
   - Snap to the ground; undo; save.
3. Where saves go, pitched with a pick:
   - (a) a layout file in the repo that the editor writes in dev, which needs a commit to reach prod;
   - (b) a layout table in Supabase that the world reads at load, which gives live edits in prod and needs a migration and admin-only writes.
   - Build round 1 on whichever needs no prod migration, and stage the other as a plan.
4. Start with the wharf, the catch board area David is placing now. Edits there must show in the game. game/fishing-depth is moving the wharf props this round and merges soon, so keep positions in data the editor reads and expect to rebase onto it.
5. Clips and shots on desktop, under `specs/evidence/world-editor/r1/`. Phone isn't needed for an admin tool; say so on the page.

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`, and after any export into web/public run `cd web && node scripts/pack-glbs.mjs`. Never ports 3000, 3300, 3301, 3390.
- Locks: `LANE=game/world-editor /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry.
- If `web/node_modules` is missing: `cd web && npm ci --legacy-peer-deps` under the heavy lock.
- Commit `[build]`, never push, never bare `git stash`. Never edit applied migrations. No em dashes. Ponytail (`specs/lane-rules.md`). Never write the gem-to-money rate. Real names never show in game.

## Status

Round 1 not started.
