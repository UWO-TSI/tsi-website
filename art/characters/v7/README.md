# Avatar v7, milestone 1

Rows 242, 252 and 254. The spec is `specs/avatar-v7.md`. David's picks:
- sculpted-lock hair
- an animated painted face
- the v6 body kept, with the head remodeled by hand
- review through `.blend` files and in-game sheets

This milestone covers the head, the face system, and three hairstyles. The other 13 bangs and 9 backs stay as they were until David approves.

## Files

| File | What it is |
|---|---|
| `head.blend` | `V7_Head` (744 tris) with `CharacterRig` and the v6 body, top, bottom and head for comparison (collection `v6_reference`, hidden). |
| `hair_short.blend`, `hair_bob.blend`, `hair_long.blend` | The head plus one style, in a collection `hair_<style>`. The lock curves sit in `<style>_bangs` and `<style>_back`, hidden: unhide them to edit. The generated meshes are named with their catalogue ids. |
| `head_model.py` | The head's topology, UVs and skinning, run step by step in the live session. |
| `locks.py` | Turns curve locks into closed low-poly lock meshes: the sweep, root burying and hugging. |
| `hair_styles.py` | The seeds (first curves) of the three styles. |
| `hair_build.py` | Builds a piece from its lock curves plus an under-cap. |
| `export_hair.py` | Runs headless: reads the `hair_*.blend` curves, writes the six GLBs and both catalogues. |
| `split_blends.py` | Splits the live working file into the review files above. |
| `build_face.py` | Builds the face atlas, `face/face_v7.json`, and composed faces. |
| `face/` | `v7_face_atlas.png` (1024 px per face canvas), `v7_face_atlas_512.png` (the world copy), `face_v7.json`, and `v7_face_default.png` (the `.blend` preview). |

## Head (item 1)

Modeled in the live Blender window through the MCP bridge, with a viewport screenshot after each step. Each step is a function in `head_model.py`:

1. **`step_grid`**: a lat/lon grid laid out on the features.
   - A row through the eye centres (lat `EYE_LAT`) and a row through the mouth (`MOUTH_LAT`).
   - Columns every 10 deg across the face, including the eye centres (lon ±30) and the centre line; 16–22 deg round the back.
   - Pole fans only at the crown and under the chin (inside the neck).
2. **`step_loops`**: refills three blocks with concentric loops.
   - Each eye: a 4×2 block refilled with two 12-vertex loops (ellipses in face-canvas space, each sized by its own side of the block) and a 6-quad cap on the eye centre.
   - The mouth: a 2×2 block with two 8-vertex loops and a 4-quad cap.
3. **`step_finish`**: normals out, smooth shading, face-chart UVs and skinning.
   - `M_Face` covers lon ±82 and lat −76..49, UV'd by `head_shape.face_chart` (arc lengths over the head, so a painted layer keeps its size everywhere on it).
   - The rest is `M_Skin`.
   - `COLOR_0` is 1, and the whole head is 100% on `mixamorig:Head`.
4. **`step_straddle`**: flat quads cut inside the curved surface (v6 sagged up to 7.4 mm), so every vertex moves out along its ray by half its faces' mean sag. The shell then straddles the analytic surface.

**Result, measured against `head_shape`'s analytic surface (`head_model.deviation`):**
- Up to 4.0 mm inside and 3.3 mm outside, median 0.5 mm.
- The neck seam is within 0.4–0.8 mm of v6's.
- No folded quads, no n-gons.

**Face UV distortion under painted features (fit_check):** stretch 1.119, anisotropy 1.188 (v6: 1.104 and 1.196).

**Engine path:** `build_clips.py -- head v7` swaps `V6_Head` for `V7_Head` in the clip build. It writes `base/v7_clips.glb` (same body, rig and 31 clips), and the catalogue's `base.clips_glb` points there.

## Hair: sculpted locks (item 2)

**A lock** is a POLY-spline curve in the `.blend`:
- **Points** are the spine: `radius` is the half width, `tilt` twists the section.
- **Custom properties:**
  - `flat`: section thickness / width.
  - `segs`: segments along the lock.
  - `sides`: 4 (a diamond: sharp side edges, soft ridge) or 5 (flatter underside).
  - `blunt`: 0 is a point, 0.85 a cut end.
  - `hug`: rests on the head or not.

**The sweep (`locks.sweep`)** makes each lock a closed solid:
- Catmull-Rom through the points.
- The section's flat side faces away from the head.
- A capped root and a pointed or cut tip.
- UVs run u across the lock and v from root (0) to tip (1).

**Against the actual `V7_Head` mesh:**
- Every **root ring** is sunk 3 mm under the skin, keeping its shape, so roots are buried whatever covers them.
- On **hugging locks** (bangs and face-framing locks), the underside, edges and tip rest 1.5 mm into the skin wherever the spine runs within 1.8–3 cm of the scalp.

**Back pieces** add an under-cap (`kit.hair_cap` at 0.9 of `hair_vol`) so no scalp shows between locks from any angle. Over the crown, lock tops stand `RELIEF` (6 mm) above the library's hair volume, which gives about 7 mm of lock relief, and the bands and crowns fitted to that volume still rest on top.

