# Ponytail audit: game since the last cleanup (2026-09-30)

**Scope:** `git diff becb580..b855a148 -- web/` (branch `feat/game-default-island`, main), 254 commits and 575 files. That is +22,434 / −17,858 lines overall, or +15,451 / −16,343 excluding tests.

**How measured:**
- Six read-only passes, one per area, plus three repo-wide scans over every changed file:
  - exports with no importer outside their own file and tests;
  - modules nothing imports;
  - allocations and setState inside `useFrame` bodies.
- Every cited line was re-read at HEAD `b855a148`.
- Line estimates are net deletions, after any replacement code.
- Nothing was built, run or edited.

**Tags:**
- **[carried]:** the code predates becb580, but a change inside the range made it dead or duplicate.
- **DECISION:** removal changes something David can see. These items are counted separately.
- Things a spec or ledger row requires are listed at the end under "Checked, not flagged".

---

## 1. Look, lighting, world FX, water

**1.1 AmbientLife.tsx is mostly the old GameWorld's scenery.**
- Where: `components/game/AmbientLife.tsx`. Only `Fireflies` (170) is imported, by IslandAtmosphere.tsx:14 and ApplicantWorld.tsx:39. These have no importer:
  - the default export (522-545);
  - Butterflies (44-128);
  - LeafDrift (180-260), the old per-player leaves that row 238 retired;
  - Birds (261-309);
  - a full copy of the gull system (310-516), duplicating the live `Seagulls.tsx`.
- Why:
  - Lines 32-33 run `useGLTF.preload(SEAGULL_URL)` at module scope. Every island that imports Fireflies (village, home, ruins, MoveLab) downloads and parses the 153 KB seagull.glb, yet no gull is mounted there.
  - Firefly's random-home branch (137-141) and its `sampleTerrainHeightFast` default (130) are dead, because both callers pass `anchors` and `groundHeight`.
- Fix:
  - Keep `seededRandom`, `Firefly` and `Fireflies`, optionally in their own file.
  - Delete the rest and the unused imports (useGLTF, cloneSkeleton, tune, gullPose).
  - Make `anchor` and `groundHeight` required.
  - Seagulls.tsx keeps the gull model and pathing, so the CLAUDE.md "reuse the seagull system" rule is still met.
- ~460 lines. Risk low.

**1.2 LeafGusts has no mount.**
- Where: `components/game/AmbienceFX.tsx:102-158`. Its last mount was GameWorld.
- Why: it is dead, and it uses `Math.random` for gust timing and position, which row 238 forbids.
- Fix: delete it.
- ~57 lines. Risk low.

**1.3 Dev-lab palette, grade and FOV state, and draft previews, with no writer.**
- Where:
  - `lib/game/devLab.ts:21-31` and `59-93`: `setLabPalette`, `setLabGrade`, `setLabFov` and `resetLab` have zero importers. Their only writer, `components/lab/LabPanel.tsx`, was deleted in 61454825.
  - The readers are therefore always null: `PostFX.tsx:27, 127-128` (`lab.grade ??`), `PlayerAvatar.tsx:14, 362` (`getLabFov() ?? 48`), and `lib/content/loader.ts:12-17, 307-312`.
  - `loader.ts:242-316` (`defaultActivePalette`, `fetchActivePalette`, `applyPaletteDraft`, `useActivePalette`) and `389` (`_fallbackActivePalette`) have no reader.
  - `loader.ts:191-239` (`applyShopDraft` and the preview branch of `useShopItems`) is reachable only from the admin list.
  - The "Preview" links in EmoteEditor.tsx:200-202, 322-331, ShopEditor.tsx:310-312, 568-577 and PaletteEditor.tsx:274-276, 417-426 open an unchanged island.
- Why: this is the whole pipeline behind the deleted GameWorld palette and lab panel.
- Fix:
  - devLab keeps only `hour`, which /lab/fishing uses.
  - Delete the palette, grade and fov state, the active-palette and shop-draft code, and the three dead Preview links.
  - Readers use constants.
- ~175 lines. Risk low.

**1.4 PostFX props no caller passes.**
- Where: `components/game/PostFX.tsx:103-110` and `119`. The three callers (ApplicantWorld:333, DefaultIslandWorld:674, MoveLab:234) always pass `grade` and `fx`, and never `enabled`, `bloom`, `bloomIntensity` or `vignetteDarkness`. The dead fallbacks are at 139, 149 and 168.
- Fix: make `fx` and `grade` required, and delete the four props and their fallbacks.
- ~22 lines. Risk low.

**1.5 envLight's own phase palettes and the "dusk" vocabulary.**
- Where:
  - `lib/game/envLight.ts:29-44` (`ENV_PHASES`, whose comments cite GameWorld) and the `phase` parameter at 94-100. Both callers always pass `light.environment` (IslandAtmosphere.tsx:73, ApplicantWorld.tsx:131).
  - `ENV_KEY` (`islandLighting.ts:93`) and the hand-copied `phase === "evening" ? "dusk" : phase` (ApplicantWorld.tsx:131, 197; DefaultIslandWorld.tsx:492) exist only to rename `evening`.
- Fix: `applyEnvironment(gl, scene, spec)`. Give CloudShadows an `IslandPhase`. Delete ENV_PHASES, ENV_KEY and the ternaries, and edit envLight.test.ts to match.
- ~25 lines. Risk low.

**1.6 `applyWaterShader` is a plugin API with one caller.**
- Where: `lib/game/waterShader.ts:480-541`. The one caller is `terrainMaterials.ts:297`, always `{ shore: SHORE_FROM_FIELD, normal: WATER_RIPPLE }`. Never used:
  - `extra` / `WATER_EXTRA_NONE` / `waterExtra()` (480-483, 441). Its user was Ocean.tsx, deleted in range.
  - `transparent` (492-497, 514).
  - The `getUniforms` thunk; the block is a module constant.
  - The dynamic cache key (539).
- Fix: one `waterMaterial()` with the chunks fixed and cache key `"water"`. Move `WATER_RIPPLE` (terrainMaterials.ts:269-282) next to `WATER_SWELL`.
- ~35 lines. Risk low.

**1.7 Water uniforms are kept in four hand-synced lists and rewritten every frame.**
- Where: `WaterParams` (waterShader.ts:45-91), `waterUniforms` (104-140), `writeWaterUniforms` (145-175) and the GLSL `UNIFORM_DECLS` (304-332) repeat the same 29 names. `advanceWater` (terrainMaterials.ts:369-379) calls `writeWaterUniforms`, which does 6 `setHex` and 23 assignments per frame, although `cfg` changes only with phase, weather or season.
- Fix:
  - Generate the uniforms and the writer from the `WaterParams` keys: `u${Cap(k)}`, with a Color when the key ends in `Color`.
  - Write only when the `cfg` object changes.
- ~45 lines. Risk low-medium (pre-existing shape, extended in range).

**1.8 terrainMaterials dead paths [carried].**
- Where: `applyTerrainMaterials` (terrainMaterials.ts:386-394) has no caller. After the early return for water at 195-199, every `isWater ? …` ternary at 201-212 is constant.
- Fix: delete the function and the ternaries.
- ~15 lines. Risk low.

**1.9 Time and phase leftovers.**
- Where:
  - `islandTime.ts:4` re-exports `torontoInstant` only for `sunPath.ts:2`.
  - The numeric `?time=18.5` branch (islandTime.ts:35-36) sets the phase but not the sun. The sun sits at the phase's preview instant, so `?time=18.5` and `?at=18:30` show different skies. Spec §8.5 keeps only `?time=<phase>`.
  - `sunFromCamera` (lookPreset.ts:435-437) is used only by its test.
- Fix: import from `@/lib/time`; drop the numeric branch and inline `phaseForHour`; move `sunFromCamera` into the test.
- ~12 lines. Risk low.

