# Café polish (rows 268, 269)

David, 2026-10-01: "I need you to polish combat system, cafe first." He then picked:
- **Interior:** "I'll send a reference". The room layout waits for his image.
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
7. **The café building.**
   - A dedicated café modeled in Blender: an awning, big warm windows, a door, a hanging sign; in the village's style; matte (row 264); one material per piece where possible.
   - Integer footprint per the ACNH grid law, so check the current café footprint and keep it unless it doesn't fit.
   - Two states: boarded up (planks over the windows and door) until the club goal, open after.
   - Build it headless (`--background --python`); the live Blender window belongs to the avatar agent. No web references (David supplies every visual reference); if you need one, ask in the questions file and build a clean neutral version meanwhile.
8. **Performance.**
   - Mount the study HUD only in the village and the café.
   - Republish only on change.
   - Rebuild the table list only when it changes.
   - Light the room with about three lights.
9. **Evidence** under `specs/evidence/cafe-polish/`:
   - the closed café;
   - the open café, day and evening;
   - entering;
   - the owner;
   - sitting, studying and settling with the toast;
   - the phone table list before and after the goal.

## Waits for David
- The interior layout and look (his reference, row 164).
- `cafe.mp3` (Suno) and the café bell (row 125). Until they arrive, use the existing fallback track and the `confirm` sound.
