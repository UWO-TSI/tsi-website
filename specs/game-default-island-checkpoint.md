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

## September 7 NPC rendering and interaction follow-up

- Movement/pose batch committed locally as `ff1cb5a`.
- Missing legacy mayor/shopkeeper sprite URLs now resolve to existing bundled art. Custom art is preserved and retries a stable bundled fallback on failure, isolated from critical scene loading. Deliberately tested a missing custom NPC image, observed the fallback, and restored the real source.
- Fixed a placeholder-to-sprite material reuse bug that made the loaded NPC invisible. Sprite, notice/bubble and nameplate share the animated pose; removed duplicate shadows and oversized ghost-like glow. Scheduled voice blips clean up on unmount.
- Added curved billboard hit testing with three camera-angle/clip tests. Live Dia click on the drawn NPC triggered its greeting hop. NPC clicks prevent the ground movement handler from also consuming the event.
- Reference island includes Mayor Eliza with terrain-aware wandering. At 390×844, NPC and compact controls render; fixed world labels drawing above the settings panel by containing the canvas stacking context. Fresh console after the final reload has no warnings/errors.
- 154 tests across 11 files, TypeScript, targeted ESLint and diff check pass. Latest production build predates this NPC batch. No touch-hardware, live chat/persistence or controlled-performance acceptance claimed.

## September 7 input ownership follow-up

- NPC batch committed locally as `3b135c2`.
- Shared keyboard handling clears held keys and pending travel on window blur, hidden document, control focus and cleanup. Browser modifier shortcuts and already-consumed events do not move the avatar. Nine lifecycle/ownership tests added.
- Exterior player and camera now pause for loading, transitions, sheets, chat, collection, controls, graphics, welcome, emotes and fishing. Interiors use the same pause state and key cleanup. Camera arrows scale rotation by elapsed seconds rather than frame count.
- Game hotkeys respect focused controls and avoid repeated toggles. Hold-Tab presence list yields to menu navigation and clears on blur/visibility loss. Graphics toggles now expose accessible labels; controls correctly describe tap movement as touch-only.
- Live Dia: controls and graphics opened and closed with Escape; keyboard Space toggled Pixel filter off and on. Collection opened. During controls, brief W/arrow presses did not change displayed player coordinates. Sustained held-key pause/resume and touch-device checks remain unverified; unit tests cover the event lifecycle. Existing unauthenticated collection/presence requests return 401 and seasonal palette uses its fallback.
- 163 tests across 12 files, TypeScript, targeted ESLint and production webpack build pass. Existing baseline-browser-data and middleware warnings remain. Dev preview restored on 3107; main remains clean.

## September 7 natural materials and canopy follow-up

- Input batch committed locally as `27bc949`.
- Sand and soil now feather into grass across a narrow 0.3-tile boundary derived from the same eased cell outlines. Path centres remain opaque; water/wood/stone borders do not acquire a green rim. Four tests cover edge falloff, one-tile paths, rounded corners, cell joins and map immutability. Grid editing/collision data is unchanged.
- Natural overlays use owned material clones and vertex alpha; chunk geometry and the owned materials dispose on replacement/unmount.
- Reviewed the existing `nature/tree_detailed.glb` and `nature/tree_oak.glb` in the model inspector. Their blocky/faceted crowns are a weaker match for the confirmed textured scenery. Kept the existing tree library.
- Broadleaf placement now presents the authored canopy front toward the primary camera, with small yaw variation instead of arbitrary full turns. Layered broadleaf meshes no longer receive card-to-card shadows; trunks still receive shadows and trees still cast them. Dia before/after shows the blossom's dark canopy patches replaced by a continuous pink crown. No source asset binaries changed.
- Dia: unfiltered overview and pixelated golden-hour walk view render with no fresh warnings/errors. Example local overview sample: 145 draws, 54,637 triangles, 144 FPS on the current host. This is a development sample, not controlled laptop acceptance or a comparison against the earlier busy-host result.
- 167 tests across 13 files and TypeScript pass. Targeted ESLint has zero errors and two pre-existing GridTerrain unused-symbol warnings. Latest production build predates this visual batch.
- Still open: grid-shaped outer coastline (larger terrain/map work deferred), broadleaf profile under a full side orbit, controlled device performance and full-game integration. The material blend is not a new custom-map implementation.

## September 7 movement render cost and spawn framing

