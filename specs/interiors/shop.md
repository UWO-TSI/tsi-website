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
Every number is in `web/lib/game/shopLayout.ts`; the room draws it as matte blocks (`ShopGreybox`), with walking, the counter station and the shopkeeper's post on the same numbers. Shots: `specs/evidence/shop-interior/phase1/`.

- **Room:** 12 x 10, up from the old 10 x 10. Two separate sections with an aisle between, and walking room round every table, didn't fit at 10 wide without packing the floor, which fights "minimal". The door stays centred in the cut-away near wall, and the whole room is in view from the door.
- **Aisle:** 2.4+ wide, straight from the door to the cashier counter. The counter closes it at the back: glazed tile with a timber top, the till on it, the shopkeeper behind it, the linear pendant over it, and a glazed tile wall behind. The counter is hip-high (0.74), as in ref 2, so the shopkeeper shows from the chest up; at 0.88 only their head showed. Crates and a potted plant close its ends, as in ref 2, so nobody walks round behind it.
- **In-game items (left, +x, on herringbone oak):**
  - seasonal: three stepped concrete plinths by the curtained window, the first thing on the left as you come in;
  - clothes: a metal rail, face-out;
  - tools: a concrete table;
  - dyes and accessories: metal shelving on the wall;
  - furniture: a low concrete showroom dais against the back wall, laid out as a little room.
- **Club merch (right, −x, on polished concrete; ref 1):**
  - the pegboard wall wraps the right wall and the back corner, over a long metal counter with drawers;
  - tees and hoodies hang at the front, totes at the back;
  - stickers, pins and caps sit in crates on the counter;
  - posters and a "club merch" sign go on the back corner's pegboard, face-on from the door;
  - the newest drop sits on two concrete plinths in the middle of the section.
- **Lights:** edge strips under the merch counter's lip and the pegboard shelves, along every shelving lip, round the tools table's top, and as a floor glow along the dais and the plinths. The linear pendant hangs over the counter. In phase 2, recessed downlights give the even fill.
- **Walking path:** the aisle, a loop through each section, and a cut between the clothes rail and the tools table. Tests walk every leg of it and check that every displayed item has a spot within the tag range (1.6) where you can stand.
- **Shots** (`specs/evidence/shop-interior/phase1/`, made by `shots.mjs` there, headless):
  - `01-plan-top-down`: the plan, with a numbered key and a colour legend;
  - `02-door-view`: the walking camera from the door;
  - `03-items-walk` and `04-items-across`: the in-game items section;
  - `05-merch-walk` and `06-merch-across`: the merch section;
  - `07-counter-walk` and `08-counter-low`: the counter.
- **Open for David:**
  - the 12 x 10 size;
  - the merch on the right and the items on the left;
  - the two floors;
  - accessories sharing the dyes' shelving;
  - a seasonal display at the front by the window.
