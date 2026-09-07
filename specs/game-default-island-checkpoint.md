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

## September 7 shop sign and window presentation

- HQ batch committed as `99f761e`. Found the missing shop sign albedo in the separate US-English source folder. Built-in image_gen adapted the existing atlas to “Tethos Shop” with a small star; installed `web/public/assets/branding/shop-sign-v1.png`. Exact prompt and provenance: `specs/shop-sign-asset.md`. Original assets remain intact.
- Shop owned material now receives the sign texture. Replaced its flat night-window quads with existing model emissive maps using the same dusk/night fade as HQ. Source side-window material is also plain, so no nonexistent texture was invented.
- Dia: temporary shop fixture in the default island verified sign text, UV alignment, door/window detail in pixelated daylight and unfiltered evening. Full-world Noon/Night checks passed, with only existing seasonal-palette fallback warning. Restored HQ fixture and pixel filter. Full-world distant sign readability still depends on the later lighting/camera pass.
- TypeScript, targeted ESLint, two material-ownership/visibility tests pass. Latest complete suite remains 175; latest production build passed at HQ commit, before this shop batch. No new backend/persistence claim.
- Next: inspect the cast/hook/reel/reveal loop and its existing test bench, preserving activity purpose and progression rules. Broad terrain and full-world art/device acceptance remain open integration work, not declared complete.

## September 7 fishing reel timing and input

- Shop batch committed as `5e059e5`. Started the fishing control/feedback pass while preserving species parameters, rarity widths, rewards and progression. First defect: fish jitter was added per rendered frame, changing the fight with display rate.
- Extracted the reel into a 60 Hz simulation shared by the game and existing fishing bench. Six tests cover matching seeded Dace/Bass/Golden Koi fights at 15/30/60/120 FPS, actor bounds, catch/escape terminal state and bounded suspended-frame catch-up.
- Input now tracks E, Space and each pointer separately. Blur, hidden document or focus in another control clears held inputs and pauses the reel. Returning requires fresh input; multiple held controls do not cancel each other when only one releases. Nine lifecycle tests cover ownership, browser modifiers, pause/resume, Escape and cleanup.
- Added focusable Fishing reel region, explicit hold/release/Escape instructions, visible paused state and named catch-progress semantics. Dia catch result (Dace, 17 cm), Escape and retries verified. Control-focus pause stayed at 42% across separate checks, then advanced on resume. No fresh warnings/errors. Physical sustained keys, touch hardware and authenticated catch persistence remain unverified.
- 190 tests across 17 files, targeted ESLint and production webpack build (including shop texture batch) pass. Preview restored on 3107. Next: cast/hook cancellation, transition input and reveal skip checks. No economy or weather probability changes.

## September 7 cast lifecycle and cancellation

- Reel batch committed as `0be5d5c`. Cast phase updates now publish synchronously to event listeners. The parent retains quick E/pointer releases before the meter mounts; competing starts cannot overwrite the active spot. Invalid coordinates are ignored, and cancelled casts cannot advance from stale callbacks.
- Escape is captured by the cast lifecycle without opening the world's menu. Pending charging/casting/waiting/bite phases cancel on blur, hidden document or pointer cancellation; reel and completed reveal retain their own behavior. Added visible Cancel/Close controls, Space hooking, clearer hook instructions and dark cast-percentage text on the cream panel.
- Ten additional lifecycle tests cover same-turn release, duplicate/invalid start, ignored releases, phase-specific Escape, interruptions and cleanup. All 25 fishing tests, TypeScript and targeted ESLint pass. Previous complete suite/build: 190 tests and production build at reel batch; latest cast changes have not yet had a full production rebuild.
- Dia temporary cast trigger: quick press/release reached Casting; direct cancellation and cancellation during a bite returned to idle without opening a reel. Full timed cast → hook → reel → Escape → Close succeeded. Charging percentage is readable, and Escape works while the cancel button is focused. Timed locator checks required a regex for the double-space bite label. No catch was saved during this fixture check. Both QA cast/charge buttons and temporary overlay mount removed; bench file has no diff.
- Next: first-catch reveal input/skip lifecycle, including repeated held keys. No reward, fish-pool, inventory or backend changes.

