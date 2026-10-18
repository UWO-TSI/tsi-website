# Lane: flat UI

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/flat-ui`
- **Branch:** `game/flat-ui`

## Status (2026-10-18)

- **Head:** see `git log -1` on `game/flat-ui` (the round 2 bag and collection commit, on top of the reviewed `[wip]` 1b9308e6 and the handoff merge).
- **Round 2, the bag and the collection: built, waiting on David.** Sheet `specs/evidence/flat-ui/round2-bag-collection.webp`, motion `round2-motion-filmstrip.webp`.
  - The `[wip]` was reviewed and finished, not reverted:
    - the micro animations (`components/gui/motion.ts`, kit CSS): the rail's dot and the tabs' pill slide, presses dip, new content fades and rises 4 px, the side panel slides in; all 120 to 200 ms, ease-out, off under reduced motion;
    - the bag: rail filters (everything, fish and sea creatures, bugs, forage and fruit, materials, then tools, clothes, furniture), only the filters the pockets hold show; a click opens `SidePanel` beside the grid (`WithSide`), no stage;
    - the collection: a hover card (long press on a phone, keyboard focus), a click opens the same side panel; no stage.
  - Fixed on top of it: the rail's dot sat on the wrong icon when filters appeared (it now re-measures as children change); the hover card was offset by the panel's entrance transform (now placed inside the grid's own box); the click after a long press was eaten; the card showed on a tap's focus; the side panel's notes repeated the clue and the museum; actions laid out as one dark button across, then grey pills.
  - No fish model is shown anywhere now: the bag and the collection have no stage; the shop and the workbench never show fish.
- **Merged to main:** step 1 (the kit), step 2 (the old shop pages).
- **Approved:** the kit, the chest, the workbench, the furniture catalogue.
- **Waiting:** step 8, the avatar creator and wardrobe, needs the coordinator's go after `game/wardrobe-b2` merges.

## David's decisions (round 2, 2026-10-18)

The verbatim notes are in `specs/polish/flat-ui.md`, under "Round 2".

1. **The kit is approved.** Add "micro animation when switching between tabs and clicking between icons":
   - the IconRail marker slides or fades;
   - icon presses scale down slightly;
   - tab content cross-fades or slides a few px;
   - the Tabs pill or underline slides.
   Each takes 120–200 ms, ease-out, and is off under prefers-reduced-motion. This applies everywhere, the shop included.
2. **The bag (redo):**
   - The rail gets category filter icons: all, fish, bugs, forage and fruit, materials, tools, furniture, clothes, and whatever else the bag really holds.
   - Clicking an item opens a small side panel next to the grid, with its name, a small picture and its actions (pin, lock, drop, equip, sell price). There's no full item page or studio stage, and the grid stays visible.
   - The storage chest and the workbench are approved as they are.
3. **The collection (redo):**
   - Hovering, or long-pressing on a phone, shows a small info card by the tile: name, rarity, where and when, the record and museum status.
   - Clicking opens the same small side panel, with its actions.
   - There's no full-page stage. The furniture catalogue is fine as it is.
4. **Remove the 3D detail stage** from the bag and the collection. It stays only in the shop and the merch. The black bass was upside down, so if any view still shows a fish model, fix it.
5. **Step 7 (redo), every other menu:**
   - KEEP THE OLD CREAM PALETTE on these menus, the original colours, paper and accents, and revert the flat recolour on them. The flat white and grey stays only on the shop, bag, chest, workbench, collection and furniture catalogue.
   - The real ask is better design:
     - more space, cleaner and more intuitive;
     - fewer boxes and nested cards;
     - one obvious primary action per view;
     - generous padding, grouped and aligned content, readable sizes.
   - **Specific notes:**
     - the journal and quests keep the palette, cleaner;
     - "cleaner mission board design";
     - "notice board design needs to be simple and intuitive";
     - "mailbox more subtle".
   - Mail letters and the notice board's notices stay paper.

## Next

1. ~~Finish the WIP, shoot the bag and the collection, report.~~ Done (`round2-bag-collection.webp`).
2. Redesign FOUR menus first, in the cream palette: journal and quests, the ruins mission board, the notice board, the mailbox.
   - Shoot before and after (desktop and phone) into `round2-step7-first4.webp`.
   - Report it, then STOP for David's OK on the direction.
3. After his OK, apply the direction to the rest: settings, wallet, tourney, cafe goals, trophies, showcase, donate, the Esc menu, friends.
4. Step 8, the creator, only on the coordinator's go.

Each step ends with:
- full tsc;
- eslint on the changed files;
- the full vitest under the heavy lock;
- an update to this file and a commit.

## Tools and gotchas

- **Dev page:** `/dev/flat-ui`.
- **Shots:** `specs/evidence/flat-ui/shots-*.mjs`, using the in-memory economy fixture (`economy-fixture.ts`). Sheets come from `sheet.py`.
- **Sheet's variant:** `variant` defaults to cream. `IslandSheet`, `ProgressionPanel` and the game's own sheets set it to flat. Paper comes from `Paper`, `[data-gui-paper]`.
- **The applicant island's collection** must stay pixel-identical; it's gated, not forked.
- **Unreachable for shots:**
  - the Oracle path doesn't open in `/lab/island`;
  - people-here and the player card need multiplayer.
- **Shop recheck:** 2 club-merch states differ by about 25 px of antialiasing on the panel corner. That's known.
- **`lib/game/shopRead.ts`** is unused since step 2. It's left in place.
- **Round 2 shots:** `shots-round2.mjs <out> bag collection motion` on `/dev/flat-ui` (`motion` records a video; frames come out with `ffmpeg -vf fps=25`). Keep raw PNGs in the scratchpad, not the repo. The round 2 "before" panels are cropped from the step 3-4 and 5-6 sheets' "after" column (x 932, y 64 + 618 i + 40, 900 x 562).
- **Locks:** `withlock.sh` in the scratchpad writes the owner `game/remodel-quick`; use a copy with `game/flat-ui` (`withlock-flat-ui.sh`). Swap has been over 9 GB, so the dev server has to be down before the heavy lock.
- **A transformed ancestor traps `position: fixed`:** the flat panel's entrance animation (`rise ... both`) makes the panel the containing block. Place pop-overs inside a positioned box of the content instead.
- **A rail's marker:** `useMarker` re-measures on key, resize and child changes; a rail that gains items after load (the bag's filters) moved the icons under a stale dot before.

