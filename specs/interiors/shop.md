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

## Round 4: the shop overlay, the window and the keycap keychain (2026-10-18)

**Ground floor: approved.** David: "amazing, maybe window needs a lil work but everythhing nice".

The window pass (`overlay-sheet.webp`, frames 7 to 9, before and after):
- the frame now sits back in the wall's reveal, white instead of dark;
- it gains a mullion and a transom;
- the sill is deeper and runs out into the room;
- the drapes are finely pleated, gathered toward the hem, and hang from a slim steel rod with finials and brackets.

**The shop overlay.**

David's brief, verbatim: "the ui overlay needs to be bigger, less box in box, have a side bar with icon for filter, less beige coin and gem display top left and cleaner, menu ui has 2d image with name and description, with pixel filter for all, clicking, item 3d large on left rotate, right is title desc stock and price and payment, less box in box, clean simple 1 box or 2 max".

His references are in `references/ui/shop/`:
- the grid: `2026-10-18-ref-merch-grid.png`;
- the detail view: `2026-10-18-ref-detail-product-hero.png` (the "Furnituristic" boards);
- the detail view, alternative: `2026-10-18-ref-detail-object-large.png` (the lamp).

"Use reference here": where the references and my reading of the brief differ, the references win.

My reading, built as `ShopOverlay`. It's one layout for both answers of the shopkeeper's, so the in-game items and the club merch match.
- **Size and boxes:** one flat light-grey panel over most of the screen, about 95% of it. Black and white type, lots of grey and white space, no beige anywhere. Inside the panel there are no boxes, except the item cards (David asked to keep the grid reference's card look) and the detail view's white spec band (the second panel).
- **Top:** coins and Gems top left, as plain icon and number pairs; the title in the middle; a round close button on the right.
- **Sidebar:** shelf icons down the left, icons only (their names are labels for screen readers and tooltips). The active one is black with a dot under it.
  - In-game items: tools, clothes, home, today's specials (with a count) and, at the counter, Sell.
  - Club merch: all, then each kind that has something in it (accessories and stickers today), and your pickups.
- **Grid** (the grid reference): large white cards on the grey.
  - each card: the item's picture centred with lots of air, small name bottom left, a quiet line under it (its description, or one for its kind), the price in a small grey pill bottom right, a tag top left ("today's special", "staff pick", "new drop") and a tiny ↗ top right;
  - every picture has the pixel filter: drawn small and scaled up unsmoothed (`PixelImage`).
- **Detail view** (the two detail references): it opens in the same panel.
  - Left: the item huge, turning, with the pixel finish. Drag turns it; let go and it eases back into the slow turn (`TurnStage`). Where an item has no model (wallpaper, flooring), its picture shows large, pixelated. Prev and next arrows step through the shelf, and "All" goes back.
  - Right: a small muted kind, the big title, the description, the price, and a dark rounded Buy (or Redeem for merch), with "Pay with coins" or "Pay with Gems". A hair dye shows the other dyes as colour dots, the variants the hero reference shows.
  - Along the bottom, a white band of specs (the lamp reference's ORIGIN / MATERIAL / DESIGNER row):
    - the keychain: switch, keycap, pick up;
    - other merch: kind, pick up, stock;
    - in-game items: kind, set (the tier, or today's special) and stock.
- **The counter:** "In-game items" opens the overlay with Sell. "Club merch" opens it on the merch: "It's all upstairs if you want to see it in person.", with no Sell and no till.
- **Phone:** the panel fills the screen, the shelves run across the top, one card a row, and the detail stacks.
- **Shots:** `specs/evidence/shop-interior/phase2/overlay-sheet.webp` (frames 1 to 6). `/dev/economy?view=overlay&section=items|merch` shows it over the in-memory economy.

**The TSI keycap keychain** (`specs/merch/tsi-keycap-keychain.md`, from David's six photos).

- **Model:** `art/merch/build_keycap_keychain.py` writes `web/public/assets/game/items/merch-tsi-keycap-keychain.glb`. It's 2,410 triangles in units of 10 cm (the block is 0.19 across).
  - P_Glass (the acrylic, see-through), P_Metal (the hardware and the pins) and P_Paint (the keycap, the milky housing and the yellow stem, their colours in COLOR_0).
  - The only texture is the keycap's top (M_Logo: the Tethos mark, rasterised from the brand SVG on navy, 256 px).
  - Each part is its own node, hanging from its own point: the keyring, four chain links and the body, with the keycap as the body's child so a press moves it in.
  - The keycap faces +z, the front every item's icon is drawn from; the shop turns it to face the room.
- **2D sprite:** its icon, rendered from the model by the icon pipeline. It shows on the wall and in the detail view in lite graphics, or when the 3D viewer fails.
- **In the shop:** it hangs from its keyring on a steel peg on the mezzanine's pegboard, between the totes and the posters (`SHOP_KEYCHAIN`).
  - **Display scale 1:** the block is 0.19 game units, about twelve times life size, as small merch is blown up to read (the sticker packs about six times, the totes about twice).
  - It swings on a small verlet chain with damping and a twisting spring (`lib/game/keychainSwing.ts`, no physics library).
  - Click and drag pulls it about and twists it; let go and it swings back.
  - A still click on the keycap presses it: in over 35 ms, held 75 ms, back over 60 ms, in time with the click.
  - Picking it eats the pointer: no walk is ordered while you handle it (checked, zero walk orders during a drag), and the interior camera doesn't orbit.
  - Its item tag reads "TSI keycap keychain".
- **In the merch view:** it hangs in the middle of the turning stage with the pixel finish (`KeychainStage`). Drag turns it, and it eases back to the slow turn; a tap on the keycap presses it, with the click.
- **The click:** "keyswitch" in the game's audio, so it follows mute and the volume settings (`web/public/audio/sfx/keyswitch.ogg`). It's synthesized for now (`art/audio/synth_keyswitch.py`): the bottom-out at 0 and the return at 0.11 s. David's recording replaces that one file.
- **Catalogue:** 500 Gems at first, 800 since David's prices (2026-10-18). It's in `lib/wallet/catalogue.ts` as `PENDING_MERCH`, not yet in `CATALOGUE`, and has no migration yet. A `CATALOGUE` row regenerates the economy and shop-icons seeds, and game/wardrobe-b2's unmerged `20261017172740_catalogue_seed.sql` regenerates shop-icons too. The coordinator decides the order.
- **Stock:** not set (unlimited) until David says how many.
- **Shots:** `keychain-sheet.webp`:
  - David's photos beside the model's turnaround;
  - the sprite;
  - on the wall: hanging, dragged, swinging back, pressed;
  - in the merch view;
  - in the standalone viewer.

### The keychain, round 2: the hardware redone from David's close-ups (2026-10-18)

David: "the main large clasp is still not the proper shape and specs, some parts or thicker, and the hole threads the
ring". The new close-ups (IMG_3111 face on, IMG_3112 edge on, IMG_3113 to 3116) replace the round-1 reading of IMG_3096,
which turned out to be a slightly turned view.

- **The keyring clasp** is cast, modelled as one smooth piece (a signed distance field meshed with OpenVDB in Blender,
  decimated to its share):
  - a flat strap, wide on the face and thin on the edge (about 2:1), ending at the nose in a rounded, slightly bulbous tip;
  - the base, a heavy wedge thickest at its knuckle end (about 3.6 times the strap's thickness) and tapering to a rounded
    point, with a round eye cast through its face;
  - the gate, a narrow loop of thin wire lying across the clasp's plane (face on it reads as one rod), wider at the nose
    than at the knuckle, its legs going into the knuckle front and back;
  - the outline is traced on IMG_3111 and checked by laying an aligned render over the photo.
- **The split rings** have their cut showing; the top one threads the clasp's eye, turned 40° through it.
- **The chain** is short now (about 4.5 end caps long, as in IMG_3114): two smooth bullet end caps with crimp collars and
  flat pierced tabs, and a tight spiral between them.
- **The lobster** hooks through the block's clear lug, which has a rectangular hole (it was a round loop); its trigger
  tab points out and down by the tail.
- **The switch top** has its LED window beside the stem (IMG_3116).
- **Size and swing:** the keychain is 0.70 long (it was 1.08), so its swing links are
  `KEYCHAIN_LINKS = [0.1722, 0.0525 ×4, 0.2175]`.
  - It hangs at display scale 1.4 on the wall (about seventeen times life size), on a peg whose top is the clasp's
    hanging point.
  - The merch view shows it at 2.24.
- **Triangles:** 5,913, under the raised 6k cap.
- **Shots:** `keychain-round2-sheet.webp` has each photo beside the model at its angle, the side-on thicknesses, the
  merch view, the wall, the viewer and the sprite.

### Approved (2026-10-18), the measured keychain, the grab fix and the studio stage

**Approved by David:**
- **Shop UI round 4:** "i want you to impliment this type of ui more, its actually really nice and clean and i like it".
- **The window.**
- **The keychain, round 3:** "this version looks good". It supersedes the earlier versions.
- **The white studio stage:** approved, with one tweak, "top right left right picture button lighter black in a blue color". The stage's previous and next buttons are now the Tethos navy a step lighter than the keycap (#2e3a63), with white arrows. Buy and Redeem are unchanged.

**The keychain at its measured size (IMG_3117-measured):** every part is rescaled with its shape kept.
- The clasp is 1.46x bigger.
- The split rings are 1.6x bigger.
- The end caps are 1.2x longer and 1.5x thicker.
- The spiral is 1.7x bigger.
- The chain is 3.1 cm from cap to cap.
- The lug is 1.6x bigger.
- The lobster is 0.93x.
- The block, switch and keycap are 1.1x.
- The whole keychain is 0.92 long, so `KEYCHAIN_LINKS = [0.2564, 0.0738 x4, 0.2547]`.
- It hangs at display scale 1.07 on the wall (the same height as before) and 1.7 in the merch view.
- 5,817 triangles.

**Grabbing it calmly (David: "when grabbing the switch it rotates like crazy"):**
- A drag winds the twist at 0.05 rad/s per px, capped at 3 rad/s. It used to be 0.6, capped at 25.
- The twist spring is damped near critical (9; critical is 10.6), and the twist is wrapped to a half turn either way.
- The held body stays under the hook. A part's orientation never turns over the top, and turns at most 20 rad/s.
- The merch stage's coast after a flick is capped at 2.5 rad/s (it was 6).
- Headless probe in the viewer, grabbing the block and shaking it hard:
  - **Before:** body angular speed held mean 92 rad/s (max 196), and a flip at 466 rad/s after letting go.
  - **After:** held mean 19.6 rad/s (max 21) and 20.7 max after.
- The swing test has a sustained fast drag case.

**The white studio stage** (every item's detail view):
- A white seamless sweep with a soft floor fade and a soft contact shadow.
- A big soft key from the upper front side, a fill from the other side, and a rim from behind.
- The softbox room environment, with the pixel finish on top.
- The keychain's acrylic is a touch greyer on it so the block still reads on white.
- The grid's card pictures are unchanged (the icons keep their own light rig).
- Shots: `overlay-studio-sheet.webp`.

**Upstairs approved (2026-10-18).** David approved the furnished mezzanine merch level with no notes
(`upstairs-before-after.webp`).

### The TSI lanyard (2026-10-18, specs/merch/tsi-lanyard.md)

- **Print:** David's two print files (32400 x 720, the whole strap end to end) are resampled to 4590 x 102 per side and
  cut into rows of one 1024 atlas (`art/merch/lanyard_atlas.py`): outside in rows 0-4, inside in 5-9.
  - The black is recoloured to the photo's navy; the white artwork stays white.
  - The print runs along the strap with the neck at its middle and the ends at the sewn tab.
  - Both strands are checked against the photo: the outside reads up the right strand and down the left; the quote
    starts at the foot of the back's left strand and ends with "Steve Jobs" at the foot of its right; neither is mirrored.
- **Model** (`art/merch/build_lanyard.py`, 4,004 triangles):
  - A flat ribbon 2 cm wide and 90 cm long, folded over a peg, each strand turning a quarter turn to face the room.
  - The sewn tab with a stitch line, a D-ring, and a swivel snap hook (domed swivel, collar, cast body with its rivet
    and a trigger tab).
  - The strap is single-sided (a closed solid) so the two prints never bleed through each other.
- **Shop:** it hangs over its own peg between the posters and the shirts, at display scale 0.3 (about three times life
  size; 1.46 tall). It sways a hair on its own, and drag pulls it about and it settles (the keychain's verlet chain down
  the strands; the strap bends along it, `components/game/Lanyard.tsx`). No walk orders during a drag.
- **Merch view** (`LanyardStage`): close up by default so the print reads through the pixel finish, turning so both
  sides come round; "See it whole" shows all of it.
- **Catalogue:** in `PENDING_MERCH`, now at 800 gems (David's price); it stays off sale like the keychain until its
  catalogue row lands. (Before it had a price, the overlay showed "Price to come" with Redeem disabled.)
- **Shots:** `lanyard-sheet.webp`. The viewer is at the scratch path `lanyard-viewer.html`.

### The GENESIS sticker (2026-10-18, specs/merch/genesis-sticker.md)

- **Card** (`art/merch/build_genesis_sticker.py`, 112 triangles): 7.5 x 6 cm (the print's 1350:1080), 0.4 mm thick,
  corners rounded 3 mm.
  - The light print is in the GLB (1024 x 819). The dark print is a separate WebP the model swaps in
    (`art/merch/sticker_art.py`).
  - The backing paper is plain.
- **Holographic foil** (`components/game/GenesisSticker.tsx`): an onBeforeCompile patch on the card's own material; no
  extra pass.
  - A rainbow whose hue runs in bands across the card and shifts with the view angle and the card's tilt.
  - A fine diffraction grain that sparkles as the angle changes.
  - Strongest where the print is bare and weaker on the ink.
  - On the light one it tints the white paper in pastel bands (light added to white would only clip). On the dark one it
    glows through the black.
  - It reads through the pixel finish.
- **Shop** (`StickerEasel`, SHOP_STICKER): both variants on a small wooden easel on the counter under the totes, at
  scale 0.4 (about four times life size).
  - The easel is one merged mesh.
  - The foil moves as you walk past.
  - Lite graphics shows the sprites.
- **Merch view** (`StickerStage`):
  - The card rocks slowly side to side (TurnStage's new `sway` prop) rather than turning all the way round, so its back
    never shows for long.
  - Drag tilts it, and the hint says "Drag to tilt".
  - The two variants are thumbnails down the left of the stage.
  - The grid card's picture is a still of the sheen.
- **Sprites:** each variant has one with the sheen baked in (`merch-genesis-sticker-{light,dark}-sprite.webp`).
- **Catalogue:** in `PENDING_MERCH` with no price, so it's off sale ("Price to come").
- **Shots:** `sticker-sheet.webp`. The viewer is at the scratch path `sticker-viewer.html`.
