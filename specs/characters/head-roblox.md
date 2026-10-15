# Head-roblox: the v9 head, David's hairstyles attached the Roblox way

Ledger rows 305 and 309, decision 1 of playtest round 1. Branch `game/head-roblox`.

**What David asked for (2026-10-14):**
- "hair is super messed up, does not fit head properly ... change the headshape so that it universally fits with roblox hair or do something about the hair so that you dont need to remodel each hair one by one and makes it look good like how they look originally".
- He chose: our head takes the Roblox head's shape where hair sits, and every hair attaches at the point and scale it has in Roblox. The face area stays ours.
- After the early sheet: "Approve, round the cheeks".
- Then: "hair honestly just import the new set and get rid of the old ones, refine head logic so it fits roblox hair logic but still looks like our style".
- His review of the 21-hair sheet: #05 sideways; "08 remove the hat as accessory, keep the m on" (then "make the m upside
  down as a w"); #10, #11, #15, #16 and #20 lower; "19 the hair is backwards on the model, it should be a cap worn
  backwards"; #12, #14, #17 and #18 blocky; "overall a lot of the hair shouldnt be so low poly and blocky".
- On weight: "it can be like lower poly like 2400 triangles for hair when far or smth cuz i also want to make the game
  light weight, but hair should look good close up".

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

`vertex = O ( HAIR_ATT + STUD x to_blender( R^T (mesh_scale * raw - position) ) )`

- `to_blender` is a half turn, with no mirror.
- `R` is the Orientation in Roblox's Y, X, Z order.
- `position`, `orientation` and `mesh_scale` come from `hair/roblox_attachments.json`.
- `O` is David's own correction for that hair, if it has one (section 4): a turn about `HAIR_ATT`, then a move. It is
  identity for the other 15.

No hair gets its own scale, warp, length change or cut.

