# HQ interior

David, 2026-10-18. Ledger row 316. HQ is the second interior to be reworked from David's references, after the [shop](shop.md). Same process: the layout comes first and gets David's OK before anything is furnished.

**Current layout: B, the gallery, with taller storeys** (phase 3, below), grown to 24 x 18 and refurnished on David's phase 3 notes (phase 4, at the end). David, 2026-10-19, on the phase 2 review, verbatim:

> "i said to do plan b, also make roofs taller for both floors"

Layout A (phases 1 and 2) is replaced: its code is gone from the game, not kept behind the lab flag (both layouts would have
needed their own models, walker parts and evidence; keeping A was not free). It stays in git history (phase 2 head `831f3036`).

## References

In `references/interiors/hq/`:

- `2026-10-18-ref-walnut-office-lounge.png` covers the office, the coffee bar and the library.
  - A walnut ceiling with oval cutouts and a skylight; concrete and walnut walls.
  - A long walnut desk with monitors and black leather office chairs.
  - A green marble coffee bar with two tall stools.
  - A tall walnut shelf with books and magazines facing out.
  - A deep blue rug, a black leather daybed, a brown leather sofa, and a glass coffee table stacked with books.
  - Track spots, and warm strips under the shelves.
- `2026-10-18-ref-lamp-lit-lounge.png` covers the lounge.
  - Brown velvet sofas and a lounge chair on a cream shag rug.
  - A low stone coffee table with a white mushroom lamp, and a round black table.
  - The big chrome arc lamp overhead.
  - A lit art piece, black track spots, walnut panelling, and plants in a bed behind glass.
- `2026-10-18-ref-aquarium-colour.png`: the aquarium's **colour**. Bright cyan-blue water, schools of silver fish, coral low down.
- `2026-10-18-ref-aquarium-wall-size.png`: the aquarium's **size**. A floor-to-ceiling tank filling a whole wall, with reef rock, orange fish and a warm strip along its base.

## The feel

David's words:

> "very nice bougie furnature, wood plants and nice carpets, watch the lighting have subtle lighing fgrom lamps and lightings rather than ceiling light, feeling should be expensive"

> "nice lounge carpet over head large lamp"

> "hq has a second floor and second floor is mostly lounging with like big carpet beanbags nice lamps and theres also doors for admins only and stuff. should also have a place to put flag i got flag design for each year"

- **Expensive and warm:** walnut, concrete, leather and velvet, deep carpets, plants.
- **Light comes from lamps and fittings, not ceiling panels:**
  - floor and table lamps;
  - the arc lamp;
  - warm strips under shelves and along the aquarium's base;
  - black track spots picking out art and shelves;
  - the aquarium's own blue glow.
- **Light follows the time of day.** The windows give soft daylight in the day. The lamps, strips and spots are always on and carry the room at night.

## Layout

The room is big, with two floors and a mezzanine like the shop's.

### The aquarium

A floor-to-ceiling tank, two storeys tall. It's the room's centrepiece.
- The ground-floor lounge sits in front of it.
- Its top half is seen from the mezzanine lounge.
- Colour from the first aquarium reference; size from the second.

### Ground floor: work

All of HQ's current functions stay and keep working.

- **Existing:**
  - Alice's front desk and the island register;
  - the notice board and the club goals;
  - the Founder's desk and its plaque (`specs/hq-onboarding.md`).
- **New:**
  - **Co-working desks:** the long walnut desk with monitors and leather office chairs.
  - **Coffee bar:** the green marble island with tall stools.
  - **Library wall:** tall walnut shelves with books and magazines facing out.
  - **A small lamp-lit lounge** in front of the aquarium.

### Upstairs: lounge

- **The big lounge:**
  - a big carpet and beanbags;
  - velvet sofas, the arc lamp and nice lamps;
  - the **walnut oval ceiling** over it. That ceiling is the lounge's only; elsewhere the ceiling is plain and dark, with track spots.
- **The yearly flags:** one hanging banner per year along the mezzanine rail, facing the entrance. They stay blank banners until David sends the designs.
- **Admin-only doors:** real doors with an "Admins only" plate. They're locked for everyone for now; admin rooms come behind them later.