- Natural materials/canopy batch committed locally as `f6b6a9a`.
- Buildings and NPCs now consume the shared position ref rather than forcing Scene to render for every walking frame. Building proximity state changes only at range boundaries. Nearest-interaction state skips equivalent records while preserving target, action, coordinate and content changes. Three regression tests added.
- Live Dia measurement on `/lab/world?nointro`: same starting framing and pointer target at (1770, 1010), with Noon selected. Baseline produced 252 Scene render invocations between 06:06:37.693 and 06:06:42.660 UTC; optimized run produced 4 between 06:09:07.009 and 06:09:11.996 UTC. Both walks visibly reached the same area. These are development render invocations (including Strict Mode behavior), not committed frames or an FPS claim.
- Measurement temporarily enabled pointer walking on the fine-pointer host and logged render calls. Both temporary edits were removed; desktop remains WASD-only, touch retains tap movement. No QA flag/log remains in source.
- Avatar reports its grounded position on mount, so initial camera framing and interaction tracking no longer wait for a first step. Initial camera lead ignores the uninitialized velocity sample. Fresh Dia load shows the avatar in frame before movement.
- Signpost and building labels use the shared curved projection. Signpost text remains readable nearby and hides at distance; building name/prompt no longer overlap. Fresh full-world console has only the existing seasonal-palette fallback warning; protected requests remain unauthenticated in the lab.
- 170 tests across 14 files, TypeScript, targeted ESLint and production webpack build pass. This build includes the previous surface/canopy changes. Dev preview restored on port 3107.

## September 7 shared building and foliage material ownership

- Previous batch committed as `ea53087`. ACNH building parts and seasonal decorations now own cloned materials; finishing and HQ flag assignment no longer mutate cached GLTF materials. Owned materials clean up on replacement/unmount, including the legacy flat-colour building fallback.
- Instanced nature now uses the same material preparation as the reference island, retaining material arrays and canopy receive-shadow rules. Cached geometry/textures remain shared and are excluded from automatic instance disposal. Extended the ownership test to cover material arrays and shared texture survival.
- Both tree placement paths use the same broadleaf yaw. Restored the documented distant-tree shadow exclusion, whose far bucket had accidentally retained the default castShadow=true.
- Dia full-world Noon check shows the HQ flag and continuous blossom crowns. Fresh full-world console has only the existing seasonal-palette fallback warning. Route change exposed a grass-normal texture marked for upload before its image loaded; UV repeat changes do not require an upload, so removed that redundant needsUpdate. Cold default-island load after the fix has no warnings/errors.
- Targeted material ownership test, TypeScript and targeted ESLint pass. Previous complete suite: 170 tests; previous production build passed before this batch. Authenticated services and physical device inputs remain unverified.
- Next: verify the postprocessing exposure path. Local dependency code disables renderer tone mapping while the current composer contains no ToneMapping effect; investigate before retuning lighting. Larger terrain/authored-map work stays deferred.

## September 7 exposure pipeline and reference light calibration

