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
| Bangs | 25–55 |
| Back | 92–236 |

Every piece is under 250.

## Fit rule

The back pieces are a full crown cap, with the face window open below lat 22° for |lon| < 61°. Bangs sit on top of the cap at a larger offset, so any bangs + back pair connects without gaps.

## Known limits / next pass

- **Sheet cells:** these are my nearest reading of each style on the labelled sheets, not David's picks per style.
- **Braided crown:** from the front it reads close to a hat band. It needs a flatter, plaited profile.
- **High ponytail:** thin from straight behind.
- **Wispy bangs:** in 3/4 view the tips of the far strands show a sliver above the crown.
- **Missing families:** braids and hats-with-hair (row 135) are not in this set yet.