## Rules for the build

- **Layout first.** A blocked-out layout and a top-down plan with every zone go to David for his OK before anything is furnished.
- **Keep every HQ interaction working.** Same entry, and the same E prompts at the desk, the register, the board and the plaque, with the onboarding script's positions updated to the new layout.
- **Real merch, real people:** no real names shown. Only David writes the Founder's plaque.
- **Lighting stays cheap.** Fake the lamp pools and strips with emissive materials and baked light where you can. Use only a few real lights.
- **Aquarium fish** are instanced and animated cheaply; caustics come from the tank's own shader.
- **Performance:**
  - add an HQ scene to the perf bench, as the shop has;
  - run one perf:check at the end;
  - list the room's meshes against the interior budget, as the shop's exceptions are.
- **Textures only where they show** (`specs/lane-rules.md`).

## Phase 1: the layout (greybox, 2026-10-18, for David's pick)

Every number was in `web/lib/game/hqLayout.ts`, for two options, drawn as matte blocks at
`/lab/island?hq=inside&hqLayout=a` (or `b`). David first picked A, then switched to B on 2026-10-19 (phase 3); the greybox is gone since phase 2. The walking, the stair and the stations use the same numbers. The shots are in
`specs/evidence/hq-interior/phase1/`: `hq-layout-options.webp` shows A beside B, view by view, made headless by
`shots.mjs` and `sheet.py` there.

### The HQ as it is (measured)

- **Room:** 16 x 12 (x ±8, z ±6), one storey.
  - The door is in the middle of the front wall (z −6). You arrive at (0, −4.2) and the exit is at (0, −5.5).
  - The walking camera follows from the door's side, so +x is screen left.
- **Stations:**

  | Station | Where | E opens |
  |---|---|---|
  | Front desk | (−5.2, −3.6) | Alice: the onboarding visit, the register, the profile showcase |
  | Notice board | (0, 4.3) | The notice sheet and the club goals (onboarding step 6) |
  | Trophy display | (−4.5, 4.2) | The tourney list (the 3D case stands at the display) |
  | Bookshelf | (6.6, −1.3) | Quests |
  | Clock | (−7, 4.75) | The island's time |
  | Founder's desk | (2.27, 3.85) | The blank plaque (onboarding step 4) |
  | Workbench | (−6.0, 1.0) | Crafting |
  | Exit | (0, −5.5) | The island |

- **Alice's post:** behind the front desk, at (−5.05, −1.78), in `lib/game/keepers.ts`.
- **The onboarding script:** it's driven by these stations' events, not by positions (`lib/game/arrival/hq/script.ts`).
  Moving the stations moves the onboarding with them.

### The new room, both options

- **Size:** 20 x 16, two storeys. The floors are 3.4 apart and the ceiling is at 6.8.
- **Door and arrival:** the door stays in the middle of the front wall. You arrive at (0, −6.4) and the exit is at (0, −7.2).
- **Aquarium:** two storeys tall (0.25 to 6.6), its water a single bright blue in the greybox.
- **Ground floor:** Alice's front desk and the register by the door, plus the green marble coffee bar, the long walnut
  co-working desk, the library wall, and the lamp-lit lounge in front of the aquarium.
  - The notice board and club goals, the Founder's desk and plaque, the trophy case, the clock and the workbench each
    get a station.
- **Upstairs:**
  - the big lounge (shag carpet, velvet sofas, beanbags by the rail, the arc lamp) under the walnut oval ceiling, which
    covers this lounge only;
  - two locked "Admins only" doors;
  - six blank yearly banners.
- **Cut-away:** the part of the upper floor you're under is cut away so the walking camera sees your floor. Each part
  returns as you step out from under it, with hysteresis so it never flickers.
- **Tests:** `hqLayout.test.ts`, 16 tests (8 per option).
  - Every taped path can be walked.
  - Every station sits where you can stand.
  - You can climb from the door to the upper floor, walk its path, and come back down.
  - You can't step off the upper floor's edge, or walk under or beside the flight.
  - The aquarium is two storeys tall with the ground lounge in front of it.
  - The cut-away works per part, without flicker.
  - There's a banner per year and there are locked admin doors.

