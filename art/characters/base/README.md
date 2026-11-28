# Base body builds

The v1 base body, the v2 reference girl and v3 to v5 (their builders, renders and outputs) were removed on 2026-11-28 (lane old-cleanup; rows 336, 337, 346 replace them). They are in git history. What stays: v6 below, `build_clips.py` and the shared shape modules.

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

# Face fit (avatar-fit, row 242)

David (2026-09-28): the eyes and mouth "look detached and poorly modeled". The v6 shape is untouched (vertex
positions identical, checked against the previous GLBs); the face texture, its UVs and the atlas changed.

- **Measured placement** (`measure_face_ref18.py` → `face_on_head` in `ref18_measurements.json`). Reference 18 is
  a 3/4 view; both iris centres and widths are fitted through the v6 head (orthographic 3/4 model, mouth on the
  centre line): view yaw 26°, eyes at lat −5.3°, lon ±30° (0.116 m of arc from the centre line), iris 0.068 m
  wide, 0.071 m tall, lid 1.8× the iris wide, mouth at lat −40°. This replaces the "/cos 25°" spacing guess.
- **Face UVs follow the head** (`head_shape.face_chart`): U and W are arc lengths along the parallel and the
  meridian, over the unchanged 2 FH canvas. The old front planar projection stretched features 1.3–2.4× toward
  the sides and put the far eye's outer end 63° round the head. Now the texture stretch is ≤1.06 under the eyes
  and brows and ≤1.1 under the mouth (`fit_check.py`), and the eyes reach 47° (visible at the 32° reference yaw).
  The chart runs past the canvas at the sides; the face texture is clamped there (skin).
- **Eyes** keep their authored shapes, scaled 1.2× (was 1.5× on the stretched chart), centred on the measured
  spots. The F eyes (F1.1 default) now tuck the iris under a lid that sits on it (the lid floated above a flat
  disc), F1.1's lid runs 1.8× the iris wide with a small outer wing, as on David's F sheet and reference 18. No
  highlight (row 209).
- **Brows** sit 0.063 m of arc above the eye centre (lat ≈ 2°), above F1.1's crease and below the default fringe
  (`brow_cover` 0 for `bangs_straight`); long bangs still cover them (row 209).
- **Resolution**: the atlas is drawn for a 1024 px face canvas (creator 1024, world 512; the world was 256), each
  cell cropped to its ink: 2048×1260, smaller than the old 2048×1444 at 512.
- The default face embedded in the GLBs stays 512 (Blender renders only; the engine composes its own).

Rebuild order after a face or head change: `build_v6.py` → `build_clips.py` → `hair/build_hair.py` →
`accessories/build_accessories.py` → `fit_check.py` → `web/scripts/sync-character-assets.mjs`.

## Fit check (`art/characters/fit_check.py`)

Runs in Blender on the exported GLBs in rest pose (what the engine binds) and exits 1 over a limit:

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/fit_check.py [-- --json out.json] [--no-fail] [--root <other art/characters>]
```

| Check | Limit | Before (d7a22995) | After |
|---|---|---|---|
| Hair open edges per piece | 0 | 16–40 | 0 |
| Air under hair, max per piece | 4 mm | 4.2–7.0 cm | 0 |
| Crown step where bangs meet a back cap (192 pairs) | 3 mm | 2.5 cm worst, 1.5 cm default | 0 |
| Default brows hidden by the default bangs | 5% | 0 | 0 |
| Hats: air over the hair / open edges | 1 cm / 0 | 6.4–7.6 cm / 50–98 | 0 / 0 |
| Hats and bands: outside over the hair, median | 1.4 cm | 1.5–6.7 cm | 0.9–1.2 cm |
| Glasses lens to painted eye, worst eye | 1.2 cm | 1.1 cm | 1.1 cm |
| Face texture stretch under features | 1.2 | 2.39 | 1.10 |
| Face anisotropy under features | 1.25 | 2.39 | 1.20 |
| Eye reach round the head (azimuth) | 55° | 63° | 51° |

The table is `specs/evidence/avatar-fit/fit-summary.txt` (made by `fit_summary.py` there). Air is measured along rays
from the head centre: zero when the scalp point is inside a closed piece (winding), else the distance to the first
surface beyond it; a gap must show on neighbouring rays too, so a ray grazing an edge wall is not air.
