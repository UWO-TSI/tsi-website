# Movement feel: every small thing is a feature (row 273)

David, 2026-10-01:

> "movement graphics a bit wonky. it should tie to the game properly, like the dust when jumping should be dust and not spheres or rings, character jump animation more seamless, dash micro animation and effect around the dash should be better developed, just everything small like that needs to be considered a proper feature"

On the particle art: "hand paint in style, develop our own particle pack."

The bar: each micro-effect below is specced, built with real art, tunable in `/lab/move`, tested where it is logic, and shown in evidence. Nothing ships as a placeholder primitive.

## Where it stands (`web/components/game/movement/moveFx.ts`, `PlayerAvatar.tsx:283-340`)
- **Dust** is flat `CircleGeometry` discs in one beige, and a splash is a `RingGeometry` (`moveFx.ts:39-40`). It spawns from move events and a run timer, not from foot contacts.
- **Speed lines** are white `BoxGeometry` rods (`moveFx.ts:73`).
- **Dash cooldown** is a flat yellow UI ring at the feet (`DashRing`, `moveFx.ts:97-102`).
- **Sounds:** dash, glide, splash and respawn reuse the dialogue `blip` sounds; jump and land reuse `jump` and `footstep`. There are no surface sounds.
- **Clips and squash:** Jump, Fall, Land, Roll, Mantle, Dash, Skid and Glide exist (`art/characters/base/build_clips.py`). Squash and stretch is procedural, and transitions between clips can pop.

## Deliverable
1. **Our own particle pack.** A small hand-painted set in the game's style (soft, painterly, matte, ACNH-cozy rather than realistic). Each is a short flipbook in one atlas:
   - dust puff;
   - low dust burst (hugs the ground);
   - sand kick;
   - grass flecks;
   - water droplets;
   - a water ripple (drawn as water, on the surface);
   - snow puff;
   - leaf bits;
   - soft tapered speed streak;
   - wind swirl;
   - skid scuff;
   - a tiny sparkle.

   Source and a reproducible build under `art/fx/`; the atlas lives in `web/public/assets/fx/`. Painted by the agent (procedural brushwork, Blender or image scripts), no downloads, no web references.
2. **One particle system.**
   - **Draw:** instanced billboards, one draw call for all movement effects, pooled, with no allocation per frame.
   - **Per particle:** frame, tint, size, rotation and life.
   - **Look:** soft edges against the ground (depth fade), lit by the sun and sky like the world (no unlit white sprites), tinted by the surface under the feet, drifting with the shared world wind.
   - **Who emits:** effects draw on every avatar that moves (look spec §7.1, multiplayer-forward), seeded from the move events so replays match.
3. **Surface awareness.** One lookup from the terrain under the feet (grass, sand, wet sand, soil, stone, wood, snow, shallow water) picks the effect, tint and sound for every move below.
4. **The moves, each a small feature:**
   - **Footsteps:** a puff or flecks on each foot contact, taken from the run and walk clips' contact frames, not a timer; nothing on wood or stone but the sound. Fading footprints on sand, wet sand and snow (a decal pool).
   - **Jump:** a 2–3 frame anticipation squash, visual only with no input delay; take-off dust kicked back from the feet; the clip phases driven by vertical speed (rise, apex tuck, fall) so the arc never pops.
   - **Land, by drop height:**
     - a tap: a few motes;
     - normal: a low ring of dust sprites spreading along the ground;
     - heavy: a bigger burst, a tiny camera dip and a longer landing pose.

     The roll trails dust.
   - **Bunny-hop and long jump:** light chained puffs; the long jump gets a stretched pose and a short trailing streak.
   - **Dash:**
     - A real dash pose: lean in, arms back, a quick anticipation.
     - A directional burst of dust on the ground, a puff of air in the air.
     - Soft tapered streaks and one or two faint afterimages, tasteful and short.
     - A settle pose at the end.
     - The cooldown readout redesigned so it reads as part of the world, not a UI ring; propose it.
   - **Skid:** a scuff trail, a skid pose and the sound.
   - **Mantle:** a dust puff at the hands, with the pull-up blending cleanly into standing.
   - **Glide:** leaf bits on opening, wind ribbons at speed, a soft set-down.
   - **Splash:** droplets plus a ripple on the water surface.
   - **Respawn:** a soft dust puff.
   - **Body:** a lean into acceleration and turns, and the head looks along the travel.