**1.10 GridWorld walks the whole scene every frame to find the sun.**
- Where: `components/game/grid/GridWorld.tsx:88-100`. It runs `scene.traverse` with a new closure every frame and takes the first directional light with intensity above 0.5.
- Why:
  - The cost grows with the painted island.
  - It depends on scene order: the evening rim light is 0.6.
  - It is a third sun lookup, next to `ContactShadows.tsx:126` (`getObjectByName("sun")`) and `SunShadows.tsx:93`.
- Fix: callers already hold the IslandLight, so pass `sun={light.sunPosition}` and `sunColor={light.sun}`.
- ~10 lines. Risk low.

**1.11 ApplicantWorld hand-copies the IslandAtmosphere light rig, and the copy has drifted.**
- Where: ApplicantWorld.tsx:130-133 and 185-197. Line 203 hard-codes `windowGlow={phase==="day"?0.3:phase==="evening"?1.15:1.6}`. At dawn that gives 1.6 against the preset's 0.8 (islandLighting.ts:68). MoveLab.tsx:137 already mounts `<IslandAtmosphere … weather="clear">`.
- Fix: `windowGlow={lighting.windowGlow}` now. Later, mount IslandAtmosphere as MoveLab does.
- ~15 lines. Risk medium: this is the live recruitment page.

**1.12 Two copies of world-effect inputs.**
- Where:
  - `IslandAtmosphere.tsx:81` recomputes `models[t.seed % models.length]` and `treeScale` instead of `treeParts(seed, models)` (NatureModels.tsx:62), which the scene itself uses. If treeParts changes, leaves fall from the wrong trees.
  - `SeasonalEvents.tsx:132` uses `worldWind("clear")` while IslandAtmosphere.tsx:78 uses the real weather. Petals ignore the one world wind (row 238).
- Fix: call `treeParts`, and pass `weather` into `EventDecor`.
- ~0 lines. Risk low.

**1.13 LookMaterials' `LIVE` set only grows.** This is a memory leak; see Bugs.
- Where: `components/game/LookMaterials.tsx:41`, 88-101 (sweep adds), 81-84 (setLook iterates everything ever seen).
- Why: materials are cloned per instance and disposed on unmount (NatureModels.tsx:39, ACNHBuilding.tsx:131, InstancedNature.tsx:57), but `LIVE` keeps them and every look change walks them. It grows with each interior visit, season swap and event.
- Fix: collect what each sweep sees and delete `LIVE` entries not seen.
- ~0 lines. Risk low.

## 2. Shadows

**2.1 The contact layer allocates per contact per frame, and it has a silent cap.**
- Where:
  - `ContactShadows.tsx:134`: a new `foot` Ellipse per contact.
  - `:137`: a new `[_sun.x, _sun.y, _sun.z]` tuple per contact, plus `sunShadow`'s return object (`lib/game/shadows.ts:102-106`).
  - `:77`: `CAPACITY = 1024`, and `:131` skips everything past it without a warning.
- Why: roughly 110 contacts today means hundreds of short-lived objects per frame. A 3-4x painted island (row 241) can pass 1024, and contact shadows would then vanish without a warning.
- Fix:
  - Reuse one scratch Ellipse and hoist the sun tuple out of the loop.
  - Give `sunShadow` an `out` parameter.
  - Grow the instanced meshes when the registered count passes capacity, or at least warn in dev.
- ~0 lines. Risk low.

**2.2 SunShadows builds a ~42-number string every frame.**
- Where: `SunShadows.tsx:34-37` (`lightKey`), compared at :148.
- Fix: keep `Matrix4` copies of the light and target matrices, compare with `.equals`, and compare the 8 camera and map-size numbers directly.
- ~0 lines. Risk low.

**2.3 Blob-shadow leftovers in comments and exports.**
- Where: `islandLighting.ts:57` and `qualityTier.ts:2` still describe blob shadows. `shadows.ts:78` `TALL` is exported but only used in its own file.
- Fix: fix the comments and drop the `export`.
- ~2 lines. Risk low.

## 3. Village map, painter, default island

**3.1 GameWorld-only scenery still ships.**
- Where:
  - `components/game/AmbientProps.tsx`: only `Lantern` (131-138) is imported (DefaultIslandWorld:16, SeasonalEvents:19, ApplicantWorld:36). These have no importer: Signpost (42-66), SteppingStones (72-99), FENCES and FENCE_SEGMENTS (105-126), LANTERNS (141-146), Campfire (150-166) and the default export (172-245).
  - `FENCE_SEGMENTS` is a module-load IIFE that calls `getTerrainHeight` 12 times whenever anything imports `Lantern`.
  - `components/game/River.tsx` (430 lines): its only importer is the dead SteppingStones (AmbientProps.tsx:8).
  - `components/game/Path.tsx` (177 lines): no importer.
  - `lib/game/coast.ts:95` `rimSink` and its constants: only the dead campfire uses them.
- Fix: cut AmbientProps.tsx down to `Lantern`. Delete River.tsx, Path.tsx and `rimSink`.
- ~850 lines. Risk low (no importer in app, lib, components or scripts).

**3.2 MiniMap's legacy radial island.**
- Where: `components/game/MiniMap.tsx`:
  - 12, 15-16 and 18-45: coast rings from `coastWobble`/`beachWidthShift`, and BUILDINGS.
  - 47 and 64: ping.
  - 69-85: landmark discovery.
  - 109-155: the drawing used when `plot` is absent.
  - The only caller (DefaultIslandWorld:743) always passes `plot`.
  - Downstream, only this code uses `lib/game/landmarkDiscovery.ts` (33 lines, plus a 49-line test) and `coast.ts:80` `beachWidthShift`. `COAST_BASE` has no importer.
- Fix: make `plot` required and render `plot.content`. Delete the rest, landmarkDiscovery.ts and its test, and `beachWidthShift`.
- ~130 lines, plus 49 test lines. Risk low.

**3.3 The retired island-map.json is still in every island bundle.**
- Where: `components/game/grid/GridWorld.tsx:16` (import), 38-47 (`cached`, `getIslandMap`) and 51 (`suppliedMap ?? getIslandMap().map`). All five callers pass `map`: DefaultIslandWorld:276, ApplicantWorld:194, HomeIslandScene:87, RuinsScene:223 and MoveLab:139.
- Fix: make `map` required, and delete the import, the cache and `getIslandMap`. The painter and scripts keep reading the file for "open the legacy map".
- ~12 lines and 40 KB of JSON (~2 KB gzip) off the member and applicant pages. Risk low.

**3.4 The painter repaints the whole map on every mouse move.**
- Where: `app/lab/map/page.tsx:858-861` runs `useEffect(() => { repaint(); blit(); }, [repaint, blit, version])`, and `blit` depends on `hover` (:856). So every `setHover` (:1276) re-runs the 65k-cell `repaint`, which is what the comment at 575-583 says it avoids. There is more waste:
  - `budget` and `waterClass` (:401, :403) recompute on every `bump()` of a brush stroke.
  - `repaint` depends on `health` (:798), so each edit repaints again 250 ms later.
- Fix: split the effect into `useEffect(repaint, [repaint, version])` and `useEffect(blit, [blit, repaint, version])`. Compute `budget` and `waterClass` in the same 250 ms debounce as `health`.
- ~0 lines. Risk low (lab only).

**3.5 The walker's bucket lookup allocates on the 120 Hz movement path.**
- Where: `lib/game/defaultIsland.ts:177-185`.
  - `near()` builds 9 template-string keys and a new array per query, through `top` and `standable`, which the sim calls many times per step.
  - Insert copies the whole bucket (`[...(grid.get(k) ?? []), it]`, :180). `InstancedNature.tsx:101` does the same.
- Fix: numeric keys (`bx * 4096 + bz`), `push` on insert, and iterate the 9 buckets in place instead of concatenating.
- ~0 lines. Risk low.

**3.6 The bench lookup scans every object every frame.**
- Where: `DefaultIslandWorld.tsx:252` calls `benchSeat`, whose `objectsOf("bench", v)` filters all map objects (`defaultIsland.ts:137`). `:253` also allocates a new object each frame. `villageLayout` calls `landmarks(v)` twice (151, 168). The bench/rock/fence prop list is built at both DefaultIslandWorld.tsx:157 and defaultIsland.ts:172.
- Fix: compute `benches` once in `villageLayout` and pass them to `benchSeat`. Reuse `layout.landmarks`. Export one `propsOf(v)`.
- ~3 lines. Risk low.

