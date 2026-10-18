# HQ interior

David, 2026-10-18. Ledger row 316. HQ is the second interior to be reworked from David's references, after the [shop](shop.md). Same process: the layout comes first and gets David's OK before anything is furnished.

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
