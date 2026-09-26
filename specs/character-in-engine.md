# Character in engine spec (wave B, after outfits and clips land)

Owner: one world agent in its own worktree off the Phase 0 branch. Decisions: rows 105, 108–111, 131–146, 191, 192, 210, 211, 222, 223, 233. Load `ponytail` first. Reuse the applicant island's existing 3D character path (Quaternius on `main`, now merged) rather than writing a second one.

## Inputs
- `art/characters/base/v6.glb` (+ `v6_clips.glb`), `art/characters/hair/{bangs,back}/*.glb`, outfit/shoe/accessory GLBs, `art/characters/character_catalog.json`, `art/characters/palette.json`, `face_variants.json` (+ face atlas and mask). Parts bind to the base skeleton by bone name.

## Deliverables
1. **Runtime character:** one component that loads the base rig once, attaches part meshes by bone name, applies palette colours per slot, composes the face atlas from the chosen eye/mouth/brows/extras (canvas from the mask, skin tone fill, brows tinted by hair colour), and hides back hair under hoods/hats (`hidesBackHair`). Shared geometry/materials across instances; target ≥ 12 on screen at 30 FPS on integrated graphics.
2. **Animation state machine:** idle/walk/run from movement speed (bouncy toy feel), sit/study/sleep/fish/forage/dig/net from existing interactions, emotes, combat clips (attack per weapon type, dodge, hit, defeat, trace) wired to the combat code; weapons attach to hand sockets and render everywhere once equipped (row 140).
3. **Replace the 2D player sprite and NPC sprites** in the member island and the applicant island's Quaternius characters with the new rig; residents use default appearances until the resident roster exists.
4. **Creator (ACNH layout, row 141):** character left in three-quarter view, category tabs (skin, eyes, mouth, brows/extras, bangs, back hair, top, bottom/one-piece, shoes, accessories), 2×4 thumbnail grid (rendered previews), swatch row (12 skin / 12 hair / 16 outfit), confirm; display name input with the identity API check. Shown at first login to the member game and in the applicant portal (row 142); saved to the profile/identity store; skippable with a random default.
5. **Wardrobe:** the existing wardrobe sheet now shows the real character (A-sheet display) and applies parts from inventory; closet at home and fitting room at the shop.
6. **Nameplates** keep display name + member dot.
7. Evidence prefix R- under `specs/evidence/character-engine/` (creator, 6 mixed looks in the village, every clip in context, combat stance with weapons, applicant island with the new character), tsc, lint, vitest (part attachment by bone name, hidesBackHair, face atlas composition, catalogue validation).
