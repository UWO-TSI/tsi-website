# Hair library (deliverable 2)

Covers rows 135, 191 and 192: two independent slots, bangs and back.

- **Bangs** come from the N sheet families.
- **Back** styles come from the B sheet families.
- **Silhouettes** follow the S sheet: a few chunky masses that are smooth by angle (edges over 40° stay sharp), with a handful of sharp tufts.
- **Colour:** all pieces share one material, `M_Hair`, tinted at runtime from `palette.json` hair colours. Each piece has a `COLOR_0` top-light gradient.

## Regenerate

```
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/characters/hair/build_hair.py -- render /tmp/hair
python3 art/characters/hair/make_sheets.py /tmp/hair
```

- **Head:** every piece is generated on `art/characters/base/head_shape.py`, which is driven by `ref18_measurements.json`. A head tweak there regenerates the whole library.
- **Kept in sync:** `head_shape.py` is the same maths as `build_v6.py`'s `head_point`. v6 keeps its own copy while it is under review.

## Files

- `bangs/<id>.glb` (16) and `back/<id>.glb` (12).
  - Each file holds the 22-bone CharacterRig plus one mesh skinned 100% to `mixamorig:Head`.
  - In three.js, bind it to the character with `SkinnedMesh.bind(character.skeleton)`, matching bones by name.
- `hair_catalog.json`: id, name, nearest sheet cell and triangle count for every piece.
- `hair_bangs_sheet.png`: each bangs style shown with `back_bob`, front and 3/4 views.
- `hair_back_sheet.png`: each back style shown with `bangs_straight`, 3/4 front and 3/4 back views.

## Budget

| Slot | Triangles per piece |
|---|---|
| Bangs | 102–194 |
| Back | 354–586 |

Every piece is under 700. About a third of each count is hidden inside the head (the walls under the scalp and the
fan that closes the solid); the visible surface is 60–110 tris for bangs and 300–420 for backs. The back caps use 15° columns because a
flat quad over the scalp sags by more than the hair is thick at 30° (skin showed through the middle of each quad).

## Fit (avatar-fit, row 242)

David (2026-09-28): the hair "looks detached and poorly modeled". It was a zero-thickness sheet 4–6 cm off the scalp,
and the engine culled its inside. Now:

- **Closed solids.** Pieces built over the scalp are closed by `kit.Piece.close_fan`: a wall from every open edge
  down to 4 mm inside the scalp (`head_shape.INNER`) and a fan from there to the head centre, all hidden inside the
  head. Tips are wedges, spikes, buns and tubes are closed, long lengths are 12 mm slabs (`thicken`). No paper
  edges, and back-face culling cannot hollow a piece.
- **On the scalp.** The outer surface follows `head_shape.hair_vol`: 0.9–1.1 cm off the scalp at the fringe and the
  hem, 2.4 cm at the crown.
- **One seam rule.** Back caps (`kit.hair_cap`) cover the crown down to `head_shape.hairline` (44° above the brows,
  22° at the temples, 60° wide face window) and every cap comes down to the same height there (`kit.seam_off`).
  Bangs have four rows: the fringe on the forehead, a middle row that bellies out a little, the hairline row 1 mm
  under the seam height, and the roots 12° behind it under the cap. The cap's front edge runs 5 mm under the seam
  height, i.e. under the bangs, and rises through them behind the hairline. Side locks lie on the cap's side panels
  and dive under it at the hairline. So neither piece shows an edge at the crown (seam step 0 on the default pair,
  ≤3 mm on all 192).
- **Shading.** One COLOR_0 gradient over the head height for every piece (`zrange`), so pieces that meet shade alike.
- **Checked** by `art/characters/fit_check.py` (hair gap, open edges, crown ledge over all 192 bangs × back pairs).

## Known limits / next pass

- **Sheet cells:** these are my nearest reading of each style on the labelled sheets, not David's picks per style.
- **Braided crown:** from the front it reads close to a hat band. It needs a flatter, plaited profile.
- **High ponytail:** thin from straight behind.
- **Missing families:** braids and hats-with-hair (row 135) are not in this set yet.
