# Character set: open questions for David

Append questions here (date, question, what you assumed meanwhile). The reviewer relays them.

## 2026-09-23 (base body v1)

1. **Facing axis.** The spec says "facing +Y in Blender (glTF exports +Z forward)". The glTF exporter maps Blender -Y to glTF +Z, so those two conflict. Assumed: the three.js result wins. The body faces -Y in Blender and +Z in the GLB (the Face primitive centroid is at +Z in the inspect output).
2. **Face skin recolouring.** A painted face texture can't be recoloured by a glTF baseColorFactor, because the nose highlight has to be lighter than the skin. Assumed: the GLB embeds `face_atlas.png` with the default skin baked in. `face_atlas_mask.png` holds the same features on transparency, so the creator can fill a canvas with the chosen skin tone, draw the mask over it and use the result as a CanvasTexture. Confirm this is acceptable, or say if you want a custom shader.
3. **What the base body wears.** Assumed: the base body carries cream base-tee and sage shorts colour zones, white socks and yellow shoes (as in #18), so it isn't bare under the separate outfit meshes. Should shoes stay on the body or become an outfit slot?
4. **Brow colour.** Brows are baked dark brown in the atlas. Should they follow the hair colour (tint them from the mask at runtime)?
5. **Scale.** The body is 1.13 m tall in Blender units. The Quaternius placeholders in-engine may use a different scale. Assumed: scale is done in-engine and the source stays at real-ish child size.

## 2026-09-23 (reference girl v2)

6. **Missing reference image.** `specs/references/characters/` is empty, so v2 was modelled from the text description only. Please drop #18 in so the next pass can be compared against the image.
7. **Faceting density.** The hood shows about 7 planes across and about 9 rows. Say if the reference is coarser (bigger planes) and I'll cut the ring counts.
8. **Vertex gradient strength.** COLOR_0 currently ranges 0.8–1.0. Should the per-face gradient be stronger, closer to a baked vertex-lit look?

## 2026-09-24 (v3 head/face)

9. **Hood vs back hair.** The back hair clips through the hood. Assumed: when the hood outfit is worn, the back hair is hidden (`v3_face_34.png` shows this) and only the bangs show. Alternatives: a flattened "under-hood" back-hair variant per style, or hoods that hide all hair.
10. **Eye highlights.** The F styles on your sheet have no highlight, and the E picks do. Should F eyes get a single small highlight for the cute read, or stay flat as drawn?
11. **G mouths.** All 63 G cells are parametric approximations of each sheet row, not exact per-cell drawings. Say if particular G cells matter and I'll hand-draw those.
12. **Bangs over brows.** Assumed brows sit just under the fringe tips and can be partly covered (ACNH-style). Should brows always render on top of the bangs instead (Mii/anime-style)?

## 2026-09-24 (v4 surfacing)

13. **Hood blue.** Reference #18 is closer to #5E9ED6 than the #7FBFEA written in the spec. Should the palette hood blue be deepened?

## 2026-09-24 (v5 base body)

14. **Body under the cape.** Reference #18 hides the torso, so shoulder width, crotch height and belly are estimated. Is a toddler build (round belly, narrow shoulders, short neck) right? Or should the base body follow another reference (#16 T-pose)?
15. **Undergarment.** I used a cream sleeveless romper zone down to the reference hem line. OK, or would you prefer a tee + shorts split that later maps onto the top/bottom outfit slots?

## 2026-09-26 (hair library)

16. **Sheet cells.** Each bangs/back style in `hair_catalog.json` names the nearest N/B cell by my reading. Please highlight the exact cells you want as launch styles, and I'll retune the matching generators.
17. **Hats-with-hair.** Row 135 lists hats-with-hair and braids. Should hats-with-hair be separate pieces in this library, or wait for the accessory pass?
