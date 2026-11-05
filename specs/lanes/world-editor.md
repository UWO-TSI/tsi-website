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

Round 1 built on game/world-editor (the commit "[build] world-editor r1: evidence"). Gates: vitest 3761 passed and 4 skipped (398 files); tsc clean; eslint clean on the 16 touched ts and tsx files. Not reviewed yet; nothing ships.

**What was already there.** `/lab/world` (the lab's top bar, "World editor"; specs/world-editor.md) is already a creative-mode editor. It has fly, the hotbar and palette, select, move, rotate, scale, delete, place, undo and redo, Ctrl+S save to web/data/world through the dev route `/api/lab/world`, and P to walk it in the game. Round 1 extends it; there is no second editor. `/lab/map` is the old grid painter, and it doesn't edit the member world.

**Round 1 adds to /lab/world:**
- Select picks what the crosshair passes through (editorStore `objectOnRay`), not the ground behind it.
- `]` and `[` raise and lower a prop or a board (Alt for 0.25; Shift already flies down), and G snaps it to the ground. A new `lift` field is read by the game's prop placement (NatureModels `sceneryOf`) and by the boards.
- The palette's "Scenery props" group holds every SCENERY_URLS model plus the market's two boards. A placed prop takes the scale the world already uses for its model, and its ghost shows the model.
- The catch board and task board are data now: `board` objects in world.json (ids `catch` and `tasks`). The game reads them (wharf.ts `boardsOf`); the generator lays them from MARKET_BOARDS.
- Edits survive generate-world. Whatever the editor changes is `pin`ned, with `of`, where the generator had put it. layoutObjects keeps pinned objects; each one replaces the generator's object of the same kind and model nearest `of` (within 3) and takes its current id, so positional ids (market-5) can shift. A delete stays as a pinned `gone`, which no world shows (villageMap `standing`). New objects get `placed-N` ids.
- Saves write each object's fields in the file's order (parseObjects), so a load saves back to the same bytes.

**Placement map** (where each thing's position lives; whether it moves without re-exporting a model):

| Thing | Where its position lives | Moves in the editor without a re-export |
|---|---|---|
| Ground heights and paint | height.png, surface.png | Yes (brushes) |
| Buildings (HQ, shop, café, museum, Oracle, monument, plaza boards, mailbox) | world.json `landmark`; generate.ts LAYOUT re-applied on a rerun unless pinned | Yes |
| Houses | world.json `house` (generated) | Yes |
| Market props (fish market, carts, barrels, crates, nets), sell stall, tackle shop, ship; palms, shrubs, beach set, forest, coral | world.json `prop`, generated from generate.ts MARKET, SHOPS, SELL_AT and scenery() | Yes; pinned edits survive a rerun |
| Catch board, task board | Was a code offset from the fish market (wharf.ts MARKET_BOARDS); now world.json `board` | Yes (now) |
| Lamp posts, hand lanterns | world.json `lamp` (generate.ts lamps()) | Yes; no raise |
| Deck squares | world.json `deck` | Yes, a whole square |
| Deck kit (tiles, roped piles, ladders, life rings, nets, rope fencing) | Code: wharf.ts deckPieces, from the deck squares, hashed | Only by moving its deck square |
| Jetty piers, walkways, piles, the boat's berth | wharf.ts JETTY in the wharf landmark's frame, plus jetty.glb | The whole jetty, through the wharf landmark; its shape needs a re-export |
| Tackle counter, sell sheet, volleyball court and board | Code offsets or ids on their props (TACKLE_COUNTER, SELL_BARREL, volley-board, volleyball-net) | They move with their prop |
| Residents' anchors, spawn, bug spots, shells, bottles, fitting room, mission board, campfire | world.json markers | Yes |
| Parts inside a model (the market's porch, fish table and swordfish; the stall's scale and SELL board; the tackle shop's rod; the ship's scaffold; the fountain) | Inside the GLBs | No: Blender re-export |
| Interiors (HQ, shop, café, museum, home) | hqLayout.ts, shop_layout.json, cafe.ts, home code | Not in this editor |

**Where saves go (pick: a).**
- (a) The repo file: the editor writes web/data/world in dev and a commit carries it to prod. There is no migration. It is reviewed and diffable, the server's cells.json stays in step, and the tests guard it. It needs a dev server and a commit. Round 1 is built on this.
- (b) Supabase, staged as a plan: the draft `web/supabase/drafts/world_layout.sql` holds one row per pinned object in world.json's own shape. Members read it; writes go only through an admin route behind adminContext (T1/T2) with the service role. The game lays the rows over world.json the way layoutObjects does, a "Build" toggle for T1/T2 in the game mounts the editor's object tools, and a bake script folds the rows into world.json and clears them. It gives live edits in prod. It needs the migration, the route, the bake step and a cache bust. The risks: prod edits skip review, and the terrain stays repo-only (cells.json).

**Evidence** (`specs/evidence/world-editor/r1/`, desktop 1280 x 800, headless; phone isn't needed for an admin tool):
- we1-01: `we1-01-board.mp4` with its poster `we1-01-board-poster.webp`, plus shots `we1-01a` to `we1-01g`. In /lab/world, aim at the catch board and select it, drag it along the deck, turn it, raise it, snap it down and save; P walks it in the game. `we1-01g-game-before-after.webp` crops the game's own view from before the edit and after the save: the board has moved from the grass by the palm onto the deck.
- we1-02: `we1-02-place.mp4` with its poster `we1-02-place-poster.webp`, plus shots `we1-02a` to `we1-02e`. A barrel's ghost from the catalogue at the market's barrel scale, three barrels placed and turned, then a fish crate. The crate is selected, raised 0.75, snapped down and deleted, and undo brings it back.
- we1-03: `we1-03-palette-catalogue.webp`, the palette's "Scenery props" group with the two market boards.
- The demo's save was restored (`git checkout -- web/data/world`); no layout change is committed.

**Not done or not verified:**
- If David moves the fish market but not its boards, a generator rerun lays the boards from the generator's market, not his.
- Phone isn't needed for an admin tool; there is no phone pass.
- Pick by ray uses an upright post per object, not the mesh.
- The walk-it shot (we1-01e) puts the game camera behind the fish market's roof; the game's own before and after view is we1-01g.
- In we1-02 the fish crate lands under the stall's awning, so the raise reads mostly through its selection box.

## Next

1. David reviews round 1.
2. When game/fishing-depth merges: its MARKET_BOARDS change moves the boards only through their two `board` rows in world.json. wharf.test ("reads the boards from the world's board objects") fails until they are rewritten (rerun generate-world, or put marketBoardsOf's values in the two rows).
3. If David picks (b): the draft migration, the admin route, the in-game Build toggle, the bake script.

## Tools and gotchas

- Clips: `specs/evidence/world-editor/r1/clips.mjs` (headless, through `window.__worldEditor`; it now exposes rotate, liftSelected, deleteSelected and save). The board scene saves into web/data/world: run `git checkout -- web/data/world` after it.
- Dev port 3482.
- Tests: lib/game/world/editor.test.ts ("placing props"), lib/game/wharf.test.ts (the boards), world.test.ts.
