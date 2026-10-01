# Polish: interiors

Audit: `audit-spaces-life.md` (interiors, keepers) and its spec B. Paths under `web/components/game/`. The standard is in `README.md`. The café is done separately (`specs/cafe-polish.md`); reuse its keeper-to-character work.

## Problems
- **Capsule keepers** (`interiorShared.tsx:292-351`: capsule body and arms, sphere head and nose, cylinder hats) in the HQ (`HQInterior.tsx:218`), shop (`ShopInterior.tsx:107`, overlapping the counter), Oracle (`OracleInterior.tsx:180`) and museum (`peaceful/MuseumInterior.tsx:96`).
  - They only lean, on a fixed 0.016 delta (`:287`).
  - The HQ receptionist stands sideways at the end of the desk (`HQInterior.tsx:218` vs `lib/game/clubhouse.ts:16-17`).
- **Box walls and plain planes:**
  - the HQ (`:131-159`), with no windows and the exit a mat by a 1 m wall;
  - the shop (`:66-88`);
  - the Oracle (`:137-159`, flat unlit banners, an icosahedron crystal, sphere embers);
  - the museum (`:88-89`: three coloured floor planes, back-wall planes only, a box desk `:95`, 18 `Html` plaques, fish frozen in the tanks, daytime light at every hour `:24`);
  - the home interior has no front wall or door, an invisible exit (`home/HomeInterior.tsx:115`) and a light with no lamp model (`:134`);
  - the fitting room has no in-world reaction.
- **Lighting:** interiors use a sun-coloured key light at night (`lib/game/islandLighting.ts:36-41`). The Oracle camera isn't snapped on entry. Escape doesn't exit interiors (`specs/ux-interiors.md:16`).

## Deliverable, in order (a commit each)
1. **Keepers become residents** on the real character rig (`character/Character.tsx`):
   - idle, greet, work and talk clips; the painted face talking; turning to face the player when near;
   - standing in the right place (the HQ receptionist behind the desk);
   - one per post from the resident roster, proposed in the questions file.

   Delete the capsule `InteriorKeeper`.
2. **Room shells**, modeled in Blender (headless, or the live window if free):
   - wall panels with trim and skirting, windows whose light follows the world clock, a framed door at every exit;
   - museum side walls, a real curator desk and plaque frames instead of `Html` plaques;
   - a home-interior front wall with a door, and a lamp model for the lamp light.

   Matte, in each room's palette. No downloads, no web references.
3. **Lighting:** each interior follows the time of day through its windows (warm lamps at night, no sun key indoors at night); the museum included.
4. **Small life:**
   - fish swim in the museum tanks;
   - the Oracle crystal pulses;
   - painted sparks (particle pack) replace the sphere embers;
   - the fitting-room curtain moves when you step in;
   - the HQ clock ticks.
5. **Transitions:**
   - Enter and exit wait for the room to be ready, with door sounds.
   - The camera snaps cleanly in every room, the Oracle included.
   - Escape exits a room when no sheet is open.
6. **Performance:** no per-frame allocations; plaques as textures, not `Html`.

## Evidence
`specs/evidence/polish-interiors/`:
- each room before and after, day and night;
- each keeper greeting;
- the museum tanks;
- the transitions as frame strips.