**3.7 Object footprints are defined four times.**
- Where:
  - The painter's `objectOutline` (page.tsx:312-326) re-implements `propFootprint` (defaultIsland.ts:128-131).
  - `mapHealth.ts:133-144` `footprintOf` is a second footprint function. Only the painter's version knows bridge, wharf and study tables, so the overlap warnings miss those.
  - `applicantVillage.ts:14-19` copies the `PROP_FOOTPRINT` numbers, and `:44-49` copies the rotated-rect test (defaultIsland.ts:194-198).
  - `page.tsx:177-178` `ROCK_MODELS` / `FENCE_MODELS` copy the `PROP_FOOTPRINT` keys.
- Fix: one `objectFootprint(o)` in defaultIsland.ts, used by the painter outline and hit test, the mapHealth overlap check and the applicant `standable`. Derive the model lists from its keys.
- ~25 lines. Risk medium: applicantVillage is live recruitment code.

**3.8 The land/water cell test is copied eight times.**
- Where: painterTools.ts:20, page.tsx:303, fishingSpots.ts:55, mapHealth.ts:44-45, villageMap.ts:117, grid.ts:1402-1405 and 1475-1476, and grid/GridTerrain.tsx:467-468. In addition, `painterTools.ts:21` `N4` repeats `ORTHOGONAL`, and `fishingSpots.ts:84` allocates a neighbour array per popped cell.
- Fix: export `isWater(s)` and `isLandCell(map, cx, cz)` from grid.ts, and use `ORTHOGONAL`.
- ~8 lines. Risk low.

**3.9 Two identical flood fills in `classifyWater`.**
- Where: `lib/game/fishingSpots.ts:93-106` (`spread`) and 120-133 (`mark`, re-created per pond). They differ only in the class written.
- Fix: one `grow(from, steps, diagonal, ok, cls)`.
- ~12 lines. Risk low (pure, tested).

**3.10 mapHealth copies defaultIsland internals and has a check that cannot fail.**
- Where:
  - `probe` (mapHealth.ts:129) copies defaultIsland.ts:206, and `inRect` (:130) copies :144.
  - `grounded` (:202) is a hand copy of `OBJECT_KINDS` minus landmark and bridge.
  - The "unknown kinds" check (:168) can never fire, because `parseVillage` drops unknown kinds (villageMap.ts:78).
- Fix: export and reuse the helpers, use `OBJECT_KINDS.filter(...)`, and delete the dead check.
- ~5 lines. Risk low.

**3.11 The painter's `World` and `Snapshot` are the same type, copied twice.**
- Where: page.tsx:226-232 and 260-266 are identical interfaces. `snapshot()` (271-280) and `restore()` (282-290) repeat the same deep copy. `turn` (307-308) repeats defaultIsland.ts:78-79.
- Fix: `type Snapshot = World`, one `cloneWorld()`, and import `turn`.
- ~14 lines. Risk low.

**3.12 Magic numbers copied between files.**
- Tree trunk radius 0.65 appears at defaultIsland.ts:75 (`TREE_TRUNK`), mapHealth.ts:138, homeIsland.ts:42 and applicantVillage.ts:50.
- Tree slot count 4, with the cedar at slot 3, appears at NatureModels.tsx:86, islandNodes.ts:24-25, page.tsx:180, 1164 and 1571.
- Fix: import `TREE_TRUNK` everywhere. Export `TREE_SLOTS` and `isCedar(seed)` next to `TREE_SEEDS`.
- ~0 lines. Risk low.

**3.13 Dead options and exports around the buildings.**
- Where:
  - `ACNHBuilding.tsx:45-50`: `ACNH_GLB` is exported but only used internally, and its `house` entry is unused (HomeIslandScene:91 and MoveLab:142 hand-write the same parts).
  - The `scale` and `yOffset` options (:76-77, 84-85, 93-94, 143-144) are never set, and `rotationY` is `Math.PI` at every call site.
  - The comment at :38 cites GameWorld.
  - NatureModels.tsx:52 and 158-159 have stale comments.
  - `nearestLandmark` (defaultIsland.ts:241-249) is used only by its test.
- Fix: delete these, drop the `export`s, and default `rotationY = Math.PI`.
- ~25 lines. Risk low.

**3.14 WharfPier is still authored in legacy world coordinates.**
- Where: `WharfPier.tsx:12-15` places it at x 43.2-45.2, and `DefaultIslandWorld.tsx:383` undoes that with `[-44.2, -0.12, -3.9]`. The comment at :8 points at terrain.ts; walking support is actually `WHARF_DECK_LOCAL` (defaultIsland.ts:62).
- Fix: author it in wharf-local coordinates from `WHARF_DECK_LOCAL` and drop the wrapper group.
- ~3 lines. Risk low.

**3.15 Study seats scan every painted table every frame.**
- Where: `StudySeats.tsx:158` calls `nearestSeat` every frame. That rebuilds every table's seats, calling `ground()` per seat and doing a linear `tableLayout` find (`lib/study/seats.ts:63, 69-78, 96-106`). The table count now comes from the painter.
- Fix: skip a table when `hypot(t.at − p) > SIT_RANGE + 3`.
- +1 line. Risk low.

## 4. Movement, characters, camera, keys

**4.1 Dead PlayerAvatar props.**
- Where: `PlayerAvatar.tsx:63, 81, 189-192` (`activeEmote`, plus the `EmoteType` / `EMOTE_CLIPS` imports at 16 and 20). Only the deleted GameWorld passed it; emotes now go through `tsi:emote` (useWorldClips.ts:30). `playerLevel` (58, 81, 406) is never passed, so every nameplate reads "Lv. 1" (see Bugs).
- Fix: delete `activeEmote` and its effect. Drop the Lv row, or pass a real level.
- ~10 lines. Risk low.

**4.2 Per-frame allocations in the avatar.**
- Where:
  - `PlayerAvatar.tsx:368` calls `onMove(new THREE.Vector3(x, y, z))`, and :367 allocates an `[x, y, z]` array, every moving frame. Every real caller only does `player.current.copy(p)` (DefaultIslandWorld.tsx:533, ApplicantWorld.tsx:134), and MoveLab passes a noop.
  - `getCameraForwardXZ` (cameraBasis.ts:11, called at PlayerAvatar.tsx:243) allocates a Vector3 and an object per frame.
  - PlayerAvatar.tsx:215 builds a template string per frame.
- Fix: replace `onMove` with a `player?: RefObject<Vector3>` that the avatar `.set()`s. Delete the two `move` callbacks and the noop. Use module scratch objects.
- ~6 lines. Risk low.

**4.3 Key maps: three reserved lists that disagree, two stores, four capture effects.** This includes a real bug; see Bugs.
- Where:
  - The reserved lists are `movement/keys.ts:19` `RESERVED`, `combat/runtime.ts:124-126` `MENU_KEYS`/`reserved()` and `identity/settings.ts:20` `RESERVED_KEYS`.
  - The fixed keys are hard-coded at DefaultIslandWorld.tsx:636 (e), 637 (z), 643 (j), 647 (f), 648 (r), 649 (x) and PlayerCharacterUI.tsx:27 (g).
  - `readAbilityKeys`/`remapAbility` (runtime.ts:127-148) repeat `readMoveKeys`/`remapMove` (keys.ts:23-45).
  - `"tsi:ability-keys"` is a bare literal (SettingsSheet.tsx:63, RuinsScene.tsx:138, 141), while movement uses `MOVE_KEYS_EVENT`.
  - The capture-phase "listen for the next key" effect exists 4 times: MoveLab.tsx:203-215 and SettingsSheet.tsx:42-54, 55-66, 71-89.
