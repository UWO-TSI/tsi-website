# Flat UI: the shop's style across the game's menus

David, 2026-10-18. Ledger row 315.

## The decision

The shop overlay (round 4, approved 2026-10-18; `specs/interiors/shop.md`) becomes the style for the game's menus. David on its review:

> "i want you to impliment this type of ui more, its actually really nice and clean and i like it, do a quick scan to see what can be replaced for this"

> "I want you to inpliment this style of ui more, run through me first"

He was shown the scan below and chose:

- **Scope:** everything listed. In his words: "everything listed but do a before after".
- **Paper stays for paper things:** mail and the notice board keep their paper look, framed inside the flat panel, as the HQ notices do.

This supersedes row 285's cream paper sheet for in-game menus. Row 285 still holds for the recruitment and applicant surfaces, which this work doesn't touch.

## The style

From the shop overlay:

- one flat light-grey panel over most of the screen, with no boxes nested inside boxes;
- a left sidebar of icons only;
- coins and gems top left, as plain icon and number pairs;
- a grid of white cards, each with:
  - the picture centred;
  - the name small and a muted line, bottom left;
  - a grey pill, bottom right;
  - an optional tag and a ↗;
- a detail view in the same panel:
  - the item large on a white studio stage on the left;
  - the info and the action on the right;
  - a spec row along the bottom;
