# Lane: flat UI

- **Worktree:** `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/flat-ui`
- **Branch:** `game/flat-ui`

## Status (2026-10-22)

- **Head:** see `git log -1` on `game/flat-ui`. Main (`feat/game-default-island` f66bafe6, wardrobe batch 2) merged in.
- **Feature freeze Oct 24** (launch Oct 31; `specs/launch/v1-launch.md`, ledger row 317). Step 8 merges only if David approves it by Oct 24, otherwise after launch. Keep it opt-in and behaviour-identical; don't widen scope.
- **Round 3, step 1 (the side panels and the motion): APPROVED** with notes (the verdict below): a spring instead of ease-in-out, a slight drop shadow on the hovered cell, and the four menus shown in the flat palette beside the cream ones.
- **Round 3, step 8, the avatar creator and wardrobe: APPROVED** (`round3-creator.webp`), with one note (the rail's icons a little bigger). Opt-in `flat` on `CharacterCreator` (closet, fitting room, the member's first creator); the applicant's is unchanged.
- **Round 3b: built and reported** (`round3b-spring-theme.webp`): the spring, the hover shadow, the bigger rail icons, and the four redesigned menus in cream beside flat for David to pick. Main d251c36e merged in. The coordinator plans to merge game/flat-ui into main once David OKs round 3b, before the Oct 24 freeze.
- **Step 7, the first four cream menus:** built (`round2-step7-first4.webp`), NO verdict yet. Leave them as they are; don't roll the direction out to the other menus until the coordinator relays David's OK.
- **Approved:** the kit, the chest, the workbench, the furniture catalogue, the bag (filters and side panel).
- **Merged to main:** step 1 (the kit), step 2 (the old shop pages).

## David's decisions (step 8 verdict, relayed 2026-10-22)

APPROVED: the creator, all three items. One note on the closet, verbatim: "left ui iicons could be slightly bigger". The IconRail icons a little bigger (roughly 20 to 24 px glyphs, the hit area grown to match); it's the kit's rail, so the shop, bag, collection and creator all match. Folded into round 3b.

## David's decisions (round 3 verdict, relayed 2026-10-22)

The verbatim notes are in `specs/polish/flat-ui.md`, under "Round 3 verdict". APPROVED: the panels, the phone panels and the motion.

1. Motion: "make the fell more bouncy/springy rather than linear". A spring with a small overshoot on hover and select (the cell pops out and settles back a little, the neighbours spring too); a CSS `linear()` curve or a tiny solver, transform-only; hover about 200 ms to settle, select about 400 ms; off under reduced motion.
2. Phone panel item: "add a slight drop shadow to the hover tab as well". The hovered cell gets a soft, slight drop shadow as it grows out; the selected cell keeps it.
3. Theme: "i think overall ui can adopt like color theme, this is the basic clean color theme for ui but later will sell ui in shop for like dark mode, and acnh themed and st uff like that, but this looks good". Before the freeze: the four redesigned menus (journal, mission board, notice board, mailbox) in the clean flat palette too, new layouts kept, paper kept for letters and notices, beside the cream versions so David can pick. Don't convert the other menus yet. Themes as token sets come after launch; don't build them now.

## David's decisions (round 3, 2026-10-18, relayed 2026-10-22)

The verbatim notes are in `specs/polish/flat-ui.md`, under "Round 3".

1. **Bag (filters and side panel):** APPROVED.
2. **Collection:** REDO. "make the right tab ui more spacious and less compact, make it a bit bgiger so that theres breathing room and icon can be bigger". The side panel wider, more padding and row spacing, a bigger picture, a clear hierarchy; the bag's side panel the same (one component).
3. **Micro animations:** REDO. "hover make a ease in out speed up slow down for the items clicked to slowly budge out a tiny bit to show its selected and push the other cells away for both hover (quicker) select(slower)".
   - ease-in-out; hover: the cell grows slightly out of the grid, the neighbours shift away, about 140 to 180 ms; select: further out, stays out while selected, neighbours stay nudged, about 280 to 360 ms;
   - transforms only, no reflow; off under prefers-reduced-motion;
   - on the kit's CardGrid and ItemCard: the shop, bag, chest, workbench, collection and furniture catalogue.
