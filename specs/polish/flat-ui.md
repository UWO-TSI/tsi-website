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
