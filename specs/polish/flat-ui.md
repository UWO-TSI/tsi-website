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