## September 7 first-catch reveal controls

- Cast batch committed as `34d8b4f`. Reveal stage refs now change synchronously, preventing rapid inputs from repeating a transition/celebration before React commits. Repeated held E/Space/Enter events are consumed without skipping; Escape closes the reveal immediately.
- Added visible Reveal catch, Continue and Close controls; modal dialog semantics, keyboard focus containment and focus restoration. Timings, rarity celebration and fish discovery rules are unchanged.
- Dia: Escape dismissed immediately. Arapaima preview accepted Tab → Close → Tab → Reveal catch → Enter, reached Continue and dismissed. Read-only DOM inspection confirmed initial button focus and return to Preview first-catch reveal with zero remaining dialogs. No fresh runtime warnings/errors. Physical held-key behavior remains unverified; repeat-event guarding is source-reviewed.
- Inspected the narrow Arapaima icon and its source renderer. The head-up orientation is explicitly recorded as David's July 24 choice in `/lab/icon`, so it was preserved. No fish icons regenerated. Legacy `_render-icons.mjs` launches Chromium and was not run because browser work must use Dia.
- 200 tests across 17 files, TypeScript, targeted ESLint and production webpack build pass, including cast lifecycle changes. Preview restored on 3107. Main worktree verified clean. Next: accurate weather and odds descriptions without changing catch probabilities or progression.

## September 7 weather and odds feedback

- Reveal batch committed as `0e28b7a`. Removed the cloudy “15% more sea bites” claim: multiplying every member of a sea-only weighted pool by 1.15 cancels during normalization. Existing probability parameters were left unchanged.
- Sunny copy now describes 12% more cast time (the actual period multiplier). Rain copy distinguishes bonus luck, expanded time windows and improved Golden Koi chances without claiming exact doubled normalized probabilities or incorrectly calling Stringfish/Gar/Catfish rain-only. Reveal odds are labeled Base odds because cast and extra weather luck are omitted from that display.
- Weather/time chips now use native buttons, expose expanded state and tooltip descriptions, open reliably on click/Space, and close on Escape without forwarding it to world menus. Native focus also uses the existing world-control ownership guard.
- Dia cloudy and rainy tooltips show revised copy. Cloudy expanded state changed true→false on Escape and false→true on Space. Fresh full-world diagnostics contain only existing seasonal-palette fallback warnings. TypeScript, targeted ESLint and diff check pass; latest full suite/build remain 200 tests and the successful reveal build, before this small copy/control batch.
- Next: preserve the initiating key/pointer across the hook→reel transition so a held hook can immediately reel. Authenticated catch/inventory and physical sustained-input/device checks remain open.

## September 7 hook-to-reel input handoff

- Weather batch committed as `0ea4ae7`. Hooking now records the initiating E/Space key or pointer before mounting the reel. The always-mounted cast listener observes releases during that transition, so the reel inherits only inputs still held.
- Reel ownership copies the handoff state rather than clearing the source during effect cleanup. Three regression tests cover immediate keyboard/pointer inheritance, release before mount, and cleanup/remount without resurrecting a released key. Previous multi-input/pause lifecycle tests remain green.
- 203 tests across 17 files, TypeScript, targeted ESLint and production webpack build pass, including weather copy/native controls. Physical held-input handoff remains unverified in Dia; the event lifecycle is unit-tested. Previous Dia cast/reel/reveal paths passed. Preview restored on 3107.
- Collection review started with Supabase skill and local source reads. No backend/schema edits or live data mutations made. Existing collection counts conflate discovery/stock; sales contain a second earn request in addition to atomic sale RPC and cap local payout. These are now under review; economy vision conflict remains recorded, with no currency-rule changes authorized by inference.

## September 7 collection discovery and book controls

