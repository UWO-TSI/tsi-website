# Head fit: the v8 head, the shared skull and the hair fit standard

> **Hair superseded (head-roblox, 2026-10-14, `specs/characters/head-roblox.md`).** The per-hair refits, cage pulls and
> fringe cuts below are reverted: every hairstyle now attaches at its Roblox HairAttachment on the v9 skull (Roblox's
> classic head where hair sits, the v8 face kept), whole and undecimated at Full, with David's own per-hair overrides
> only. The v8 face and its fit points stand.

Ledger rows 264 (matte), 301 (no outside art), 304 (head and hair fit) and 305 (David's own hair set). Branch `game/head-fit`.

David, 2026-10-08:
- "Rounder, flatter face": a softer rounded-box head with a flat, even face area, so every painted face sits cleanly.
- One shared skull with fit points, so any hair fits every head with no clipping or floating; hats and accessories use the same points.
- Refit all current hair. Future hair is remodelled from screenshots David sends.

Every number below comes from `art/characters/fit_check.py` or from the GLBs themselves. The evidence is in `specs/evidence/head-fit/`.

## 1. The head (v8)

**Shape.** `art/characters/base/head_shape.py` defines `SKULL`, a superellipsoid whose shape changes from back to front:

| Parameter | Value | Meaning |
|---|---|---|
| `A` | 0.215 | Half width. ref 18's head is 0.454 wide; the box's corners carry the volume. |
| `B_FRONT` / `B_BACK` | 0.192 / 0.186 | Distance from the head centre to the face plane and to the back of the skull. |
| `P_FRONT` / `P_BACK` | 4.0 / 2.5 | Horizontal roundness. 2 is an ellipse; higher is squarer. The face plane is flat enough for David's widest eyes. |
| `C_TOP` / `C_BOT` | 0.2245 | Crown and chin. ref 18's height is kept. |
| `C_BOT_FRONT` | 0.2545 | The chin under the face, 3 cm lower than ref 18's. This gives flat room for mouths and drool down to the canvas's bottom edge (David's faces reach W 0.999). |
| `Q_TOP` | 2.3 | A round crown. |
| `Q_BOT_BACK` / `Q_BOT_FRONT` | 2.6 / 4.5 | A round jaw at the back, a flatter jaw in front. |

It is not a Roblox head: it is softer, wider at the jaw and shallower front to back.

**Coordinates.** A point is `(lat, lon)`: the ray from the head centre `HC` through `head_point_v7(lat, lon)`, the old head.
- `head_point(lat, lon)` is where that ray meets the v8 skull.
- Every lat/lon in the library therefore means the same direction on both heads: hair seeds, the hairline, hat edges, fit points and the checker's rays.
- `refit_v7_to_v8(p)` moves a point fitted to the v7 head along its ray by the change in skull radius.

**Mesh.** `art/characters/skull/build_head.py` builds `V8_Head` with the v7 topology steps from `v7/head_model.py`:
- feature rows and columns through the eyes and the mouth;
- concentric loops round each eye and round the mouth;
- face-chart UVs;
- 100% weight on `mixamorig:Head`;
- the straddle pass.

The result has 744 triangles, the same as v7, and departs from the analytic surface by at most 4.6 mm (median 0.6 mm). `base/build_clips.py -- head v8` writes `base/v8_clips.glb` with the same body, rig and 59 clips. The engine loads it.

**The face atlas is unchanged.** Its canvas coordinates are stable, so every part keeps its placement. The eye and mouth lat/lon are solved on the new surface from the canvas anchors (`chart_inv`). The chart is still arc length over the head.

**Face fit**, measured over every eye, brow and mouth on both atlas pages:

| | v7 head | v8 head | Limit |
|---|---|---|---|
| Texture stretch (worst) | 1.135 | 1.136 | 1.2 |
| Anisotropy (worst) | 1.286 | 1.288 | 1.3 |
| Eyes facing away from straight ahead | 46.9° (first page only) | 51.2° (both pages) | 52° |
| Mouths facing away (row-301 and David's drool) | 61.2° | 45.1° | 52° |
| Brows facing away | 35.8° | 13.3° | 52° |

On the v7 head, the first page alone already failed its anisotropy limit, because of the row-301 mouths.

On the v8 head, the earlier parts sit under 1.05 stretch and anisotropy. The worst values come from David's widest eyes (U 0.04-0.07), which reach round the jaw's corner.

## 2. The shared skull and its fit points

The skull is defined in `art/characters/skull/skull.py`. It exports `skull/skull.json`, which is synced to `web/data/characters/skull.json` and read through `lib/game/character/skull.ts`. Positions and frames are in glTF space; each frame's z axis is the skull's outward normal.

**Shells over the scalp** (metres above the skull):
- `INNER` (-0.004): hair undersides and buried roots.
- `hair_vol` (1.1-2.4 cm): the hair mass.
- `hair_outer` (3.2 cm at the hairline, 4.3 cm at the crown): lock tops reach this.
- `hat_in` = `hair_outer` + 4 mm: hat insides.

**Lines on the skull:**
- `hairline(lon)`: 44° in front, 22° at the temples.
- `nape(lon)`.
- `scalp_line(lon)`: the hairline in front, easing past the temples to the nape at the back. A full hairstyle covers everything above it.
- `hatline(lon)`: 30° in front, 8° at the back.
- The ear zone: centred on lat -21.9 (face thirds, between the eye line and the mouth), lon ±92, radius 14°. Hat rims stay above lat -7.9.

**Fit points:**

| Point | Where | What fits there |
|---|---|---|
| `top` | Top centre | Hair and hat attachment (where Roblox puts its Hair and Hat attachments). A tuft roots here. |
| `crown` | lat 72, back | The whorl. Back pieces root round it and cover it. |
| `hairline_C`, `hairline_L`, `hairline_R` | Front hairline | Bangs roll over it; back caps end at it. |
| `temple_L`, `temple_R` | lat 22, lon ±62 | The hairline turns down to the sideburn. |
| `ear_L`, `ear_R` | Ear zone centres | Glasses temples rest here; nothing hangs a hat rim over them. |
| `nape` | Back of the neck | Back hair meets the neck. |
| `hat_C`, `hat_B` | The hat line | Hat rims. |
| `face_front`, `eye_L`, `eye_R`, `mouth` | Face canvas anchors | Glasses bridge and lenses, masks. |
| `neck` | Under the chin | Neck pieces. |

**Coverage.** Each piece type covers certain fit points: its underside must lie within `float_max` of the scalp there.
- Bangs cover `hairline_C`.
- Backs cover `crown` and `top`.
- Full styles cover all three.
- Hats cover `top` and `crown`, with their own clearance.
- A tuft (`covers: ["top"]`) has its foot on `top`.

**Clearances** (`skull.CLEARANCE`, enforced by the checker):

| Name | Value | Meaning |
|---|---|---|
| `clip_max` | 2 mm | Visible surface under the skin. |
| `float_max` | 6 mm | Air under a piece at a fit point it covers. |
| `gap_max` | 4 mm | Air anywhere the piece covers. |
| `hat_gap_max` | 10 mm | Air between a hat and the hair. |
| `hat_poke_max` | 2 mm | Hair poking through a hat. |
| `reach` | per type | A box from `top` that each type stays inside. It catches a mis-scaled import, like Roblox's per-type accessory bounds. |

## 3. The fit checker

`Blender -b -P art/characters/fit_check.py [-- --json out.json] [--no-fail]` exits 1 on any failure.

It measures on the exported GLBs in rest pose, against the head in the catalogue's base GLB. To the earlier checks (gap, open edges, seams over all 16 x 12 bangs/back pairs, lock roots and dives, hats, bands, glasses, face stretch) it adds:
- **Face facing:** every painted pixel of every eye, brow and mouth on both atlas pages, against straight ahead.
- **Skull section, per piece:**
  - clip: a visible outward surface sunk under the skin;
  - float and coverage at each fit point the piece covers;
  - the reach box;
  - hat rims above the ear zone.
- **Full styles:** the gap is measured above the scalp line, and clip below it, where hair hangs free of the face and jaw. Their cards root under their own under-cap above the line, hidden like the locks' buried roots.

**Result now: PASS, 0 fails, 0 flags.** That covers 49 hair pieces, 4 hats, 2 bands and 2 glasses. Detail:
- Seams: worst 9.3 mm (limit 14); the default pair 0.2 mm.
- Hats: 0 air and 0 poke.
- Bands: 9.1 mm and 8.0 mm of air, 1.1 mm of poke.
- Glasses: within 8.1 mm of every first-page eye.

For comparison, the v7 hair on the v8 head failed 71 checks: locks dived up to 3.5 cm into the new forehead, and the pony had 5 cm of air under it.

## 4. How Roblox fits hair, and what we took

This section uses Roblox's public creator documentation only. No Roblox catalog item, mesh or reference file is used. The reference-file study was dropped.

- **Rigid accessories snap by name.** Hair and hats attach at Hair and Hat attachments on the head. Both sit in the top half of the head's bounds and may coincide. Face items attach at the face front or face centre.
  - Ours: the `top` fit point, with `face_front` and the eyes for face items. Hats and hair share `top` and `crown`.
- **Each type has its own bounding box** measured from its attachment. The hair box is off-centre: it reaches further down and back than up and forward. The Accessory Fitting Tool turns it red when an item is outside.
  - Ours: the `reach` boxes, checked for every piece.
- **Layered items wrap a reference cage.** The mesh lies between an inner cage (the body it wraps) and an outer cage (what the next layer wraps over). Anything inside the inner cage clips.
  - Ours: the analytic skull is the inner cage; `hair_outer` and `hat_in` are the outer cages hats wrap over. Clip is measured under the skull, float above it.
- **Hairlines come from the face.** The hairline is set from the eyebrows (face thirds), keeps its shape round the ears, and ends at the base of the neck.
  - Ours: `hairline`, the ear zone at the face thirds, and `nape` and `scalp_line`.
- **Hair and hats stay rigid.** Roblox recommends no auto-skin for them, and they scale with the head.
  - Ours: everything on the head is 100% on `mixamorig:Head`. Imported hair is scaled by the head's width (section 6).

## 5. Adding a hairstyle from one of David's screenshots (lock hair)

1. Put the screenshot in `specs/references/characters/david/` (David supplies every reference; row 301).
2. Seed the style in `art/characters/v7/hair_styles.py` in skull coordinates:
   - `("s", lat, lon, off)` is on the scalp, `off` metres out. Use `top(lat, lon, r, flat)` to put a lock's top on `hair_outer`.
   - `("d", out, side, down)` hangs from the previous point.
3. Follow the fit points:
   - Bangs root at the crown whorl (lat 84) and roll over `hairline(lon)`.
   - Backs root round `crown` and lie on their under-cap (`cap_outer`: `GROOVE` under the lock tops, never nearer the scalp than `CAP_FLOOR`) down to their hem.
   - Pulled-back styles go in `TIGHT`; their under-cap tightens only behind the ears.
   - Ties and buns use the `gather`, `tail` and `bun_coil` helpers.
4. Make the curves in the live session (`hair_build.seed`) and adjust them by eye against the screenshot in `hair_bangs.blend` or `hair_backs.blend`.
5. Run `export_hair.py`, then `build_accessories.py` (bands rest on the worn hair), then `fit_check.py`, which must PASS.
   - If a lock dives, raise its control point (the sweep buries roots and rests hugging locks on the skin by itself).
   - A long lock over a tight curve needs more `segs`.
6. Run `build_lod.py -- <id>`, then `render_lod.py`, then `web/scripts/sync-character-assets.mjs`. The LOD test fails if a part lacks a LOD 1.

Budget: at most 1,200 triangles per lock piece. The heaviest bangs plus the heaviest back, with the heaviest outfit and glasses, must stay under 4,000 (`look.test.ts`).

**When the skull changes:** restore the v7 curves (`git checkout cd42ad7d -- art/characters/v7/hair_*.blend`) and run `skull/refit_hair.py`. It applies:
- the move along each ray;
- a midpoint wherever a run would cut nearer the skin;
- `TOUCH` (hand lifts and segment counts by name);
- `SEGS`.

Every head part records the skull it fits (catalogue `skull: v8`); `skull.test.ts` fails otherwise.

## 6. Importing a hairstyle file (David's own models)

`Blender -b -P art/characters/hair/import_hair.py [-- --who david --only id,id]` reads `hair/source/<who>/manifest.json`. Each entry has:
- `file`, `id` and `name`;
- optional `covers`;
- `accent` (`default`: a hair palette index or `skin`);
- `cap` (`rule`, `color`, `logos`);
- `drop` (`face_plate`);
- `yaw`.

The importer accepts GLB, glTF, FBX, OBJ and `.blend` files. For each one it runs these steps:

1. **Import.** Meshes are joined and transforms applied. Face front is -Y and up is Z.
2. **Weld and budget.**
   - Collapse to `LOD0_MAX` (1,500) less the under-cap. Strand cards are welded first; collapsing them unwelded shreds them.
   - Where cards meet three or more to an edge, the collapse stalls; those edges are split and collapsed again.
   - The smallest wisps go last, if needed.
3. **Clean.** A face shell is dropped (#15). Cap and visor faces are marked; they become a cap mask channel (step 9).
4. **Orient.** The hair is seated both ways and keeps the facing that leaves the face open and covers the back.
5. **Seat.** It is scaled by the head: Roblox's head is 1.2 studs wide and ours is the skull's width, so 1 stud = 0.358 m, within about 10% per hair. Nelder-Mead over the cap's rays then finds a per-axis scale (within 12% of uniform) and an offset that:
   - minimise the air under the hair;
   - keep the crown covered;
   - steer clear of the skin.
6. **Cage step.**
   - Pulls: where hair lies on the head above the scalp line and stands off it, whole columns move in, so the hair keeps its thickness.
   - Pushes: over the skin by 4 mm above the line and 1 cm below it.
   - A face whose middle is still under the skin lifts its corners, and its long edges are split within the budget.
   - A push spreads to its neighbours but never more than 1 cm past their own need.
   - Islands wholly inside the head are deleted.
7. **Body.**
   - Lengths below the chin follow our proportions: the neck at 0.63 and the torso at 0.30, so waist-long hair ends at our waist. They also draw in toward the body.
   - Nothing stays inside the body.
   - A last push pass follows.
8. **Under-cap.** The head's own faces above the scalp line, 2.5 mm out, form a matte shell (UVs at u < 0, COLOR_0 0.55: the engine leaves it to the tint, the hair's shadow). No skin shows through a gap in the hair from any angle.
   - Before it: a fringe that hid the eyes (manifest `fringe`) is drawn up toward the brows before the cage step, and after it whatever still lies across the eyes (`open_face`: the face from the brows to the mouth) seen from the front is cut away; faces flung outside the hair box go.
9. **Maps.**
   - Each texture becomes a shading map: luminance over the median of the part it shades, with glossy bands pressed down (matte, row 264).
   - Two-tone styles also get an accent mask from their saturated texels.
   - Logos are painted out with the median of the surrounding surface.
   - Maps go into `hair/hair_maps.png`: 2560 x 1024, ten 512 px cells, one map per channel: 21 shading maps, 3 accent masks and 2 cap masks.
   - **One primitive, one material** (`specs/perf/budget.md`): the cap or visor takes the fixed colour `hairMaps.cap` (#28282E) through its mask, the second colour through its accent mask, the under-cap through its UV marker. Nothing is a second material, so a full hairstyle adds no draw.
10. **Export.** The output is `hair/full/<id>.glb` plus its catalogue entry: slot `back`, `full: true`, `map` channels, `accent`, `skull`, `source`.

Then run `fit_check.py` (must PASS), `build_lod.py -- <ids>` and the sync.

**In the engine:**
- A full hairstyle sits in the back slot; the bangs are not worn with it, and picking bangs brings the default back.
- The body material samples the shared atlas: the palette tint is multiplied by map x gain, and the accent colour is mixed in by its mask. The atlas loads the first time anyone wears a mapped style.
- The creator's Hair panel has a Hairstyles row and a Second colour swatch row for two-tone styles. Dyes past the free six count as dyes, as for the main colour.

## 7. David's 21 hairstyles

**Facing.** `manifest.json` pins each style's turn to face front, as reviewed in the bench: the converter kept David's own facing, which differs between styles, and the importer's guess got 5 of 21 wrong. #19's cap is worn backwards: brim forward, its dreads hung over the whole face and the cap sat low. **For David to confirm.**

**Fringes.** The messy boy (#2), the messy wolf cut (#10) and the bob with a pigtail (#17) hid the eyes from the front. Their fringes are drawn up toward the brows and whatever still lay across the face (brows to mouth) seen from the front is cut away, so the eyes read through (`10-fringes.webp`). This is a first pass for David to tune.

**Authorship.** David confirmed on 2026-10-08 that he made all 21 himself for his own Roblox shop, so they ship as our hair (ledger row 305). The sources are in `art/characters/hair/source/david/`.

**Trademarks removed.**
- #8: the McDonald's arches and yellow trim on the visor are painted out to the visor's grey.
- #19: the Oakland A's mark, the MLB batter patch and the New Era flag are painted out to the cap's black. The cap stays part of the style.

**Recolourable.** Every style takes the hair palette.
- #14 (white and blue): the blue is an accent, blue by default.
- #19 (dreads with brown tips): the tips are an accent, brown by default; the cap keeps its fixed colour.
- #20 (waves with a fade): the fade is an accent that follows the skin by default.
- #9 has no UVs and takes the tint alone.

**Cost.** Each style is one primitive in one material (the hair budget's rule), so it adds no draw call or material per character: it merges into the body mesh. Texture: one 512 px cell channel each in the shared atlas (2560 x 1024 RGB, about 14 MB on the GPU with mipmaps, loaded once). Before this pass most had 2 primitives and materials (the under-cap) and #8 and #19 had 3 (the cap); each extra one was a draw per character on screen, until the merge.

| Hairstyle | Full, before | Full, now | LOD 1, before | LOD 1, now | Primitives and materials, before | Now |
|---|---|---|---|---|---|---|
| hair_anime_spikes | 1,610 | 1,350 | 1,046 | 675 | 2 | 1 |
| hair_baby_sprout | 1,534 | 1,286 | 996 | 643 | 1 | 1 |
| hair_bob_pigtail | 1,734 | 1,359 | 1,622 | 679 | 2 | 1 |
| hair_bowl_cut | 1,536 | 1,290 | 816 | 644 | 2 | 1 |
| hair_dreads_cap | 1,750 | 1,499 | 1,638 | 748 | 3 | 1 |
| hair_fluffy_boy | 1,648 | 1,339 | 1,536 | 668 | 2 | 1 |
| hair_hime_short | 1,528 | 1,305 | 1,416 | 652 | 2 | 1 |
| hair_layered_shag | 1,559 | 1,327 | 1,013 | 663 | 2 | 1 |
| hair_long_pigtails | 1,750 | 1,500 | 1,638 | 749 | 2 | 1 |
| hair_long_scruffy | 1,525 | 1,261 | 1,413 | 629 | 2 | 1 |
| hair_messy_boy | 995 | 935 | 747 | 465 | 2 | 1 |
| hair_messy_dreads | 1,750 | 1,500 | 1,638 | 974 | 2 | 1 |
| hair_messy_low_pony | 1,517 | 1,224 | 1,405 | 795 | 2 | 1 |
| hair_messy_wolf | 1,750 | 1,372 | 1,638 | 679 | 2 | 1 |
| hair_short_tufts | 1,544 | 1,294 | 1,187 | 646 | 2 | 1 |
| hair_swept_fringe | 1,749 | 1,500 | 1,637 | 749 | 2 | 1 |
| hair_visor_messy | 1,545 | 1,296 | 1,433 | 648 | 3 | 1 |
| hair_vkei | 1,445 | 1,198 | 1,333 | 777 | 2 | 1 |
| hair_waves | 1,316 | 1,116 | 705 | 558 | 2 | 1 |
| hair_windy_bob | 1,546 | 1,296 | 1,434 | 643 | 2 | 1 |
| hair_wispy_ponytail | 1,749 | 1,500 | 1,637 | 745 | 2 | 1 |

The sources had 609-4,000 triangles. Now Full runs 935-1,500, under-cap included (the head's faces above the scalp line), and LOD 1 runs 465-974.

Full stays under the full hair budget (1,750: the heaviest bangs-plus-back pair, which a whole hairstyle replaces; `specs/perf/budget.md`) and under the default pair (1,576).

LOD 1 is about half: `build_lod.py` welds the cards, splits their three-way junctions, and holds them to 95% of the hair's surface within its 12 mm tolerance (collapse takes whole thin cards, so the furthest strand tip always strays). A distant character in one of these costs at most 974, under the default bob's 1,172.

## 8. Per-character cost, before and after

| | Before (v7) | After |
|---|---|---|
| Base skin and face | 1,264 | 1,264 (744-triangle head) |
| Default look's hair, LOD 0 | 1,576 | 1,576 |
| Default look's hair, LOD 1 | 1,260 | 1,172 |
| Library LOD 1, all 36 head pieces | 21,117 | 20,307 |
| Draw calls per character | body + face (+ decal) | the same |
| Shadow draws per character | the same | the same |
| Materials per character | the shared body + its own face | the same |
| Vertex attributes per vertex | 6 floats (unused lock sheen) | 5 floats (hair map channels and accent) |
| New shared texture | none | hair atlas, about 14 MB on the GPU with mipmaps, only once a mapped style is worn |

**LOD 1 coverage:** every catalogue part has one (`look.test.ts`).

**Measured** (`npm run perf:check`, `specs/evidence/head-fit/perf-check.txt`): passed on all eight scene and tier pairs. Draw calls and triangles stay within 1% of the baseline in the village, v2 and ruins scenes. A cafe A/B with 24 bots, run as two builds that differ only in whether the bots may wear David's styles, comes out at 140 and 145 draws and 69,343 and 77,827 triangles (with and without them).

**LOD 0 changes:**
- `bangs_hime` went from 634 to 644 triangles: its side locks need more segments over the jaw.
- The heaviest full look stays under 4,000 with the heaviest outfit and glasses: 1,264 + 1,500 + 761 + 208 = 3,733 with one of David's styles. With every accessory slot filled, the heaviest wearable look is 4,941 at Full and 4,376 at LOD 1 (`specs/perf/budget.md`: 5,200 and 4,600), its hair a lock pair and a band.

**LOD 1 changes:**
- Lock hair's LOD 1 may now sink 4 mm (was 3) into the head. On the v8 head, the default fringe and bob otherwise stayed whole.
- Seven pieces are 1-73 triangles heavier at LOD 1 (`bangs_swept_back` 245 -> 318, `acc_flower_crown` 344 -> 380).
- The rest are lighter or the same.

## 9. Known limits

- David's strand-card styles are open sheets. They render because the body material is double-sided, and the checker exempts them from the closed-solid rule.
- The fringes cut for #2, #10 and #17, and #19's backwards cap, are first passes for David to tune.
- The cage step reshapes his hair a little where it met our head:
  - fringes hang 1 cm off the face;
  - long cards over the jaw bulge out locally;
  - lengths below the chin are shortened to our body.
- Long hair is 100% on the head bone, as before, so it can pass through the shoulders in some clips.
- One pair of glasses fits the first atlas page's eyes. David's own eyes (page 2) sit where he drew them, up to about 10 cm from the lens on the widest pairs. This is reported, not held.