- Fix:
  - Export one `FIXED_KEYS` (e, escape, tab, enter, z, j, f, g, x).
  - Write one keystore helper `(storageKey, defaults, event)` that gives read, remap and a hook. Each remapper refuses `FIXED_KEYS` plus the other two maps' live values.
  - Write one `useNextKey(active, onKey, onCancel)`.
  - Delete `MENU_KEYS`.
- ~30 lines. Risk low.

**4.4 Follow-camera plumbing is repeated in four scenes.**
- Where: each scene makes a focus Vector3, calls `useFollowCamera` and threads `camTarget` into PlayerAvatar: DefaultIslandWorld.tsx:242-243 and 292; HomeIslandScene.tsx:57-58 and 103; RuinsScene.tsx:121-122 and 250; MoveLab.tsx:127-128 and 147. PlayerAvatar writes it at :359.
- Fix: PlayerAvatar owns the focus and calls `useFollowCamera(focus, zoom, overview)`, with a null opt-out for the café and applicant scenes. Keep the frame priorities.
- ~6 lines. Risk low-medium.

**4.5 MoveLab mirrors.**
- Where:
  - `tuning`, `juice` and `slow` are mirrored into refs by three effects (MoveLab.tsx:175, 178-180) only so PlayerAvatar can take RefObjects (PlayerAvatar.tsx:67-70).
  - The `bindings` state (166, 210) re-implements `useMoveKeys()` (keys.ts:47-55).
  - :169 inlines a coarse-pointer `matchMedia` where `useCoarsePointer` exists (useMediaQuery.ts:23).
  - :130-134 repeats the village scenery build (DefaultIslandWorld.tsx:152, 229-237).
- Fix: pass plain values, use the hooks, and export one `sceneryOf(v, ground, season)`.
- ~15 lines. Risk low (lab only).

**4.6 Tap-to-walk leftovers.**
- Where:
  - `lib/game/groundPick.ts` (8 lines) is a pass-through of `pickCurvedSurface` with a legacy `sampleTerrainHeightFast` default. Its only caller passes `groundHeight` (PlayerAvatar.tsx:13, 134).
  - MoveTargetIndicator recomputes the y that PlayerAvatar.tsx:140 already grounded (MoveTargetIndicator.tsx:6, 25, 28, 40-41, with a legacy `getTerrainHeight` default).
- Fix: call `pickCurvedSurface` directly and delete the file. Use `position[1]` and drop the prop.
- ~10 lines. Risk low.

**4.7 Character.tsx dead exports [carried].**
- Where: `preloadLooks` (Character.tsx:281-284) and `clipLength` (:285) have no importers. CharacterCrowd.tsx:45 inlines the same expression as `clipLength`.
- Fix: delete both.
- ~6 lines. Risk low.

**4.8 Small dead fields.**
- `touchStick.dash` is written (TouchControls.tsx:21-22, moveFx.ts:23-24) but never read.
- `Lap.splits` (course.ts:105-106, 112-116) is computed but never read.
- The dev `screenOf` in RuinsScene.tsx:113-118 duplicates moveFx.ts:135-138.
- Fix: delete them, and import `screenOf`.
- ~8 lines. Risk low.

**4.9 Duplicated magic numbers.**
- Base FOV 48 appears at PlayerAvatar.tsx:362 and in the three Canvas configs (DefaultIslandWorld.tsx:658, MoveLab.tsx:228, ApplicantWorld.tsx:328).
- Walk speed 7.4 appears at Character.tsx:242 and sim.ts:27.
- `DASH_PRESETS.Burst` (MoveLab.tsx:65) repeats the dash defaults at sim.ts:54-60. If the defaults are retuned, the "current preset" highlight silently stops matching.
- Fix: read FOV from `camera.fov` once, use `MOVE_TUNING.walkSpeed`, and define Burst as `pick(MOVE_TUNING, …)`.
- ~0 lines. Risk low.

**4.10 The HUD re-renders do avoidable work in the ruins.**
- Where:
  - CombatHud re-renders on every `publishCombat` (every 0.1 s). Each render parses localStorage about three times (`readAbilityKeys()` at CombatHud.tsx:24, which also calls `readMoveKeys` via `reserved()`, plus `readMoveKeys()` at :45).
  - `PlayerCharacter` (PlayerAvatar.tsx:430-434) builds a new `weapon` object per publish, so Character re-renders 10 times a second.
  - TouchControls calls `setKnob` on every pointermove (TouchControls.tsx:16).
- Fix: use the hooks from 4.3, memoise the weapon on `weapon|alive|armed`, and move the knob through a ref.
- ~0 lines. Risk low.

## 5. Catch pipeline, seasonal events, crafting, weather

**5.1 The Supabase `recordCatch` is dead in production.**
- Where: `lib/collections/supabaseStore.ts:84-88`, the interface at `store.ts:45` and `service.ts:33-39`. Only the dev demo (collectionsDemo.ts:32) and tests call it, and always on the memory store. Casts, lands and harvests go through the catch-roll RPCs.
- Fix: delete it from the interface, the Supabase store and the service. The memory store keeps a local `record()` for the demo and the tests. This also removes the second `trophyFor` call path.
- ~15 lines. Risk low.

**5.2 The catch route does work it doesn't need.**
- Where: `app/api/collections/route.ts:52-53`.
  - `listGoals()` runs for harvest, which doesn't use goals.
  - `islandWeatherNow()` runs for land, which doesn't use weather.
  - Both are awaited one after the other.
  - `catchAction` then reads `store.roster()` (`select *` from `collection_species`, supabaseStore.ts:40-46) on every cast and harvest (service.ts:73), although the roll uses the TS `ROSTER`/`FISH` and the rows are generated from `ROSTER`.
- Fix:
  - Resolve goals and weather inside `catchAction` per action, with `Promise.all` where both are needed.
  - Use the imported `ROSTER` in `catchAction` and `tourney` (service.ts:202-203).
- ~2 lines, and one query saved per catch. Risk low.

**5.3 Server weather: three cache layers, and the failure path isn't cached.** See Bugs.
- Where: `lib/server/weather.ts:12, 26, 34` (module cache), :29 (`next.revalidate`) and the CDN header on /api/weather. The `catch` at :36-37 returns the fallback without caching it.
- Fix: cache the fallback for about 5 minutes, and keep only the module cache plus the route header.
- ~3 lines. Risk low.

