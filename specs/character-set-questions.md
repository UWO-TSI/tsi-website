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

## 2026-09-26 (deliverable 3: outfits, accessories, clips)

18. **Seat and bed heights.** Assumed Sit and Study sit on a bench with a 0.12 m seat, feet dangling, and Study writes at a 0.28 m desk. Assumed Sleep and Defeat lie on the back, with the head toward the character's back (-Z in glTF). The catalogue records seatHeight and deskHeight. Give the real furniture heights and I'll re-key.
19. **Fish is two clips.** `Fish` is a one-shot cast that ends on the hold pose. `FishHold` loops from that pose. `Defeat` ends lying down (`endsNeutral: false`). Every other one-shot starts and ends on Idle frame 0. OK, or should Fish be one clip that the engine subclips?
20. **Hats with hair (answers Q17 for now).** Beanie, sun hat and cap set `hidesBackHair`. Each carries a short bob-length `M_Hair` tuck at the sides and nape, tinted with the hair colour, so the head never reads bald. The chosen bangs stay visible. Is one tuck for every back style fine, or do long styles need a long tuck?
21. **Layering order.** Assumed:
    - Top hems sit over every bottom's waistband.
    - The overall bib and straps sit over tops.
    - Bags sit over everything.
    - The backpack clips long back-hair styles.
    - Accessory groups stack one each: face, head, bag, neck.
    Say if any combination should be blocked in the creator instead.
22. **COLOR_0 was never exported.** Blender 5's "ACTIVE" vertex-colour export uses the render colour attribute, and `bmesh.to_mesh` leaves that unset. So v6.glb and the hair GLBs had no gradient in three.js.
    - Fixed in the shared `kit.py`, so hair and all new parts now carry COLOR_0.
    - `v6_clips.glb` carries it too.
    - `v6.glb` itself is untouched because build_v6.py is locked.
    Use v6_clips.glb as the base body, or allow the one-line fix in build_v6.py?
23. **Expressions per clip.** Clips don't switch face frames. I assumed the engine pairs them: Laugh/Cheer/Dance with happy, Sad with sad, Sleep with sleepy, Hit with surprised, Defeat with sleepy. Want this in the catalogue?
24. **Decal slot.**
    - Every top has an `M_Decal` patch: UV 0..1, alpha MASK, a transparent 8×8 PNG by default. The engine swaps the map.
    - The TSI crewneck ships a script-drawn TSI roundel placeholder (`outfits/decal_tsi_mark.png`). Please supply the real mark.
    - The patch sits 4 mm over the cloth, so it may need polygonOffset at distance.
25. **Hood up.** The hood-up rain-cape is its own GLB (`variantOf: onepiece_raincape`), not a toggle inside one mesh. OK?

## Coordinator rulings on 18–25 (2026-09-26; David delegated routine calls)
18. Seat/desk/bed heights: the engine offsets the character per furniture anchor using each furniture GLB's measured seat/bed height; clips stay generic.
19. Fish as cast (one-shot) + FishHold (loop): keep.
20. One hat tuck shared by all hair styles: keep.
21. Layering: a one-piece replaces top and bottom; accessories have sub-slots (eyes, head, back, neck), one item per sub-slot; a head hat and a hood cannot be worn together (the later choice replaces the earlier).
22. Regenerate `v6.glb` with the vertex-colour gradient: yes. Adding the gradient does not change the locked shape.
23. Expressions per clip: Laugh/Cheer/Dance → happy, Sad/Defeat → sad, Hit → surprised, Sleep → sleepy, AttackMelee/AttackBow/AttackCast → angry, everything else → neutral with blinks.
24. Real TSI mark: use the official TSI logo already shipped in `web/public/` (the site's own logo files; a supplied asset, not a self-sourced reference) as the crewneck decal.
25. Hood-up rain-cape as its own catalogue item: keep.
