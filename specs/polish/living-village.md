# Polish: living village

Audit: `audit-spaces-life.md` (residents, village life, night, weather) and its spec A. Paths under `web/`. The standard is in `README.md`. Design principle 2: the world must never feel empty.

## Problems
- **Residents.**
  - There are 2 of the 8–12 the plan calls for (row 85), seeded in `20260927090000_admin_pass.sql:17-18`.
  - They drift on a sine wave and face the player while still moving (`NPC.tsx:83-89, 221`), never truly stop or idle, and teleport between schedule spots. The NPC key includes `home`, so a phase change remounts them (DIW:279).
  - Collision is checked from the spawn point, not the current position (`NPC.tsx:153`).
  - Schedules are day-only, so they stand on the path at 3 a.m.
  - The "!" bubble is IBM Plex Mono (`NPC.tsx:308-341`).
  - `setState` runs in `useFrame` (`NPC.tsx:167, 198, 205`).
- **Ambient life.**
  - Seagulls exist only on the applicant island (`components/recruit/ApplicantWorld.tsx:13`).
  - There are no non-catchable butterflies, dragonflies or beach crabs, though `Critters.tsx` has the models.
  - The home island has no life at all.
- **Village life.** A startled bug blinks out after 1.4 s (`VillageLife.tsx:141`) and slides along a fixed +x (`:149`). The literals on `:131, 150` allocate every frame.
- **Night.**
  - Only the HQ gets window glow (DIW:355 vs 359-363; home island `:91`).
  - Lamps switch on instantly (`AmbientProps.tsx:12`).
  - Lighting jumps between phases (`lib/game/islandLighting.ts:64-79`).
- **Weather.** No rain splashes and no snow footprints (row 152).

## Deliverable, in order (a commit each)
1. **Resident movement.**
   - Fix the NPC key and the collision origin.
   - Replace the sine wander with a waypoint routine: walk with the real walk clip at stride speed, stop, then varied idles (look around, stretch, sit on a bench, chat with another resident).
   - Face the travel direction; turn to the player only when stopped and the player is near.
   - Night schedules: home through a door, or a bench under a lamp.
   - No `setState` in the frame loop.
   - Tests for the routine (no teleports, no walking through solids, stops at every waypoint).
2. **The greeting bubble** in the cream UI kit, with a small pop-in, the resident's name and a gentle bob. It never covers the player's prompt.
3. **Ambient life**, all drawn for everyone from the shared world clock:
   - Port `Seagulls.tsx` to the village and the home island.
   - Ambient butterflies and dragonflies from `Critters.SPECIES` by season and hour (not catchable; the catchable nodes stay as they are).
   - Beach crabs that scuttle away when you come close.
   - Fish jumping in the sea now and then.
4. **Bugs.** A wary hop as a tell before fleeing; flee away from the player along a curving path; fade out instead of popping.
5. **Night.**
   - Window glow on every building with windows (village and home island), easing on at dusk.
   - Lamps fade up over a few seconds.
   - Phase lighting blends continuously instead of stepping.
6. **Weather.**
   - Rain splashes on the ground and ripples on puddles and the sea.
   - Snow footprints that fade.

   Both use the particle pack and system from `specs/movement-feel.md`.
7. **More residents.** Propose the remaining service residents and two or three flavour villagers (names, looks on the character rig, traits, homes, routines) in the questions file. Build them as data so admins can add more (principle 8). The seed migration comes after David approves.

## Evidence
`specs/evidence/polish-village/`:
- residents' routines as a top-down trace;
- a frame strip of a resident walking, stopping, idling and greeting;
- seagulls, butterflies and crabs;
- the village at dusk before and after;
- rain and snow.

Also report FPS.
