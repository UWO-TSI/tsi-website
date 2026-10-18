# Lane: flat UI

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/flat-ui`
- **Branch:** `game/flat-ui`

## Status (2026-10-18)

- **Head:** see `git log -1` on `game/flat-ui`.
- **Step 7, the first four menus: built, WAITING on David's OK on the direction** (sheet `specs/evidence/flat-ui/round2-step7-first4.webp`). Don't start the rest until the coordinator relays his OK.
  - **Palette:** every in-game `Sheet` is back on cream. `variant="flat"` is gone from `IslandSheet`, `ProgressionPanel`, the Esc menu, friends, people here, the player card and start studying. The Sheet's flat variant code stays for `FlatPanel`'s pieces. So the menus not yet redesigned (settings, wallet and the rest) show their original cream look again.
  - **The cream pieces** (`components/gui/cream`):
    - `Folds` and `Fold`: rows that open in place, the open one the only paper, with that row's one action;
    - `Section`: a quiet uppercase heading;
    - `QuietButton`: second actions as underlined text;
    - `BackLink`.
  - **Journal** (`JournalSheet`, `ClubGoal`):
    - quests: chapters as rows; the one under way is open, with its steps, the step to do now under the highlighter, and one action; skip is a quiet link. Locked chapters are plain rows.
    - club goals: one bar, the points and percent above it, and one numbers line; what opens next is one line under "Up next".
    - letters: the mailbox body.
  - **Mission board** (`MissionBoardSheet`, `MissionBoard.module.css`, size lg):
    - the mission under way sits on top in butter, with its progress and one action (Claim rewards, or Abandon as a quiet link);
    - missions are rows by area: a kind icon, difficulty pips, and "Back in 14 h";
    - the open row shows the story, reward chips and Accept.
  - **Notice board** (`NoticeSheet`, size lg): notices pinned on paper.
    - the goal is the big notice, with Contribute;
    - your next step is a butter sticky note (first on a phone);
    - "Up next" is one line;
    - HQ notices are slips that open to read ("The board" goes back).
  - **Mailbox** (`LettersSheet`, "more subtle"):
    - quiet hairline rows: an envelope, the sender and subject, a line of the letter, and the date;
    - unread is shown in bold with a coral dot;
    - "Write a note" is the kit's quiet button;
    - an opened letter is paper, with Reply, and Report as a quiet link;
    - the composer has the paper textarea.
  - **Shared bodies:** `JournalBody` and `LettersBody` also render the portal pages `/student/dashboard/journal` and `/letters`, so those pages pick up the new layout too (same palette).
- **Round 2, the bag and the collection:** built, reported (`round2-bag-collection.webp`, `round2-motion-filmstrip.webp`), waiting on David.
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

1. ~~Finish the WIP, shoot the bag and the collection, report.~~ Done.
2. ~~Redesign the first four menus in cream, shoot, report.~~ Done (`round2-step7-first4.webp`). **STOP here until David's OK comes through the coordinator.** Fold in any notes he gives on the four first.
3. After his OK, apply the direction to the rest, with the `components/gui/cream` pieces: settings, wallet, tourney, cafe goals (it still uses `GoalCard`; move it to `ClubGoal`), trophies, showcase, donate, the Esc menu, friends. Shoot before and after into one sheet.
   - `progression.module.css` still serves the wallet, Contribute and cafe goals. When those move, delete what's left unused there and `GoalCard` (keep `rewardName`).
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
- **Step 7 shots:** `shots-round2-step7.mjs <out> [scene ...]`.
  - The journal, the notice board and the mailbox run on `/dev/progression?demo=1&sheet=journal|goals|letters|notice`. That harness now answers the journal's own letters fetch too.
  - The mission board runs on `/dev/flat-ui?surface=missions`, with `cool=<id>` for a cooldown, `mission=<id>` for one under way and `done=1` for one ready to claim.
  - Both pages have the sky backdrop. `/dev/progression` has its own nav buttons top left; they're in the before and the after alike.
- **Before shots of cream menus:** take them from the branch with the variant reverted and before the redesign; once the code changes there's no going back without a second worktree.
- **The kit's `Button`** (VillageButton) is the primary action in cream: a sage blob, big on purpose. `variant="quiet"` is the cream pill for a quiet action (the mailbox's Write a note).