### Option A: the back mezzanine (the shop's arrangement)

- **The mezzanine:** over the back third (z 1.5 to 8), facing the door. The six banners hang from its front rail,
  facing the entrance, so you see them as you walk in.
- **The aquarium:** fills the left wall of the double-height front hall (z −5.4 to 1.2). The ground lounge sits in front
  of it. Its top half is seen from the mezzanine's front-left corner.
- **Ground floor:**
  - Alice's desk faces the door on the right.
  - The coffee bar stands in the hall.
  - The work floor is under the mezzanine: co-working, the library wall across the back, the notice board and goals,
    the clock, the Founder's desk, the trophy case and the workbench.
- **Stair:** up the right wall, toward the back, arriving at the mezzanine's front-right corner.
- **Upstairs:** the lounge in the middle and left, the admin doors at the back right.

### Option B: the gallery (the aquarium straight ahead)

- **The aquarium:** fills the back wall, 10 wide, straight ahead of the door. The ground lounge sits in the
  double-height hall in front of it.
- **The upper floor:** wraps the hall in a U.
  - A bridge over the entrance holds the big lounge, which faces the tank head on.
  - An arm runs down each side.
  - The six banners hang from poles off the arms' rails, one after another toward the tank as you walk in.
- **Ground floor:**
  - The entry is under the bridge, with Alice's desk on the left and the coffee bar on the right.
  - The library wall and co-working are under the left arm, with the Founder's desk and the trophy case at the back.
  - The notice board is under the right arm by the stair, with the workbench at the back.
- **Stair:** up the right wall, under the right arm, toward the back. You walk the arm to the bridge.
- **Upstairs:** the admin doors are on the left arm.

### The exterior (report only; not changed)

- **The building as it is:** `hq-office.glb` stands 7.0 wide and about 5.3 deep (landmark half 3.5 x 2.65). Its walls
  are about 3.5 tall, its roof peak 4.76, and its door 1.8 tall.
- **Height:** the interior is two storeys whichever option is picked. For the outside to read as two storeys, the
  facade needs a raised upper storey with windows, walls to about 6.8 (+3.3), and the roof on top (peak about 8.1).
- **Footprint:** the interior was already more than twice the building's width (16 x 12 inside a 7 x 5.3 building),
  the convention every village interior follows. It can stay.
  - If David wants the outside to match the room's proportions, the building would grow to about 8.5 x 6.8, i.e. +1.5
    wide and +1.5 deep, and that needs room around its landmark in the village.

### Not in phase 1

- Materials, models, the aquarium's water, fish and caustics.
- Lamps and lighting by the time of day.
- The coffee bar's, the aquarium's and the admin doors' prompts. The new stations are in the layout; the greybox
  answers only the ones HQ has now.
- Alice walking her new post.
- The HQ perf bench and the room's meshes against the interior budget.

## Phase 2: layout A furnished (2026-10-18)

> **Superseded by phase 3.** David switched to layout B on 2026-10-19; the room below is gone from the game. The phase 2
> furniture, materials, aquarium shaders and light carry over to B.

