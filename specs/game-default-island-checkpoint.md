# Default island: first review checkpoint

Updated 2026-09-07. Branch `feat/game-default-island`, based on game tip `2a388d5`.
Local URL: http://127.0.0.1:3107/lab/island

## Agreed scope

Animal Crossing-inspired scenery with 2D sprite characters. Pixel filter defaults on and can be switched off; reuse the existing per-device setting. Start with existing assets and propose replacements where they fall short. Preserve activity purposes and overall vision. Broader mechanics/progression changes require review. Full laptop game and lightweight phone presence remain the overall target. This scene establishes the first visual reference on a simple temporary island; custom map update is deferred.

## Implemented

- Development-only island route using shared GridWorld, PlayerAvatar, PostFX and existing GLB/sprite assets. Production lab 404 remains in place.
- Small island fixture, soil path, wooden crossing, gentle bank, HQ and curated vegetation. Fixture never reads or overwrites authored map drafts.
- Walk/overview cameras, daylight/golden-hour/overcast presets, return-to-clearing and frame timing.
- Pixel toggle changes render resolution and nearest-neighbor upscaling, persists with the existing settings key, and also fixes the main GameWorld's always-pixelated canvas styling. Filter off preserves the 2D sprite artwork.
- Swept movement blocks water, shores, HQ and trees; slide movement and shared ground-height sampling. Clear held keys on blur/unmount, bind input to the stable sound callback, and bound large frame steps.
- Ground queries clamp to the same cell height range as the rendered grid. Correct normal-map color space and water sun direction. Soil gets its missing tint. Water extends under rounded shore cutouts, the bed has minimum clearance, and grass fringe is limited to grass banks.

## Verification

- 134 tests pass across seven files, including terrain/movement, curved projection/picking and material ownership cases. TypeScript passes.
- ESLint on changed TypeScript files: zero errors, five pre-existing unused-symbol warnings. Final touched files rechecked after fixes. `git diff --check` passes.
- Native Dia: route loads; initial pixel view and filter-off view render; off survives a true reload; toggle restored on. Held W crosses the wooden passage from spawn; HQ stops the avatar at z≈6.5. Return to clearing restores avatar and camera to (0, -10) after movement. Walk and overview cameras render; overcast preset changes the scene. An initial held-key regression was found and fixed through browser testing.
- Local development samples approximately 27–30 FPS at a 2560×1410 browser window on the busy host. This is not a controlled production benchmark or laptop performance acceptance.
- Screenshots: `/Users/DavidLiu/Desktop/ClaudeBrain/Documents/uwotsi-default-island-2026-09-06/`.

## September 7 polish and verification

- Fixed grass fringe alpha-mask tint and UV direction, grass contact on slopes, hardwood colour and the HQ flag using the existing Tethos logo. Extended ocean beyond the map rectangle.
- World labels and touch picking now use the same view-space bend as the shader. Labels retain readable screen size. Camera updates precede label projection.
- Static shadows refresh on asset/light/settings changes. Measured draw calls reduced from 170 to 138. Colour grading disabled did not improve settled frame rate on the busy host; performance acceptance remains open.
- At 390×844, compact settings use View options and navigation scrolls horizontally. Space toggles the pixel checkbox. Canvas can receive keyboard focus; focusing controls clears held movement.
- Image loading moved out of avatar rendering; owned textures/materials clean up on unmount. Movement markers and sit feedback use the supplied ground height. Water beneath eased shores uses neighboring river elevation.
- Fresh Dia console after 04:32:40 UTC: no warnings/errors. Historical HMR messages were excluded by timestamp. Golden-hour lighting renders correctly.
- Production webpack build with 4 GB heap passed; local production GET /lab/island returned 404. Existing middleware deprecation, multiple-lockfile and stale baseline-browser-data warnings remain. Dev preview restored to port 3107.
- David explicitly authorized continuous local implementation/polish/QA without approval between steps. Checkpoints do not pause work; personal testing is still required before any push.

## Still open within Part 1

