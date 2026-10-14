# Head-roblox: the v9 head, David's hairstyles attached the Roblox way

Ledger rows 305 and 309, decision 1 of playtest round 1. Branch `game/head-roblox`.

**What David asked for (2026-10-14):**
- "hair is super messed up, does not fit head properly ... change the headshape so that it universally fits with roblox hair or do something about the hair so that you dont need to remodel each hair one by one and makes it look good like how they look originally".
- He chose: our head takes the Roblox head's shape where hair sits, and every hair attaches at the point and scale it has in Roblox. The face area stays ours.
- After the early sheet: "Approve, round the cheeks".
- Then: "hair honestly just import the new set and get rid of the old ones, refine head logic so it fits roblox hair logic but still looks like our style".

Every number below comes from the scripts named. The evidence is in `specs/evidence/head-roblox/`.

## 1. The head the hairs were made on

**It is Roblox's classic head.** The evidence:

| What | Finding |
|---|---|
| The accessory files Roblox serves publicly (#1, #6, #11; the other 18 need a login) | A Handle Part with a SpecialMesh (FileMesh, Scale 1, 1, 1) and `AvatarPartScaleType` "Classic". |
| The raw `.mesh` assets | The same vertices and bounds as the source GLBs: `mesh2glb` kept Roblox's mesh coordinates, centred on their bounding box. |
| Roblox's official reference rig (github.com/Roblox/avatar, `Legacy/rigs/R15_Block.fbx`) | The classic head is a cylinder 0.6 stud in radius and 0.6 in half height, its rims rounded with radius 0.3. Its `Hair_Att` (and `Hat_Att`) sits at the top centre. |
| #1, #6 and #11 placed by their own attachments | They sit on that head as in Roblox: the sprout's root at the top, the bowl's rim on the forehead. |
| The cavities of all 21 | They seat on its circular plan and flat top. The realistic dynamic mannequin's head (0.67 stud wide) fits none of them. |

**Where a hair goes.** In Roblox the Handle is placed so that its HairAttachment meets the head's:

`vertex = HeadHairAttachment * HandleHairAttachment^-1 * (mesh_scale * raw)`

Most of David's hairs stand proud of the classic head's flat top. #11's dome has 0.28 stud of air over it. Roblox shows that air from no angle, and neither do we, because the under-cap closes it (section 3).

## 2. The v9 skull

`art/characters/base/head_shape.py`: `skull_radius(d) = classic + face_weight(d) * (v8 - classic)`.

**The hair zone is the classic head.**
- `STUD` = 0.358 m (the classic head as wide as ours, `SKULL["A"] / 0.6`).
- `CLASSIC_DY` = 0.012: its axis 1.2 cm behind the head centre, so the forehead stands about 1 cm proud of the face plane on the centre line.
- Its top is our crown.
- `HAIR_ATT`, its top centre, is a skull fit point (`hair_att`, glTF in `skull.json`).

**The face area stays v8**, by `face_weight`:

| Direction | Rule |
|---|---|
| Sideways and down | The face is kept exactly where paint can sit. That is the creator's placement area on the v8 face canvas (`face.ts` `FACE_AREA`, U 0.07-0.93, down to W 0.985), widened to the widest default parts (David's eyes reach U 0.04, his drool W 1.0). Beyond `FACE_MARGIN` (0.08 canvas), the cheeks and the jaw corners round into the classic head over `FACE_RAMP` (0.16 canvas). This is David's "round the cheeks". |
| Up | The forehead turns into the classic head between lat 10 and 44 (`FACE_LAT`). |
| Low | Below the nape line the head tapers into the v8 jaw, nape and chin, which the neck joins (`NECK_LAT` -20 to -65). |

The weight sits on a 2° grid, cached in `skull/face_zone.json`. The cache is generated and not committed; it rebuilds when its parameters change.

**The mesh.** The head mesh has the same topology as before (`skull/build_head.py`, 744 triangles) and the same face canvas and atlas.

