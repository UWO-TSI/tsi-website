# Avatar fit: face, hair and accessories sit on the head (row 242)

David (2026-09-28): "avatar eyes, mouth and accessories and hair/bangs looks detached and poorly modeled and needs more work." The v6 base proportions stay locked (row 233); this is about everything that sits on the head.

## Root cause (survey 2026-09-28, ranked)
1. **Hair is a zero-thickness sheet 4–6 cm off the scalp, and the engine culls its inside.** `kit.py:138-155` builds one quad sheet with open edges; bangs sit at offsets 0.044–0.058 m (`build_hair.py:42`), the back cap 0.038–0.05 m (`:144`); the forehead is 0.185 m from the head centre, so the fringe floats about 24% of the head radius off it. The GLBs are `doubleSided` but the engine swaps in `BODY_MATERIAL` (FrontSide, `Character.tsx:28`), so side locks read as paper slivers and the far side vanishes.
2. **v6 doubled the bangs offset to hide crown seams** (`build_v5.py:774` 0.022–0.041 → `build_v6.py:796`), so the fringe became a lid standing 1.4 cm proud of the cap at the crown, and the brows slide against its edge.
3. **The face is a flat front projection on a strongly curved head** (`build_v6.py:704-707, 965-968`): the eyes (1.5× scale, centres at ±0.115 m from a "/cos 25°" guess) reach 54° around the head with 1.7× stretch, so in 3/4 view the far eye slides onto the side; F1.1 renders as a flat grey disc; the 256 px canvas (`Character.tsx:229`) makes brows and mouth 2–4 px lines.
4. **Accessories inherit the inflated hair**: hats 6.6–9.6 cm off the scalp, the hat tuck is another culled sheet, glasses are pinned to the F1.1 eye centre (`build_accessories.py:46`).
5. **Review never saw the engine look**: Blender sheets render double-sided, level and orthographic, with different hair (`render_evidence.py:26, 88-89`); no fit tests exist.

## Deliverable
1. **Hair as closed, thick, conforming shells**: every bangs and back piece has real thickness (no open paper edges), hugs the scalp (about 0.8–1.5 cm off at the hairline, fuller volume toward the crown in the chunky ref-18 style), and its edges tuck slightly into the scalp so no gap shows from any angle. Bangs lie on the forehead; the bangs/back seam is hidden (bang roots tuck under the cap edge), with no crown ledge. Bangs and back stay separate pieces (row 191).
2. **The engine draws character parts correctly**: open or thin parts render double-sided (or are made closed); closed body parts can stay FrontSide.
3. **Face**: a projection that follows the head's curvature so features do not stretch and both eyes stay on the face in 3/4 view; re-measure eye spacing and scale on reference 18 instead of the "/cos 25°" guess; F1.1 reads as a proper eye (David's less-detailed preference, rows 172 and 192), not a grey disc; the face texture is sharp at game distance (at least 512 px in the world, 1024 in the creator); brows fully visible below the bang line (row 209).
4. **Accessories refit**: hats sit on the new hair surface (under 1 cm), the tuck is a closed thick shape, glasses follow the chosen eye set's centre per variant, circlet and crown sit on the new hair.
5. **Fit checks in the pipeline**: a script that measures the hair-to-scalp gap (max, median), the hat-to-hair gap and face-feature stretch, with thresholds that fail the build.
6. **Review in the engine**: evidence is captured in the game renderer (character creator, the game camera at village distance, and a 3/4 close-up) as well as Blender sheets.
7. Keep the catalogue ids stable so saved `avatar_config` rows keep working.

## Evidence
Before/after engine shots for every bangs style over three backs, each hat and glasses, the six expressions, and the game-camera view of six looks; fit-check numbers before/after. Art verdict is David's.