This is a playable review checkpoint, not final visual or whole-game acceptance. Continue this part before moving on to the next subsystem.

- Refine shoreline silhouette and material blending. Grid-shaped beach outline remains visible; dark fringe and square water horizon have been repaired.
- Compare thin vegetation silhouettes at multiple angles; material/flag/nameplate repairs are in place. Continue existing-library-first evaluation.
- Controlled laptop production performance measurement and profiling; phone presence is not implemented by this lab.
- Remaining runtime checks: jump/sprint, blur/resume and loading failure; controlled device inputs and broader network audit. Golden hour, compact layout, fresh console and production build are now checked.
- Revisit the existing full game with shared material/input changes before integration. No authentication/backend/economy changes were made, and existing functional portal/activity loops were not regression-tested here.
- David's art/feel feedback remains useful while implementation and QA continue. No push/deploy; main and the saved custom map are untouched.

## September 7 recovery and traversal follow-up

- First checkpoint committed locally as `3dff288`.
- Corrected two-channel grass normals by reconstructing Z in the material shader. Shader compiles and the reference scene renders normally.
- Footstep surfaces come from the default island grid; collision-constrained movement now drives walking feedback and sprint velocity. Rounded shoreline cutouts are excluded from walkable ground using the same outline as the mesh. Added a footprint regression test.
- During full-world QA, a hot reload lost the WebGL context and PostFX attempted to add passes to it. PostFX now observes context loss/restoration; a test verifies suspension, restore notification and listener cleanup. Real GPU restoration is not yet fault-injected.
- Added a shared scene error boundary to the reference scene and full GameWorld. Deliberately substituted a missing HQ model: recovery screen appeared with Reload island and lab navigation remained usable. Restored the real URL, clicked Reload island and verified the scene plus a fresh clean console. No fault injection remains in source.
- Full legacy world renders after a fresh reload and Noon control change. It still has a seasonal palette fetch fallback warning and existing visual debt; this is a smoke check, not whole-world acceptance. An earlier auth-lock recovery warning appeared during heavy hot reloads. Backend contracts were not changed.
- Turbopack resolved Tailwind from the wrong repository root after switching between production build and dev. Set explicit web app roots and moved stale `.next/dev` output into a uniquely named `/tmp/uwotsi-island-dev-cache-*` directory. Both lab routes then compiled and returned 200. No dependency updates.
- Latest suite: 136 tests across eight files. TypeScript and targeted ESLint pass. Production build predates this follow-up and will be rerun after the next coherent batch.

## September 7 movement and avatar pose follow-up

- Second checkpoint committed locally as `32e90dd`.
- Replaced frame-end velocity integration with exact exponential displacement. The old calculation moved about 18 cm farther over one second at 15 FPS than at 120 FPS. Tests now compare walking, sprinting, reversing and stopping across 10–120 FPS.
- Tap movement slows toward its target, stops within 10 cm and clears velocity; tests verify no overshoot and that collision still blocks water with no walking feedback against a bank.
- Facing turns through the shortest angular arc and sprite direction is camera-relative, including cameras on all four sides.
- Dia hop screenshot exposed a stationary outline and overlapping nameplate. Sprite, outline and label now share the animated billboard pose, updated before camera/HTML projection. Repeat hop screenshot shows the outline attached and label above the head.
- Latest suite: 149 tests across nine files; TypeScript and targeted ESLint pass. Production webpack build passed after this batch and the recovery/root changes. Dev preview restored on 3107.
- Full-world logs also revealed missing permanent NPC sprite URLs in content defaults; investigate with existing sprite library next. Auth-protected collection/ghost endpoints return 401 in the unauthenticated lab, so this smoke check does not verify persistence or live presence.
- CUA reconnect note: reset detached the original tab (511417935); reconnect could not reclaim it. Current QA tab 511417936 opened through the same verified Dia extension browser. Do not reset the CUA session merely to reread documentation. Old preview remains open because its handle could not close it; do not close unrelated user tabs.
