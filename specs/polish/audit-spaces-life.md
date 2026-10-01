# Polish audit: spaces and life (2026-10-01, read-only survey)

Paths are relative to `web/`.

I found 2 resident NPCs in the village, no seagulls or ambient critters in the member game, and no boat model anywhere in it. All five interior keepers are capsule-and-sphere figures, and the ambient sound is one outdoor loop that keeps playing indoors. Paths below are relative to `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/restart-art-cohesion/web/`.

**1. Spaces and life systems**

| Space / system | What the player sees and hears | Weakest moment |
|---|---|---|
| HQ clubhouse (`HQInterior.tsx`, `Clubhouse` in `DefaultIslandWorld.tsx:390`) | Sage box walls, parquet, pendants, lounge, desk; outdoor day/night loop plus hourly music | Capsule receptionist standing at the end of the desk, sideways to the player (`HQInterior.tsx:218` vs `lib/game/clubhouse.ts:16-17`); no windows; the exit is a mat by a 1 m wall |
| Shop (`ShopInterior.tsx`) | Only reachable at `/lab/interior`. The village shop building has no door prompt (`DefaultIslandWorld.tsx:144`) | Walking up to the "Shop" sign does nothing |
| Oracle (`OracleInterior.tsx`, `oracle/OracleTemple.tsx`) | Lavender box walls, flat unlit banner planes, pieces of the altar, icosahedron crystal, sphere embers | Hooded capsule keeper; the camera is not snapped on entry |
| Museum (`peaceful/MuseumInterior.tsx`) | Three coloured floor planes, back-wall planes only, 18 HTML plaques | No side walls, a box for the desk (`:95`), a bald capsule curator (`:96`), fish frozen in the tanks, daytime light at every hour (`:24`) |
| Home interior (`home/HomeInterior.tsx`) | Textured wallpaper and floor, placed furniture | No front wall or door; the exit is invisible (`:115`); a light with no lamp model (`:134`) |
| Fitting room | Outdoor GLB that opens a sheet (`DefaultIslandWorld.tsx:360`) | Nothing reacts in the world: no curtain, no step-in |
| Residents (`NPC.tsx`) | 2 seeded residents (`supabase/migrations/20260927090000_admin_pass.sql:17-18`), sine-wave drift, a greeting bubble with blips | They walk sideways while facing the player and never stop or idle properly |
| Village life (`peaceful/VillageLife.tsx`) | 7 catchable bug nodes; forage nodes made of primitives | A startled bug blinks out after 1.4 s (`:141`) |
| Home island (`home/HomeIslandScene.tsx`) | House, trees, mailbox, a sign | The "dock" is a sign plus an HTML label on sand (`:94-95`); no pier, no boat |
| Wharf (`WharfPier.tsx`) | Flat-colour box planks, cylinder posts | No boat, rope or buoy, though `public/assets/acnh/props/boat.glb` exists |
| Boat arrival (row 211) | Missing: boat travel is a 320 ms fade and teleport (`DefaultIslandWorld.tsx:617`) | First login has no boat and no HQ lead greeting |
| Move target (`MoveTargetIndicator.tsx`) | Two flat yellow rings and a dot (`:76-107`) | These are the rings David rejected (row 273); unlit, so they glow at night, and they don't follow slopes |
| Night | Lamps, HQ windows, fireflies | Only 1 lamp on the map (row 163 asks for lamps along the paths); only the HQ gets window glow (`:355` vs `:359-363`, home island `:91`) |
| Weather and season | Rain, puddles, mist, snow, leaves and petals | No rain splashes, no snow footprints (row 152) |
| Sound | Four time-of-day loops (`lib/game/audio.ts:61-67`) | No weather or season beds on disk, no interior beds, no shore or river sounds; door `enter.ogg`/`exit.ogg` never play; music uses 2 applicant tracks whose licence is unverified (`lib/game/musicSchedule.ts:41`) |

**2. Rough edges, most placeholder-looking first**

