# Avatar v7

Rows 242, 252 and 254. The spec is `specs/avatar-v7.md`. David's picks:
- sculpted-lock hair
- an animated painted face
- the v6 body kept, with the head remodeled by hand
- review through `.blend` files and in-game sheets

Milestone 1 (the head, the face system, three styles) was approved with three tweaks (David, 2026-09-30): hair "Fuller, like the sheet", sheen "Stronger glossy band", mouths "Bigger talk shapes". Since then the whole library (16 bangs, 12 backs) is sculpted locks under its existing ids, and the hats and bands are refit on the fuller hair.

## Files

| File | What it is |
|---|---|
| `head.blend` | `V7_Head` (744 tris) with `CharacterRig` and the v6 body, top, bottom and head for comparison (collection `v6_reference`, hidden). |
| `hair_bangs.blend`, `hair_backs.blend` | The head plus every bangs (or back) piece as lock curves, one collection per catalogue id under `bangs` (or `backs`). These curves are the editable source. |
| `head_model.py` | The head's topology, UVs and skinning, run step by step in the live session. |
| `locks.py` | Turns curve locks into closed low-poly lock meshes: the sweep, densifying, root burying and hugging. |
| `hair_styles.py` | The seeds (first curves) of all 28 pieces, the under-cap volume (`GROOVE`, `CAP_FLOOR`), bun knots, and the hat tuck locks. |
| `hair_build.py` | Builds a piece from its lock curves (back pieces add their matte under-cap and knots); `gallery` lays pieces side by side for live review. |
| `export_hair.py` | Runs headless: reads both `.blend` files, writes the 28 GLBs and both catalogues' hair entries. |
| `split_blends.py` | Splits the live working file into the review files above. |
| `build_face.py` | Builds the face atlas, `face/face_v7.json`, and composed faces. |
| `face/` | `v7_face_atlas.png` (1024 px per face canvas), `v7_face_atlas_512.png` (the world copy), `face_v7.json`, and `v7_face_default.png` (the `.blend` preview). |

`hair/build_hair.py` (the parametric shell builder) is retired: it exits unless run with `--force-legacy`.

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
  - `hug`: rests on the head or not; `hug_from`: how near the scalp the spine must run for that to start (0.03 m; fringe locks 0.06, so they rest on the skin all along).

**The sweep (`locks.sweep`)** makes each lock a closed solid:
- Control points more than 12 deg apart along the scalp get points in between (`densify`, longitude unwrapped), so a lock never cuts a chord through the head.
- Catmull-Rom through the points.
- The section's flat side faces away from the head.
- A capped root and a pointed or cut tip.
- UVs run u across the lock and v from root (0) to tip (1).

**Against the actual `V7_Head` mesh:**
- Every **root ring** is sunk 3 mm under the skin, keeping its shape, so roots are buried whatever covers them.
- On **hugging locks** (bangs and face-framing locks), the underside, edges and tip rest 1 mm into the skin wherever the spine runs within `hug_from` of the scalp (fully by 1.8 cm).

**Volume ("Fuller, like the sheet").** `head_shape.hair_outer` is the hair's outer surface: lock tops reach about 3.2 cm over the scalp at the hairline and 4.3 cm at the crown. The median outer surface of the three milestone styles rose from 1.7-2.1 cm to 2.0-2.8 cm (`fit-v7.txt`). Back pieces lie on an under-cap `GROOVE` (12 mm) under that, so the grooves between locks read deep. The cap never comes nearer the scalp than `CAP_FLOOR` (10 mm), or skin flecks show through its sagging quads. The cap is matte (u = 0, no sheen), so the grooves stay dark. Pulled-back styles (`TIGHT`: pony, pigtails, buns) sit 8 mm tighter; the undercut's cap drops to the floor below lat 16-30 (the shaved sides).

**Bangs own the front crown.** Every bangs lock roots (buried) at the crown whorl and runs forward at full volume, over the hairline, down to the fringe. Bangs and back meet in buried roots, and the back pieces keep no locks at the front crown.

**The library.** All 16 bangs and 12 backs keep their catalogue ids (saved looks keep working):

| Slot | Ids | Locks | Tris |
|---|---|---|---|
| bangs | straight, straight_long, bowl, wispy, swept_l, swept_r, curtain, curtain_long, centre_split, spiky, hime, choppy, swept_back, single_strand, wavy, asym_block | 6-14 | 420-646 |
| back | bob, wolf, long, wavy_long, high_pony, pigtails, twin_buns, bun, braid_crown, short_spiky, undercut, bowl | 5-23 (+ bun knots) | 690-1110 |

Gathered styles (pony, pigtails, buns) take their locks from the crown for low ties and rise through the middle for high ties, with fanned roots. The buns are coiled locks around a knot blob.

**Under hats.** A hat that hides the back hair carries its own tuck: a cap at `hair_styles.cap_outer` in 24 deg columns plus seven short locks (`hair_styles.tuck`, segs 3) along the brim edge. Hats are laid at `hair_outer` plus clearance. Flower crown and circlet rest on the lock ridges of the worn default hair (`build_accessories.worn_top`).

**Budget.** Lock hair is at most 1,200 tris per piece, headwear at most 1,150 (`look.test.ts`). The base (skin and face, 1,264) plus the heaviest bangs (646) and back (1,110), the heaviest outfit (761) and glasses (208) is 3,989; with the heaviest hat in place of the back, 3,995. `look.test.ts` checks both stay under 4,000. A flower crown over the heaviest back, plus a bag and a scarf, reaches about 4,940.

