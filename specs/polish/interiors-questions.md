# Interiors: questions for David

Spec: `interiors.md`. Branch `game/polish-interiors`. Every question below has an assumption already built in, so nothing here blocks. Answer whichever you like; the rest stays as built.

## 1. Who staffs each room (deliverable 1, rows 122, 217)

The keepers are the living village's proposed roster (`living-village-questions.md` §1), on the real character rig with their roster looks and lines. The persona that holds a post in the Residents editor wins (its name and lines); until one does, the proposal stands there.

| Room | Post | Resident (proposed) | Where | Their work loop |
|---|---|---|---|---|
| HQ | `hq_lead` | **Wren** (the first-login greeter) | Behind the front desk, between it and its chair, facing the room | Stands ready, sorts the papers on the desk (Trace), reaches into a drawer |
| Shop | `shopkeeper` | **Toren** | Behind the counter and register | Ready, works the register, reaches under the counter's end |
| Oracle temple | `oracle_keeper` | **Sable** | Beside the altar | Ready, hands to the crystal, tends the front candle |
| Museum | `museum_curator` | **Odile** | Behind the curator's desk | Ready, labels specimens, a specimen drawer |
| Wharf shack (lab bench only) | `wharf_keeper` | **Bram** | Behind the counter | Ready, under the counter |

Each one, as Rosa does in the café: looks up and waves hello as you come in (once, then only when you walk up after 25 quiet seconds, also across visits), turns to you while you're near (never more than a shoulder's turn off their counter), shows the "!" as they notice you and their nameplate while you're near, talks with the Chat clip, the painted mouth and the voice blips. Using their station (the desk's showcase, the quiz, the donation sheet) they face you and talk you through it; click them for another line. Sable says the quiz's reactions herself (they used to float in a lilac box over a capsule).

**Assumptions taken:**
- **a. Keepers are always at their posts**, as in ACNH's Resident Services: the same resident also walks their routine in the village. You can see Wren on the plaza, walk into HQ and find her at the desk. **Question:** keep it (never an empty desk, principle 2), or empty the post while they're out and close the counter?
- **b. The front desk is served from the room side.** The desk's prompt moved to the customer's side (in front of the drawers); Wren stands where the chair is. The receptionist used to stand at the desk's end, side-on.
- **c. The applicant island's HQ** (the parked island application) is the same room component, so it gets Wren and the new room too.

## 2. Room shells (deliverable 2)

Modelled headless in Blender (`art/interiors/build_interiors.py`, reusing the café's kit `art/cafe/cafekit.py`): no downloads, no generated or referenced art. Each room keeps its palette from `ux-interiors.md`:

| Room | Walls | Windows | Its own pieces |
|---|---|---|---|
| HQ | Cream-sage plaster over the sage raised-panel wainscot | Two each side, glazing bars, mustard pleated drapes | The parquet floor and furniture as they were |
| Shop | Mint plaster over beadboard, a plank floor | One each side | A yellow-and-cream striped awning with a scalloped edge over the counter |
| Oracle temple | Lavender plaster on a stone plinth, stone pilasters and cornice, flagstones | Two round windows each side, a rose window over the altar | A banner per family (Arcane, Ranger, Warden, Vanguard) with its sigil, the crystal a modelled cluster |
| Museum | Each wing its own wall colour (aqua, ochre, sage) over a walnut wainscot | One each side, a clerestory of nine along the back | Three floors (tile, herringbone, slate) with brass strips, Odile's desk, a plaque stand at every case, a sign over each wing |
| Your house | Your wallpaper, as before | None (see c) | A near wall with the front door; a pendant lamp in each room |

Every near wall is the cut-away lip, now with a framed doorway (jambs, a threshold) and a stone doorstep outside.

**Assumptions taken:**
- **a. The windows show a painted outside, not the real island.** They're drawn from the island's light: the sky's colours, the low sun's glow at dawn and dusk, stars and a few lit windows at night, the season's trees, rain or snow falling past the glass. The view shifts a little as you walk past. **Question:** fine, or do you want the real island (render-to-texture, a few ms a frame)?
- **b. The Oracle's banners are the four families** (the reveal's colours and sigils), replacing the old red, blue, green and gold class banners.
- **c. No windows in your house.** Wall items go anywhere on its walls, and a window would take a placement spot. It still keeps the island's hours: soft daylight by day, the pendants warm at night. **Question:** do you want windows (a fixed spot on the back wall, say) or a window you can place like furniture?
- **d. The candles were upside down.** The dump's chamberstick is authored inverted, so the temple showed white "mushrooms". It's turned upright, and the flames sit on the wicks.

## 3. Lighting (deliverable 3)

Indoors now follows the island's blended light (`lib/game/interiorLight.ts`): the sun comes in through the windows by day (with shadows on High, the ceiling and the cut-away wall cast, so it lies on the floor in the windows' shapes), the moon's faint blue at night (never a sun-coloured key), and the lamps come up as the daylight goes. Dawn and nightfall ease in over the same 40 minutes as outdoors. The museum keeps the island's hours too (it was daylight at every hour).

## 4. Small life (deliverable 4)

- **The aquarium's fish swim** (the species' own model from the fishing catalogue), lapping low by the front glass, tails beating, on the world clock, so everyone sees the same aquarium. Sea creatures keep to the tank floor.
- **The crystal breathes**: its glow and light swell slowly (in the family's colour during the reveal).
- **Candles burn**: a painted flame on each wick (the combat pack's fire tongue in candle colours) and sparks drifting up (its light mote), instead of the sphere embers; the candle pools flicker with them.
- **The fitting room's curtain** stirs in the wind, swishes as you brush past it walking up, and sweeps across when you step in (E).
- **The HQ clock ticks**: its pendulum swings a beat a second and its hands keep the island's time (lifted out of the dump model at load).

## 5. Transitions (deliverable 5)

- The fade waits for the room: it lifts only after everything has loaded and the room has rendered a few frames (the warm-up step is now `lib/game/sceneGate.ts`, tested). Doors sound on the way in and out.
- The camera arrives already in place in every room (the walker snaps it as it mounts; the temple's used to swoop in from the village).
- Escape leaves a room by its door once nothing is open: it closes a sheet or dialog first, never leaves while you're seated studying, decorating or mid-fade.
- You arrive a step inside every room, clear of the door's prompt, which now shows only when you walk back to the door (the café's rule). Before, "Return to the island" was up the moment you came in, so E took you straight back out.

## 6. Sounds this needs (none exist; the Sound pass, row 125)

Wired with what exists until a source is picked:
- **The clock's tick:** the UI click, pitched down and quiet, heard only near the clock. A real tick and tock would replace it.
- **Door open and close:** the existing enter and exit sounds.

Silent until sourced:
- candle crackle in the temple, the crystal's hum;
- aquarium bubbles and a soft filter hum in the museum;
- the curtain's swish;
- room tone per room (the HQ's murmur, the shop's bell over the door).

## 7. Found along the way

- **The keepers' lines** are the roster's three each. The persona holding a post in the Residents editor replaces them.
- **`.keeperBubble` and `.plaque`** in `DefaultIslandWorld.module.css` were left unused (Sable speaks in the residents' bubble; the plaques are a texture) and are deleted, now that the GUI sheet, which restyled them, has merged.
- **The wharf shack** (`/lab/interior?room=wharf`) is still flat planes; only its keeper changed (Bram). It's lab-only.
