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

**Round 2, two floors (David, 2026-10-17):** "real merch is upstairs and in game merch is down stairs". The size can be 12 x 10 or larger. Kept from round 1, as David approved: oak downstairs and concrete upstairs, accessories sharing the dyes' shelving, and seasonal items first, by the front window.

- **Room:** 12 x 10 on both floors, floor to floor 3.2 (a 0.2 slab). Each floor's walls are 3.2 high. The door stays centred in the cut-away near wall.
- **Seeing two floors:**
  - while you're downstairs, the upper floor is cut away, so the camera sees the floor you're on;
  - the camera rises with you up the stair;
  - past 60% of the climb the upper floor shows, and it hides again below 40% on the way down, so it never flickers;
  - upstairs, the stairwell looks down onto the ground floor.
- **Stair:** a straight concrete flight up the right wall (−x), from beside the door toward the back:
  - 16 steps, 1.8 wide, with a handrail on its open side;
  - it's the first thing on the right from the door;
  - a "Club merch upstairs" sign stands at its foot;
  - upstairs, a glass railing runs round the stairwell, and you arrive at the back right, facing the merch wall.
- **Ground floor (herringbone oak): in-game items and the counter.**
  - The aisle (2.4+ wide) runs straight from the door to the cashier counter. The counter is hip-high glazed tile with a timber top and the till; the shopkeeper stands behind it, the linear pendant hangs over it, and a tile wall is behind. Crates and a plant close its ends.
  - Left side:
    - seasonal: stepped concrete plinths by the curtained window;
    - tools: a concrete table;
    - dyes and accessories: metal shelving on the wall;
    - furniture: a concrete showroom dais against the back wall.
  - Right side, beside the stair:
    - clothes: a face-out metal rail;
    - wallpaper and flooring: sample panels on the back wall with tiles on a low plinth. These are in the shop's catalogue but had no place before.
- **Upper floor (polished concrete): club merch (ref 1).**
  - The pegboard wall runs across the back, face-on as you arrive, and round the left corner, over a long metal counter with drawers.
  - On the back wall: tees and hoodies hung, totes, posters over a metal shelf, the "club merch" sign, and stickers, pins and caps in crates on the counter.
  - Down the left side: more garments hung, and folded stacks.
  - The featured drop sits on two concrete plinths in the middle. A window is at the front left.
  - The front of the upper floor is open floor for now, room for the range to grow.
- **Lights:**
  - ground floor: edge strips along the shelving lips, round the tools table, and as floor glow on the dais, plinths and samples; the linear pendant hangs over the counter;
  - upper floor: strips under the merch counter's lip and the pegboard shelf, and floor glow at the plinths.
- **Walking path:**
  - the aisle;
  - the way to the stair and up it;
  - the items loop and a cut past the tools table;
  - a loop round the clothes rail, with a spur to the samples;
  - upstairs, the merch loop.
- **Tests:** `shopLayout.test.ts` checks that:
  - every leg of the path can be walked;
  - every item has a spot within the tag range (1.6) on its own floor;
  - the walker climbs from the door to the merch wall and back, and the upper floor shows and hides without flickering;
  - you can't walk under or beside the flight, or into the stairwell;
  - nobody can get behind the counter;
  - the shopkeeper can be seen over the counter.
- **Shopkeeper's dialogue (proposal for phase 2):** "Club merch" opens the shop UI straight on the merch category, with a line pointing upstairs: "It's all upstairs if you want to see it in person." Buying never needs the trip upstairs; the upper floor is there to look round. Keepers now ignore anyone on the floor above, so the shopkeeper doesn't greet you through the ceiling.
- **The exterior can't hold two floors as it is.** It's the ACNH market, `shop-market.glb`, a single storey. In world units:
  - walls 3.35 high;
  - roof 3.54 high;
  - sign top 3.93;
  - a 1.88 door, against a 1.36 character.

  To read as two floors it needs, roughly:
  - a second storey of facade, walls to about 6;
  - a row of upper windows on the front, which could show the merch inside;
  - the roof raised to sit on top;
  - the sign moved between the floors or onto the upper facade.

  The footprint can stay. This belongs with the separate exterior remodel.
- **Shots** (`specs/evidence/shop-interior/phase1/`, made headless by `shots.mjs` there):
  - `01-plan-ground` and `02-plan-upstairs`: the plans, each with a numbered key;
  - `03-door-view`;
  - `04-items-walk` and `05-items-across`;
  - `06-counter-walk` and `07-counter-low`;
  - `08-stair-view`;
  - `09-on-the-stair`: the climb, as the upper floor appears;
  - `10-top-of-stairs`;
  - `11-merch-walk` and `12-merch-across`.
- **Open for David:**
  - the stair's side and direction: the right wall, rising away from the door;
  - the clothes rail moving to the right, beside the stair;
  - the wallpaper and flooring samples corner;
  - whether the open front of the upper floor should get more merch fixtures, or the upper floor become a 12 x 6 mezzanine at the back overlooking the entrance;
  - the dialogue proposal above.
