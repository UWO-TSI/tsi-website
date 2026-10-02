# World refinement: birds, trees, fruit, flowers, HUD stack (row 284)

David, 2026-10-02:

> "game feel and graphic refinement (including models) im seeing buggy birds that fly away with glow light, i think flower can be shrunk smaller, tree is only half model and needs to be remodeled, fruits are not actually on the tree, some ui is still out of place."

The diagnosis (2026-10-02) is below. Short names:
- **VL** = `web/components/game/peaceful/VillageLife.tsx`
- **AF** = `web/components/game/AmbientFauna.tsx`
- **af** = `web/lib/game/ambientFauna.ts`
- **SG** = `web/components/game/Seagulls.tsx`
- **NM** = `web/components/game/NatureModels.tsx`
- **CSS** = `web/components/game/DefaultIslandWorld.module.css`
- **DIW** = `web/components/game/DefaultIslandWorld.tsx`

Standard: `specs/polish/README.md`. Most of these are side effects of the new orbit camera: the old cheats only worked from the fixed west view.

## 1. Birds and glow
**Flight:**
- **What reads as "birds":** the butterflies (`af:30`; a catchable emperor is 0.65u). They should be about 0.25u.
- **Fleeing bugs:**
  - They climb 3.1u and travel 5.7u in 1.5 s (`bugFlee.ts:26-31`).
  - They pop back to their perch whenever anything is harvested, because `bugState` is keyed off `harvested` (`VL:105-113`).
- **Ambient flyers** leave as a group, rising 6u at the end of their hours or in weather (`af:167-169, 191-192`).
- **Gulls:**
  - Anchored and set at a height for the old camera (`af:250-257`, `AF:156-157`), so their circles now pass by the lens.
  - The swoop heading snaps to `sa + π`; the right heading is `-sa` (`SG:118`).

**Glow:**
- The rare-bug sparkle is an additive `sun.png` sprite with tone mapping off (`VL:40-47`). `fade()` never fades it, so a full-bright orb flies off with the bug.
- Sprites skip the curved-world bend (`curvedWorld.ts:107`), so every glow (sparkle, fireflies, mist) floats about 0.55u or more above its owner.
- Bloom (threshold 0.65 under a 3.8 sun, `lookPreset.ts:72, 94`) haloes white wings.

**Fix:**
- Fade or drop the sparkle while a bug flees.
- Key bug state off the per-hour bug list.
- Calmer flee: a short hop up and away along a curve, then a fade, without climbing out of view.
- Ambient flyers scatter individually and softly, not as a group.
- Shrink flyers to about 0.25u.
- Gulls: re-anchor them away from wherever the camera can be, raise them, fix the swoop heading, and let them land on posts, roofs and the water now and then.
- Make glows instanced quads that take the bend, or patch the sprite shader with the same bend.
- Keep fauna out of bloom, or raise the threshold to about 0.9 where it doesn't dull the approved look.

## 2. Trees: remodel to full, closed crowns
ACNH crowns are front-only shells (oak leaves have 88% of normals facing +z; the back mesh 100%). `treeYaw` (`NM:101-105`) turned them to face the old camera, so the orbit camera sees flat backs. The leaf cut-out masks (`mTreeOakLeaf_OP.png` etc.) are in the dump but never referenced; the GLB materials are opaque.

**Remodel every village tree in Blender** (the live window via the MCP bridge if free, or headless) so the crown is full and closed from every angle:
- hardwood a/b (dump `PltTreeOak{3,4}.dae`) and the cherry/sakura (`PltTreeOak4Sakura.dae`);
- check the cedar (about 67% one-sided);
- every season variant `seasonalLook.ts:31-36` swaps in.

How:
- Keep ACNH's silhouette and textures as the source. Build the back and sides as real geometry: mirrored and varied leaf shells, the back plane closed.
- Wire the `_OP` masks as cut-outs (alpha test about 0.5) where they help.
- Matte. Keep triangle counts sane (report them).
- Keep the trunk and `mShadow` caster logic (look spec §9).

Then drop the camera-facing yaw. Keep a small random yaw for variety, now that every side is finished. The occluder fade's cut through canopies should look intentional (a soft dither), not like a missing half.

## 3. Fruit on the tree
The fruit node sits at the trunk with z − 0.9 (`lib/game/islandNodes.ts:26-27`) plus offsets (`VL:54-55`), so it hangs 0.2–0.85u in front of the leaves. It ignores the tree's scale, yaw and model, and takes its height from the ground at the offset.

**Fix:**
- Place fruit in the tree's own space, using ACNH's hang joints from `PltTreeOak{3,4}Node.dae` (`Plant01`, `Plant02`, `PlantTop`). Measure them on the remodeled crown and check them in `/lab/item`.
- Real fruit models instead of spheres: the dump has `UnitIconPltFruit{Apple,Cherry,Coconut,Orange,Peach,Pear}.Nin_NX_NVN`. Use them for study only if their licence path is the same as the other dump assets. Otherwise model our own, matte.
- Fruit sways with the crown and drops (the tree-shake spec) from where it hangs.

## 4. Flowers smaller
`flowerParts` (`NM:70-71`) places 3 models at 0.8 scale spread ±0.4/±0.3, so a cluster covers about 1.6 × 1.4u on a 1.0u tile. Scale to about 0.45–0.55 with offsets of about ±0.22, so a cluster fits one tile.

The same function feeds the village, the home island and the applicant island (recruitment, live). Apply it everywhere unless it breaks the applicant island's look; check with a before/after.

The pickable flower blob (`VL:64`) becomes a proper small flower model.

## 5. HUD bottom stack and corners
- **Controls bar:** the orbit pass grew it to about 14 items, so it wraps to two rows (about 106px). It overlaps the E prompt (`CSS:41`) and the minimap (`CSS:59`); the ruins bar overlaps the combat HUD (`CSS:223`).
- **"Click to look around"** (`CSS:313`, `DIW:879`) collides with the top cluster under about 1100px and with the title under about 760px.
- **Fishing meter** (bottom 120, `FishingOverlay.tsx:400-405`) sits under the toasts (bottom 132).
- **Narrow screens:** the minimap moves to top 198 and the study panel covers the prompt and toasts (`study/study.module.css:34`).
- **Touch stick:** hardcoded offsets (`DIW:877`) for a widget that moved.

**Fix:**
- One shared bottom-stack layout (CSS variables for bar height, prompt, toasts, meters, study panel) and safe corners.
- Trim the controls bar to about 6 items with a "?" that opens the full list.
- Move the look hint below the top cluster, or onto the canvas as a centred hint.
- Check at 1440×900, 1280×720, 1100×700, 760px tall and phone size, in the village, café, ruins and fishing.

The minimal-HUD direction (row 283) is being built in `game/game-ui`. Coordinate through CSS variables, and don't move the top cluster.

## Evidence
`specs/evidence/world-refinement/`:
- each tree, front, back and sides, before and after;
- fruit on the tree from four sides;
- flower clusters;
- gulls, butterflies and a bug fleeing as frame strips, day and night (no floating glows);
- the HUD stack at each size.

Report FPS and triangle counts.