**The mesh is Roblox's, whole** (David's sheet review, 2026-10-14: "a lot of the hair shouldnt be so low poly and
blocky ... should look closer to the reference"). Nothing is decimated at Full: each hair keeps every triangle of its
source (609 to 4,000, Roblox's cap on an accessory), welded at its UV seams and smooth-shaded. Only LOD 1 and LOD 2 are
reduced (section 7).

**Shared rules, the same for every hair:**

| Rule | What it does | Why |
|---|---|---|
| Face (`face_rule`) | Our painted face plate is flat and wider than Roblox's round face, so out to the paintable edge it stands up to 4 cm in front of where Roblox's face was. Hair on that ray moves out by exactly that much plus 3 mm, fading over the height above the head. Hair that was tucked into Roblox's face comes out onto ours. A long card face that still sags into the skin lifts its corners. | Without it, 6 of 21 clip 4-19 mm into the face plate's corners (#6, #13, #14, #17, #19, #20). Hair over the hair zone does not move at all. |
| Under-cap | The head's own faces under the hair (2 of 5 rays meet it, then a closing), 2.5 mm out, in the hair's shadow tone. #20's fade is the scalp itself and has none (manifest `undercap: false`). | So no skin shows between strands, and the air under a dome never reads. It adds up to ~320 triangles. |
| Clean | #15's own face plate is dropped, since our face replaces it. #19's logo is painted out. Recolouring, the accent masks and the one-material atlas are unchanged. | |
| Split (manifest `split`) | #8's visor and headset leave the hair as their own accessory, `acc_visor` ("Visor and headset", Accessories > Hats): every island mostly of the cap's faces goes whole, in a fixed grey (#2B2B33). Its logo keeps its own yellow (a fixed accent, `#E9B530`) and is flipped upside down in the texture, so the M reads as a W (David: "make the m upside down as a w"). The hair is worn with it or without it. | David: "08 remove the hat as accessory, keep the m on". |

**What head-fit did that this reverts:** per-hair Nelder-Mead scale and offset, the cage pulls, length fitting to our body, and the fringe cuts on #2, #10 and #17.

**The bench facings were wrong on five styles: #2, #10, #13, #17 and #19 faced backwards.** The "fringes over the eyes" that head-fit cut were the back hair hanging over the face. The orientations now come from the face opening on the classic head, checked against David's preview. #5 is turned a quarter (`[0, 90, 0]`): David saw it "on the head sideways".

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
5. Run `import_hair.py` again. It refits, re-maps, rebuilds LOD 1 and LOD 2 and syncs to the web, with no other step.
   `fit_check.py` then verifies.

**David's corrections** (`override`, from his sheet review; each entry says why). They are applied after the shared
transform and kept when the Roblox values are filled in:

| Hair | Override | David |
|---|---|---|
| #10 messy wolf, #11 bowl cut | offset `[0, -0.06, 0]` (2 cm down) | "should sit slightly lower on the head" |
| #15 vkei, #16 swept fringe | offset `[0, -0.06, 0]` | "should sit lower on the head" |
| #19 dreads with a cap | rotation `[0, 180, 0]` | "it should be a cap worn backwards" (the brim at the back) |
| #20 waves | offset `[0, -0.14, 0]` (5 cm down) | "too high on head" |

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

A piece split off a hairstyle (#8's visor) is checked as headwear worn over that hairstyle; its fit there is Roblox's
own, so it is reported and not failed.

**Result** (full-detail meshes): `FIT_CHECK PASS`, 0 fails, 1 flag: #20's skin-through at its lowered fade (section 8;
`specs/evidence/head-roblox/fit-check.txt`).

## 7. Cost

**Three tiers per hairstyle** (David: "lower poly like 2400 triangles for hair when far ... but hair should look good
close up"). `art/characters/build_lod.py` makes LOD 1 and LOD 2 from Full; `lod.ts` picks the tier.

| Tier | When (`lod.ts`) | Triangles a hairstyle | How |
|---|---|---|---|
| Full | within 21 u, or over 72 px tall | 929-4,315 (source 609-4,000 plus the under-cap) | the original mesh |
| LOD 1 | past 21 u and under 72 px | 929-2,156 | shape-kept collapse, cards held (`CARD_MAX` 2,400) |
| LOD 2 | past 40 u and under 28 px (`far`) | 929-1,100 | the same, to 1,100; every other part draws its LOD 1 there |

`budget.ts` prices them: a hairstyle is held to 4,400 at Full, 2,400 at LOD 1 and 1,200 at LOD 2, and a whole look to
7,800 / 5,100 / 4,000 (`CHARACTER_BUDGET`; `budget.test.ts` computes the heaviest wearable look).

| | Before (ec4641f6) | Now |
|---|---|---|
| Head | 744 tris | 744 tris |
| Base skin and face | 1,264 | 1,264 |
| David's hairstyles, Full | 927-1,686 | 929-4,315 (one primitive, one material) |
| David's hairstyles, LOD 1 | 542-1,173 | 929-2,156 |
| David's hairstyles, LOD 2 | none | 929-1,100 |
| #8's visor (an accessory now) | part of #8 | 686, LOD 1 444 |
| Heaviest wearable look, Full / LOD 1 / LOD 2 | ~5,070 / ~4,030 / none | 7,700 / 5,014 / 3,958 |
| Draws, materials and shared textures per character | | unchanged (the hair atlas as before) |

**Download.** Every hairstyle GLB on the web is meshopt-compressed (`EXT_meshopt_compression`, lossless: no quantizing,
so the parts still merge; drei's `useGLTF` decodes it). A client fetches only the styles worn by the characters it
draws, and LOD 1 and LOD 2 only once someone is far enough away to use them.

| Hair download, all styles | Before (b80097c0, lock library and decimated styles) | Now |
|---|---|---|
| Full | 1.68 MB styles + 1.59 MB library | 1.61 MB (25-106 KB a style; 3.73 MB uncompressed) |
| LOD 1 | 1.70 MB styles + 1.48 MB library | 1.40 MB |
| LOD 2 | none | 1.06 MB (26-69 KB a style) |
| Shading atlas | 1.32 MB | 1.45 MB |
| Total | 7.77 MB | 5.59 MB (with the visor's 0.08 MB) |

**`perf:check`** (`SCENES=village,cafe`, one run, the machine's 1-minute load at 5.6-5.9 with other lanes working):
`specs/evidence/head-roblox/perf-check.txt`.

| Scene | Tier | Median frame ms | p95 ms | Frame CPU ms | Draws | Triangles |
|---|---|---|---|---|---|---|
| village | High | 4.9 (3.9, +25.6%) | 6.2 (4.9) | 4.2 (3.4) | 373 (382) | **592,191** (537,560, +54,631; budget 560,000) |
| village | Lite | 2.8 (2.3, +21.7%) | 4.0 (3.4) | 2.4 (2.0) | 277 (288) | 381,324 (353,865) |
| cafe | High | 2.0 (2.1) | 5.0 (3.1) | 1.1 (0.6) | 143 (140) | 86,903 (69,455; budget 110,000) |
| cafe | Lite | 1.7 (1.5, +13.3%) | 5.2 (2.8) | 1.2 (0.7) | 110 (103) | 84,782 (63,874) |

It **fails**: the village on High is 32k triangles over its budget, from the residents' and bots' full-detail hair
(drawn twice on the Full ones: the scene and the sun's shadow map), and the median frame is 13-26% over the baseline in
three of the four. The hair detail is not cut back (the coordinator's ruling); the options are with David (section 8).

## 8. Known limits

- 18 of the 21 attachments are provisional until David copies them from Studio.
- **The village on High is over its triangle budget** (592k of 560k) and slower by up to a quarter (section 7). The
  likely fixes, for the coordinator and David to choose: deeper seagrass (about -8k), and moving the Full to LOD 1 line
  nearer (`CHARACTER_LOD.near` 21 u / `mesh` 72 px), which keeps close-up hair whole.
- The face rule moves hair over the face plate's corners by 3-5 cm, and up to 7 cm on #6's jaw-side locks, which were tucked into Roblox's face.
- Long hair is Roblox-long on our shorter body.
- Bands float over thin styles and sink into full ones. The circlet floats in front of a bare forehead.
- #20, lowered 5 cm as David asked, has its fade's lower edge in the head's v8 zone: a lip at the sides, and at the back
  the skin comes through by up to 4.7 mm in places (`fit_check` flags it; the fade there is skin-coloured).
- #8's visor is Roblox's own piece: over its hair it stands off (the brim, the mic) and strands come through it, as in
  Roblox; `fit_check` reports it and does not fail it. Over other styles it floats or sinks like a band.
- The visor is sold like every accessory (80 coins, `wear-acc-visor`; migration `20261015042854_catalogue_seed`, after the wardrobe cut's `20261014220430_wardrobe_cut`; v1-integrate). Its
  shop icon is the plain grey piece: the icon renderer does not read the hair atlas, so the W is not on it.
- The hairstyles' shading follows their textures: the near-black sources (#8, #1) stay high-contrast in a light colour.

## 9. Evidence

`specs/evidence/head-roblox/` (engine shots: `shots.mjs`, headless, on `/lab/avatar`; tiles: `sheets.py`):

| File | What |
|---|---|
| `03-all-21-engine.webp` | David's 21 beside his preview, front, 3/4, side and back, in the engine (skin 3, hair colour 3) |
| `04-visor-w.webp` | #8 with its visor (the W) and without, front and 3/4 close-ups |
| `05-lod-tiers.webp` | five styles at Full, LOD 1 and LOD 2 (`?charlod=1|2`), 3/4 and back |
| `06-david-faces-v9.webp`, `07-styles-v9.webp` | David's 19 faces on three skins, and the default styles, on the v9 head |
| `fit-check.txt` | `fit_check.py`: PASS, 0 fails, 1 flag (#20) |
| `perf-check.txt` | the `perf:check` table above |
| `01-early-3.webp`, `02-all-21.webp` | the earlier Blender sheets (before the full-detail meshes) |