5. **Seamless animation.**
   - A transition table: every pair of clips gets a crossfade time, and a landing can interrupt a fall cleanly.
   - Stride matching: walk and run playback follow ground speed so the feet don't slide.
   - Foot-contact markers on the clips, used for footsteps.
6. **Sound:**
   - Wire per-surface footstep, jump, land, dash and splash sounds from files already in `public/audio/`.
   - List every sound that's missing in the questions file. The coordinator will ask David for a pack; no generation here.
   - Respect the Sound settings.
7. **Lab.** A Juice panel in `/lab/move` toggles and tunes each effect, with the pack preview and slow motion.

## Milestone 1 (review gate)
Ship these for David to play in `/lab/move` and in the village; he approves the look before the rest:
- the particle pack sheet;
- the particle system;
- footsteps on grass and sand;
- jump, land and dash.

## Evidence
`specs/evidence/movement-feel/`:
- the pack sheet;
- slow-motion frame strips of each move, before and after;
- one per-surface footsteps strip;
- the dash in close-up;
- FPS unchanged in the village.

## Built: milestone 2 (branch `game/movement-slide`, 2026-10-01)
- **Skid, mantle, glide, splash, roll** (`lib/game/movement/juice.ts`, `PlayerAvatar`), each from our pack, tinted by the ground, seeded from the spot, in the Juice panel (`skid`, `mantle`, `glide`, `splash`, `roll`):
  - skid: a kick of dust on the old way with the ground's grains or flecks and the first scuff; scuffs and trail through it; a push-off puff against the new way;
  - mantle: a puff under each hand on the lip, flecks or grains knocked down its face, motes as the feet step onto the top;
  - glide: leaf bits and a puff of air pushed down on opening, wind ribbons off the leaf's two tips at speed, leaf bits when it folds in the air, a soft ring and leaves settling on the set-down;
  - splash: sized by the drop (the sim's `splash` event now carries it; `SPLASH` 0.6 and 1.8u): a few drops and one ripple, droplets and two ripples, a crown, a wide ring and mist;
  - roll: a tumble of dust as the back meets the ground and again halfway, trail through it, a settle as it pops up.
- **Footprints** on sand and wet sand: a painted shoe print in the pack (`sandPrint`, row 14, `art/fx/build_pack.py`; every other row byte-identical) that crumbles and fills over its frames, laid at each foot contact along the facing, pressed in at once, gone after 7 s (sand) or 11 (wet sand); its own decal layer in the scene's particle system (160), drawn over the terrain's painted sand and soil layers (render order 3.5; the effects at 3.6), so effects never push one out. Snow prints are the living village's (`WeatherGround`, row 13 `footprint`), for you and the residents. Juice: `prints`.
- **The transition table** (`crossfade` in `lib/game/character/clips.ts`): every clip is in a family (locomotion, air, landings, movement, seats, actions, combat) and every pair of families has a time, with the pairs that matter listed: a landing cuts into a fall in 0.04 s, the movement chain hands over in 0.03 to 0.06, sitting and lying down ease in 0.25 to 0.3, a hit is immediate. A test walks every pair in the catalogue (43 clips).
- **Stride matching:** walk, run and crouch-walk start the next loop on the same foot (`matchPhase`, from their measured contacts); the run holds down to 1.15× walking pace once running (no flicker on the line); the walk's cadence follows a slow amble too. Measured in Blender: a planted foot moves 0.64 u/s in Walk at 1×, 2.12 in Run, 0.44 in CrouchWalk, so at 7.4 u/s the walk would need about 23 steps a second to plant its feet; the feet still slide at full speed (a question for David).
- **Residents' footstep dust** (`useStepDust` in `components/game/movement/moveFx.ts`): residents (each `Figure` in `NPC.tsx`) and the dev crowd throw the ground's dust at each foot contact, at 0.6 of the player's and silent, ripples on rain days, prints on sand.
- **The dash's afterimage** no longer films over the character dashing away from the camera: afterimages blend in the opaque pass after the world and before the character that leaves them, which draws over them where they overlap.
