# HQ interior

David, 2026-10-18. Ledger row 316. HQ is the second interior to be reworked from David's references, after the [shop](shop.md). Same process: the layout comes first and gets David's OK before anything is furnished.

**Current layout: B, the gallery, with taller storeys** (phase 3, below). David, 2026-10-19, on the phase 2 review, verbatim:

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
  - Wren's front desk and the island register;
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
  | Front desk | (−5.2, −3.6) | Wren: the onboarding visit, the register, the profile showcase |
  | Notice board | (0, 4.3) | The notice sheet and the club goals (onboarding step 6) |
  | Trophy display | (−4.5, 4.2) | The tourney list (the 3D case stands at the display) |
  | Bookshelf | (6.6, −1.3) | Quests |
  | Clock | (−7, 4.75) | The island's time |
  | Founder's desk | (2.27, 3.85) | The blank plaque (onboarding step 4) |
  | Workbench | (−6.0, 1.0) | Crafting |
  | Exit | (0, −5.5) | The island |

- **Wren's post:** behind the front desk, at (−5.05, −1.78), in `lib/game/keepers.ts`.
- **The onboarding script:** it's driven by these stations' events, not by positions (`lib/game/arrival/hq/script.ts`).
  Moving the stations moves the onboarding with them.

### The new room, both options

- **Size:** 20 x 16, two storeys. The floors are 3.4 apart and the ceiling is at 6.8.
- **Door and arrival:** the door stays in the middle of the front wall. You arrive at (0, −6.4) and the exit is at (0, −7.2).
- **Aquarium:** two storeys tall (0.25 to 6.6), its water a single bright blue in the greybox.
- **Ground floor:** Wren's front desk and the register by the door, plus the green marble coffee bar, the long walnut
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
  - Wren's desk faces the door on the right.
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
  - The entry is under the bridge, with Wren's desk on the left and the coffee bar on the right.
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
- Wren walking her new post.
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
  - Wren's walnut desk by the door: a fluted front, a travertine top, a warm strip under the lip, the register open on
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
- Every station HQ had: the exit, Wren's desk (the visit's report and the register), the notice board, the Founder's
  desk, the trophy display, the clock, and the workbench (its own prompt).
- The library replaces the bookshelf: "Browse the library".
- New stations, their lines drafts for David (`HQ_LINES` in `hqLayout.ts`):
  - the coffee bar: "Get a coffee" → "Fresh coffee at the marble bar. The cups are already warm.";
  - the aquarium: "Look at the aquarium" → "Silver fish turn together in the blue. A small orange one goes its own way.";
  - the admin doors: "Try the door" → "Admins only. It's locked."
- No reward for any of them (principle 3).
- Wren stands at her new post behind the desk (`KEEPER_POSTS.memberHq`), seen over its counter from the walking camera
  (tested).

**Perf** (`specs/evidence/hq-interior/phase2/perf-check.txt`; the `hq` bench scene, from the door):
- High: 2.70 ms, 104 draws, 77k triangles.
- Lite: 1.80 ms, 62 draws, 70k triangles.
- Under the café's budget on every line.

**Shots:** `specs/evidence/hq-interior/phase2/hq-phase2-sheet.webp`, made headless by `shots.mjs` and `sheet.py` there.
- Day and night side by side: the plans, from the door, walking in, the aquarium from the lounge and close up, the work
  floor, the upper lounge and its view of the tank, upstairs walking.
- By day only: the overview, the top of the stairs, the board and the Founder's desk, the coffee bar and Wren's desk, the
  admin doors, walking under the mezzanine, and the three new stations' lines on screen.

**Not done:**
- The banners stay blank until David sends the year designs.
- The plaque stays blank until David writes it.
- Other players upstairs are drawn on the ground floor's height. The network sends no height, as in the shop.