- Hook handoff committed as `1312a10`. Local collection records now retain zero-stock discoveries; the book and first-catch silhouette use discovery presence rather than positive stock. Invalid stored records, counts and item keys are rejected. No schema, reward or currency changes.
- Collection opens immediately from local data, refreshes on each opening, cancels stale fetches/audio on close, and reports account-sync failure. Added native fish buttons, pressed filters, modal focus containment/restoration, Escape ownership, visible focus rings and a persistent header/close control.
- 18 isolated storage tests cover depletion/recollection, malformed data, invalid spending, merge discovery and unavailable storage. Full suite: 221 tests across 18 files. TypeScript and targeted ESLint pass. Latest production build is at the preceding 203-test handoff batch; this collection batch has not yet been production rebuilt.
- Dia temporary source fixture (no browser inventory writes): zero-stock Dace retained in 2/118 discovered count, Discovered filter and Enter-opened field notes; Tab/Shift-Tab containment, Escape focus restoration, reopening reset and sticky close control verified. No fresh console warnings/errors. Fixture removed and normal fishing bench restored. Phone-width check blocked by viewport capability referencing detached duplicate tab 511417935; active tab remains normal 2548px width. No responsive pass claimed.
- Remaining: authenticated collection/sale integrity (max merge can resurrect stock; legacy sale also requests an extra earn), old deleted local discovery cannot be recovered without server history, physical input/device and controlled laptop performance QA. Currency vision conflict remains unresolved in historical code; no inferred economy redesign. Next bounded work: fix fishing bench habitat odds/simulator mismatch without changing game probabilities.

## September 7 habitat-correct fishing bench

- Collection batch committed as `d5e0d30`. Fishing bench now selects River/Sea, computes odds from the same weighted pool as actual rolls (including existing weather luck), simulates that habitat, and clears results on environment changes. Cast luck is explicitly zero.
- Shared pool extraction preserves the prior roll distribution. Four tests compare prior arithmetic across weather, habitats, hours, luck and random boundaries, and verify nonempty finite normalized pools over the day. Full suite: 225 tests across 19 files; TypeScript, targeted ESLint and production webpack build pass, including the collection batch.
- Dia: river 30/47 and sea 33/44 active species at the tested early-morning cloudy setting; sea simulation returned only sea catches, rain cleared prior results. No fresh runtime warnings/errors. Dev restored on 3107; main remains clean. No live data, currency, catch probability or progression changes.
- Next: full-world lighting/resource-lifecycle visual pass. Phone viewport remains blocked by detached duplicate tab in the browser capability.

## September 7 environment-light resource lifetime

- Fishing bench batch committed as `dc125f9`. Environment-light bake cache is now scoped to each scene and renderer. A synchronous bake creates and disposes its PMREM generator, avoiding reuse of the previous Canvas renderer after remount. Replaced render targets and temporary input textures are released; failed bakes keep the previous scene environment.
- Five focused tests pass for phase caching, independent scenes, replacement renderers, failed bake cleanup and safe repeated cleanup with another owner's environment. Initial test disposal listeners were corrected to observe the render target (Three emits disposal there), then all five passed. TypeScript and targeted ESLint pass. Previous full suite/build: 225 tests at fishing bench batch.
- Dia day/night and cloudy/rain/sunny remounts remained rendered with only the existing seasonal-palette fallback warning. Night view still has low building depth and overbright river; this resource fix deliberately leaves all light values unchanged. Next: bounded nighttime readability pass.
- Three.js PMREM lifetime checked against installed source and https://threejs.org/docs/pages/PMREMGenerator.html. No backend, currency or authored-map edits.

## September 7 moonlight and water-highlight pass