- black and white type, no beige, and the Tethos navy (#2e3a63) for round buttons.

## Surfaces, in order

| # | Surface | Fit | Size |
|---|---|---|---|
| 1 | Avatar creator and wardrobe (`CharacterCreator`, `WardrobeSheet`). It already has the rail, a big model and a right panel. | High | S |
| 2 | Old shop copies (`portal/ShopView`, `EconomySheets` `ShopBody`), moved onto the shop overlay's body | High | S |
| 3 | Bag (`Bag`, `InventoryBody`), then the storage chest (`ChestSheet`) | High | M |
| 4 | Workbench (`crafting/Workshop`) | High | M |
| 5 | Furniture catalogue (`home/DecorateSheet`). It stays docked so the room shows, so it has cards and icon filters but no detail view. | High | M |
| 6 | Collection book (`CollectionBook`, `JournalPages`). The applicant island's copy keeps its look. | High | L |
| 7 | Every other in-game sheet, through `Sheet`'s flat variant (below). | Medium | S each |

Row 7 covers settings, mail (paper letters inside the flat panel), journal and quests, the Oracle path, the ruins mission board, wallet, friends and people, the player card, museum donate and trophies, the notice board and goals (paper notices inside), the tourney and top-studier lists, and the Esc menu.

## Unchanged

- **HUD:** it has to stay light over the world.
- **Dialogue:** speech in the world.
- **Reward moments, minigames and cinematics.**
- **The HQ paper notices.**
- **The map's painted art.**
- **The marketing site, recruitment, the applicant island, admin, and the portal pages under `/student/dashboard/*`.** The portal pages can't be reached from inside the game.

## How

1. **Shared kit.** Pull the shop overlay's pieces into shared components, with the colours moved into `web/styles/game-tokens.css`:
   - `FlatPanel`;
   - `IconRail`;
   - `Purse`;
   - `CardGrid` and `ItemCard`;
   - `DetailView` with `SpecBand`;
   - `Pill`, the dark and ghost buttons, `RoundButton`, and hairline rows.
   The shop then uses the kit, with no visible change to it.
2. **`Sheet` gets a `flat` variant.** It's opt-in, and the default stays cream, because portal and recruitment pages use `Sheet` too.
   - `Tabs` render as an `IconRail` when they have icons.
   - `ListRow` becomes a hairline row and `ItemTile` a white card under the flat variant.
3. **Before and after for every surface.** Every surface converted goes to David as a before and after.

## Built (game/flat-ui, 2026-10-18)

Evidence: `specs/evidence/flat-ui/`, one sheet per step pair, each row before and after. The shot scripts (`shots-shop.mjs`, `shots-steps.mjs`, `shots-game.mjs`) are headless and muted; `/dev/flat-ui` mounts the bag, chest, workbench, collection and decorate panel alone on the in-memory services.

1. **The kit** (`components/gui/flat`): `FlatPanel` (also `embedded` on a page), `Purse`, `IconRail`, `CardGrid` and `ItemCard` (price or pill, tag, sold-out, owned and not-found covers, three sizes), `DetailView` with `SpecBand`, `InfoHead`, `PayRow` ("Price to come" turns the action off), `ColourDots`, `DarkButton`, `GhostButton`, `RoundButton`, `HairlineRow`. Colours are the `--flat-*` tokens in `styles/game-tokens.css`. The shop overlay is the kit, pixel-identical (`step1-2-shop-sheet.webp`).
2. **The old shop copies:** `/student/dashboard/shop` and `/student/dashboard/economy/shop` show the overlay's body in an embedded flat panel, on the economy service. The first used to read the legacy catalogue.
3. **The bag and the chest:** the pockets as small white cards with an icon rail (pockets, tools, clothes, furniture), an item on the white studio stage, owned things with Equip. The chest's two grids sit side by side. Drag, pins, sort, lock, drop and moving between panes all stay.
4. **The workbench:** recipe cards with a rail of what they make; a recipe on the stage with its ingredients as hairline rows and Craft as the dark pill.
5. **The furniture catalogue:** still docked beside the room; cards, icon filters, and the wallpaper and flooring as swatch cards.
6. **The collection:** the journal's pages on the rail, silhouettes until found, an entry on the stage with its field notes. The applicant island's card is gated and unchanged (0 px differ).
7. **Sheet's flat variant:** `variant="flat"`, set by `IslandSheet`, `ProgressionPanel` and the game's own sheets; the default stays cream. Inside it, tabs with icons are an icon rail, rows are hairlines, tiles white cards. `[data-gui-flat]` maps the cream tokens onto the flat palette. Letters and club-goal cards keep their paper (`Paper`, `[data-gui-paper]`).

**The detail stage's poses (David):** a fish lies on its side and swims, turning round the vertical; things drawn from above in their icons (butterflies, dragonflies, the ladybug) lean toward you so their wings show.

**Not yet:** step 8, the avatar creator and wardrobe, waits for game/wardrobe-b2 to merge.

## Round 2 (David, 2026-10-18)

David reviewed steps 1 to 7 (the sheets in `specs/evidence/flat-ui/`).

**Approved**
- **Step 1, the kit.** One addition, verbatim: "make sure to have micro animation when switching between tabs and clicking between icons".
  - The icon rail's active marker slides to the new icon.
  - An icon press gives a slight scale-down and a bounce.
  - Tab content cross-fades and slides a few px.
  - The tabs' pill slides.
  - Each is 120 to 200 ms, ease-out, and off under reduced motion. They apply everywhere the kit is used, the shop included.
- **Step 2, the old shop pages.** Merged (main 43139bc8).
- **The storage chest, the workbench and the furniture catalogue:** approved as they are.

**Redo: the bag (step 3).** Verbatim: "looks good, but make side tab icon for bag filter for fish adn bug and furnature and stuff. bad doesnt need the zoom in click into item, they can click and a lil tab on the side with action item show dont need item open page. storage looks clean, crafting looks clean"
- The rail filters by category: all, fish, bugs, forage and fruit, materials, tools, clothes, furniture, as the bag holds them.
- A click opens a small side panel beside the grid: the name, a small picture and the actions. There is no item page and no studio stage, and the grid stays in view.

**Redo: the collection (step 6).** Verbatim: "looks good, dont need lish fish or bug click into its own page, just hover and it will show small page with info, click will have page with action"
- Hover, or a long press on a phone, shows a small info card by the tile: the name, rarity, where and when, the record and the museum.
- A click opens the same side panel as the bag, with that entry's actions.

**Redo: the other menus (step 7).** Verbatim:
- "the ui overall needs better development and not beause of the new color pallete. I also kinda like the old color palette so keep the color pallete for the quests, cleaner mission board design. notice board design needs to be simple and intuitive. mailbox more subtle"
- "keep old color pallete but the ui and design needs more work, more space and cleaner more intuitive design needs to be applied"
- "keep color pallete more intuitive and clean/spacious ui layout"

What that means:
- **Palette:** these menus keep the cream palette, its paper and accents. The flat recolour comes off them. The flat white and grey look stays only on the shop, the bag, the chest, the workbench, the collection and the furniture catalogue.
- **Layout:** more space, cleaner and more intuitive.
  - Fewer boxes and no cards nested in cards.
  - One obvious primary action per view.
  - Generous padding and line spacing.
  - Grouped, aligned content.
  - Rows that are less dense, at readable sizes.
- **Notes per menu:** journal and quests, keep the palette, cleaner; the mission board, a cleaner design; the notice board, simple and intuitive; the mailbox, more subtle.
- **Order:** four first (journal and quests, the mission board, the notice board, the mailbox), before and after on desktop and phone, to David. When he OKs the direction, the rest follow: settings, wallet, tourney, cafe goals, trophies, showcase, donate, the Esc menu and friends.

**Redo: the detail stage.** Verbatim: "i dont think detail stage is needed, remove. also bass is upside down"
- The 3D studio stage comes off the bag and the collection; the side panel replaces it. It stays in the shop and the merch only.
- The fish and bug pose code goes too: the shop needs neither.

### Round 2, built: the bag, the collection and the micro animations (game/flat-ui, 2026-10-18)

Evidence: `specs/evidence/flat-ui/round2-bag-collection.webp` (before and after, desktop and phone) and `round2-motion-filmstrip.webp` (40 ms a frame).

- **Micro animations** (`components/gui/motion.ts`, the kit's CSS), everywhere the kit is used, the shop included:
  - the rail's dot and the tabs' pill are one marker that slides to the new choice;
  - an icon or button press dips and springs back;
  - new content (another shelf, another tab) fades in and rises 4 px; the side panel slides in;
  - each takes 120 to 200 ms, ease-out, and none plays under reduced motion.
- **The bag:** the rail filters the pockets: everything, fish and sea creatures, bugs, forage and fruit, materials (only those the pockets hold), then tools, clothes and furniture. A click opens a small panel beside the grid (`SidePanel` in `WithSide`): a small picture, the name, rarity and kind, what to know (in your bag, sells for, size, museum, used in) and the actions (pin to the wheel across the top, then lock and drop). Clothes and furniture show the same panel, with Equip where the slot allows it. The grid stays in view; on a phone the panel sits at the foot of the screen. A filter shows its stacks only, so rearranging works on "everything".
- **The collection:** hovering a tile (a long press on a phone, or keyboard focus) shows a small card: the name and rarity, caught, the record, where and when, now, the museum. A click opens the same side panel with those notes, the one-liner, and pin to the wheel when it's in the bag and can be held.
- **No stage:** the bag and the collection have no 3D stage, so no fish model shows anywhere (the shop sells none, and the workbench makes none).

### Round 2, step 7: the first four menus, cleaner, in the cream palette (game/flat-ui, 2026-10-18)

Evidence: `specs/evidence/flat-ui/round2-step7-first4.webp` (before and after, desktop and phone). Waiting on David's OK on the direction before the rest follow.

- **The palette:** the in-game sheets are cream again (the flat variant is off `IslandSheet`, `ProgressionPanel` and the game's own sheets). The flat look stays on the shop, the bag, the chest, the workbench, the collection and the furniture catalogue.
- **The pieces** (`components/gui/cream`), for this and the rest:
  - rows that open in place (`Folds`, `Fold`), with the open row the one piece of paper on the page and its one action;
  - sections under a quiet heading;
  - second actions as quiet underlined text;
  - a back link.
- **Journal and quests:**
  - the chapters are rows, and the one under way is open: its steps, the step to do now under the kit's highlighter, and its one action;
  - skipping is a quiet link, and locked chapters are plain rows;
  - a club goal has one bar (the monument's stages are its quarters, so the second bar went), its points and percent, and one line of who chipped in and your share;
  - a goal waiting on another is one line under "Up next".
- **The ruins mission board:**
  - the mission under way is on top, with its progress and its one action (Claim rewards, or Abandon as a quiet link);
  - the ten missions are quiet rows by area, each with a kind icon, difficulty pips and when it's back;
  - the one you open shows its story, its rewards and Accept, so there's no wall of Accept buttons.
- **The notice board:** notices pinned up on paper:
  - the club goal is the big one, with Contribute;
  - your next step is a sticky note (first on a phone);
  - what opens next is one line;
  - HQ's notices are slips you open to read.
- **The mailbox, more subtle:**
  - quiet rows: an envelope, who it's from and the subject, a line of the letter, and the date;
  - unread rows are bold with a small coral dot, with no yellow fill;
  - "Write a note" is a quiet button;
  - an opened letter is paper, with Reply, and Report as a quiet link.
- **The portal pages** `/student/dashboard/journal` and `/letters` render the same bodies, so they follow.

## Round 3 (David, 2026-10-18; relayed 2026-10-22)

David reviewed the round 2 pages (`round2-bag-collection.webp`, `round2-motion-filmstrip.webp`, `round2-step7-first4.webp`).

- **The bag (filters and side panel):** APPROVED.
- **The collection:** REDO. Verbatim: "make the right tab ui more spacious and less compact, make it a bit bgiger so that theres breathing room and icon can be bigger".
  - The side panel gets wider, with more padding and row spacing, a bigger picture or icon of the entry, and a clear hierarchy.
  - The bag's side panel gets the same breathing room, so they match. It's the same component.
- **The micro animations:** REDO. Verbatim: "hover make a ease in out speed up slow down for the items clicked to slowly budge out a tiny bit to show its selected and push the other cells away for both hover (quicker) select(slower)".
  - **Easing:** ease-in-out (it speeds up, then slows down).
  - **Hover:** the hovered cell grows slightly out of the grid and the neighbouring cells shift away a little to make room. Quick, about 140 to 180 ms.
  - **Select:** the clicked cell eases out a bit further and stays out while selected, and its neighbours stay nudged away. Slower, about 280 to 360 ms.
  - Transforms only: no layout reflow, no jank.
  - Off under prefers-reduced-motion.
  - On the kit's `CardGrid` and `ItemCard`, so it covers the shop, the bag, the chest, the workbench, the collection and the furniture catalogue.
- **The first four cream menus** (journal, mission board, notice board, mailbox): no verdict yet. They stay as they are, and the direction doesn't roll out to the other menus until his OK comes through the coordinator.
- **Step 8, the avatar creator and wardrobe:** GO (wardrobe batch 2 has merged).
  - The creator already has the rail, the big model and a right panel. Restyle it to the approved flat look: the flat panel, the `IconRail` with the new motion, the white studio stage behind the character (the shop stage's lights), hairline controls, and the same roomy side-panel feel.
  - Every behaviour stays: the hair colour wheel, the "Own" swatches, two-colour hair, the hat cut, the detail tiers, the faces and the reflection creator flow.
  - The applicant island's creator, if separate, stays untouched.

### Round 3, built: the side panels and the cells' motion (game/flat-ui, 2026-10-22)

Evidence: `specs/evidence/flat-ui/round3-panels-motion.webp` (before and after, desktop and phone, the bag and the collection, plus hover and select stills on the bag, the collection and the shop) and `round3-motion-filmstrip.webp` (frames at exact times, seeked through the Web Animations API).

- **The side panel** (`SidePanel`, the bag's and the collection's alike):
  - 380 px wide (was 300), 320 px between 761 and 1100 px wide; 24 px from the grid;
  - padding 26 to 28 px, 22 px between its parts;
  - the picture first and large: 128 px (twice its pixel size, so the pixels stay square) on a 196 px block of the panel's grey, the close in its corner;
  - then the kind (14 px, muted) and the name (26 px);
  - a line about it (`text`: the collection's one-liner or clue) under the name, where it reads first;
  - the facts as hairline rows 13 px tall each way, 14 px type, the label column 116 px;
  - the main action 48 px tall across the panel, the quiet ones under it.
  - On a phone it stays at the foot of the screen, the picture (96 px block) beside the name.
- **The cells' motion** (`useNudge` in `components/gui/motion.ts`, `.nudge` in the kit's CSS):
  - a hovered cell grows 3 px a side and its eight neighbours step away (5 px for the four touching, less for the corners, a hair for the ring after), in 170 ms;
  - the picked cell (the one holding `[data-selected]`) grows 5 px a side and stays out, its neighbours kept 8 px away, in 340 ms;
  - both ease in and out (`cubic-bezier(0.65, 0, 0.35, 1)`). The hover runs on the `translate` and `scale` properties and the pick on `transform`, so each keeps its own pace;
  - only CSS variables change (on the cells that move); nothing reflows. A touch only picks (no hover), and an empty slot or a spent piece stays still;
  - none of it plays under prefers-reduced-motion.
  - It's on `CardGrid` (the shop, the workbench, the collection, the bag's clothes and furniture shelves) and, through `NUDGE_GRID` and `useNudge`, on the bag's and the chest's slots and the furniture catalogue's pieces and finishes.
  - The card's old hover lift (2 px up) is gone; its shadow stays. A picked card has a soft shadow under its ring.
  - The panel's rail is 70 px (was 76) and the content's left padding 10 px (was 4), so a first-column card has room to grow without being clipped; the content sits where it did. The chest's grids have the same room inside their scroll.

### Round 3, step 8 built: the avatar creator and wardrobe in the flat look (game/flat-ui, 2026-10-22)

Evidence: `specs/evidence/flat-ui/round3-creator.webp` (before and after: the closet's hair, its colours, eyes, accessories and tops; the first creator's head and skin with the name, its mouth sliders and its shoes; the closet and the first creator on a phone; the applicant island's creator unchanged).

- **Opt-in:** `CharacterCreator` takes `flat`. The closet and the fitting room (`WardrobeSheet`) and the member's first creator (`PlayerCharacterUI`) pass it. The applicant island mounts the same component without it, so its creator is the cream studio as it was: its rail and panel are pixel-identical (only the 3D portrait differs between shots, by the idle pose's timing). The reflection creator shares the controls and keeps its look; the flat CSS is scoped to `.creator[data-flat]`.
- **The look:** one light-grey screen with the title in the middle and the round close at the end across the top; the kit's `IconRail` down the left (an item's picture grey until it's chosen; the dot slides; on a phone across the top); the character on the white studio sweep under the shop stage's lights (`Portrait studio="white"`: TurnStage's rig, a neutral contact shadow) with the navy round buttons to turn it and "Drag to turn" under it; the options in a roomy white panel (padding 28 to 30 px, the category's name at 26 px, sections split by hairlines).
- **The controls:** flat grey tiles (the worn one white with an ink ring and lifted, out of the grid with the kit's motion; several can be on); round swatches ringed in ink (the Own swatches keep their word); hairline sliders with an ink thumb; the colour wheel ringed in a hairline, its hex on the grey; the main action the dark pill across the panel, Surprise me and Skip quiet under it (one row on a phone, the main action last).
- **Unchanged behaviour:** the categories, tiles, owned and locked items, the hair colour wheel and its lock, the Own swatches, two-colour hair, the hat cut, the face sliders, the thumbnails and their bake, the graphics tier's resolution, the name check, Escape, the wardrobe's open and close motion, and the tab keys.

## Round 3 verdict (David, relayed 2026-10-22)

APPROVED: the panels, the phone panels and the motion. His notes, verbatim:

1. **Motion:** "make the fell more bouncy/springy rather than linear".
   - The ease-in-out becomes a spring with a small overshoot on hover and select: the cell pops out, settles back slightly, and the neighbours spring too.
   - A CSS `linear()` spring curve or a tiny spring solver; transform-only.
   - Hover quick (about 200 ms to settle), select slower (about 400 ms).
   - Off under reduced motion.
2. **Phone panel item:** "add a slight drop shadow to the hover tab as well". The hovered cell gets a soft, slight drop shadow as it grows out, and the selected cell keeps it.
3. **Theme:** "i think overall ui can adopt like color theme, this is the basic clean color theme for ui but later will sell ui in shop for like dark mode, and acnh themed and st uff like that, but this looks good".
   - The coordinator's reading: this clean flat palette becomes the base theme for the whole UI, and later UI themes (dark mode, an ACNH-style cream theme and so on) are sold in the shop.
   - Before the freeze (Oct 24): the four redesigned menus (journal, mission board, notice board, mailbox) are shown in the clean flat palette too, with their new layouts, and the paper kept for letters and notices, beside the cream versions so David can pick. The remaining menus are not converted yet.
   - **UI themes come from tokens (after launch, not built now):** a theme is a token set (the base flat, dark, cream or ACNH), swapped as a whole; the components read tokens only.
