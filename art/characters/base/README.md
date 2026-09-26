# Base body v1 (deliverable 1)

A neutral base character in the #18 style: low-poly, fully faceted, flat-shaded, about 2.8 heads tall (1.13 m, head 0.40 m). It has a painted face atlas and solid palette materials. Built entirely by `build_base_body.py`. Nothing in the .blend was edited by hand.

## Rebuild

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_base_body.py
node web/scripts/character-inspect.mjs art/characters/base/base_body.glb
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_turntable.py -- /tmp/frames mp4
ffmpeg -y -i /tmp/frames/sheet_%02d.png -filter_complex tile=8x2 art/characters/base/turntable_contact.png
ffmpeg -y -framerate 24 -i /tmp/frames/tt_%03d.png -c:v libx264 -pix_fmt yuv420p -crf 20 art/characters/base/turntable.mp4
```

The render script imports the GLB, not the .blend, so the review frames check the export.

## Numbers (from character-inspect)

- **Triangles:** 682. Every triangle has flat vertex normals except 4 slivers at the head poles.
- **GLB size:** 149 KB, including the 512x512 PNG face atlas.
- **Bounds:** feet on y=0. The character faces +Z in glTF/three.js, which is -Y in Blender.
- **Materials:** one mesh with six primitives:
  - `M_Skin`
  - `M_Face` (atlas texture)
  - `M_BaseTop`
  - `M_BaseBottom`
  - `M_Socks`
  - `M_Shoes`

  Colours come from `../palette.json` → `base_body_defaults` (skin index 3, top cream, bottom sage, socks white, shoes yellow).

## Bones (22, Mixamo names, no facial bones)

`mixamorig:` + Hips, Spine, Spine1, Spine2, Neck, Head, and for each side Left*/Right* Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase.

- The rest pose is a T-pose with bone roll 0.
- three.js's PropertyBinding strips the `:` from these names (`mixamorigHips`), the same as for real Mixamo GLBs.
- Mixamo or CC0 clips still need `SkeletonUtils.retargetClip`, because rest orientations differ from Mixamo's.

## Sockets

Empties parented to bones, exported as child nodes of the joints:

- `Socket_R_Hand` on `mixamorig:RightHand`
- `Socket_L_Hand` on `mixamorig:LeftHand`
- `Socket_Back` on `mixamorig:Spine2`, behind the back

Their orientation is identity. Per-weapon grip offsets come later.

## Clips (30 fps, keyed every frame, last frame = first frame)

- `Idle`: 2.0 s. Breath through the spine, a slow hip sway, a head tilt, and the arms drifting slightly.
- `Walk`: 1.0 s, two steps. Bouncy toy waddle:
  - hip bob that dips sharply at contact
  - side sway and lean over the stance foot
  - hip twist
  - knee lift on the swing leg
  - opposite arm swing with an elbow bend
  - head nod

  It walks in place. Root motion is left to the engine.

## Face atlas

`face_atlas.png` is 512x512. One row of six square frames runs across the top in this order: neutral, happy, surprised, sad, angry, sleepy.

- The face UVs point at frame 0. To switch expression: `map.offset.x = i / 6`.
- The GLB embeds the atlas with the default skin baked in.
- `face_atlas_mask.png` has the same features on transparency. For another skin tone, fill a canvas with that tone, draw the mask over it and use the canvas as the texture (see `specs/character-set-questions.md` #2).
- The atlas is painted procedurally in the build script. No Higgsfield credits were spent, and it is not a likeness of any real person.

## Files

- `build_base_body.py`: the source of truth
- `render_turntable.py`: renders the review frames
- `base_body.blend`
- `base_body.glb`
- `face_atlas.png`
- `face_atlas_mask.png`
- `turntable_contact.png`:
  - row 1: Idle at 8 yaw angles
  - row 2: 8 Walk frames in 3/4 view
- `turntable.mp4`: 4 s, walking in place while turning 360°

---

# v2 reference girl (recreation of #18)

David rejected v1 ("everything is wrong, it doesn't have the proportions"). v2 recreates reference #18 from the modelling description in `specs/character-set.md`. The reference image itself was not in `specs/references/characters/` when this was built, so it has not been compared against the picture directly.

## Rebuild

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_ref_girl.py
node web/scripts/character-inspect.mjs art/characters/base/ref_girl.glb
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_turntable.py -- /tmp/ref ref glb=ref_girl.glb mp4
ffmpeg -y -i /tmp/ref/sheet_%02d.png -filter_complex tile=8x2 art/characters/base/ref_girl_contact.png
ffmpeg -y -framerate 24 -i /tmp/ref/tt_%03d.png -c:v libx264 -pix_fmt yuv420p -crf 20 art/characters/base/ref_girl.mp4
```