4. **The first four cream menus:** no verdict yet (see Status).
5. **Step 8, the creator and wardrobe: GO.** Restyle to the flat look: flat panel, IconRail with the new motion, the white studio stage behind the character (the shop stage's lights), hairline controls, the roomy side-panel feel. Keep every behaviour: the hair colour wheel, the "Own" swatches, two-colour hair, the hat cut, the detail tiers, faces, the reflection creator flow. The applicant island's creator, if separate, stays untouched.

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

1. ~~Round 3 step 1: the side panels and the cells' motion; shoot; report.~~ Done.
2. ~~Round 3 step 8, the creator: opt-in `flat`, shoot, report.~~ Done (`round3-creator.webp`).
3. ~~The verdict's notes: the spring, the hover shadow, the bigger rail icons, the four menus in flat beside cream; `round3b-spring-theme.webp`.~~ Done and reported. Wait for David's pick of the four menus' palette.
4. When David picks the four menus' palette: if flat, flip `MenuPaletteContext`'s default (components/gui/variant) to "flat" (that's every ProgressionPanel and IslandSheet menu, so check the rest first with the coordinator, since he said not to convert them yet). Either way, after his OK (through the coordinator): apply the direction to the rest, with the `components/gui/cream` pieces: settings, wallet, tourney, cafe goals (it still uses `GoalCard`; move it to `ClubGoal`), trophies, showcase, donate, the Esc menu, friends. Shoot before and after into one sheet.
   - `progression.module.css` still serves the wallet, Contribute and cafe goals. When those move, delete what's left unused there and `GoalCard` (keep `rewardName`).

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
- **Locks:** `LANE=game/flat-ui /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy <cmd>`. Swap has been over 9 GB, so the dev server has to be down (and the browser lock released) before the heavy lock.
- **Killing the dev server:** in zsh an unquoted `$PIDS` isn't split; kill the PIDs by number (npm exec, next dev, next-server and its postcss workers).
- **Round 3 shots:** `shots-round3.mjs <out> panels|stills|film|creator` on port 3192. `film` pauses only the animations under way and seeks them (`document.getAnimations()`), so each frame is its exact time; the finished entrances (the panel's rise, held by its fill) are left alone. The filmstrip sheet is composed by a small script in the scratchpad (`r3/film.py`), the before and after sheet by `sheet.py`.
- **Palette preview:** `palette=flat` on `/dev/progression` and `/dev/flat-ui?surface=missions` (MenuPaletteContext); `PALETTE=flat` for `shots-round2-step7.mjs`. `sheet.py` takes `LABELS="cream,flat"` for a choice instead of a before and after.
- **The spring:** `--nudge-ease` in the kit's CSS is a damped spring sampled into `linear()` (damping 0.55, 33 points); regenerate it with the formula in the comment if the feel changes. `film` times are 0 to 200 ms (hover) and 0 to 400 ms (select).
- **Creator shots:** `/dev/flat-ui?surface=wardrobe` (the closet; `place=fitting` for the fitting room), `surface=creator` (the member's first creator, with the name field), `surface=creator-applicant` (the applicant island's, as ApplicantIsland mounts it). "Dreads with a cap" is the free two-colour hairstyle (Own, the second colour). Raw befores: scratchpad `r3/before/c-*.png`.
- **The cells' motion:** `useNudge()` is a React 19 callback ref with a cleanup; the grid's direct children are the cells. It writes `--nudge-*` variables and `data-nudge` only where they change, and reads offsetLeft/Top (layout without transforms), so the motion never feeds back into itself. A cell with `z-index: 1` paints over a sticky sibling with no z-index: the side panel has `z-index: 2` for the phone.
- **A transformed ancestor traps `position: fixed`:** the flat panel's entrance animation (`rise ... both`) makes the panel the containing block. Place pop-overs inside a positioned box of the content instead.
- **A rail's marker:** `useMarker` re-measures on key, resize and child changes; a rail that gains items after load (the bag's filters) moved the icons under a stale dot before.
- **Step 7 shots:** `shots-round2-step7.mjs <out> [scene ...]`.
  - The journal, the notice board and the mailbox run on `/dev/progression?demo=1&sheet=journal|goals|letters|notice`. That harness now answers the journal's own letters fetch too.
  - The mission board runs on `/dev/flat-ui?surface=missions`, with `cool=<id>` for a cooldown, `mission=<id>` for one under way and `done=1` for one ready to claim.
  - Both pages have the sky backdrop. `/dev/progression` has its own nav buttons top left; they're in the before and the after alike.
- **Before shots of cream menus:** take them from the branch with the variant reverted and before the redesign; once the code changes there's no going back without a second worktree.
- **The kit's `Button`** (VillageButton) is the primary action in cream: a sage blob, big on purpose. `variant="quiet"` is the cream pill for a quiet action (the mailbox's Write a note).