1. **Capsule keepers**: `interiorShared.tsx:292-351` (capsule body and arms, sphere head and nose, cylinder and sphere hats), used in HQ `:218`, Shop `:107` (keeper overlaps the counter), Oracle `:180`, Museum `:96`. They only lean; they never turn, talk or wave.
2. **Forage primitives**: fruit spheres (`VillageLife.tsx:54`), dodecahedron rocks (`:61`), an icosahedron as the flower fallback (`:63`), a circle for dig spots (`:59`).
3. **Box walls and plain planes**: HQ `:131-159`; Shop `:66-88`; Oracle `:137-159`; museum walls and floors `:88-89`; botanical frames (`DefaultIslandWorld.tsx:382-386`); Oracle crystal `:94`; ember spheres `:75`; wharf planks, posts and rail (`WharfPier.tsx:31-53`). The pier's end rail sits at Z1 (`:44`), which looks like the land end — needs a check in the painter. Lab-only extras: HQ admin door `:193-202` and picture planes `:210-215`.
4. **Residents**:
   - Moving between schedule spots will teleport: the NPC key includes `home`, so a phase change remounts the NPC (`DefaultIslandWorld.tsx:279`).
   - Collision is checked from the spawn point, not the current position (`NPC.tsx:153`).
   - They face the player while still drifting (`:221`); the sine wander never truly stops (`:83-89`).
   - The ceremony stroll is a glide with no path.
   - Schedules are day-only, so they stand on the path at 3 a.m.
   - The "!" bubble is set in IBM Plex Mono (`:308-341`).
5. **Feels empty**: 2 residents of the 8–12 in row 85; seagulls are mounted only in `components/recruit/ApplicantWorld.tsx:13`; no non-catchable butterflies or dragonflies even though `Critters.tsx` has the models; 2 benches; the home island has no life at all.
6. **Abrupt changes**:
   - Fades run on fixed 320/900 ms timers and don't wait for loading (`DefaultIslandWorld.tsx:601-620`).
   - Lighting jumps between phases (`lib/game/islandLighting.ts:64-79`); lamps switch on instantly (`AmbientProps.tsx:12`).
   - Escape doesn't exit interiors (`specs/ux-interiors.md:16`).
   - Interiors use a sun-coloured key light at night, with no windows (`islandLighting.ts:36-41`).
7. **setState in useFrame and per-frame allocations**:
   - `NPC.tsx:167,198,205` (setState).
   - `VillageLife.tsx:131,150` (object and array literals each frame).
   - The keeper lean uses a fixed 0.016 delta (`interiorShared.tsx:287`).
   - `home/PlacementLayer.tsx:50` (setState plus a clone on every pointer move).
   - 21 drei `Html` nodes in the museum.

**3. Proposed specs, in order**

**A. Living village**
- Fix the NPC key and the collision origin (`DefaultIslandWorld.tsx:279`, `NPC.tsx:153`).
- Replace the sine wander with a waypoint routine: walk, stop, idle variety, face the direction of travel, and turn to the player only when stopped. Add night schedules (bench, or go indoors at a door).
- Port `Seagulls.tsx` to the village and home island; add ambient butterflies and dragonflies from `Critters.SPECIES` and beach crabs.
- Fade out fleeing bugs instead of popping them (`VillageLife.tsx:141`); replace forage primitives with GLBs.
- Pass `windowGlow` to every building; fade lamp intensity instead of switching it.
- Add rain splashes and snow footprints (`RainFX.tsx`).
- Restyle the "!" and greeting bubble.

**B. Interiors**
- Replace `InteriorKeeper` with the `Character` rig (Idle, Wave, talking mouth, turn to face), tied to the post personas.
- Room shells: wallpaper and trim like `HomeInterior` uses, windows that follow the time of day, a door frame at the exit, museum side walls and a real desk, a south wall and door for the home interior.
- Transitions: lift the fade only once loading is done (`useProgress`), play enter/exit sounds, snap the Oracle camera, let Escape exit.
- Small animations: fish swim in tanks, the crystal pulses, painted sparks instead of sphere embers, the fitting-room curtain moves.
- Lighting: museum follows the time of day; drop the sun key at night.
- Fix the keeper delta; replace the HTML plaques.

**C. Arrival, wharf, home island, sound**
- Wharf: textured planks, docked `boat.glb`, buoy and rope; check which end the rail is on.
- Boat travel and first-login arrival per row 211 (the boat glides in, the HQ lead greets).
- Home-island pier and boat at `HOME_DOCK`.
- Move-target marker painted from the movement-feel particle pack, lying on the slope, dimmer at night.
- Sound: weather and season beds, interior room tone (HQ clock tick, Oracle candles, aquarium bubbles), positional shore and river, door sounds.
- Blend lighting between phases.

**Needs David's call:**
- Resident names and traits (row 217) and which posts keepers staff.
- Lamp placement — he places everything in the painter (row 246).
- Whether the shop gets an interior or `ShopInterior.tsx` is deleted.
- Fish jumps as ambience (row 195 rules out fish shadows).
- The style of the move-target marker and the painted sparks (row 273 particle pack).
- Interior windows and wall finishes.
- All new ambience and SFX (row 125, generated per sound) and the music (his Suno tracks, rows 106 and 112–113).