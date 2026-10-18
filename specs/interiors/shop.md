# Shop interior (David, 2026-10-17) — row 313

Interiors are reworked one room at a time, from David's references. The shop is first. **Layout comes first, before anything else**: a greybox layout for David's approval, then models, textures, lighting and UI.

## References (David's, in `references/interiors/shop/`)
- `2026-10-17-ref-merch-wall-pegboard.png`: a merch wall. Grey perforated pegboard, a long grey metal counter with drawers, LED strips lighting the shelf edges, items in small crates and trays, garments and totes hung on the board, bold posters.
- `2026-10-17-ref-tile-counter.png`: a cashier counter in glazed green tile with a timber top, a linear pendant light, herringbone oak floor, white curtains, stacked crates and a potted plant.

## Look
"Clean with metal and concrete, well lit, minimal, with items displayed on concrete tables and nice lighting through edges."
- Concrete display tables and plinths, metal shelving and pegboard, edge-lit shelves and tables (light strips along the edges), and a bright, even, warm-neutral light.
- Minimal clutter.
- The game's matte style and palette stay; the references set the materials and mood.

## Layout and behaviour
- **Two sections in the room:** in-game items (clothes, furniture, tools, dyes, seasonal) and real club merch (IRL items redeemed with gems). They're physically separate areas.
- **Walking around:** near a displayed item, a small tag pops up with the item name and a mini image.
- **The shopkeeper:** talking to them opens dialogue with two options, "In-game items" and "Club merch". Each opens the full category in the shop UI.
- **Shop UI:** browsing as now. For real club merch, the item's 3D model sits in the middle, rotating, with a pixel overlay effect (like the game's pixel finish).
- **Real merch models:** placeholders until David supplies merch photos or models.

## Phase 1: the layout (greybox, 2026-10-17, for David's approval)
Every number is in `web/lib/game/shopLayout.ts`, and the room draws it as matte blocks (`ShopGreybox`). The walking, the stair, the counter station and the shopkeeper's post use the same numbers. Shots are in `specs/evidence/shop-interior/phase1/`.

**Round 3: the mezzanine and the changing room (David, 2026-10-17).**

The upper floor is now a mezzanine of about 12 x 6 over the back of the room, overlooking the entrance, so you see the merch level from the door. The open front is gone.

Approved:
- the stair on the right wall;
- the clothes rail by the stair;
- the samples corner;
- "Club merch" opening the merch UI straight away, with the line "It's all upstairs if you want to see it in person."

New: a changing room next to the clothes, using the village fitting room's behaviour.

Kept from earlier rounds:
- oak downstairs, concrete up;
- accessories sharing the dyes' shelving;
- seasonal items first, by the front window.

- **Room:** 12 x 10.
  - The front 4 (from the door to z −1) is double-height, with the two windows one over the other above the seasonal plinths.
  - The mezzanine floor is at 3.2, from its glass-railed front edge at z −1 to the back wall. It's open over the stair.
- **Seeing it:**
  - From the door the mezzanine shows. Through the glass you see the featured drop at its front, and a "club merch" sign hangs on its edge, facing the door.
  - Walk in under it, past z −1.5, and it's cut away so the camera sees the counter and the floor you're on. It shows again when you're back out front, past z −1.9.
  - Between those two points it stays as it was, so it never flickers.
  - It shows the whole time you're on the stair or up on it.
  - Since the mezzanine is over the counter, the shopkeeper isn't visible from the door; the counter comes into view as you step in.
- **Stair:**
  - a straight concrete flight up the right wall, from beside the door toward the back: 16 steps, 1.8 wide, with a handrail;
  - a "Club merch upstairs" sign at its foot;
  - you arrive on the mezzanine at the back right, facing the merch wall.