David picked **option A, the back mezzanine**, and left the exterior as it is ("gonna remodel the buildings maybe
later"). Layout A is now the member HQ: `/lab/island?hq=inside` and through HQ's door in the village. The applicant
island keeps its own clubhouse (`HQInterior.tsx`).

**The room** (`components/game/hq/HqInterior.tsx`, `HqRoom.tsx`):
- **Models:** `art/interiors/build_hq.py` reads `art/interiors/hq_layout.json` (written from `hqLayout.ts` by
  `web/scripts/hq-layout-json.mjs`; a test keeps it current) and writes `web/public/assets/game/interiors/hq/`:
  - `ground.glb`, 23.4k triangles: the walnut plank floor, the hall's walls both storeys high, the work floor, the stair;
  - `upper.glb`, 15.0k: the mezzanine, cut away while you're under it;
  - `ceiling.glb`, 4.6k: the hall's dark ceiling, the walnut oval ceiling over the upper lounge, the black track spots
    and the whole front wall with its glazed door and two tall windows. The game shows it only to a camera under the
    ceiling: the walking camera looks in from above, the evidence's eye-level views see a closed room;
  - `tank.glb`, 9.2k: the aquarium's inside, reef, glass and surface.
- **Materials:** textures only up close (the walnut planks 512; the walnut grain, the plaster, the rug pile, the green
  marble and the magazine covers 256). Everything else is plain colour on the shared presets. The strips, the lamp
  shades' undersides and the oval lights are `M_Glow`. Budget exceptions for `ground.glb` and `upper.glb` are in
  `budget.ts`, like the shop's.
- **Downstairs:**
  - Alice's walnut desk by the door: a fluted front, a travertine top, a warm strip under the lip, the register open on
    the ledge and a mushroom lamp;
  - the green marble coffee bar with an espresso machine and two walnut stools;
  - the lamp-lit lounge before the aquarium: a cream shag rug, a velvet sofa facing the glass, a travertine table with
    a mushroom lamp, a lounge chair and a globe floor lamp;
  - under the mezzanine: the long walnut co-working desk with four monitors and leather office chairs, the work lounge
    on the deep blue rug (the quilted black daybed, a brown leather sofa, a glass table of books), the library wall
    (walnut shelving, books in rows and magazines face out, a warm strip under every shelf), the walnut panelled wall
    with the notice board and the club goals, the clock, the Founder's desk with its chair pushed back and the blank
    plaque under a picture light, the trophy case and the workbench;
  - palms by the door, a big framed canvas over the stair.
- **Upstairs:** the cream shag carpet, the velvet sofas, the travertine table, a round black table with a mushroom lamp,
  four beanbags by the rail, the chrome arc lamp, the walnut panelling and the lit art piece, the six blank banners hung
  from the rail facing the door, and the two locked admin doors with their "ADMINS ONLY" plates.

**Light** (lamps, strips and track spots, not ceiling panels; following the time of day):
- **Day:** the windows (right wall, both storeys; left wall upstairs) show the outside, and a caster closes the room's top
  and front for the sun, so it only comes in by the windows.
- **Lamps:** they're always on. Their warm pools, the spots' washes on the library, the board, the plaque and the art,
  and the aquarium's blue on the lounge are soft additive patches, one draw a floor (`lib/game/hqLight.ts`,
  `LampPools.tsx`).
- **Real lights:** four. The hall, the work floor, the upper lounge, and the aquarium's blue.
- **Night:** the fill and the room's reflections ease down with the daylight, so at night the lamps, the strips and the
  bright tank carry the room.

**The aquarium** (`components/game/hq/Aquarium.tsx`):
- **Water:** cyan-blue (the colour reference), deep blue at the sand to bright cyan at the top, slow light shafts and
  caustics over the back.
- **Reef:** rock rising to a tall face at the mezzanine's end (the size reference), corals, fans and weed, lit by the
  tank's own light with caustics on what faces up.
- **Fish:** four schools of silver and sixteen small orange fish, one instanced draw. Each swims a closed path worked
  out in the vertex shader (`lib/game/hqAquarium.ts`, tested to stay in the water).
- **Surface:** rippled, seen from the walking camera above.
- **The rest:** the warm strip along its base, and every tank shader bends with the curved world.

**Stations** (each on its own floor; nothing answers from the stair):
- Every station HQ had: the exit, Alice's desk (the visit's report and the register), the notice board, the Founder's
  desk, the trophy display, the clock, and the workbench (its own prompt).
- The library replaces the bookshelf: "Browse the library".
- New stations, their lines drafts for David (`HQ_LINES` in `hqLayout.ts`):
  - the coffee bar: "Get a coffee" → "Fresh coffee at the marble bar. The cups are already warm.";
  - the aquarium: "Look at the aquarium" → "Silver fish turn together in the blue. A small orange one goes its own way.";
  - the admin doors: "Try the door" → "Admins only. It's locked."