- Environment lifetime committed as `bb0a1d9`. Full world reuses its existing directional/shadow light for a soft moon key. The night palette now holds from 21:00 through 04:00 instead of blending toward dawn for the whole night. Daytime sun values are unchanged. Dawn/dusk moon fades are continuous and unit-tested.
- Default-island preview adds Moonlight with the same key, a night water palette, window glow and readable heading contrast. Daylight stays the default. Dia verified night, daytime restoration and pixel filter on/off; full-world noon/dusk/clear-night/rain-night also render. Buildings/props have clearer night form; the full-world legacy river remains visually pale and needs further art work.
- Legacy river highlights now follow its existing phase palette instead of adding fixed daytime white. The animation ref follows replacement materials, and material cleanup no longer disposes unchanged geometry. Temporary red/base-color shader probes and window/uniform console diagnostics were removed. They confirmed the visible river layer and live night uniform values; no geometry, grid, authored map or saved tuning changes.
- 232 tests across 21 files, targeted ESLint, TypeScript and production webpack build pass, including the environment-lifetime batch. Dia logs: existing seasonal-palette fallback only in full world; clean default-island checks. Preview restored on 3107, daylight and pixelation restored. No push/deploy.
- Phone viewport still blocked: capability targets detached duplicate 511417935; re-claim/close attempts remain detached, and native Dia access reports no window. Active 511417936 remains usable. No mobile pass claimed. Next: interaction overlays and accurate failure/pending feedback; authenticated persistence and controlled device performance remain open.

## September 7 NPC conversation lifetime and failure feedback

- Lighting batch committed as `6bda7d3`. NPC overlay now mounts a conversation keyed by persona ID. Parent callback identity changes no longer reset history/drafts. Close or NPC change aborts history/send/report requests, late responses are ignored, and a synchronous pending guard prevents duplicate sends.
- Drafts remain through request failures; retries use edited text. History loading permits composing but gates Send to prevent history overwriting new replies. Sign-in/unavailable states stay readable rather than auto-closing; non-auth history failures permit a new message. Composer retains focus while pending; added modal Tab/Escape ownership, reply text exposed once to assistive tech, IME/repeat guarding and the API's existing 500-character limit.
- Extracted typed client transport with 14 tests for statuses, malformed replies/history, cancellation and bodyless report acknowledgement. Full suite: 246 tests across 22 files. TypeScript, targeted ESLint and diff check pass. Latest production build is the preceding lighting batch (232 tests); conversation batch not yet production rebuilt.
- Dia source-only transport fixture (no network/model calls): parent rerender preserved draft/history count; repeated pending Enter kept one send; rejection preserved draft; edited Retry succeeded; switching NPC aborted the previous request and ignored its forced late reply; Escape aborted another request; Tab/Shift-Tab and focus restoration passed; slow history gated Send while retaining typed text; signed-out and history-failure feedback verified. No fresh runtime warnings/errors. Fixture removed, regular island preview restored.
- Next: replace NPC chat's gradient/name portrait placeholder with the same existing sprite used in-world. Authenticated persistence/reporting and phone-width/device QA remain open. MobileWorld already contains a lightweight SVG/presence implementation in source; its correctness/integration still need verification (do not describe it as absent).

## September 7 matching NPC portraits

- Conversation lifecycle committed as `5505af8`. Chat portrait now crops the front-facing cell from the same NPC sprite source/fallback helper used in the world, replacing the gradient/name placeholder. Failed custom art falls back to bundled sprites; initials remain if no image loads. Improved muted-copy contrast, 44px close target and mobile composer font size.
- Dia fixture verified mayor and Toren sprites plus failed custom-art fallback, with no fresh runtime warnings/errors. Fixture removed. No network/model/report calls made by these fixture transports.
- TypeScript, targeted ESLint and production webpack build pass, including the conversation-lifetime batch. Latest full suite: 246 tests across 22 files. Real phone viewport, authenticated chat/history/report and physical IME/device behavior remain unverified.
- Mobile source review: existing SVG/presence mode is integrated below 768px, but SSR/hydration initially chooses the desktop branch. Presence and emote request failures are silently ignored. Next: prevent premature desktop mounting and make presence/sharing status truthful without changing backend rules.

## September 7 mobile presence and viewport entry