**Sheen ("Stronger glossy band").** The merged body geometry carries `hairSheen = (1, u, v)` and `hairTangent` (the direction along the lock, from its UVs, `rig.lockTangents`) on lock hair. The body material (`faceMaterial.ts`) adds a Kajiya-Kay specular band along that tangent for each directional light, masked to thin streaks along the lock ridges (the centre line and two side lines), plus a small lift of the ring that faces up toward the viewer. The band is near-white, takes the light's colour and moves with the light; it is clamped so it never frosts the hair. Older parts without lock UVs (outfits) get zero tangents and no sheen.

**Editing:**
1. Open `hair_bangs.blend` or `hair_backs.blend`; each catalogue id is a collection of curves.
2. Move points, or change `radius` or the custom props.
3. Save, then run `export_hair.py`, `build_accessories.py` (the bands rest on the default hair) and `fit_check.py`.

## Face: animated painted face (item 3)

`build_face.py` redraws v6's measured drawings of David's picks (row 192), one side per cell. The engine mirrors eyes, brows, blush and freckles.

**Atlas contents:**
- 14 eye styles; every lidded eye has `open`, `half` and `closed` frames.
- 2 brows (white, tinted with the hair colour).
- 76 mouths (M picks plus the whole G grid).
- 4 talk cells (`layers.talk`, T1-T4).
- 3 extras.

**Atlas format:** 2048×1152 px at 1024 px per face canvas, with 16 px gutters whose colour is bled outward for mipmaps. The world loads the 512 copy. A cell is `[x, y, w, h, ax, ay]`, where `(ax, ay)` sits on the layer's anchor measured on reference 18: eye, brow, mouth, cheek, mole.

**Engine** (`web/lib/game/character/face.ts`, `faceMaterial.ts`):
- The face draws the skin colour plus seven slots: blush, freckles, mole, brows, right eye, left eye (mirror only) and mouth.
- Each slot is uniforms only: the atlas rect, where it lands on the canvas, a mirror mode, a tint, and a pose that moves and tilts the brows.
- Each character owns one material; they all share one program.

**Animation** (`FaceAnimator`):

| What | Behaviour |
|---|---|
| Blink | Half, closed, half (0.04 + 0.07 + 0.04 s), at random 2–6 s intervals. |
| Talking | The mouth steps through the talk cells T1-T4 and the look's own mouth about 9 times a second, never repeating a cell twice running. |
| Emotes | Laugh, Cheer and Dance cycle their own mouths. |
| Expressions | The six (row 144) pick eye and mouth cells and a brow pose. |

**Hooks:**
- `CharacterMotion.talk` (seconds of talking): NPC speech bubbles set it.
- `CharacterMotion.face` forces an expression, eye frame or mouth (portraits, the bench).

**Talk cells ("Bigger talk shapes").** T1 an open oval (M3.1's style), T2 an oval with teeth (M6.1), T3 a wide open smile (M2.1), T4 half open. They are drawn about 1.7x taller than those picks' proportions: the mouth sits where the face turns under toward the chin, so the camera sees it about half as tall as drawn. They grow upward so the lower edge stays above the jaw line. The resting mouth stays the look's own small mouth.

The bench at `/lab/avatar` shows all of it. `?sheet=bangs&back=<id>`, `?sheet=backs&bangs=<id>` and `?sheet=hats` show the library.

## Regenerate

**Head (only after hand edits in `head.blend`):**
```
Blender -b -P art/characters/base/build_clips.py -- head v7
```

**Hair, from the `.blend` curves:**
```
Blender -b -P art/characters/v7/export_hair.py
Blender -b -P art/characters/accessories/build_accessories.py   # hats, tucks; bands rest on the worn default hair
Blender -b -P art/characters/fit_check.py
```

**Face:**
```
Blender -b -P art/characters/v7/build_face.py [-- compose <dir>]
```

**Then:**
```
node web/scripts/sync-character-assets.mjs
git checkout web/public/assets/characters/v6/decal_tsi_mark.png   # the sync re-renders it byte-different
```

For live modeling, split the working file into the review files with:
```
Blender -b <work.blend> -P art/characters/v7/split_blends.py
```

## Fit (fit_check.py; numbers in specs/evidence/avatar-v7/fit-v7.txt)

**PASS, 0 fails, 0 flags.**
- All 28 pieces: 0 open edges, 0 exposed root vertices, locks never diving into the skin by more than 1.9 mm (limit 2), at most 2.7 mm of forehead or scalp showing under any piece (limit 4).
- Seams over the 192 bangs × back pairs: worst 13.2 mm, median 5.1 mm, the default pair 1.5 mm. Lock pairs are held to 14 mm (`seam_ledge_max_locks`: the 12 mm groove plus 2 mm). Where a bangs lock ends beside a back lock, the step reads as the same groove the hair has between any two locks. Shell pairs keep the 3 mm limit.
- Hats: 0 air, 0 poke; they rise 8-11 mm over the hair (median).
- Flower crown and circlet: 9.9 and 9.8 mm of air at most (in the grooves under the band), 0 and 0.2 mm of poke.
- Glasses: lens 2.7 mm from the eye centre by default, 8.5 mm worst.

The skin-through check (shell pieces whose flat rows sag into the head) has nothing left to flag: every piece is locks over a cap that keeps `CAP_FLOOR`.

## Known limits

- Hair-3d-set's hair is smooth and rounded; v7 keeps the low-poly rule (sharp lock edges, faceted sections), so it reads chunkier than the sheet up close.
- A few backs show a small step where a lower lock's tip sticks out under the layer above (bowl, short spiky, side view).
- Long hair is skinned 100% to the Head bone (as before), so it can pass through the shoulders in some clips.