| Style | Ids (existing, replaced) | Refs | Locks | Tris (bangs + back) |
|---|---|---|---|---|
| short | `bangs_spiky` + `back_short_spiky` ("Short layered") | B6.2, B1.3, B3.4 | 8 + 12 (2 crown tufts) | 380 + 978 |
| bob | `bangs_straight` + `back_bob` | B2.1, B6.4, N4.2 | 9 + 9 | 450 + 930 |
| long | `bangs_curtain` + `back_long` | B3.1, B5.3, N3.2 | 8 + 9 | 480 + 1002 |

**Full look:** the base (skin and face, 1264) plus the heaviest style, top, bottom, shoes and glasses stays under 4,000 tris. `look.test.ts` checks this.

**Sheen band (engine):** the merged body geometry carries `hairSheen = (1, u, v)` on lock hair (`rig.ts`). The body material (`faceMaterial.ts`) lightens a streak down each lock's ridge where its surface faces up toward the viewer, before lighting, so it takes the palette hair colour and the scene light. Older shell styles and hat tucks have no lock UVs and keep their plain look.

**Editing:**
1. Open `hair_<style>.blend` and unhide `<style>_bangs` / `<style>_back`.
2. Move points, or change `radius` or the custom props.
3. Save, then run `export_hair.py` and `fit_check.py`.

`build_hair.py` leaves these six ids alone.

## Face: animated painted face (item 3)

`build_face.py` redraws v6's measured drawings of David's picks (row 192), one side per cell. The engine mirrors eyes, brows, blush and freckles.

**Atlas contents:**
- 14 eye styles; every lidded eye has `open`, `half` and `closed` frames.
- 2 brows (white, tinted with the hair colour).
- 76 mouths (M picks plus the whole G grid).
- 3 extras.

**Atlas format:** 2048×1088 px at 1024 px per face canvas, with 16 px gutters whose colour is bled outward for mipmaps. The world loads the 512 copy. A cell is `[x, y, w, h, ax, ay]`, where `(ax, ay)` sits on the layer's anchor measured on reference 18: eye, brow, mouth, cheek, mole.

**Engine** (`web/lib/game/character/face.ts`, `faceMaterial.ts`):
- The face draws the skin colour plus seven slots: blush, freckles, mole, brows, right eye, left eye (mirror only) and mouth.
- Each slot is uniforms only: the atlas rect, where it lands on the canvas, a mirror mode, a tint, and a pose that moves and tilts the brows.
- Each character owns one material; they all share one program.

**Animation** (`FaceAnimator`):

| What | Behaviour |
|---|---|
| Blink | Half, closed, half (0.04 + 0.07 + 0.04 s), at random 2–6 s intervals. |
| Talking | The mouth steps through `talk.frames` and the look's mouth about 9 times a second, never repeating a cell twice running. |
| Emotes | Laugh, Cheer and Dance cycle their own mouths. |
| Expressions | The six (row 144) pick eye and mouth cells and a brow pose. |

**Hooks:**
- `CharacterMotion.talk` (seconds of talking): NPC speech bubbles set it.
- `CharacterMotion.face` forces an expression, eye frame or mouth (portraits, the bench).

The bench at `/lab/avatar` shows all of it.

## Regenerate

**Head (only after hand edits in `head.blend`):**
```
Blender -b -P art/characters/base/build_clips.py -- head v7
```

**Hair, from the `.blend` curves:**
```
Blender -b -P art/characters/v7/export_hair.py
Blender -b -P art/characters/accessories/build_accessories.py   # bands rest on the worn default hair
Blender -b -P art/characters/fit_check.py
```

**Face:**
```
Blender -b -P art/characters/v7/build_face.py [-- compose <dir>]
```

**Then:**
```
node web/scripts/sync-character-assets.mjs
```

For live modeling, split the working file into the review files with:
```
Blender -b <work.blend> -P art/characters/v7/split_blends.py
```

## Fit (fit_check.py; numbers in specs/evidence/avatar-v7/fit-v7.txt)

**PASS on all gates.**
- The six lock pieces: 0 open edges, 0 air under them, 0 exposed root vertices, locks never diving into the skin (0–0.9 mm).
- The crown seam: 0 mm on all 192 bangs × back pairs.
- Flower crown and circlet: 9.9 and 9.8 mm of air, 0 poke. They are laid on the worn default hair with `build_accessories.worn_top`, and the blossoms sit on lock ridges.

**New check (skin standing out through a shell piece):** reported as FLAGs for the older library. Its long side locks and the undercut's shaved rows are 18–36 deg flat rows that sag into any head; six of them had this on v6 already. They are rebuilt as locks after review.

## Known limits

- Hair-3d-set's hair is a smooth, fuller mass with strong sheen. v7 keeps the low-poly rule (sharp lock edges, about 7 mm of relief), so it reads a little flatter than the sheet.
- Talking mouths are David's small cells (M1.1 size). At village distance, talking reads mainly as motion.
- Long hair is skinned 100% to the Head bone (as before), so it can pass through the shoulders in some clips.