- Shared asset batch committed as `fca5e06`. Found that installed @react-three/postprocessing disables renderer tone mapping while PostFX had no replacement effect. Live Dia exposure 0.5 versus 1.6 produced no visible scene change before repair.
- Added explicit NEUTRAL ToneMapping after HDR effects, matching the operator both Canvas roots already select. Repeated exposure extremes now visibly darken/brighten the HQ and terrain. Reviewed pixelated dusk with bloom, unfiltered view, lite-mode fallback and restoration; no new runtime errors.
- Source: [postprocessing tone mapping documentation](https://pmndrs.github.io/postprocessing/public/docs/#tone-mapping), checked September 7; installed EffectComposer implementation corroborates renderer tone-mapping suppression. Exposure behavior is verified in the live app, not inferred solely from documentation.
- Corrected reference light levels after the pipeline fix: daylight sun 3.2, golden hour 2.7, overcast 1.35; ambient 0.4 and hemisphere 1. All three presets reviewed in Dia; brighter daylight preserves building and foliage detail. Full-world lighting presets still need their later art pass.
- Graphics hints no longer present an old host-specific bloom/shadow FPS cost as a universal estimate. Bloom restored off, lite mode off, pixel filter on; no saved lab grading draft overwritten.
- 170 tests, TypeScript, targeted ESLint and production webpack build pass, including the preceding model-ownership batch. Existing build deprecation/browser-data warnings remain. Continuous local work, no push/deploy.
- Next: NPC interaction targets must follow current wandering positions and refresh while the player stands still; preserve existing interaction radii/actions and progression.

## September 7 live interaction tracking

- Rendering/exposure batch committed as `aad0b7d`. Nearest-target sweeps now run every 50 ms while exterior input is active, independently of player movement. Existing target radii, priorities and actions are preserved; critters and picked flowers also refresh while stationary.
- Permanent NPCs publish their current grounded position through refs. NPC selection and target glow follow the drawn character instead of its day/night/weather anchor.
- Live Dia check used temporary bundled permanent NPCs because the unauthenticated world bench returned none. Player remained at (-5, -2). Mayor acquired at distance 3.4985827 (06:40:59.753 UTC) and cleared at 3.5045511 (06:41:19.248 UTC), without moving the player. Logged glow coordinates exactly matched the mayor's current grounded position. A passing critter also acquired/cleared while stationary.
- Temporary NPC fixture and QA_LIVE_NPC logging removed. Default island fresh console clean. TypeScript, targeted ESLint and diff check pass. Prior 170-test suite and production build passed before this interaction batch; no authenticated NPC conversation or persistence claim.
- Next: finish camera-follow settling at rest, then review the reference/traversal checkpoint against the agreed part-by-part scope. Authored terrain remains deferred.

## September 7 camera settling and curved model visibility

- Live-target batch committed as `f655587`. Camera follow now samples position every frame and settles look-ahead to zero at rest; it stops requesting camera moves after settling. Four tests cover distant spawn, rest, matching 15–120 FPS walks, terrain height and a bounded resume step.
- Follow yields while controls are unavailable, gameplay is paused or the opening flythrough is active. Dia cold framing and a plaza walk finish with the avatar framed correctly. Temporary fine-pointer walking override removed afterward.
- Flythrough QA exposed an old sky-dominated opening shot. Moved its opening pose closer to the village; the sweep and landing remain skippable. Temporarily forced the intro for inspection without clearing stored preferences, then restored the usual first-visit guard.
- The museum vanished at the intro endpoint: its centre projected to vertical NDC 1.266 before bending, but 0.849 after bending, inside the visible frame. Shared prepared models now bypass unbent CPU frustum culling. Regression test demonstrates the unbent bounds rejection and in-frame bent point. Dia repeat shows the museum present after landing.
- Visibility fix can draw additional off-screen meshes. A local full-world night sample showed about 40 FPS, 416 draws and 388.1k triangles; counts fluctuate with alternating shadow frames. This is not a controlled before/after or laptop acceptance. Full-world art/performance still need their integration pass.
- All temporary QA_CAMERA_* overrides removed. 175 tests across 15 files, TypeScript via production build, targeted ESLint, diff check and production webpack build pass, including live interaction tracking. Existing seasonal-palette fallback/unauthenticated lab limits remain.
- Next: representative building door/window asset inspection and polish, continuing the shared import contract. No authored-map, backend, currency, recruitment or marketing changes.

## September 7 HQ door and window presentation

- Camera/culling batch committed as `dc7c7fa`. Extracted the existing ACNH part assembly into `ACNHBuilding.tsx`, allowing the default island to load the same HQ body and separate door as the full world without importing all building preloads.
- Removed the opaque cream entry plane that hid the real paneled door. Kept its soft entry light. HQ night windows now animate the existing model emissive textures instead of drawing rectangular overlays across the arches. Instance-owned materials preserve cached asset isolation.
- Dia verified the brown paneled door and arched window detail in reference daylight/evening and full-world Noon/Night. Fresh diagnostics contain only the existing full-world seasonal-palette fallback warning. Full-world lighting remains darker than the reference and awaits its integration art pass.
- TypeScript initially found three byte-identical generated `.next/types` copies with ` 2` suffixes. Moved only those verified duplicates to `/var/folders/6q/97z85wms4pl1b74vwpsqxy_40000gn/T/uwotsi-generated-route-duplicates-hkv3a40g`; origin unknown. No source/config change was needed. TypeScript, targeted ESLint and production webpack build pass. Previous complete suite remains 175 tests; no new tests for this visual assembly change.
- Preview restored on 3107. Next: inspect shop materials and recover existing texture detail where possible. No source asset binaries, authored map, economy, backend, recruitment or marketing changes in this batch.