**The face check** (`fit_check.py`; eyebrows are gone, tutorial-v2):

| | v8 | v9 | Limit |
|---|---|---|---|
| Eye stretch | 1.136 | 1.139 | 1.2 |
| Eye anisotropy | 1.288 | 1.292 | 1.3 |
| Eyes facing away | 51.2° | 48.8° | 52° |
| Mouth stretch / facing | 1.136 / 45.1° | 1.135 / 45.0° | |

The rounding reaches the outer edge of David's widest eye pairs. A margin of 0.11 holds the eyes at 1.137 and 1.290, but brings back the cheek bulge David asked to remove.

## 3. Attaching a hair: one shared transform

`art/characters/hair/import_hair.py`, for every hair in `hair/source/david/manifest.json`:

`vertex = HAIR_ATT + STUD x to_blender( R^T (mesh_scale * raw - position) )`

- `to_blender` is a half turn, with no mirror.
- `R` is the Orientation in Roblox's Y, X, Z order.
- `position`, `orientation` and `mesh_scale` come from `hair/roblox_attachments.json`.

No hair gets its own scale, offset, warp, length change or cut.

**Shared rules, the same for every hair:**

| Rule | What it does | Why |
|---|---|---|
| Face (`face_rule`) | Our painted face plate is flat and wider than Roblox's round face, so out to the paintable edge it stands up to 4 cm in front of where Roblox's face was. Hair on that ray moves out by exactly that much plus 3 mm, fading over the height above the head. Hair that was tucked into Roblox's face comes out onto ours. A long card face that still sags into the skin lifts its corners. | Without it, 6 of 21 clip 4-19 mm into the face plate's corners (#6, #13, #14, #17, #19, #20). Hair over the hair zone does not move at all. |
| Under-cap | The head's own faces under the hair (2 of 5 rays meet it, then a closing), 2.5 mm out, in the hair's shadow tone. #20's fade is the scalp itself and has none (manifest `undercap: false`). | So no skin shows between strands, and the air under a dome never reads. |
| Budget | Collapse to 1,700 triangles including the under-cap (the full-hair category is 1,750). Faces the collapse flung across the gaps between cards (more than 12 mm off the source) are dropped. | At 1,500 the collapse turned card gaps into spikes (#5, #17). |
| Clean | #15's own face plate is dropped, since our face replaces it. The logos on #8 and #19 are painted out. Recolouring, the accent masks and the one-material atlas are unchanged. | |

**What head-fit did that this reverts:** per-hair Nelder-Mead scale and offset, the cage pulls, length fitting to our body, and the fringe cuts on #2, #10 and #17.

**The bench facings were wrong on five styles: #2, #10, #13, #17 and #19 faced backwards.** The "fringes over the eyes" that head-fit cut were the back hair hanging over the face. The orientations now come from the face opening on the classic head, checked against David's preview.

**Long hair** (#3, #18) keeps Roblox's length relative to the head, so on our chibi body it reaches the thighs. Shortening it to our proportions would need a shared length rule; David hasn't asked for one.

## 4. The attachment data (`hair/roblox_attachments.json`)

**Sources.**
- #1, #6 and #11: read from their accessory files.
- The other 18: `provisional: true`, from `hair/seat_fit.py`. It seats the cavity on the classic head, then lifts it by 0.196 stud, the mean lift #6 and #11 have in Roblox. Its error on the three known: 0.006-0.04 stud (2-14 mm).

**How David fills an entry from Studio** (the file's header says the same):
1. Insert the accessory.
2. Select Handle > HairAttachment and copy its Position and Orientation.
3. Set `mesh_scale`: the SpecialMesh's Scale, or Size / MeshSize for a MeshPart.
4. Set `provisional` to false.
5. Run `import_hair.py` again. It refits, re-maps, rebuilds LOD 1 and syncs to the web, with no other step. `fit_check.py` then verifies.

## 5. Hair is David's 21 only

**Removed:** the 28 lock bangs and backs, their GLBs and LODs, and their sources (the v7 hair blends, `export_hair`, `hair_build`, `refit_hair`, the old shell library). `hair_styles.py` keeps only the hat tuck. `import_hair.py` writes the catalogue's hair as exactly the manifest's styles.

**The look model** (`look.ts`):
- `DEFAULT_LOOK` wears `hair_bob_pigtail`, and `bangs` is always empty.
- A saved look's old fringe or back loads as the nearest of the 21 (`OLD_HAIR`; `look.test.ts`). Unknown hair falls back to the default.
- Random looks pick a whole style.
- The creator's Hair tab is one row of the 21, still recolourable.

**Re-haired:**

| Who | Hairstyle |
|---|---|
| Wren (HQ lead) | `hair_wispy_ponytail` |
| Mayor | `hair_messy_low_pony` |
| Shopkeeper | `hair_messy_boy` |
| Curator | `hair_hime_short` |
| Wharf keeper | `hair_swept_fringe` |
| Oracle keeper | `hair_long_scruffy` |
| Crafter | `hair_anime_spikes` |
| Juniper | `hair_long_pigtails` |
| Marlo | `hair_bowl_cut` |
| Nell | `hair_windy_bob` |
| Rosa (cafe) | `hair_messy_low_pony` |
| Jayden, the applicant guide (David OK'd the recruitment edit) | `hair_fluffy_boy` |

**Hats and hoods** (`hidesBackHair`) hide the hairstyle and show the hat's own tuck, as before.

**Bands** (flower crown, circlet, cat ears) can't rest on every Roblox style, which runs from a bald sprout to a 10 cm dome. They rest on the hair-volume shell the hats are fitted to (`hair_outer`), as a Roblox accessory rests on its attachment: over the hair or in it.

## 6. The fit check for hair attached the Roblox way

A Roblox-attached hair is held to what our head adds over Roblox's own fit:
- **Air:** where the hair rests on Roblox's head (4 mm or less there), it rests on ours too.
- **Clipping:** the hair's surface under our skin that was outside Roblox's head.
- **Reach:** Roblox's Classic hair box (3 studs wide; 2 up and 3 down; 1.5 in front and 2 behind) from `hair_att`.

Roblox's own air and clipping are reported and not failed. The domes and rims stand 6-12 cm off the head. #10, #14 and #19 already clip 3-8 mm into Roblox's own head.

**Result:** `FIT_CHECK PASS`, 0 fails, 0 flags (`specs/evidence/head-roblox/fit.json`).

## 7. Cost

| | Before (head-fit) | Now |
|---|---|---|
| Head | 744 tris | 744 tris |
| Base skin and face | 1,264 | 1,264 |
| David's hairstyles, Full | 935-1,500 | 927-1,686 (one primitive, one material) |
| David's hairstyles, LOD 1 | 465-1,054 | 542-1,173 |
| Lock library (28 pieces) | 18,593 LOD 1 triangles in the library | gone |
| Flower crown | 624 | 704 |
| Heaviest wearable look, Full and LOD 1 | — | within 5,200 and 4,600 (`budget.test.ts`) |
| Draws, materials and shared textures per character | — | unchanged (the hair atlas as before) |

`perf:check` (`SCENES=village,cafe`, one run): see `specs/evidence/head-roblox/perf-check.txt`.

## 8. Known limits

- 18 of the 21 attachments are provisional until David copies them from Studio.
- The face rule moves hair over the face plate's corners by 3-5 cm, and up to 7 cm on #6's jaw-side locks, which were tucked into Roblox's face.
- Long hair is Roblox-long on our shorter body.
- Bands float over thin styles and sink into full ones. The circlet floats in front of a bare forehead.
- The baby sprout spends 1,682 triangles on a tuft (its source has 2,880; the budget rule is shared).