**5.4 The seeded daily weather is a second source of truth.** See Bugs.
- Where:
  - `lib/game/weather.ts:28-35` (`getTodayWeather`, a hash of the device-local date) is read by PlayerAvatar.tsx:311 (rain footsteps), FishingOverlay.tsx:161, 666 and 908 (bite wait, dart chance, cast cycle; :666 runs inside the reel's per-frame step) and fishing.ts:179-182. fishing.ts also uses device-local `getHours()`/`getMonth()`.
  - Everything else, including the server roll, uses the Open-Meteo island weather on Toronto time.
  - There are also two IslandWeather mappers: `REEL_WEATHER` (rolls.ts:75) and `rosterWeather` (islandWeather.ts:59).
- Fix:
  - Publish the current island weather from `useIslandConditions` (a tiny module store, like `cloudLayer`).
  - Map it with a `reelWeather()` next to `rosterWeather`.
  - Build the fishing context from `torontoParts`.
  - Delete `getTodayWeather` and its URL overrides.
- ~10 lines. Risk low.

**5.5 `momentAt` is written twice.**
- Where: `lib/collections/rolls.ts:50-53` and `usePeacefulContext.ts:44-45` both compute `{ hour + 0.5, month, rosterWeather }`. If one changes, a forage node shows one species and the server gives another.
- Fix: one function in `lib/collections/logic.ts`, used by both.
- ~2 lines. Risk low.

**5.6 Three minute clocks.**
- Where: `lib/game/seasonalEvents.ts:35-40`, `useIslandConditions.ts:53-60` and `DefaultIslandWorld.tsx:484-486`. The last one uses `Date.now()` rather than `worldNow()`, so `?at=` moves the sun and the events but not forage or bugs.
- Fix: return `now` from `useIslandConditions` and pass it to `useIslandEvent(now)` and `usePeacefulContext(weather, now)`.
- ~8 lines. Risk low.

**5.7 Dead fishing leftovers.**
- `fishing.ts:36-45` `SELL_PRICES` has no importer. It is also a stale mirror: seaking 2500, while the wallet catalogue has its own.
- The `coastDist(sp) > 47` zone branch (FishingOverlay.tsx:255, import :39) is dead: every `tsi:fish-start` sends `water` (DefaultIslandWorld.tsx:589) or runs with `zoneOverride="sea"`.
- `legacyFishingWaterHeight` (fishingWater.ts:5-7) is a default nobody uses.
- Fix: delete them, and use `zoneOverride ?? "river"`.
- ~12 lines. Risk low.

**5.8 Types defined twice.**
- `LandSeason`/`TourneyRef` are in store.ts:11-19 and again inline as the return type of `landSeason` (seasonal.ts:52).
- `CatchReply` is in lib/game/collections.ts:67-69 and in service.ts:50-51.
- Fix: one definition each, with a type-only import, as SeasonalEvents.tsx:23 already does for `TourneyView`.
- ~6 lines. Risk low.

**5.9 The SQL quote helper is copied five times.**
- Where: collections/seed.ts:4-5, progression/seed.ts:4-5, crafting/seed.ts:6-7, wallet/seed.ts:4-5 and combat/seed.ts:9.
- Fix: export `q`/`arr` from collections/seed.ts; crafting already imports from it.
- ~6 lines. Risk low.

**5.10 The fail-closed "limited" list always re-adds the TS goals.**
- Where: `lib/progression/seasonal.ts:42` unions the TS `SEASONAL_GOALS` catches into `limited`, and `fishing.ts:164` duplicates that list. If an admin removes a catch from an event in ClubGoalEditor, the catch stays limited but never opens, so it never bites. The journal still shows it in season.
- Fix: fall back to `SEASONAL_GOALS` only when `goals` is empty; `fishing.ts:164` becomes `eventCatches([], new Date())`.
- 0 lines. Risk medium: confirm the intent with David.

**5.11 `ownedGear` swallows database errors.**
- Where: `lib/collections/supabaseStore.ts:106-109` returns `[]` on any error, "before the economy migration", a state production has left. A transient error drops a tier-4/5 rod owner to the starter rod, which locks out legendaries for that cast.
- Fix: `raise(error)`.
- 0 lines. Risk low.

## 6. Combat

**6.1 `lib/combat/movement.ts` is a test-only third dodge model [carried].**
- Where: all 69 lines. It is imported only by `lib/combat/rules.test.ts:6` (block 69-89). Its `DODGE` (ms, :7) disagrees with the live `lib/game/combat/sim.ts:12` (seconds).
- Fix: delete the file and the `describe("dodge and aggro")` block.
- ~91 lines. Risk low.

**6.2 The old dodge impulse is computed, then thrown away.**
- Where: `encounter.ts:29-33` builds `p.impulse` from DODGE every dodge frame. `combatPush` (actions.ts:103-104) drops it whenever `dodgeAge !== null`, because the movement kit's dash moves the player (actions.ts:92-96). Only the balance bot reads it (balance.ts:126), so the balance table measures a dodge the game no longer has.
- Fix: encounter only ages `dodgeAge`. Drive the bot's dodge with `stepMove` + `combatTuning`, or move the roll into balance.ts.
- ~2 lines. Risk low.

**6.3 Dead combat fields and constants.**
- Island `Weapon.damage`, `.tier` and `.durability` (contract.ts:9-11, 20) are never read on the island.
- The `owned` parameter of `islandWeapons` (islandAdapter.ts:22) is never passed.
- `PLAYER_BASE.maxEnergy` (data.ts:89) is unused, and `derived().energy` (lib/combat/progression.ts:93) is never read and contradicts the fixed-100 energy ruling.
- `ENHANCED_MULT` (weapons.ts:52) is unused; incantation.ts:108 hard-codes 1.5.
- `runes.ts:15-17` (`EFFECT`, `ENERGY`, `Rune.energy`) is dead, because CombatHud always passes `effect` (so the `effect ?? rune.effect` fallback at IncantationOverlay.tsx:62 never runs).
- Fix: delete them; use `ENHANCED_MULT` in incantation.ts; make `effect` required.
- ~14 lines. Risk low.

**6.4 The combat demo re-implements the shared demo shim.**
- Where: `lib/game/combat/demo.ts:18-43` repeats `installDemoFetch` and `reply` (`lib/game/demoFetch.ts:11-36`).
- Fix: `installDemoFetch("combat", "/api/combat/", …)`.
- ~15 lines. Risk low.

**6.5 Every kill reads combat progression three times.**
- Where: `lib/combat/service.ts:112-115` (`requireGate` reads progression and family), then 121-124 read progression again before and after the kill whenever the enemy has a trait (6 of 8 enemies). With the Supabase store, a kill costs about 8 round trips.
- Fix: `requireGate` returns `p`; take `before` from `p.traits`, and only re-read when `p.subclass === "transmuter"`.
- ~1 line. Risk low.

**6.6 Small combat duplicates.**
- The starter-weapon list appears 3 times: weapons.ts:46 `STARTER_WEAPONS`, data.ts:14 `WEAPON_ORDER` and balance.ts:25 `STARTERS`.
- `sim.ts:33-37` `sweptHit` is `abilities.ts:241-245` `segDist`, and `resolvePlayerShot` takes it as an injected parameter (actions.ts:56, encounter.ts:65) although there is one implementation.
- `actions.ts:18` re-exports from abilities, and `actions.ts:28` `weaponDamage` is used only by a test.
- `abilities.ts:277` has `radius: ef.length ? ef.radius : ef.radius`.
- The sector-geometry cache exists twice: EncounterRender.tsx:119-124 and 273-277.
- ~17 lines. Risk low.

**6.7 The island mission-event translation layer.**
- Where: `lib/game/combat/missions.ts:18-26` (kebab-case kinds) and `:44-55` (`toSystem`) only rename fields into `lib/combat/missions.ts` events.
- Fix: derive the type from the system event and make `toSystem` `{ ...ev, id }`. Update the 9 call sites.
- ~18 lines. Risk low-medium (touches tests).

**6.8 Per-frame allocations in the ruins loop.**
- `encounter.ts:17`: `[...SLOT_IDS, "swap"]` every frame.
- `encounter.ts:19`: `buffs.filter` every frame.
- `encounter.ts:25`: `{ ...me }`, new impulse objects, and `moveSpeed`, which runs `derived()` every frame.
- `RuinsScene.tsx:148, 152-153`: new `me` and `aim` objects.
- `RuinsScene.tsx:168`: `respawnAfter` is O(rows × spawns) per dead enemy.
- `RuinsScene.tsx:171`: an array literal in `.includes` per enemy.
- `PlayerAvatar.tsx:214`: `combatTuning` spreads `MOVE_TUNING` every frame.
- `EncounterRender.tsx:70, 181, 207`: `.filter` per frame; `color.set(cssString)` at 190, 217-218, 222 and 291.
- Fix: hoist constants, mutate in place, cache `derived` and `combatTuning` by speed, use a Map for respawns, and precompute Colors.
- ~0 lines. Risk low.

**6.9 The memory store has drifted from the SQL.**
- `lib/combat/memoryStore.ts:86`: a keyed replay returns the current subclass, while SQL returns the first result (`20260926210000_combat_kits.sql:76-77`).
- `memoryStore.ts:61` hard-codes the 6000 kill-XP cap, where SQL reads `economy_settings`.
- The fees shown come from TS constants (service.ts:62, lib/combat/progression.ts:15-16), but the fees charged come from `economy_settings` (combat_kits.sql:84).
- The header at `memoryStore.ts:1` names the wrong migration.
- Fix: store `{ fee, subclass }` per key, import the cap, read the fees from settings (or mark the TS constants as the source), and fix the header.
- ~0 lines. Risk low.

## 7. Admin and content

**7.1 The older content admin pages hand-roll the gate and row loading [carried; the pattern was replaced in range].**
- Where: the admin pass added `AdminGate` and `useContentRow` (ProgressionAdminShared.tsx:54, 72), but only the new pages use them. The recipe pages are 12, 17 and 14 lines. The eleven older pages are 39-91 lines each:
  - npcs, shop, palettes and emotes: `new` and `[id]/edit`;
  - npcs, shop and palettes: `[id]/history`.
- The same "Access Denied" block is also in shop/page.tsx:28, emotes/page.tsx:49, palettes/page.tsx:94 and log/page.tsx:217.
- Fix: wrap them in `<AdminGate>` and use `useContentRow`.
- ~590 lines. Risk low.

**7.2 NPCEditor re-implements the shared editor kit.**
- Where: `components/portal/NPCEditor.tsx`:
  - 87-89 and 153-253: its own draft, publish and discard flow, which is `useDraftFlow` (ProgressionAdminShared.tsx:92-142).
  - 469-512: its own button bar, which is `DraftBar`.
  - 559-645: local copies of inputCls, the button classes, `Field` and `Toggle`.
  - 518-557: a client `validate()` that duplicates `validateResidentDraft` (residents.ts:44-56). The persona_prompt ≤ 2000 check (:543) exists only on the client.
- Fix: use the kit, as RecipeEditor does (131 lines), and move the prompt limit into `validateResidentDraft`.
- ~215 lines. Risk low-medium.

**7.3 Dead draft GET endpoints [carried].**
- Where: `app/api/content/drafts/route.ts:45-64` (list) and all of `app/api/content/drafts/[id]/route.ts` (one). Every editor POSTs, and drafts are read through the Supabase client (loader.ts:65, NPCEditor.tsx:104, GameContentIndex.tsx:41). Only the generic gate test reaches these routes.
- Fix: delete them, and drop them from adminRoutes.test.ts.
- ~43 lines. Risk low.

**7.4 The content-table-to-route map is kept in four places.**
- Where: drafts.ts:10 `CONTENT_TABLES`, log/page.tsx:15-34 (`TABLE_OPTIONS`, `HISTORY_ROUTE`), VersionHistory.tsx:15 and 36-43 (`EDITOR_ROUTE`, identical to `HISTORY_ROUTE`), and GameContentIndex.tsx:14-23. Adding crafting_recipes needed edits in all four.
- Fix: export `CONTENT_ROUTES` from drafts.ts and derive the rest.
- ~15 lines. Risk low.

**7.5 The staff (T1-T3) gate is hand-rolled six times [carried].**
- Where: events/route.ts:77-94, bounties/[id]/route.ts:52-70, bounties/[id]/review/route.ts:17-35, quests/route.ts:90-106, achievements/route.ts:69-86 and achievements/[id]/award/route.ts:17-34. Each is about 15 lines of getUser plus a tier read.
- Fix: a `staffContext()` next to `adminContext`. Keep each caller's RLS client for the writes.
- ~70 lines. Risk medium.

**7.6 Two mute writers.**
- Where: admin/moderation/route.ts:13 and 76-81 upserts `muted_until` inline with its own 7 days, while identity/service.ts:84 uses `muteDays = 7` through `store.setMute`. The service's tier re-check (:85) can't fail, because its only caller is already behind `withAdminStore`. The inline 400 bodies at economy/admin/merch/[id]/route.ts:16 and identity/moderate/route.ts:15 repeat `badRequest()` (memberContext.ts:48).
- Fix: export `MUTE_DAYS`, have the route call `setMute`, drop the dead re-check, and use `badRequest`.
- ~5 lines. Risk low.

**7.7 Moderation joins are split between client and server.**
- Where: NameReportsPanel.tsx:21-37 joins reports, profiles and identity on the client, while GET /api/admin/moderation (route.ts:20-55) does the same join on the server. GameContentIndex.tsx:51-55 fetches that whole payload plus a count, only to show a badge.
- Fix: add name reports to the GET, and have the panel and the badge read from it.
- ~15 lines. Risk low.

**7.8 The seasonal edit page duplicates the goals edit page.**
- Where: `seasonal/[id]/edit/page.tsx` (18 lines) is `goals/[id]/edit` plus `seasonal`.
- Fix: ClubGoalEditor derives `seasonal` from `initial.goal_type`, and the seasonal list links to goals/[id]/edit.
- ~18 lines. Risk low.

**7.9 Small admin drift.**
- admin/page.tsx:214 shows NPCSpendWidget to T1 only, but /api/npc/spend admits T1/T2 (see Bugs). admin/page.tsx:100-114 re-reads the user and tier.
- residents.ts:12 `PHASES` duplicates `ISLAND_PHASES`.
- `ResidentPost` (residents.ts:11) has no importer; NPCEditor.tsx:23 re-derives it.
- directory/route.ts:10-13 uses `adminContext` as a tier probe (`gate.status !== 403`).
- Fix: use `isAdminTier`, reuse `ISLAND_PHASES` and `ResidentPost`, and use `memberContext()` + `isAdminTier` in the directory route.
- ~7 lines. Risk low.

## 8. Audio, companion, dashboard shell

**8.1 Test-only methods in `lib/game/audio.ts`.**
- Where: `setPhase` (297-300), whose comment says "kept for existing callers (GameWorld, ApplicantIsland)", and `dispose` (481-493). Only audio.test.ts calls them, and the header documents both (29, 34).
- Fix: tests use `setAmbience({ phase })` and `stop()`; delete both methods.
- ~20 lines. Risk low.

**8.2 Duplicate paths inside AudioManagerImpl.**
- Where: `playElement` (263-275) repeats `playCascading`'s NotAllowed and NotSupported handling (372-384). `newTrackElement` (353-363) duplicates `createAudioElement` (495-507).
- Fix: `playSFX` calls `playCascading(el, [src], 0)`, and one element factory remains.
- ~20 lines. Risk low.

**8.3 Thin audio hooks.**
- Where:
  - `useAmbientAudio` (useAudio.ts:20-22) and `useSFX` (32-37) each have one caller.
  - `useAudioState` keeps a module constant in `useState` (:49).
  - `EMPTY_STATE.volumes` (:42) copies `DEFAULT_VOLUMES` (audio.ts:114).
  - musicDirector.ts is a 22-line file with one hook and one caller.
- Fix: inline the two hooks, use `() => EMPTY_STATE`, export `DEFAULT_VOLUMES`, and move `useMusicDirector` into useAudio.ts.
- ~20 lines. Risk low.

**8.4 Sound unlock-on-gesture is copied three times.**
- Where: AudioController.tsx:39-45, StudyCompanion.tsx:27-37 and MoveLab.tsx:182-187.
- Fix: one `useSoundUnlock()` in useAudio.ts.
- ~12 lines. Risk low.

**8.5 Companion duplicates.**
- StudyTab.tsx:18-43 is the same Live/Demo/DemoLive wrapper as app/student/companion/study/page.tsx:9-35. That page is linked only from a signed-out card (StudyCompanion.tsx:51) that the tab shell never shows.
- The `noSub` + `location.search` snapshot is copied 6 times: companion/page.tsx:18, 39; StudyTab.tsx:18, 21; companion/study/page.tsx:9, 13; StudyHud.tsx:22, 25; CombatHarness.tsx:27; progression Harness.tsx:62.
- `SeatFigure` (CompanionTableScene.tsx:37-51) is `MateFigure` (StudySeats.tsx:65-78) without the overhead.
- dashboard/page.tsx:7-13 re-implements `useMediaQuery` only to get a null server snapshot.
- Fix:
  - One wrapper, or delete the standalone page and point the link at /student/companion.
  - One `useSearch()`.
  - One figure with an optional overhead.
  - A `serverValue` parameter on `useMediaQuery`.
- ~52 lines. Risk low.

**8.6 The Performance probe re-renders the whole game root every second [carried].**
- Where: `DefaultIslandWorld.tsx:196-208` calls `onMetrics` → `setMetrics` (:530, 677) at 1 Hz, even with the options panel closed. That re-renders the 779-line root and its HUD.
- Fix: write the text into the `<output>` through a ref, or mount the probe only while the Performance `<details>` is open.
- ~0 lines. Risk low.

## 9. Migrations and seed tooling

**9.1 The seed generator and the seed-sync tests pin TS catalogues to applied migrations.**
- Where:
  - `scripts/gen-seeds.mjs:15-23` rewrites the generated block inside 20260926150400_collections, 150600_economy, 180000_ownership, 190000_combat_content and 20260929120000_seasonal_events.
  - `scripts/gen-crafting-seed.mjs` does the same for 20260926160000_crafting.
  - All of those migrations are applied in production (STATE.md:9).
  - The tests assert that the applied files contain the current TS output: collections.test.ts:47-48, economy.test.ts:174, ownership.test.ts:82-83, combat/service.test.ts:196, goals.test.ts:103 and crafting.test.ts:42.
- Why: any roster, price, recipe or goal change in TS fails those tests until someone edits an applied migration. That breaks the "never edit applied migrations" rule, and production never re-runs the edited file, so TS and the database drift silently. This is the largest two-sources-of-truth risk in the range.
- Fix:
  - Freeze the applied blocks by snapshotting the generated SQL once in the tests.
  - Have the generators write a new upsert migration, and assert parity on the newest migration that carries the markers.
- ~0 lines. Risk medium (process).

---

## Bugs found (not waste)

**Player-visible:**
1. **Two weather sources.**
   - Rain footsteps, the reel's bite, dart and cast perks, and the local roll read the seeded daily hash (`getTodayWeather`, device-local date). Everything else, including the server roll, reads Open-Meteo on Toronto time. You can see rain with dry footsteps, and the perks disagree with the sky and the server.
   - Where: PlayerAvatar.tsx:311; FishingOverlay.tsx:161, 666, 908; fishing.ts:179-182.
   - Fix: 5.4.
2. **Catch card size vs record.**
   - `catchAction` returns the unclamped size (`lib/collections/service.ts:89`) but records `clampSize(sp, size)`, which is null for off-roster fish. About 60% of the river pool and 47% of the sea pool is off-roster (FISH 91 vs roster 55).
   - Those catches show "612 cm" but store no size, trophy or tourney entry, and SeasonalEvents.tsx:212 promises "Any catch during the tourney counts".
   - Minimal fix: return `kept`; show `landing.size` without the `rollSize` fallback (FishingOverlay.tsx:279); reword the copy to "any roster fish". Whether to add the 38 species to the roster is David's call.
3. **Nameplates always read "Lv. 1".** Where: PlayerAvatar.tsx:58, 81, 406. No caller passes `playerLevel`.
4. **Key conflicts.**
   - Menu actions can be bound to E, Z, J, F, G, R or 1-4 (settings.ts:20). E then both interacts and opens the menu (DefaultIslandWorld.tsx:636-640).
   - Ability keys can take K, L, F, G, X, [ or ] (runtime.ts:124). An ability on L opens the mailbox in the ruins.
   - Movement keys can take G or X (keys.ts:19). Sprint on G toggles the emote menu.
   - Fix: 4.3.
5. **Touch stick stuck after entering a building (probable; confirm on a phone).** TouchControls has no unmount cleanup. DefaultIslandWorld.tsx:773 unmounts it on entering a non-café interior while `touchStick` keeps x, z and jump, so the avatar walks or hops on its own after coming back out. Fix: reset the stick in an unmount effect.
6. **Palette "Set Active" and the palette, emote and shop "Preview" buttons do nothing** since GameWorld was deleted. Nothing reads `seasonal_palettes.active` or applies those drafts (palettes/page.tsx:73 still says "Palette activated."). See 1.3 and DECISION D3.
7. **Event petals ignore the real wind** (SeasonalEvents.tsx:132; row 238). The applicant HQ's dawn window glow is 1.6 instead of 0.8 (ApplicantWorld.tsx:203).

**Robustness and latent:**

8. **Weather fallback never cached.** While Open-Meteo is down, every catch POST, including `land`, which doesn't need weather, waits up to the 5 s timeout (lib/server/weather.ts:36-37; route.ts:53).
9. **LookMaterials memory leak.** `LIVE` keeps every disposed material forever (LookMaterials.tsx:41, 97). This is relevant to the Mac mini memory crashes during three.js dev.
10. **`ownedGear` returns `[]` on any database error** (collections/supabaseStore.ts:108), so a transient error silently rolls with the starter rod.
11. **ContactShadows silently drops contacts past 1024** (ContactShadows.tsx:77, 131). Latent until the island is painted bigger.
12. **Painter health bugs.**
    - The fishing check ignores the pond markers the game uses: mapHealth.ts:237 calls `classifyWater(map)`, while the game uses `villageWater(v)` (fishingSpots.ts:155-161). So the shipped pond counts as river, and "pond not fishable" never runs.
    - Overlap warnings are keyed by bare id (mapHealth.ts:258, page.tsx:718-750). The 9 ids a landmark and a resident anchor share both light up red.
13. **The painter repaints the 65k-cell map on every mouse move** (3.4). Lab only.
14. **Seasonal limited list overrides admin edits** (5.10). Needs David's confirm.
15. **Spend widget hidden from T2** although /api/npc/spend allows T2 (admin/page.tsx:214).
16. **Low.**
    - The persona_prompt length limit is client-only (NPCEditor.tsx:543).
    - A Transmuter's "new trait" banner can show twice on two overlapping kills (service.ts:122-124; the server data stays correct).

No security gap was found: every admin route goes through `adminContext`/`withAdminStore`, and adminRoutes.test.ts enforces it.

## DECISION items (not in the main total)

| # | What | Where | ~Lines |
|---|---|---|---|
| D1 | The painter's legacy "prop" marker tool. The game does not read the markers (its own help text says so); keep drawing them read-only. | app/lab/map/page.tsx:101, 118, 147-151, 344-345, 703-715, 1074-1115, 1245-1246, 1648-1657 | 70 |
| D2 | The /dev/combat harness. `?combat=demo`, PathSheet and the balance table cover it; specs/combat-questions.md:6 still cites it. [carried] | app/dev/combat/* | 365 |
| D3 | Palette "Set Active": a route and button that nothing reads. | app/api/content/palettes/[id]/activate/route.ts, palettes/page.tsx:57-80, 256-270 | 120 |
| D4 | Guestbook moderation with no guestbook. Launch routing deleted the member side and explicitly kept this. | admin/guestbook/page.tsx, api/guestbook/[id]/moderate/route.ts, admin/page.tsx:87-93 | 365 |
| D5 | The in-world AudioController slider panel duplicates Settings → Sound, the spec'd home (audio-pass.md:5). Keep the bell and mute. | AudioController.tsx:84-204 | 90 |

## Checked, not flagged

- **Required by spec or ruling:**
  - InteriorPlayer keeps its own controller (movement.md:23).
  - The `__move` dev hook and `routePilot` are used by the evidence scripts.
  - The applicant camera lerp (movement-questions #25).
  - `stepMove` stays pure, so its per-step state objects are by design.
  - The five lab-only PlayerAvatar props (the lab runs the real avatar).
- **Tested models:**
  - The TS optics (`halfVector`/`glareLobe`/`facetGlint`) are the tested model of `WATER_OPTICS`, and `WATER_CHOP` is generated from the TS.
  - `balance.ts` is imported only by its test.
- **SQL:**
  - The append-only wrapper chain `collections_land` → `seasonal_land` → `collections_land_drop` is the correct way to extend applied functions.
  - The memory store matches the SQL for cast, land, harvest, caps, tourney entry and recipe drops.
  - The 2/5/15% drop chances are generated from TS and tested.

## Apply first (ranked)

1. **3.1 GameWorld scenery orphans** (AmbientProps down to Lantern, River.tsx, Path.tsx, `rimSink`): −850, low risk, pure deletion.
2. **1.1 AmbientLife down to Fireflies**: −460, and every island stops downloading seagull.glb.
3. **5.4 + 5.3 One island weather source and a cached fallback**: fixes Bugs 1 and 8 and deletes `getTodayWeather`.
4. **7.1 Older content admin pages on AdminGate/useContentRow**: −590, low risk.
5. **1.3 Lab palette, grade and FOV state, active palette and draft previews**: −175, and removes three broken Preview buttons.
6. **7.2 NPCEditor on the shared editor kit**: −215, and the prompt limit moves to the server.
7. **3.2 + 3.3 MiniMap legacy island and the island-map.json import**: −142, and −40 KB of JSON on the member and applicant pages.
8. **1.13 LookMaterials `LIVE` pruning**: fixes the material leak (Bug 9).
9. **4.3 One fixed-key list, one keystore and one `useNextKey`**: −30, and fixes Bug 4.
10. **6.1 + 6.2 + 6.3 Combat dead code** (test-only dodge module, discarded impulse, dead fields): −107.

After these, the hot-path items with no line change: 2.1, 3.4, 3.5, 4.2, 6.5 and 6.8.

## Total

| Area | ~Lines removed |
|---|---|
| 1 Look, lighting, water | 870 |
| 2 Shadows | 2 |
| 3 Map, painter, island | 1,090 (+49 test) |
| 4 Movement, characters, keys | 90 |
| 5 Catch, seasonal, weather | 65 |
| 6 Combat | 160 |
| 7 Admin, content | 980 |
| 8 Audio, companion, shell | 125 |
| **Total, no decision needed** | **~3,400** |
| DECISION items D1-D5 | ~1,010 |
| **Total with decisions** | **~4,400** |

About 815 of the 3,400 is [carried] code (7.1, 7.3, 7.5, 6.1, 4.7, part of 1.8) that predates becb580 but was left dead or duplicated by changes in this range. The other ~2,550 landed in the range or was orphaned by it, mostly by the GameWorld deletion in f0e99747.

## Applied (2026-09-30, branch `game/cleanup` from 7ca8f4c2)

Net for the range 7ca8f4c2..6cf19ab4: +2,426 / −5,608 = **−3,182 lines** in `web/`. Excluding tests: +2,095 / −5,394 = −3,299. No migration was added or edited; `node scripts/gen-seeds.mjs` reports the seeds up to date.

**Applied, one commit each:**

| Item | Commit | Note |
|---|---|---|
| 1.1 | 76880612 | |
| 1.2 | d0b749da | |
| 1.3 | 70ba9968 | Bug 6: the dead emote/shop/palette Preview links are gone. Set Active (D3) untouched. |
| 1.4 | 3bd3468b | |
| 1.5 | cbbbe819 | Partial: audio keeps its own "dusk" ambience key. |
| 1.6 | ee594414 | |
| 1.7 | 408c9016 | Generated uniforms checked equal to the old hand-written set. |
| 1.8 | 500de9b6 | |
| 1.9 | 908423ff | `?time=` now takes phase names only; STATE.md's `?time=18.5` example is stale. |
| 1.10 | a6717d05 | |
| 1.11 | 5e2c1971 | Partial: dawn glow 1.6 → 0.8 via `lighting.windowGlow`. Mounting IslandAtmosphere left for "later", as the item says (live recruitment page). |
| 1.12 | 765708e0 | Bug 7: petals follow the real wind. |
| 1.13 | 7a4b6181 | Bug 9. |
| 2.1 | 554ac03d | Bug 11: draws in chunks of 1024. |
| 2.2 | 7169da4d | |
| 2.3 | 55b60bb8 | |
| 3.1 | b7c4eea1 | |
| 3.2 | d80cfe42 | |
| 3.3 | f31df2ae | |
| 3.4 | d8bdcaa7 | Bug 13. |
| 3.5 | 4fe8f28d | |
| 3.6 | a6b166aa | The bench spot object is allocated only inside bench range. |
| 3.7 | a99d8b6d | |
| 3.8 | 4c3dccc2 | |
| 3.9 | 19474090 | |
| 3.10 | e0110a66 | |
| 3.11 | 1b00dd61 | |
| 3.12 | e936a7d0 | |
| 3.13 | 14b8fa29 | |
| 3.14 | edd8cb41 | |
| 3.15 | 48bf2fff | |
| 4.1 | 9d27600a | |
| 4.2 | ecc1f7d5 | |
| 4.3 | 5431236b | Bug 4. The CombatHud key hooks (4.10) landed here. |
| 4.5 | 9ce18698 | |
| 4.6 | f8f9ca56 | |
| 4.8 | 696c3d45 | |
| 4.9 | 5aeff4d2 | Partial: one `BASE_FOV` constant instead of reading `camera.fov` (a remount would compound the zoom). Walk speed is in `components/game/character/**`, off-limits to this branch. |
| 4.10 | 03050fee | |
| 5.1 | 4b9e63a3 | |
| 5.2 | 36e8f169 | |
| 5.3 | 6cf1fd36 | Bug 8. |
| 5.4 | 9a5174e2 | Bug 1. |
| 5.5 | a8c48a03 | |
| 5.6 | 05b791a4 | |
| 5.7 | 1dccd4e4 | |
| 5.8 | 7705437c | |
| 5.9 | fd86de2c | Generated SQL unchanged. |
| 5.11 | f2ecee1f | Bug 10. |
| 6.1 | ebb555da | |
| 6.2 | b66fecd5 | Balance table byte-identical before and after. |
| 6.3 | d9ccd086 | Partial: `derived().energy` stays, because /dev/combat (D2) reads it. |
| 6.4 | 2e3efadd | |
| 6.5 | 60cdc5b5 | |
| 6.6 | 8861c305 | |
| 6.7 | 23a4e9e7 | |
| 6.8 | f6dfd4af | Partial: the `me`, `aim` and impulse objects stay, since their references escape into the sim input. The EncounterRender filters and the Blasts `color.set` stay. Balance table unchanged. |
| 6.9 | 137df67f | The TS fees are marked as the source of the settings. |
| 7.1 | c8eafb4d | |
| 7.2 | 3ad56df9 | Bug 16: the persona prompt cap is checked on the server. |
| 7.3 | cb9905b1 | |
| 7.4 | 58e0339b | Partial: GameContentIndex keeps its AREAS list, which carries per-area copy. |
| 7.5 | 56460b8d | |
| 7.6 | ad176c1c | Partial: the service's tier re-check stays as defense in depth. |
| 7.7 | 002ab384 | |
| 7.9 | c0d2f3c1, 0515db0b | Bug 15 (spend widget for T2). Partial: the directory route stays on `adminContext`, because adminRoutes.test.ts forbids a route's own T1/T2 check. |
| 8.1 | c3e94b4a | |
| 8.2 | 1312dc86 | |
| 8.3 | 0ac1a0f3 | |
| 8.4 | 1de78d42 | |
| 8.5 | cbcc4c37 | Partial: CombatHarness (D2) untouched. |
| 8.6 | d97e0cd5 | |
| 9.1 | 6cf19ab4 | Scope: the hand-written SQL parity tests (study tables, combat fees, kit traits, progression chapters) are unchanged. |

**Bugs fixed outside an item:**
- Bug 2 (catch card size): f599edb3.
- Bug 3 (nameplate "Lv. 1"): e7cfedec. Callers pass the combat-progression level. The Lv row is hidden until the level is known, and shows 1 when signed out.
- Bug 5 (touch stick): 325234b9.
- Bug 12 (painter health): bf4df4c8.

**Skipped:**
- **4.4.** PlayerAvatar is keyed and remounts on travel. Owning the focus there would reset the follow camera's state and far plane on every trip.
- **4.7.** `components/game/character/**` is off-limits (avatar v7 branch).
- **5.10 / Bug 14.** David's call.
- **7.8.** Deriving the mode from `goal_type` changes the goals editor for seasonal rows (the type locks and the back link changes).
- **Bug 16, second half** (the Transmuter banner showing twice). Not in this pass.
- **D1-D5.** Left exactly as they are.
