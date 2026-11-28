# HQ interior texture and color polish

David's request: polish headquarters and make its assets use proper textures and colors. Local applicant HQ only for room lighting/palette; repaired furniture GLBs are shared assets. No layout expansion or new furniture models.

## Root cause and source assets

The old furniture export substituted brown material factors whenever a remake atlas lived in a separate source directory. It also removed the now-unused texture coordinates. Recoloring those models could not recover wood grain, books, stationery, upholstery, pots or the clock body/dial.

Original source library: `/Users/DavidLiu/Downloads/Assets/Model/`. Restored original variant 0 albedo PNGs from `<model>ReBody0.Nin_NX_NVN/mReBody_Alb.png`; chair and bulletin board additionally use `ReFabric0/mReFabric_Alb.png`.

| Existing GLB | Original source model | Restored details |
| --- | --- | --- |
| study-desk | FtrStudyDesk | Light wood, books, stationery, paper |
| study-chair | FtrStudyChair | Wood body and separate yellow upholstery |
| bookshelf | FtrBookshelf | Wood grain and individual colored books |
| wooden-chest | FtrWoodenChest | Wood grain, drawers, handles |
| bulletinboard | FtrBulletinboard | Frame and green fabric board surface |
| antique-clock | FtrAntiqueClock | Walnut body, dial, pendulum details |
| plant-monstera | FtrPlantMonstera | Original woven pot |
| plant-yucca | FtrPlantYucca | Original white pot |

Existing leaf, clock-hand, trophy and rug textures are retained. New PNGs are embedded directly in the existing GLBs. Albedo uses white material factors and roughness 0.85, avoiding a second brown multiplier. Geometry and normals remain byte-identical to HEAD. `scripts/restore-hq-textures.py` restores UVs from the original DAE, checks every triangle edge against placed geometry, rejects merged UV seams, and skips already-restored assets. Repeat samplers preserve source UVs outside 0–1. Piece/preload URLs share a version suffix to invalidate previously cached brown models.

## Room polish

- Reused `RoomTexFloorSimpleParquet00` albedo, copied unchanged to `web/public/assets/acnh/interior/hq-parquet-albedo.png`. Repeat 1 × 0.75 preserves square floor panels across a 16 × 12 room.
- Sage wainscoting `#a1ae91`, cream walls, original light wood furniture and warm walnut clock.
- Neutral cream ambient 0.75, cool sky/warm ground hemisphere 0.65, warm central pool 24, cream directional key 0.85. Existing localized board/trophy pools retained.
- Interior grade: desaturation 0.04, lift 0.35, warmth 0.25, vignette 0.16. Color warmth comes primarily from light rather than a heavy global cast.
- Furniture opts into the existing cached shadow system; receiving floor and 2048 directional shadow map. Lighter graphics still disables shadow rendering.
- Bookshelf faces the room. Welcome mat gets X/Y half-turns so it is right-side up and legible from the entrance. Existing desk/chest/trophy orientation fixes preserved.

## Verification

- Eight-asset binary audit passed: valid embedded image payloads and buffer bounds; 13 textured primitives have UVs; positions/normals unchanged from HEAD.
- `npx tsc --noEmit`: pass.
- Focused ESLint: pass (existing baseline-browser-mapping age advisory only).
- Model-material and interior-backdrop suites: 7 tests pass.
- Dia localhost: inspected restored textures in pixel and smooth modes; exit/re-entry works; hiring board opens all four roles; clock proximity shows date-aware application panel (dates are currently unset).
- Screenshot: `specs/references/lighting-2026-09-16/hq-interior-restored-smooth.png`.
- The previous golden exterior windows/firefly pass is now visually observed in Dia after reloading the previously failed preview.
- No production build, authenticated submission, mobile hardware or GPU benchmark claimed. No push/deploy.

Lighter-mode interior visual check remains incomplete: a development hot reload re-ran the arrival overlay while inside; a full reload recovered the preview. Dia then stopped accepting native coordinate clicks (no-window error), so the indoor lite pass was not completed. Original preferences restored: pixel finish on, lighter graphics off. Pixel/smooth HQ checks above completed before this interruption.
