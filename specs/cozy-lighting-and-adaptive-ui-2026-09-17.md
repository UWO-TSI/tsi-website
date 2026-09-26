# Applicant village: cozy lighting, appearance, and island interactions

Date: 2026-09-17. Local work on `feat/director-developer-recruitment`; no deployment.

## Outcome and scope

Improve the existing applicant island/HQ, preserve original assets and gameplay systems, and adapt application UI/loading to system appearance and campus time. Follow-up scope: smaller bush-centered fireflies with independent paths, fishing around the whole shore, intentional HQ furnishing, and a compact countdown above the wall clock.

Completion checks: type/lint checks; shoreline targets and casts remain over water; collisions preserve the entry/board path and block new furniture; fireflies wander continuously within their planting area; deadline semantics remain correct; visual inspection of night lighting, original furniture textures and UI. Remaining visual gaps are listed below.

## Research and decisions

These are engine documentation and art-direction choices, not claims about Nintendo's proprietary implementation or guaranteed psychological effects. Prior Animal Crossing research remains in [the existing report](applicant-lighting-2026-09-16.md).

| Evidence | Applied decision |
| --- | --- |
| [Unity: showcase work with lighting](https://learn.unity.com/pathway/creative-core/unit/lighting/tutorial/showcase-your-work-with-lighting?version=2022.3) covers light color, mood and key/fill separation. | Use quiet neutral/cool fill to retain colors, warm local pools at real lamps, reception, board and display. Avoid an orange wash over every surface. |
| [Epic: bloom](https://dev.epicgames.com/documentation/unreal-engine/bloom-in-unreal-engine) describes intensity, threshold and spread. | Preserve the existing optional bloom pipeline. Emission comes from windows/lamps and small insect glows; no full-screen glow layer or new postprocessing system. |
| [Epic: tone mapping and grading](https://dev.epicgames.com/documentation/en-us/unreal-engine/color-grading-and-the-filmic-tonemapper-in-unreal-engine) explains bright-emissive highlight behavior. | Keep exposure/grade restrained so furniture atlases remain legible. Stronger local warm light at night sits above a lower fill. |
| [Three.js texture documentation](https://threejs.org/docs/pages/Texture.html) specifies color texture color spaces. | Retain original embedded albedo maps and UVs, sRGB color textures and existing neutral tone mapping. Packed ACNH Mix maps are not blindly treated as standard PBR maps. |
| [MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme) states light includes no expressed preference. [web.dev color-scheme](https://web.dev/articles/color-scheme) explains UA-control appearance. | System preference owns light/dark brightness. Campus time changes warmth and sky accents without overriding an explicit light preference. CSS media queries handle initial appearance and live system changes. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) contrast guidance. | Check primary text, muted text and button contrast. Respect reduced motion for decorative loading/cloud animation and skip the arrival camera sweep. This is not a full accessibility audit. |

## Lighting and original assets

`APPLICANT_HQ_LIGHTING` now defines day/evening/night ambient, hemisphere, key, ceiling, lamp and desk strengths. Existing exterior phases, haze, clouds, shadows and warm windows remain integrated with the same renderer.

- Board-side original floor lamp at `(-6.1, 0, 4.9)`, warm light at height `2.12`, range `6`.
- Display-side lamp at `(2.6, 0, 5)`, warm light at height `2.12`, range `5.5`.
- Existing study-desk lamp receives a small pool at `(-4.8, 1.6, -2.5)`, range `3.3`.
- Entry fill at `(0, 1.4, -4.9)`, range `4`, leaves the walkway readable.
- Local point lights add no shadow-map passes; existing directional furniture shadows remain.

Imported `FtrLamp` and `FtrWoodenTableMini` from the user's existing `/Users/DavidLiu/Downloads/Assets/Model/` source collection. No replacement models were authored. `scripts/prepare-hq-lamp.py` embeds the source textures with assimp. Lamp uses body/fabric variant 0 and its explicit emission mask. Table uses body 0 and green fabric 4; fabric 0 is a flat dark default swatch and was replaced with the original green variant after visual review.

Reproduce from repo root:

```sh
python3 scripts/prepare-hq-lamp.py /Users/DavidLiu/Downloads/Assets/Model
python3 scripts/prepare-hq-lamp.py /Users/DavidLiu/Downloads/Assets/Model FtrWoodenTableMini reading-table
```

## HQ layout and countdown

- Reception remains beside the entry, with its existing desk, chair and keeper.
- Reading area: bookshelf against side wall `(7.4, 0, -2.8)` facing inward; two original study chairs at `(4.4, 0, -1.2)` and `(6, 0, -1.2)`, facing the original small table at `(5.2, 0, .35)`.
- Display remains along the north wall; acorn rug and central route remain open.
- Grandfather clock uses shared `HQ_CLOCK = [-7, 0, 5.55]`, backed against the north wall and facing into the room. Adjacent plant moved forward to avoid overlap.
- Physical collision footprints reflect the new placements.
- Within 1.8 units of the clock interaction point, a pointer-transparent, translucent 210px label appears in scene above it. It disappears when walking away or opening a panel. The former fixed bottom-right card is removed.
- Identical role schedules collapse into one timer; differing schedules retain separate role rows. Real configured dates remain authoritative. Unset dates show “Application dates coming soon”; no invented deadline. Dates use Toronto time.

## Existing gameplay reused

- `AmbientLife.Fireflies` still renders the existing ACNH firefly GLB and sun-glow sprite. Model scale `.045 → .012`; glow `.38 → .13`.
- Each insect has its own deterministic randomized, eased waypoint sequence, timing, heading and pulse. Paths stay close to an anchor rather than following synchronized circular orbits.
- Applicant anchors use the existing 22 bushes across the island, with 22 insects at evening/night or 8 in lighter mode. Height samples the applicant terrain, not the member map.
- Fishing eligibility derives from water cells adjacent to the actual island terrain. Any standable location within 3 units of that shoreline can use the existing fishing UI, minigame, catch effects and collection system.
- The target lies offshore; the existing bobber accepts an optional water-directed cast. Member fixed-spot camera-forward behavior remains the default.

## System appearance and loading

`RecruitmentAppearance` scopes semantic color tokens to the application routes. HUD, application sheets, forms, auth surface, customization, countdown, backpack, fishing surfaces and loading use these tokens; shared member components retain fallback colors. A minute/visibility subscription uses the existing Toronto phase utility: day 07:00–17:00, evening 17:00–21:00, night otherwise.

The existing cloud image/arrival sweep are reused. Loading is an honest indeterminate state, shared by route suspense and game warmup. Reduced-motion users skip the decorative sweep and CSS animation. An interior/HMR state no longer leaves the arrival-cloud overlay waiting for an outdoor camera callback.

Development preview: `?preview=1&lighting=day|evening|night&appearance=light|dark`. Appearance override is limited to the existing development preview mode; normal use follows system preferences.

## Verification and remaining gaps

Passed:
- `npx tsc --noEmit`.
- Focused ESLint for changed TS/TSX. Only dependency-age informational notice.
- 34 tests across applicant terrain/furniture, firefly paths, graphics preferences, arrival sweep and recruitment countdown.
- Shoreline test samples every half-unit of standable perimeter across all quadrants and checks short/full-power cast endpoints stay over water. Interior center cannot fish.
- Firefly tests check independent, continuous, bounded paths for 22 insects over 90 seconds.
- Original asset audit: lamp has 2 meshes/3 embedded PNGs; table 2 meshes/2 PNGs; all primitives have UVs and valid embedded images. Both are upright floor-origin source geometry.
- Main palette contrast: light body 10.80:1, muted 5.70:1, button 5.50:1; dark body 10.83:1, muted 5.96:1, button 7.53:1. Does not cover every UI state.
- Dia screenshots inspected: night exterior with small distributed glows, dark HUD, warm entrance, furnished HQ, inward-facing shelf, wall clock and original lamps with light pools. Entry interaction worked.

Still unverified visually: final green tablecloth/chair orientation adjustment, proximity countdown placement, a complete catch from multiple shores, automatic OS theme switching, loading in both system themes, and mobile layout. Dia moved to a URL where computer control was blocked; computer interaction was stopped. No attempt was made to bypass that restriction or switch browsers. Full production build and deployment were not run.
