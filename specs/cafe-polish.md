# Café polish (rows 268, 269)

David, 2026-10-01: "I need you to polish combat system, cafe first." He then picked:
- **Interior:** "I'll send a reference". The reference arrived later the same day (row 270): "premium cafe. different seating options, fits 40-50 ppl", with four images in `specs/references/cafe/david/cafe-ref-01.png` to `04.png`.
- **Building:** model the café in Blender now.
- **Barista:** a named café owner.
- **Movement:** walk only inside.

## Where it stands (survey 2026-10-01)
The café works end to end (sit, study, coins, walk-away settlement), but most of it is a stand-in.

**Exterior and entry**
- The exterior is a re-coloured placeholder house with two log fences (`DefaultIslandWorld.tsx:362,365`) and a floating "Café · Opening soon" sign (`:174,374-376`).
- The closed prompt has no action and doesn't match the story ("boarded up for years", `progression/defaults.ts:54`).
- Once open there is no sign at all, and `defaultIsland.ts:50` still marks the café `open: false`.
- "Enter the café" fires from any side of the footprint (`:255`).

**Interior**
- An 18×12 box room with clubhouse furniture and seven point lights (`CafeInterior.tsx`).
- The barista is the capsule keeper figure (`interiorShared.tsx:258-300`).
- You arrive inside the exit range, so "Return to the island" shows on entry (`CafeInterior.tsx:26-27,76`).
- The room heading is generic, and the controls bar lists Zoom and Map indoors.
- The café walks on `PlayerAvatar` with the full kit (movement Q20).

**Rules and feedback**
- The server's `sit` (`lib/study/service.ts:155-177`) and the phone let anyone sit at café tables before the chapter 2 club goal opens the café (row 177).
- Settlement is one quiet text line.
- The island prompt and the study prompt share a spot and both take E (`StudyHud.tsx:80` vs `DefaultIslandWorld.tsx:723`).

**Performance**
- The study HUD is mounted everywhere (including the ruins), polls every 30 s and republishes on every render.
- The table list rebuilds every second, so seats and seat-mate labels redraw at 1 Hz.

## Deliverable, in order (a commit each)
1. **Gate café tables** on the chapter 2 goal, in the server's `sit` and in the phone's table list (outdoor tables stay open). Test first: it fails before, passes after.
2. **Prompts.**
   - Measure "Enter the café" from the door.
   - Put the inside arrival point outside the exit range.
   - Study seats suppress the island prompt and its E handler while a seat prompt is up.
3. **Closed and open states.**
   - Closed: "Boarded up · help reopen it at the monument". E opens the chapter 2 goal's progress.
   - Open: a café sign.
   - Fix `open` in `defaultIsland.ts` to follow the goal.
4. **Inside.**
   - Walk only: no jump or dash.
   - A café subtitle under the room heading.
   - Zoom and Map hidden from the controls bar indoors.
5. **Settlement feedback.** A coin toast and sound through the toast system on settlement, with different copy for a finished block and leaving early. Never show the TC ≈ CAD rate.
6. **The café owner.**
   - One of the service residents (row 122, the `cafe_owner` post in `lib/content/residents.ts`), on the real character rig in a fixed look. Propose the name, look and two or three lines in the questions file for David's OK.
   - Stands behind the counter with idle and greet clips, talkable (the existing resident dialogue path), sells nothing yet.
   - Replaces the capsule figure.
7. **The premium interior** (row 270), from David's four references. Read them closely; they are the whole art direction.
   - **The look:**
     - Warm, dim amber light.
     - Wood-panelled walls and ceiling with recessed downlights.
     - A wood-framed backlit grid ceiling panel over the bar.
     - Glowing lightbox signs: "PICK UP", "ORDER & PAY HERE", and two or three backlit menu boards.
     - Tiled backsplashes: a white grid tile and a dark grid tile.
     - A long wood bar with an espresso machine, grinders, cups and jugs.
     - A white-tiled counter with a glass top display, and a pastry display case.
     - Stainless under-counter fridges.
     - Open shelves with cups and paper bags.
     - Plants, wall sconces, and a big window wall.
   - **Rendering:**
     - Signs and panels are emissive materials, not lights.
     - About three real lights.
     - Matte everywhere except a restrained sheen on steel and glass (the look-dev glass/metal treatment).
   - **Menu-board text:** café drinks and pastries (espresso, latte, matcha latte, tea, hot chocolate, croissants, buns). No prices.
   - **Capacity, 40–50 seats across varied seating:**
     - window bar stools;
     - two-seat tables;
     - four-seat tables;
     - booths or a couch area;
     - a long communal table.

     The room grows to fit them (today it is 18×12, so expect about 28×18) with clear walkways and the counter at the back.
   - **Seats stay data:** `CAFE_LAYOUT` in `web/lib/study/seats.ts` plus furniture shapes.
     - New tables are new backend rows in `DEFAULT_TABLES` (`lib/study/tables.ts`) and a new seed migration: timestamp after `20261001041452`, generated through `lib/seedMigrations.ts` / `scripts/gen-seeds.mjs`, added to the SQL smoke list.
     - Keep the existing 7 café table ids.
     - Reuse the existing table kinds where they fit. If a new kind (bar, booth, communal) needs a schema change, do it in that migration.
   - **Models:** hand-modeled props in Blender headless (no downloads, no AI generation). Reuse existing clubhouse props only where they match the references.
   - **The owner (item 6)** works behind this bar.
8. **The café building.**
   - A dedicated café modeled in Blender to match the premium interior: warm wood and glass, big windows glowing amber at night, an awning, a lightbox sign.
   - It is the village's style, not photoreal, and matte (row 264).
   - Integer footprint per the ACNH grid law. The room is bigger now; the outside footprint may stay modest, since interiors are their own scene.
   - Two states: boarded up (planks over the windows and door) until the club goal, and open after.
   - Build it headless (`--background --python`); the live Blender window belongs to the avatar agent.
9. **Performance.**
   - Mount the study HUD only in the village and the café.
   - Republish only on change.
   - Rebuild the table list only when it changes.
   - Light the room with about three lights.
10. **Evidence** under `specs/evidence/cafe-polish/`:
   - the closed café;
   - the open café, day and evening;
   - entering;
   - the owner;
   - sitting, studying and settling with the toast;
   - the phone table list before and after the goal;
   - the interior beside each reference image, at the same rough angle;
   - a top-down seat map with the count.

## Waits for David
- `cafe.mp3` (Suno) and the café bell (row 125). Until they arrive, use the existing fallback track and the `confirm` sound.