- **Ground floor (herringbone oak): in-game items, the changing room and the counter.**
  - The aisle (2.4+ wide) runs from the door to the hip-high glazed-tile counter, which has a timber top and the till. The shopkeeper stands behind it, the linear pendant hangs over it, and there's a tile wall behind. Crates and a plant close its ends.
  - Left:
    - seasonal: stepped plinths by the window;
    - tools: a concrete table;
    - dyes and accessories: metal shelving;
    - furniture: a showroom dais against the back wall.
  - Right, beside the stair:
    - clothes: a face-out metal rail;
    - the changing room next to it;
    - wallpaper and flooring samples in the back corner.
- **Changing room:**
  - a free-standing booth beside the clothes rail, 1.5 x 1.1 and 2.2 high;
  - its curtain faces the door and the walking camera, with a mirror and a bench inside;
  - standing in front of it, the prompt is "Try on outfits";
  - E does what the village fitting room does: `tsi:fitting`, then the wardrobe opens as "Fitting room".

  The village's fitting room beside the shop now duplicates it. David lays out the village himself, so it stays until he removes it in the painter.
- **Mezzanine (polished concrete): club merch (ref 1).**
  - The pegboard wall runs across the back and round the left corner, over a long metal counter with drawers.
  - On the back wall: tees and hoodies hung, totes, posters over a metal shelf, a sign, and stickers, pins and caps in crates on the counter.
  - Down the left side: garments hung, and folded stacks.
  - The featured drop sits on two concrete plinths at the front, behind the glass.
  - A glass railing runs round the stairwell.
- **Lights:**
  - ground floor: edge strips along the shelving lips, round the tools table, and as floor glow on the dais, plinths and samples; the linear pendant over the counter;
  - mezzanine: strips under the merch counter's lip and the pegboard shelf, and floor glow at the plinths.
- **Walking path:**
  - the aisle;
  - the way to the stair and up it;
  - the items loop and a cut past the tools table;
  - round the clothes rail, past the changing room to the samples;
  - on the mezzanine, the merch loop.
- **Tests** (`shopLayout.test.ts`, 12 tests):
  - every leg of the path can be walked;
  - every item has a spot within the tag range (1.6) on its own floor, with the merch on the mezzanine;
  - the climb from the door to the merch wall and back works;
  - the mezzanine shows from the door and cuts away under it, without flickering;
  - you can't walk under or beside the flight, into the stairwell, or off the mezzanine's edge;
  - the changing room is beside the rail and usable from in front of its curtain;
  - nobody can get behind the counter, and the shopkeeper can be seen over it.
- **Exterior:** as before, `shop-market.glb` is single-storey: walls 3.35, roof 3.54, sign top 3.93, a 1.88 door. For the shop to read as two storeys, the exterior remodel needs a raised upper facade (walls to about 6) with windows, and the roof on top. The footprint can stay.
- **Shots** (`specs/evidence/shop-interior/phase1/`, made headless by `shots.mjs` there):
  - `01-plan-ground`: with the mezzanine cut away;
  - `02-plan-mezzanine`;
  - `03-door-view`;
  - `04-items-walk`;
  - `05-counter-walk`;
  - `06-changing-room`;
  - `07-changing-room-open`: the wardrobe, opened there;
  - `08-stair-view`;
  - `09-on-the-stair`;
  - `10-top-of-stairs`;
  - `11-merch-walk`;
  - `12-merch-across`;
  - `13-mezzanine-edge`: over the glass to the entrance below.

## Phase 2, part 1: the furnished ground floor (2026-10-17)
Approved for phase 2: round 3. While it was being built, David moved the changing room and chose the background:
- the changing room is now **three booths right behind the stair**, each with a curtain, a mirror and a bench, each opening the "Try on outfits" wardrobe. Its old spot by the rail is a low concrete table of shoes;
- the background is **Tethos-branded dark**: deep charcoal, a fine grain, the Tethos mark tiled faintly and drifting slowly, a soft vignette, and a slight tint per building. It's one CSS layer behind the canvas (`InteriorBackdrop`; the room clears to transparent round itself), so it costs no draws. It's used in the shop, HQ, the museum, the café and the wharf shack.

