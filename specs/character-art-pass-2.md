# Character art pass 2

Owner: one Blender art agent (art/characters + the sync script + catalogue). Style rules unchanged (`specs/character-set.md`, `kit.py`, locked v6). Never source references.

1. Wearable parts for the crafted clothes that exist as items but have no model: straw hat, flower crown, shell necklace, crystal circlet, silk sweater, monarch cape, koi kimono. Map each to its slot (head/neck accessory sub-slots, top, one-piece), `hidesBackHair` for hats, catalogue ids matching the item keys in `web/lib/crafting` and the economy catalogue so owning the item makes it wearable.
2. A real `Stretch` clip (seated, arms up and back, 2 s loop) replacing the Cheer-arms stand-in; update the study pose mapping only by clip name.
3. Fixes from the first pass: the beanie reads as a beret (make it a snug knit cap with a folded brim); the cap shows stripes of forehead under the wispy bangs (adjust the hat tuck); backpack clipping long back-hair; long skirts when sitting (knees).
4. Run `web/scripts/sync-character-assets.mjs`, keep `web/data/characters/*.json` tracked, update contact sheets (`outfits_sheet.png`, `accessories_sheet.png`, `clips_contact.png`), in-engine evidence (A2- WebP under `specs/evidence/character-art-2/`): each new wearable on the character in the village, the Stretch at a cafe table, the fixed beanie and cap.
Gates: tsc, full vitest (catalogue validation), focused eslint.
