# Café polish: questions for David

Spec: `specs/cafe-polish.md`. Branch `game/cafe-polish`. Evidence: `specs/evidence/cafe-polish/`. Each question names the assumption already built; nothing here blocks.

## 1. The café owner (item 6): name, look and lines
- **Proposed name:** Rosa.
- **Look** (`CAFE_OWNER` in `web/lib/game/cafe.ts`, fixed): medium-deep skin, dark brown hair in a top bun with curtain bangs, round glasses, a cream collared shirt under dark-wood bib overalls that read as a barista's apron, charcoal loafers. The rig has no apron part, so the overalls stand in for one.
- **Lines** (greeting bubble on approach, then E to hear the next):
  1. "Welcome in! Take any seat. The window stools get the best light."
  2. "Croissants just came out of the oven. Study hard, I'll keep the coffee coming."
  3. "It took the whole club to get those boards off. I'm so glad you're here."
- **Assumption:** she lives in code until you approve. Once you do, a Residents-editor persona on the `cafe_owner` post takes over her name and lines without a code change. Should I seed that persona in a migration instead?
- **Work clips:** the rig has no barista clip, so she uses Trace at the espresso machine and Forage at the pastry case. A tamp-and-pour clip from the avatar pass would read better. Should I ask for one?

## 2. Seating (item 7): 20 seats
- Four window stools (two tables of two), two tables for two, a four-top, a four-seat booth, and a small communal table of four.
- **Assumption:** the communal table seats 4, which keeps the room at "about 20". A 6-seat communal table would make it 22 and would need a `kind` schema change.
- The migration (`20261001072421_cafe_tables_seed`) only relabels the existing 7 tables (Window bar 1 and 2, Table for four, Communal table, Booth) and gives the booth 4 seats. The ids stay the same.

## 3. Ambient patrons
- They study at a laptop or a book (the Study clip), or sit over a cup (the Sit clip). The rig has no Sip clip yet. Should the avatar pass add one?
- **Density:** up to 7 in an empty café, one fewer for each member seated, none once 7 members are in. Does that feel right?

## 4. The sign and the building (item 8)
- The lightbox reads "CAFÉ". Do you want a name on it (for example "Rosa's" or a Tethos name)?
- **Palette:** warm wood cladding, a deep green and cream striped awning, a charcoal standing-seam roof, cream barge boards, a stovepipe for the oven.
- **Closed:** planks over the windows and door, a CLOSED board, and an unlit sign.
- **Open:** an A-frame menu, an OPEN sign, a lit sign, and at night amber windows and porch lanterns.
- Footprint 5 × 5 on the grid (half [2.5, 2.5]).

## 5. Look calls I made
- **Proportions:** café furniture is sized to the characters (chairs 0.4, counters 0.8) so Rosa shows above the bar. Outdoor benches are unchanged.
- **Ceiling:** the wood ceiling, downlights and grid panel are cut away for the game camera (dollhouse view). They only show from eye level, as in the reference shots.
- **Light:** the interior stays warm and dim at every hour. Only the window wall's view and its daylight change by phase.
- **Menus:** coffee, not-coffee and oven boards, with no prices.
- **Walk only (item 4):** this also turns off running, not just jump and dash, since you said "walk only".

## 6. Waiting on you (unchanged)
- `cafe.mp3` (Suno) and the café bell (row 125). Until they arrive, the door plays the existing enter/exit sounds and settlement plays `confirm`.

## 7. Noticed, not mine to change
- The toast stack and the interact prompt share the bottom centre. When a settlement toast shows while a seat prompt is up, the toast covers the prompt. This is ToastHub's global layout.
- At desktop widths the view options panel is always open (`DefaultIslandWorld.module.css` hides it only under 700 px).