## Numbers

- **Triangles:** 732 (budget ≤ 1200). All 732 are flat-normal, because the mesh is triangulated before export.
- **GLB size:** 185 KB.
- **Height:** 0.99. The hooded head runs from 0.555 to 0.99, which is 44% of height (about 2.3 heads). The hood is 0.53 wide against a 0.43 hem, so the head is wider than the body.
- **Head and hood:** about 250 triangles (one teardrop shell with a recessed face oval and a horseshoe rim), plus 16 for the bangs and 4 for the nose.
- **Materials:**
  - `M_Skin`
  - `M_Face` (atlas)
  - `M_Hood` (#7FBFEA)
  - `M_Underskirt` (#E27AB0)
  - `M_Hair` (#6B3A22)
  - `M_Nose` (#FBE3CF)
  - `M_Socks`
  - `M_Shoes` (#F0D24A)
  - `M_Sole` (#C9A63A)

  All come from `palette.json`: `ref_girl_defaults` and `derived`.
- **Vertex-lit look:** `COLOR_0` carries a per-corner gradient: each part is lighter at the top, and the hood lining is darker (×0.72). three.js multiplies it into the base colour.
- **Rig, sockets and clips:** as in v1, re-fitted to the new proportions: 22 `mixamorig:` bones; `Socket_R_Hand`, `Socket_L_Hand` and `Socket_Back`; `Idle` 2 s and `Walk` 1 s.
- **Motion:**
  - The hem and underskirt are weighted 35–45% to the UpLegs, so the bell sways with each step.
  - The hood is on the Head bone, which rolls and nods against the body on the walk.
- **Face atlas:** `ref_face_atlas.png` and `ref_face_atlas_mask.png`, laid out and swapped as in v1 (six frames, `offset.x = i / 6`).
- **Review files:**
  - `ref_girl_34.png`: 3/4 front hero shot, camera just below eye level, mid-stride
  - `ref_girl_contact.png`:
    - row 1: Idle at 8 angles, starting at the 3/4 front
    - row 2: 8 Walk frames from the 3/4 front
  - `ref_girl.mp4`: turntable while walking

## Self-review against the description (what still differs)

- **Face oval:**
  - The top corners are squarer than an oval, because the face follows the hood's ring grid.
  - The chin is a straight lower edge rather than a rounded one.
- **Hood crown:** there is a slight pinch at the top centre where the rings converge. From the side it reads as a teardrop with a soft point at the top back, as described.
- **Bangs:** they read as a zigzag fringe, all about the same length. The reference has 3–4 distinct chunks of clearly different lengths.
- **Eyes:** these are still my interpretation. They are about a quarter of face width and tilted down toward the nose, with iris, pupil, rim and catchlight. They may need to be bigger or darker once David compares them to the image.
- **Vertex gradient:**
  - It is subtle (0.8–1.0) and hard to see in the EEVEE preview.
  - I have not seen it in three.js yet.
  - The reference's gradient may be stronger.
- **Sleeves:** they read as cape shoulders with the hands poking out, not as distinct wide sleeves.
- **Shoes:** chunky and rounded, but closer to a faceted clog than a slip-on.
- **Bag:** omitted, as the spec asks. The pose uses relaxed hands.

---

# v3 simple-cute head + face system

Built from David's sheets in `specs/references/characters/david/` only. Source: `build_v3.py`. Renders: `render_v3.py`.

## Rebuild

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_v3.py -- /tmp/v3var
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_v3.py -- /tmp/v3r /tmp/v3var mp4
ffmpeg -y -i /tmp/v3r/var_%02d.png -filter_complex tile=4x3 art/characters/base/v3_face_variants.png
ffmpeg -y -i /tmp/v3r/sheet_%02d.png -filter_complex tile=8x2 art/characters/base/v3_contact.png
ffmpeg -y -framerate 24 -i /tmp/v3r/tt_%03d.png -c:v libx264 -pix_fmt yuv420p -crf 20 art/characters/base/v3.mp4
```

## What's in v3.glb (1297 tris, cap 1500)

The rig, sockets and Idle/Walk clips are the same as v2. There are six skinned meshes:

| Mesh | Tris | Notes |
|---|---|---|
| `V3_Head` | 396 | smooth-shaded, see below |
| `V3_Body` | 390 | v2 cape-dress, underskirt, sleeves, hands, legs and socks, plus a short neck |
| `V3_Hood` | 206 | outfit piece: the v2 shell with the face opening cut and resized to clear the new head |
| `V3_Shoes` | 96 | their own mesh, so shoes can be the fifth outfit slot |
| `V3_HairBangs` | 77 | straight-cut fringe with side locks (N sheet family) |
| `V3_HairBack` | 132 | chunky bob (B sheet family) with the face window open |

- **Head:** a squashed egg, wider than tall, with full cheeks and a soft flat chin. It is smooth-shaded with no facets on the face. Its `M_Face` front region uses a planar UV into `v3_face_default.png`.
- **Hair:** both hair meshes are faceted, double-sided and weighted to the Head bone.
- **Hood and hair:** when the hood is shown, hide `V3_HairBack`, because it clips through the hood.
- **Gradient:** `COLOR_0` now runs 0.64–1.0 per part, with the hood lining ×0.62. The head and neck stay at 1.0 so the face texture matches the skin.

## Face system

`face_variants.json` plus `v3_face_features.png` (a 2048×1236 atlas).

**Layers** (in draw order):
- `extras`: optional and stackable. Blush, mole, freckles.
- `brows`: `brow_soft` (default) and `brow_flat`. Drawn white and multiplied by the hair colour.
- `eyes`: 14 picks. F1.1 (default), F1.2, F2.1, F2.2, E1.1, E1.2, E1.4, E1.6, E5.4, E5.5, E5.6, E6.1, E8.1, E8.4.
- `mouth`: 76. The 13 picked M cells (default M1.1, the "H" bracket) plus G1.1–G9.7.

**Engine compose:** fill the skin colour, then draw each layer's atlas rect into its destination rect on a 512 canvas, and use the result as the `M_Face` map.

**Placement:**
- Eyes are drawn at 1.38× the authoring size, wide apart (u 0.27 / 0.73) in the lower half of the face (w 0.615).
- The mouth is small and low (w 0.785). There is no nose.

**Features are hand-drawn vector shapes** in the build script (numpy raster, 4× supersampled), not traced from the sheets. G mouths are parametric approximations of each sheet row.

## Review files

- `v3_face_34.png`: the #18 camera with the hood up (back hair hidden).
- `v3_face_34_hair.png`: the same angle with the hood down.
- `v3_front.png`: front view, hood down.
- `v3_face_variants.png`: head close-up, hood down. Faces are in file-name order:
  - row 1: E1.1+M1.1, E1.1+M2.1, E1.4+M1.1, E1.4+M2.1
  - row 2: E5.5+M1.1, E5.5+M2.1, F1.1+M1.1, F1.1+M2.1
  - row 3: F1.2+M1.1, F1.2+M2.1, F2.2+M1.1, F2.2+M2.1
- `v3_contact.png`: row 1 is Idle at 8 angles, hood up; row 2 is 8 Walk frames.
- `v3.mp4`: turntable while walking.

## Known differences / open points

- **Hood up:** the face reads a little flat and mask-like inside the hood, and the opening's side edge is straight rather than oval.
- **Hair:** the bob is heavy and helmet-like compared with the B sheet's tufted masses. The fringe tufts are shallow zigzags, not separate strands.
- **Walk:** the hood/hair sway comes only from Head bone motion.
- **F-style eyes:** the lids are my simplification of the sheet strokes. None of the F eyes has a highlight, matching the sheet.

---

# v4 soft surfacing (from build_v3.py)

David's verdict on v3 was "full of triangles". v4 keeps v3's head, face system, proportions and two-part hair, and changes the surfacing. `build_v3.py` now emits the v4 files (`v4.glb`, `v4.blend`, `v4_face_default.png`, `v4_face_features.png`, `face_variants.json`), and `render_v3.py` renders them. Rebuild commands are the same as v3, using `/tmp/v4var` and `/tmp/v4r`.

## Changes from v3

- **No triangulation, no vertex jitter.** Every face is smooth-shaded. An edge stays hard only when its dihedral angle exceeds a per-part threshold (`SHARP_DEG`):

  | Parts | Threshold |
  |---|---|
  | Hood | 28° |
  | Dress and underskirt | 34° |
  | Bangs | 32° |
  | Sleeves, back hair | 50° |
  | Shoes | 60° |
  | Head, neck, hands, legs | fully smooth |

- **Hood:** 10 longitudes instead of 14. It reads as about 6 big gore planes plus the lining. The opening is oval (tapered rim and an arched brim), and the hood is snug (scale 1.01).
- **Dress:** 8 panels.
- **Hair:** bangs are 7 chunky strands with deep tufts; back hair is 10 columns with a tuft on every other strand. Total 117 tris, down from 209.
- **Vertex gradient:** stronger, 0.56–1.0 per part.
- **Total:** 1131 tris.
- **David's answers applied:**
  - F eyes have no highlight.
  - Brows sit partly under the bangs.
  - `V4_HairBack` is hidden whenever a hood or hat is worn (the hood render shows this).

## Review files

- `v4_face_34_hood.png`
- `v4_face_34_hair.png`
- `v4_front.png`
- `v4_face_variants.png` (same order as v3)
- `v4_contact.png`
- `v4.mp4`
- `v4_vs_ref18.png`: the #18 crop on the left, v4 with the hood up on the right.

## Still differs from #18

- **Hood colour:** the reference hood is a deeper, more saturated blue (roughly #5E9ED6) than palette #7FBFEA.
- **Face size:** in the reference the face fills more of the hood opening, and the face is larger relative to the hood.
- **Bangs:** the reference bangs are longer, darker chunks.
- **Hair crown:** the back-hair crown shows small notches at the apex in close-up.
- **Pose:** the reference is mid-stride; the comparison render is Idle.

---

# v5 naked base body, measured from #18

David's verdict on v4: the outfit is an accessory, and the head and body proportions were off. v5 is the base body only: skin, a neutral cream undergarment zone and bare feet. It carries the v4 face system (14 eyes / 76 mouths / brows / extras, no nose, brows partly under the bangs) and the two-part hair. There is no hood, dress or shoes.

## Files

| Role | Files |
|---|---|
| Source | `build_v5.py` (from `build_v3.py`; reads `ref18_measurements.json`), `render_v5.py`, `compare_v5_ref18.py` |
| Outputs | `v5.glb`, `v5.blend`, `v5_face_default.png`, `v5_face_features.png`, `face_variants.json` (rewritten for the v5 face canvas) |
| Renders | `v5_face_34.png`, `v5_front.png`, `v5_face_variants.png`, `v5_contact.png`, `v5.mp4`, `v5_vs_ref18.png` |

Total: 1004 tris.

- `V5_Body`: 504
- `V5_Head`: 396
- `V5_HairBangs`: 35
- `V5_HairBack`: 69

## Rebuild

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/build_v5.py -- /tmp/v5var
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/base/render_v5.py -- /tmp/v5r /tmp/v5var mp4
python3 art/characters/base/compare_v5_ref18.py /tmp/v5r     # prints LINE_ERR_% and writes compare.png
```

## Measurements

`ref18_measurements.json` holds the pixel values, assumptions and ratios. Body height = bare head top (y 58, i.e. the hood minus ~5%) to the sole (y 758) = 700 px.

| Measurement | Ratio of body height |
|---|---|
| Head height | 0.449 |
| Head width | 0.454 |
| Face oval | 0.383 wide × 0.346 tall |
| Eye centre | 0.729 above the sole |
| Eye width (near eye) | 0.114 |
| Eye spacing (frontal estimate) | 0.23 |
| Mouth | 0.604 above the sole |
| Chin | 0.551 above the sole |
| Shoulder line | 0.483 above the sole |
| Body shoulder width (estimate) | 0.30 |
| Hem | 0.219 above the sole |
| Crotch (estimate) | 0.269 above the sole |
| Hand | 0.079 × 0.064 |

Derived: head width is 1.5× the shoulder width, and the eyes sit 60% of the way down the head.

## Guide-line check (`v5_vs_ref18.png`)

Error as % of height:

| Line | Error |
|---|---|
| Eye | +0.43 |
| Chin | +0.04 |
| Hem | −0.04 |
| Sole | 0 |

All are within the 3% target.

- The eye line is detected from the dark eye pixels in the render.
- Chin, hem and sole come from the model geometry through the level orthographic camera, so they confirm placement rather than independently re-measure it.
- "Hem" on the base body is the undergarment's lower edge, placed at the reference dress hem.

## Known gaps

- **Body under the cape:** the reference hides it, so torso width, crotch and shoulder width are estimates (listed in the JSON assumptions).
- **Face vs reference:** the reference face oval is rounder and fuller at the cheeks than ours.
- **Hair side locks:** in close-up they leave small skin slivers and a dark gap by the near cheek.
- **Mouth placement:** the mouth sits low (as measured), close to the chin.

---

# v6 base body: #18 head shape, clean seams, tee + shorts

David's feedback on v5 had three points: the head needs a wider lower half and a lower face pulled forward, the panels need to connect cleanly, and the base layer should be a tee and shorts. v6 is built from `build_v6.py` (derived from `build_v5.py`), rendered with `render_v6.py` and checked with `compare_v6_ref18.py`.

## Changes

- **Head (`head_point`):**
  - A jaw term widens the lower half by up to 13%, easing into a soft chin.
  - The upper half is 5% narrower.
  - A muzzle term pushes the lower face forward by up to 16% in profile.
  - The width is re-calibrated so the widest point (the jaw/cheeks) still equals the measured 0.454.
  - z is untouched, so the eye and chin lines are unchanged.
- **Hair seams:** the back hair is now a full cap above lat 22°, and the bangs lie on top of it (offset 0.044–0.056), so the crown has no gaps or skin slivers. The side locks overlap the back-hair side panels at lon 72–80°.
- **Neck:** it flares into the jaw, so there is no ledge under the chin.
- **Tee and shorts:** separate meshes. `V6_Top` is the tee (cream, short sleeves, open neck). `V6_Bottom` is the shorts (warm wood, seat plus legs to the reference hem line). Both are shells 7 mm over the skin. `V6_Body` is all skin, so either piece can be swapped out.

## Numbers and checks

- **Total:** 1286 tris.

  | Mesh | Tris |
  |---|---|
  | Body | 520 |
  | Top | 144 |
  | Bottom | 114 |
  | Head | 396 |
  | Bangs | 35 |
  | Back hair | 77 |

- **Guide-line errors:** eye +0.43%, chin +0.04%, hem −0.04%, sole 0%.

## Renders

- `v6_face_34.png`
- `v6_front.png`
- `v6_profile.png`
- `v6_head_closeups.png` (3/4, profile, back 3/4)
- `v6_face_variants.png`
- `v6_contact.png`
- `v6.mp4`
- `v6_vs_ref18.png`

## Remaining

- **Muzzle:** the side locks hide it in the profile view. It reads best in the front and 3/4 views.
- **Sleeves:** the tee sleeve hem crumples slightly at the armpit in the arms-down pose.
- **Crown:** a small tuft stands proud at the top of the crown in profile.