- Portrait batch committed as `9b2ff14`. Dashboard now resolves viewport before mounting either world, and phones that opt into 3D can return to lite view. Existing mobile SVG layout/presence behavior remains the base.
- Lite mode distinguishes connecting/shared/offline/signed-out presence and loading/empty/failed visitor feeds. Emotes give immediate local feedback, report actual sharing success/failure, reject duplicate pending sends, and abort on leaving. Serial polling and bounded requests clean timers/listeners and ignore stale replies; malformed visitor coordinates/duplicates are filtered.
- Eight new tests pass; full suite 254 tests across 23 files. TypeScript, targeted ESLint and production webpack build pass. Dia 390px source-fixture container verified ready/empty/offline/signed-out states, successful/failed emotes, close cancellation (one aborted request), and late-response suppression. Fixture removed; no real presence/emote writes. No fresh browser errors during this fixture.
- Actual phone viewport/touch and authenticated backend remain untested. The ghosts API still converts database errors to empty success, which the frontend cannot distinguish. Supabase abortSignal API checked against https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal. No backend/schema/currency changes. Dev restored on 3107.
- Next: graphics controls synchronization. Inspection found separate useGraphicsSettings instances keep independent state, so panel changes can persist without updating the live world.

## September 7 live graphics settings and keyboard panels

- Mobile batch committed as `08c2efa`. Graphics panel, full/default worlds and legacy lite/ghost hooks now share one immutable live store. Existing localStorage keys and defaults retained. Changes notify all same-tab consumers, cross-tab updates refresh state, malformed booleans fall back safely, and blocked writes retain session choices. Lite mode now gates full-world directional shadows as its disabled control implies.
- Graphics and Controls panels gain modal semantics, focus containment/restoration, capture-phase close shortcuts, larger controls, sticky close headers and improved muted contrast. Graphics shows effective disabled states while retaining preferences; Controls includes the existing M map binding and removes outdated sprint copy.
- Ten store tests cover synchronization, reset, persisted keys, malformed values, blocked storage, cross-tab/remount updates and listener cleanup. Full suite 264 tests across 24 files; TypeScript, targeted ESLint and production webpack build pass. React external-store contract checked against https://react.dev/reference/react/useSyncExternalStore.
- Dia live world: pixel toggle immediately changed canvas backing size from 1274×660 to 2548×1320 and survived reload; restored on. Lite toggled live, dependent controls disabled, preferences restored after turning it off. Graphics Shift-Tab/Tab wraps, Escape returns focus to Video; Controls Tab stays inside, F1 closes and returns to Keys. No fresh runtime errors, only existing seasonal-palette fallback warning. One CDP timeout occurred during a render toggle; subsequent inspection/render/log checks succeeded. Bloom off, lite off, shadows/pixel/ghosts on restored.
- No authored maps, backend, currency, recruitment or marketing changes. Actual phone/device/performance and authenticated flows remain open. Next: ambient audio lifecycle and mute correctness review, followed by another bounded polish/QA pass.

## September 7 ambient audio lifetime and mute correctness

- Graphics batch committed as `d099b68`. Ambient crossfades now read live volume settings, so muting cannot be undone by the next animation frame. Live one-shots also follow volume changes and are released when finished. Leaving the world stops both fade tracks, active one-shots and frame callbacks; re-entry into the same phase restarts correctly while retaining the sound preference.
- Autoplay rejection returns to the enable prompt without blacklisting a valid file; stopped-track promise failures are ignored. Invalid stored/runtime volume values fall back to finite settings. Existing sound library preserved. Mixer has named/value-announced sliders, initial focus, Escape close/launcher focus and larger targets.
- Nine media-mock tests cover mute/fade behavior, rapid phase changes, stopping/re-entry, autoplay retry, late rejection, stored values and finished one-shots. Full suite 273 tests across 25 files; TypeScript, targeted ESLint and production webpack build pass. Media behavior checked against https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play and /volume.
- Dia isolated real mixer fixture: Enable sound, Master initial focus, Home to zero, Escape to Audio launcher, phase change, unmount/remount, retained settings and restoring 70/60/80 levels all passed. No fresh browser warnings/errors. Fixture removed. This verifies controls and tested media behavior, not listening quality or physical-device playback.
- Next bounded work: emote menu keyboard/phone-width polish and custom-icon fallback. Authenticated sharing, actual phone/touch and controlled laptop performance remain open; no push/deploy.
