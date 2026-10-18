# Lane: flat UI

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/flat-ui`
- **Branch:** `game/flat-ui`

## Status (2026-10-18)

- **Head:** `1b9308e6 [wip]`, on top of `325b45d8`.
  - The WIP is the previous agent's round 2, in progress:
    - micro-animations, in the new `web/components/gui/motion.ts` and the kit's CSS;
    - the bag's side panel (`Bag.tsx`);
    - the collection's hover card and side panel (`FlatCollection.*`);
    - kit edits (`gui/flat/*`, `gui/index.tsx`, `gui.module.css`, the tests);
    - a new `specs/evidence/flat-ui/shots-round2.mjs`.
  - It was replacing the collection's detail page with the hover card and side panel. Review it, then finish it.
- **Merged to main:**
  - step 1, the shared kit (`web/components/gui/flat`, `--flat-*` tokens);
  - step 2, the old shop pages on the overlay's body.
- **Done on the branch:**
  - the detail stage's pose code is removed (`325b45d8`);
  - David's round-2 notes are in `specs/polish/flat-ui.md` (`3dcd3541`).
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

1. Finish and check the WIP:
   - the micro-animations;
   - the bag's filters and side panel;
   - the collection's hover card and side panel;
   - the stage removed from the bag and the collection.
2. Shoot before and after (desktop and phone). Make the sheet `specs/evidence/flat-ui/round2-bag-collection.webp`, then report it to the coordinator and keep going.
3. Redesign FOUR menus first, in the cream palette: journal and quests, the ruins mission board, the notice board, the mailbox.
   - Shoot before and after (desktop and phone) into `round2-step7-first4.webp`.
   - Report it, then STOP for David's OK on the direction.
4. After his OK, apply the direction to the rest: settings, wallet, tourney, café goals, trophies, showcase, donate, the Esc menu, friends.
5. Step 8, the creator, only on the coordinator's go.

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