**Models** (`art/interiors/build_shop.py` reads `art/interiors/shop_layout.json`, which `web/scripts/shop-layout-json.mjs` writes from `lib/game/shopLayout.ts`, so the models and the walking never drift; a test keeps the JSON current):
- the look is simple and rounded, after David's references;
- only the herringbone oak (512) and the glazed sage tile (256) are textured, both subtle;
- everything else is plain colour on the shared presets (`P_Stone`, `P_Metal`, `P_Wood`, `P_Paint`, `P_Glass`, `P_Cloth`), so each preset draws once;
- the edge lights and the pendant's strip are `M_Glow`;
- the ground floor is 15.9k triangles and 10 materials; the mezzanine's shell (slab, fascia, railings, the "CLUB MERCH" sign, the upper walls) is 4.2k;
- upstairs fixtures are still the layout's blocks, until part 2;
- the room bakes its own warm environment, so metal reads as metal and the fill stays even (the island's sky isn't indoors).

**Items on show** (`lib/game/shopDisplay.ts`): each slot shows a real catalogue item, drawn with its icon's model and tints and fitted into its slot:
- garments hang on hangers on the rail;
- rods and nets lie along the table;
- wallpapers are framed panels on the wall and floorings are tiles on the dais;
- the front plinths carry **today's specials** (the shop's own daily pick), so the front display changes each day.

**Behaviour:**
- **Item tag:** within 1.7 of an item on your floor, a small cream card over it shows its name and icon, marked "Today's special" when it is one. Nothing shows from the stair or while a sheet is open.
- **The shopkeeper:** E at the counter asks "What are you after today?", with two answers:
  - "In-game items" opens the shop without the merch tab;
  - "Club merch" opens the merch only. The shopkeeper says "It's all upstairs if you want to see it in person.", and the sheet drops the till and the sell tab.
- **The merch UI:** the picked item turns in the middle on a small canvas drawn at 0.3 of its size and scaled up without smoothing, the game's pixel finish. A click on an item's picture shows that one. The models are the merch icons' models, placeholders until David's merch photos arrive.
- `/dev/economy?view=shop&section=merch|items` shows either answer over the in-memory economy.

**Shots:** `specs/evidence/shop-interior/phase2/`, with the review sheet `ground-floor-sheet.webp`. They were made headless by `shots.mjs` there, plus the merch screen from the dev economy page.

**The club merch screen** (David's reference, `references/ui/shop/2026-10-18-ref-merch-grid.png`, 2026-10-18): `MerchShop`.
- **Layout:** a light, clean panel with a grid of large white rounded cards: 3 across in the in-shop "Club merch" sheet (xl), 2 on narrower sheets, 1 on a phone.
- **Each card:**
  - the item's still render (its icon, a render of its 3D model) centred on white;
  - its name, over a quiet "kind · Tethos club";
  - its price in Gems as a grey pill at the bottom right;
  - a ↗ at the top right;
  - a tag ("staff pick" or "new drop") at the top left in the Tethos blue.
- **Filter pills:** "all", then whichever of apparel, accessories, stickers and home have something in them. Today that's all, accessories and stickers. The active pill wears the Tethos mark in blue.
- **Kinds and tags** (`lib/wallet/merchShelf.ts`): an item's kind comes from its name, so new merch files itself. Tags are a short list there (the tote is a "staff pick") until the catalogue has a column for them.
- **Detail view:** a card opens the model turning with the pixel finish, with the tag, name, kind line, description, price pill and stock, and "Redeem with Gems". Redeeming reserves the item for pickup at HQ, as before.
- **In-game items screen:** kept as it was. It lists dozens of cheap items with Buy, Owned and special states. The reference's sparse luxury grid suits a handful of real items, and would make the item lists long and slow to scan.
- **Shots:** `merch-ui-sheet.webp` and `16-19` in `specs/evidence/shop-interior/phase2/`, from `/dev/economy?view=shop&section=merch`.