- No reward for any of them (principle 3).
- Alice stands at her new post behind the desk (`KEEPER_POSTS.memberHq`), seen over its counter from the walking camera
  (tested).

**Perf** (`specs/evidence/hq-interior/phase2/perf-check.txt`; the `hq` bench scene, from the door):
- High: 2.70 ms, 104 draws, 77k triangles.
- Lite: 1.80 ms, 62 draws, 70k triangles.
- Under the café's budget on every line.

**Shots:** `specs/evidence/hq-interior/phase2/hq-phase2-sheet.webp`, made headless by `shots.mjs` and `sheet.py` there.
- Day and night side by side: the plans, from the door, walking in, the aquarium from the lounge and close up, the work
  floor, the upper lounge and its view of the tank, upstairs walking.
- By day only: the overview, the top of the stairs, the board and the Founder's desk, the coffee bar and Alice's desk, the
  admin doors, walking under the mezzanine, and the three new stations' lines on screen.

**Not done:**
- The banners stay blank until David sends the year designs.
- The plaque stays blank until David writes it.
- Other players upstairs are drawn on the ground floor's height. The network sends no height, as in the shop.


## Phase 3: layout B, the gallery, with taller storeys (2026-10-19 decision, built 2026-10-22)

David, on the phase 2 review: "i said to do plan b, also make roofs taller for both floors". Layout B is the member
HQ (`/lab/island?hq=inside` and through HQ's door in the village). The exterior is unchanged. Option A's code is gone
(see the top of this file).

**The room** (`web/lib/game/hqLayout.ts`, every number the models, the walker and the stations use):
- **Size:** 20 x 16. **Each storey 4.6 high** (was 3.4), the slab 0.3, the ceiling at 9.2.
- **The aquarium:** fills the back wall straight ahead of the door, 10 wide and 1.4 deep, from 0.25 to 9.0: the full
  height of the room. Walnut cladding at its ends and over it, the warm strip along its base.
- **The upper floor wraps the hall in a U**, three parts:
  - **the bridge** over the entrance (z −8 to −3.5): the big lounge facing the tank head on, under the walnut oval
    ceiling (7 x 3 ovals);
  - **the left arm** (x 5.5 to 10): a reading corner by the bridge (two velvet chairs, a side table, a globe lamp) and
    the two locked admin doors at its end, on the back wall;
  - **the right arm** (x −10 to −5.5): the stair's well and its landing, a plant, the big canvas on the back wall over
    the landing.
- **The six yearly banners** (blank until David's designs) hang from poles off the arms' rails over the hall's edge,
  three a side, one after another toward the tank, facing the door. Track spots on each arm's ceiling pick them out.
- **The stair:** up the right wall under the right arm, toward the back, 22 steps of 0.21 rise and 0.30 run (about 35
  degrees), foot at z 0, head at z 6.6. The upper floor is open over the whole flight, railed round.

**Downstairs:**
- **The entry under the bridge:** Alice's walnut desk left of the door with the register, the green marble coffee bar
  right of it, the work lounge on the deep blue rug in the left corner (the daybed, the leather sofa, the glass table),
  the workbench against the right wall, palms either side of the door.
- **The hall:** the lamp-lit lounge before the tank (a long velvet sofa facing it, the travertine table and mushroom
  lamp, two lounge chairs turned in, a globe floor lamp each side), a plant by the tank.
- **Under the left arm:** the library wall along the left wall (3.6 tall, six bays, books and magazines face out, a warm
  strip under each shelf), the long co-working desk before it, the trophy case, and at the back the clock and the
  Founder's desk with its blank plaque on the walnut panelling.
- **Under the right arm:** the notice board and the club goals on walnut panelling by the stair's foot.

**The cut-away** (`createHqWalker`): downstairs and on the stair, a part of the upper floor is cut away while you're
under it, or while it (its slab and rail, or anything of it, like a banner) stands between the walking camera and you;
with hysteresis, so nothing flickers. Upstairs all of it shows. So from the door the bridge is away and the hall, the
arms and the tank show; walking the hall's edge under the banners, their arm goes; under an arm, that arm goes.
**The ceiling and the front wall** show only to a camera inside the room: the walking camera downstairs is now under
the ceiling (8.4 against 9.2) but only looks down; upstairs it's above it; from the door it's outside.

**The models** (`art/interiors/build_hq.py`; pieces on a side or the front wall are made facing −z and turned onto it):
- `ground.glb` 27.9k triangles (the walls both storeys high, the back wall open behind the tank), `upper.glb` 17.5k in
  three parts (`hq_upper_0..2`, 28 primitives), `ceiling.glb` 8.1k, `tank.glb` 10.5k. Budget exceptions for ground and
  upper in `budget.ts`.
- **The aquarium's shaders, fish and caustics** are phase 2's, turned to the back wall: the fish swim along x (five
  silver schools up the two storeys, 20 orange fish low by the reef), the reef rises to the bridge's floor at the left
  end. The glass is unlit (a lit pane caught the blue light and washed the water out from above).
- **Light:** phase 2's: lamp pools and spot washes faked (`hqLight.ts`, now on the side and front walls too, the
  upstairs ones per part), four real lights (the entry and the hall, the work floor under the left arm, the bridge's
  lounge, the tank's blue), the lamps carrying the room at night.

**Stations** (each on its own floor; the walk-through in `phase3/shots.mjs` "prompts", 2026-10-22): the exit, Alice's
desk, the coffee bar, the notice board, the library, the trophy display, the Founder's desk, the clock, the aquarium and
the workbench downstairs; the two admin doors upstairs. All twelve answer. Alice stands at her post behind the desk
(`KEEPER_POSTS.memberHq`), seen over its counter from the walking camera, the bridge over her cut away (tested).

**Shots:** `specs/evidence/hq-interior/phase3/hq-phase3-sheet.webp`, made headless by `shots.mjs` and `sheet.py` there:
the plans of both floors, from the door, the aquarium straight ahead from the entrance, the bridge's lounge looking at
the tank, the arms with their banners, under the left arm, the stair, the two storeys from the front, the height from
the walking camera (the hall, the drop from the bridge), day and night where both.

**Perf** (`specs/evidence/hq-interior/phase3/perf-check.txt`; the `hq` bench scene, from the door; passed):
- High: 2.90 ms, 111 draws, 79k triangles.
- Lite: 1.90 ms, 69 draws, 72k triangles.
- Phase 2 was 2.70 ms and 104 draws on high: the upper floor's three parts cost seven draws. Under the cafe's budget on
  every line.

**Not done:** the banners and the plaque stay blank until David sends them; other players upstairs still draw at the
ground floor's height (the network sends no height).


## Phase 4: David's review of phase 3 (2026-10-22): redo

David, verbatim:

> "looks good for a v1, but make the textures of things more accurate like how they interact with the light. I also think the building can be built a little bigger for more space, make it more loungy, like utilize the first floor space infront of the fishtank to use for lounging, big cozy sofa and bean bag with bigger rug, second floor can utilize space better by adding like study fixtures on the left side, I want big clear windows like in modern appartments and not the curtain with the + kinda window, and add like long table with monitor and chairs and stuff, add more plants, and improve quality of these models"

> "more lightings, lightsings should fade a little lighter and more light fixures so no dark corners at night"

> "why is there 2 admin doors, make it 1, and place it like under the stairs"


### Phase 4 built (2026-10-22)

Still layout B, the gallery, the aquarium on the back wall. The exterior is unchanged.

- **Bigger:** 24 x 18 (was 20 x 16), the storeys still 4.6, the ceiling 9.2. The bridge is z −9 to −4, the arms x ±6.5 to
  ±12, the tank 11 wide (x ±5.5) and still the full height. Every number is in `web/lib/game/hqLayout.ts`.
- **The hall, a real lounge before the tank:** a deep U sectional in brown velvet facing the glass (an 8.2 back run, two
  2.15 returns, throw pillows), the travertine table and mushroom lamp inside it, five velvet beanbags between it and the
  glass, a 10.4 x 6.2 cream shag rug, a globe floor lamp at each back corner. The aquarium's station is on the walkway
  before the glass. The work zones under the left arm stay (library, co-working, trophy case, clock, Founder's desk).
- **Upstairs, the study on the left arm:** a reading nook by the bridge; the long walnut table (6 m) down the arm with
  three monitors a side back to back, six leather office chairs and two brass task lamps; low walnut shelves of books
  along the wall under the window; a whiteboard on the back wall. A reading nook on the right arm too; the bridge's
  lounge as it was.
- **Windows:** big modern panes, floor to ceiling where the wall is free (over the study's shelves from 1.1 up), thin
  black frames, upright mullions no wider apart than 1.5, no transoms, no curtains. The front door is a black framed
  double glass door, split down the middle only.
- **One admin door, under the stair:** the space under the flight's high end is closed along its open side by walnut
  panels whose tops follow the stringer; the door sits in them at z 5.4 (the flight 2.6 over its top), a black steel
  frame, a dark walnut leaf, a brass lever, a keypad, the "ADMINS ONLY" plate and a line of light under it. Its station
  is on the ground floor beside the stair: "Admins only. It's locked." Both upstairs doors are gone.
- **Lighting:** 30 lamps (12 globe floor lamps, mushroom table lamps, 5 brass desk lamps, 6 sconces), warm cove strips
  under the gallery's edges, track spots on the library, the board, the admin door, the trophy case, the plaque, the
  banners, the whiteboard and the canvas. The pools fade softer and a little lighter (`LampPools.tsx`), are cut to the
  room so a corner lamp lights up to its walls, and a floor lamp by a wall or a sconce washes the wall
  (`lib/game/hqLight.ts`; a test checks every spot you can stand by a wall has a light within 3.6). Six real lights
  (the entry and hall, under each arm, the bridge, the study, the tank's blue). Night keeps a warm fill.
- **Materials** (`build_hq.py` `mats()`, `lib/game/modelMaterials.ts`): the floor and walnut satin with normal maps
  (the planks' seams, the grain), plaster and the rugs' pile with normal relief, green marble polished with a clear coat,
  velvet with a sheen at grazing angles (new preset `P_Velvet`, KHR_materials_sheen), leather a gentle highlight (new
  preset `P_Leather`), chrome and brass dark enough that the look's metal class keeps them metal, glass see-through.
  The room's reflections (`HQ_ENV`) now hold its windows, lamps and the aquarium's blue (`envLight.ts` `glows`).
- **Models:** rounder cushions and arms, thicker back cushions on a solid back, throw pillows; slouchy beanbags; a
  snake plant kind; more plants (13 on the floors and 2 on the study's shelves, was 8).
- **Fixed:** the arms' floors read pale in phase 3: the floor sank under the slab's top where the curved world bent its
  one big quad. The slab's top is now 5 cm under the planks and every floor is in 2 m cells.

**Models and budget:** `ground.glb` 36.8k triangles, `upper.glb` 28.1k in three parts (32 draws), `ceiling.glb` 7.9k,
`tank.glb` 10.5k. The exceptions in `budget.ts` rose with the reasons there.

**Perf** (`specs/evidence/hq-interior/phase4/perf-check.txt`, passed): high 2.10 ms, 125 draws, 97k triangles; lite
1.70 ms, 76 draws, 90k triangles.

**Stations** (`phase4/shots.mjs` "prompts"): the exit, Alice's desk, the coffee bar, the notice board, the library, the
trophy display, the Founder's desk, the clock, the aquarium, the admin door and the workbench all answer; Alice at her
post. Nothing answers upstairs now.

**Shots:** `specs/evidence/hq-interior/phase4/hq-phase4-sheet.webp`: the plans, from the door, the lounge before the tank
(and on the sectional), the study (and at its table), the bridge, the windows upstairs and down, the admin door, four
corners, close-ups of velvet, leather, marble, walnut and the chrome and glass, the walking camera in the hall and at
the study, day and night side by side; the overview and the lines on screen by day.

**Not done:** the banners and the plaque stay blank until David sends them; other players upstairs still draw at the
ground floor's height.
