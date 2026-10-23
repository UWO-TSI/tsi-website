# CODEMAP

Jump table. Paths are repo-relative. "(unclear)" = unverified. Read `STATE.md` for what is live.
Layout: `web/` (Next.js: app, components, lib, data, scripts, supabase), `realtime/` (Colyseus), `art/` (Blender), `specs/`, `scripts/`.

## 1. Surfaces

| Surface | Routes | Code |
|---|---|---|
| Marketing | `/`, `/genesis`, `/globetest`, `/npo/*` | `web/app/(site)/`, `app/genesis`, `app/npo`, `components/{sections,hero,layout,ui,title}/` |
| Recruitment/apply | `/student/apply/*`, `/student/election`, `/finalround[/token]`, `/admin/recruit` | `app/student/apply/`, `components/{recruit,admin}/`, `lib/recruitment*.ts`, `app/finalround/FinalRound.tsx` |
| Applicant island (3D) | `/student/apply/portal` | `components/recruit/{ApplicantIsland,ApplicantWorld}.tsx`, `lib/game/{applicantVillage,applicantTime}.ts` |
| Member game (3D) | `/student/dashboard` (renders `DefaultIslandWorld`), `/student/go`, `/student/onboarding`, `/student/opening-soon` | `components/game/DefaultIslandWorld.tsx`, `lib/game/` |
| Member portal + admin | `/student/dashboard/*` (bounty, calendar, directory, economy, jobs, kanban, leaderboard, oracle, quests, shop), `/student/dashboard/admin/*` | `app/student/dashboard/`, `components/portal/`, `lib/portal/`, `lib/content/` |
| Companion/study | `/student/companion[/study]` | `components/{companion,study}/`, `lib/study/` |
| Lab tools | `/lab/{avatar,classes,fishing,furniture,gui,hairthumbs,icon,icons,interior,island,item,look,map,move,tune,world}` | `app/lab/*/page.tsx`, `components/lab/`; map painter `app/lab/map/page.tsx` |
| Dev pages | `/dev`, `/dev/{economy,playground,progression}` | `app/dev/` |
| Realtime | Colyseus room `island` (Fly.io) | `realtime/src/` |

Auth gate: `web/middleware.ts`, `lib/supabase/middleware.ts`.

## 2. Game systems

Logic `web/lib/game/` (flat, `foo.ts` + `foo.test.ts`). R3F `web/components/game/`. Scene root `DefaultIslandWorld.tsx`. Below, `L/` = `web/lib/game/`, `C/` = `web/components/game/`.

| System | Files | Entry | Tests |
|---|---|---|---|
| World, terrain, grid | `L/grid.ts`, `L/world/`, `C/grid/` (GridWorld, GridTerrain, GridCliffs, GridOcean), `C/world/SmoothTerrain.tsx`, `L/coast.ts` | `C/grid/GridWorld.tsx` | `L/grid.test.ts`, `L/world/*.test.ts`, `C/grid/*.test.ts` |
| Shipped village map | `web/data/village-map.json` (terrain + objects; David paints it in `/lab/map`, agents do not edit), `island-map.json`, `world-map.json`; loader `L/villageMap.ts`, `L/mapHealth.ts` | `L/villageMap.ts` | `villageMap.test.ts`, `mapHealth.test.ts` |
| Rendering look | `C/{PostFX,SkyDome,IslandAtmosphere,SunShadows,ContactShadows,LookMaterials}.tsx`, `L/{grading,skyShader,islandLighting,envLight,shadows,aerialFog,curvedWorld,lookPreset,qualityTier}.ts` | `DefaultIslandWorld.tsx` | `islandLighting`, `envLight`, `lookPreset`, `shadows` |
| Water | `L/waterShader.ts`, `L/{waterField,waterLevels,waves,foamRings,seabed}.ts`, `C/water/`, `C/grid/GridOcean.tsx` | `GridOcean.tsx` | `waves`, `foamRings`, `waterDepth`, `GridOcean` |
| Time, weather, season | `L/{worldClock,islandTime,sunPath,islandWeather,weatherSystem,season,seasonalEvents,halloween}.ts`, `C/{RainFX,WeatherGround,SeasonalEvents,Halloween}.tsx` | `L/useIslandConditions.ts` | `worldClock`, `weatherSystem`, `season` |
| Nature, grass, FX | `C/{InstancedNature,NatureModels,Critters,Seagulls}.tsx`, `L/{natureLod,grassField,fireflySwarm,ambientFauna,puddles}.ts`, `L/fx/` | `C/AmbientLife.tsx` | `natureLod`, `L/fx/*.test.ts` |
| Character, avatar, hair, wardrobe | `C/character/` (Character, CharacterCreator), `C/PlayerAvatar.tsx`, `L/character/`, `web/data/characters/*.json`, `C/peaceful/WardrobeSheet.tsx`, `C/FittingRoom.tsx` | `C/character/Character.tsx` | `L/character/*.test.ts` |
| Movement | `L/movement/` (sim, keys, juice, ride), `L/{locomotion,glider,moveUnlocks,keyboardInput}.ts`, `C/movement/` | `L/movement/sim.ts` | `movement/sim.test.ts`, `locomotion` |
| Camera | `L/{orbitCamera,cameraBasis,cameraJuice,photoMode,introSweep}.ts`, `C/useOrbitInput.ts` | `L/orbitCamera.ts` | `orbitCamera`, `introSweep` |
| Combat, classes | `web/lib/combat/` (kits, classes, per-family kits, progression, missions, service), `L/combat/` (abilities, runtime, sim, mobs, spawns, balance), `L/fx/`, `C/combat/`, `app/api/combat/*` | `L/combat/runtime.ts`, `C/combat/CombatHud.tsx` | `L/combat/*.test.ts`, `lib/combat/*.test.ts` |
| Arrival, opening, tutorial, onboarding | `L/arrival/` (sequence, crossing, tutorial, `hq/` teachers), `C/arrival/`, `C/hq/useHqOnboarding.ts`, `L/{actTiming,welcome}.ts`, `api/{onboarding,world/arrival}` | `C/arrival/Arrival.tsx` | `L/arrival/**/*.test.ts` |
| Interiors: HQ, shop | `C/{HQInterior,RoomShell,interiorShared}.tsx`, `C/hq/`, `C/Shop*.tsx`, `L/{clubhouse,interiorLight,shopLayout,shopCounter,shopDisplay}.ts` | `HQInterior.tsx`, `ShopInterior.tsx` | `clubhouse`, `shop*.test.ts` |
| Interiors: home, museum, cafe, oracle, wharf | `C/home/`, `web/lib/homes{,-sync}/`, `L/homeIsland.ts`, `C/peaceful/MuseumInterior.tsx`, `C/study/Cafe*.tsx`, `L/cafe.ts`, `C/oracle/`, `web/lib/oracle/`, `C/wharf/`, `L/{wharf,boatTrip}.ts` | `C/home/HomeIslandScene.tsx` | `homeIsland`, `cafe`, `wharf`, `boatTrip` |
| Villagers | `C/{NPC,Keeper}.tsx`, `C/peaceful/VillageLife.tsx`, `L/{residentRoutine,residentSpace,residentTalk,keepers}.ts`, `web/lib/npc/`, `api/npc/*` | `C/NPC.tsx` | `resident*`, `keepers` |
| Fishing | `L/fishing*.ts`, `L/rods.ts`, `C/{FishingOverlay,FishingBobber,FishReveal}.tsx`, `C/character/FishingRig.tsx` | `L/fishing.ts` | `fishing*.test.ts` |
| Forage, bugs, trees, collections | `L/{peaceful,forageWorld,bugFlee,treeFruit,drops,collections,bagStore}.ts`, `C/peaceful/`, `C/{Bag,CollectionBook}.tsx`, `web/lib/collections/`, `api/collections/*` | `C/peaceful/PeacefulLayer.tsx` | `peaceful`, `forage*`, `collections` |
| Study tables | `C/study/`, `web/lib/study/`, `api/study/*` | `C/study/StudySeats.tsx` | `lib/study/*.test.ts` |
| Multiplayer client | `web/lib/net/` (protocol.ts wire format), `C/net/` (NetWorld, RemoteAvatars, ChatDock), `web/lib/world/` (friends), `api/world/*`, `lib/server/realtimeNotify.ts` | `C/net/NetWorld.tsx` | `lib/net/*.test.ts`, `C/net/*.test.ts` |
| Realtime server | `realtime/src/` (`rooms/{IslandRoom,chat,state,limits,sanity,views}.ts`, auth/, world.ts, internal.ts), `realtime/scripts/bots.ts` | `rooms/IslandRoom.ts` | `realtime/test/*.test.ts`, `soak.ts` |
| UI, HUD, menus, GUI kit | `C/{TopCluster,MiniMap,ToolWheel,TalkBox,ToastHub,QuestTracker,EscLayers,RewardCard}.tsx`, `web/components/gui/`, `L/{hudStore,hudPrefs,escMenu,toolWheel,toastQueue}.ts`, design tokens `web/styles/game-tokens.css` | `C/TopCluster.tsx` | `hudStore`, `escMenu`, `toolWheel`, `MiniMap` |
| Economy (coins, gems, shop, prices) | `web/lib/wallet/` (rules, catalogue, service, shopShelves, merchShelf), `web/components/economy/`, `C/DailyGift.tsx`, `api/{economy,shop}/*` | `lib/wallet/service.ts`, `rules.ts` | `lib/wallet/*.test.ts` |
| Progression, quests, crafting | `web/lib/progression/`, `web/components/progression/`, `web/lib/crafting/`, `L/{questTracker,progressionBridge}.ts`, `api/{progression,quests,crafting}/*` | `lib/progression/` | `lib/progression/*.test.ts` |
| Perf budget | `L/perf/` (budget, governor, frameStats), `L/{mapBudget,qualityTier}.ts`, `C/{QualityGovernor,PerfProbe}.tsx`, `specs/perf/` (perf-check.mjs, budget.md, baseline.json), `web/scripts/map-budget.mjs` | `specs/perf/perf-check.mjs` | `perf/budget`, `governor` |
| Audio | `L/{audio,useAudio,musicSchedule}.ts`, `C/AudioController.tsx`, `web/public/assets/audio/`, `art/audio/` | `AudioController.tsx` | `audio*.test.ts` |
| Dance, emotes, photo, campfire | `C/{dance,emotes,photo,campfire}/`, `L/{danceSync,emotePlay,photo,campfire}.ts` | (unclear) | `danceSync`, `photo`, `campfire` |
| Merch 3D | `C/{Lanyard,KeycapKeychain,GenesisSticker}.tsx`, `L/{lanyardFlat,keychainSwing}.ts`, `art/merch/` | (unclear) | `lanyardFlat` |
| Identity, moderation | `web/lib/{identity,moderation}/`, `api/identity/*` | (unclear) | `L/identity.test.ts` |

## 3. Data and backend

| Thing | Where |
|---|---|
| Supabase | clients `web/lib/supabase/{client,server,admin,middleware}.ts`; types `lib/supabase/types.ts`; `lib/server/{memberContext,adminContext}.ts` |
| Security tests | `web/supabase/tests/game_security_smoke.sql` (exploit tests: `wallet_apply` server-only, `invite_codes` hidden, `member_badges` closed to anon) |
| Migrations | `web/supabase/migrations/` (93). Never edit applied ones. New: `YYYYMMDDHHMMSS_name.sql`, timestamp later than latest on main (old ones `001_`..`0NN_`). Prod status in `STATE.md`. Also `supabase/{drafts,tests}/` |
| API routes | `web/app/api/<domain>/<action>/route.ts` (combat, economy, collections, study, progression, world, npc, oracle, applications, admin, ...). Client helper `lib/apiClient.ts` |
| Server actions | (unclear) none verified; mutations go through API routes |
| Store pattern | `service.ts` + `store.ts` + `supabaseStore.ts` + `memoryStore.ts` + `transport.ts` in `lib/{wallet,study,combat,world}/` |
| Content / email | `web/data/content-defaults.ts`, `lib/content/`; `web/emails/`, `lib/resend.ts` |

## 4. Art pipeline

Blender headless: `Blender -b -P art/<dir>/<script>.py`. Outputs GLB/PNG into `web/public/assets/{game,characters,acnh,fx,icons,nature,sky,buildings,fauna,audio}`.

| `art/` dir | Contents |
|---|---|
| `characters/` | base body `base/`, `hair/`, `accessories/`, `outfits/`, `lod1|2/`, `build_lod.py`, `colour_atlas.py`; out `assets/characters/v6` |
| `props-enemies/` | `pe.py` helper (out `assets/game/`), build_{enemies,props,items,tools,weapons,arcane,warden,forage,bobber,combat_fx}.py |
| `nature/`, `trees/`, `rocks/` | nature kit, trees, flowers, bushes, rocks |
| `terrain/`, `water/`, `wharf/` | ground, fish, seabed, wharf |
| `buildings/`, `interiors/`, `cafe/` | buildings, interiors (`shop_layout.json`), cafe (`cafekit.py`) |
| `barriers/`, `fx/`, `icons/`, `merch/`, `traditions/`, `audio/` | fences, FX packs, class icons, lanyard/keychain/sticker, pumpkin, key synth |

Import scripts (`web/scripts/`, `node`): `extract-acnh-*`, `extract-{sky,road,grass}-*`, `derive-kit-mapping`, `organize-dump`, `sync-character-assets`, `convert-fbx-to-glb.js`, `convert-world.ts`, `bake-hair-thumbs`, `render-icons`, `finish-{trees,bushes,greenery}`, `fix-normal-maps`, `restore-*-assets`, `glb-bbox`, `character-inspect`. Root `scripts/`: `fbx_to_glb.py`, `prepare-hq-lamp.py`, `restore-hq-textures.py`. David supplies all art references.

## 5. Commands

Run in `web/`.

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` (known baseline of old errors in `specs/qa.md`: don't raise it) |
| Tests | `npm test` (script `test` = `vitest run`); one file `npx vitest run lib/game/grid.test.ts`; `npm run test:watch` |
| Typecheck | no script; `npx tsc --noEmit` |
| Perf check | `npm run perf:check` (once per rendering lane) |
| Realtime (in `realtime/`) | `npm run dev`, `build`, `test`, `typecheck`, `bots`, `soak` |

### Dev URLs and overrides

Dev server only (`/lab` and `/dev` 404 in production builds). Member island `/student/dashboard`, test island `/lab/island`, applicant island `/student/apply/portal?preview=1`, harness index `/dev` (progression, economy, combat, playground).

| Override | Values |
|---|---|
| `?time=` | `dawn`, `day`, `evening`, `night` or an hour like `18.5` |
| `?weather=` | `rain`, `snow`, `fog`, `wind` |
| `?season=` | `winter`, or a blend like `autumn-winter:0.5` |
| Interiors | `?hq=inside`, `?museum=inside`, `?temple=inside`, `?home=1` or `?home=inside`, `?decorate=1&place=<piece>` |
| Combat | `?ruins=1`, `?mission=<id>` |
| Position | `?at=x,z`, `?spawnat=x,z`, `?aerial=1&ax&az&ah&dir` |
| Signed-out demo data | `?collections=demo`, `?progression=demo`, `?oracle=demo` |
| World switch (build env) | `NEXT_PUBLIC_GAME_WORLD=new` plays the new world (`web/data/world`) on the member island and in the server's catch checks; unset is the village (`lib/game/world/active.ts`) |
| Maps | `/lab/island?fixture=v2` walks the v2 world, `/lab/map?fixture=v2` paints it, `?fixture=terrain` opens the synthetic test island, `/lab/island?draft=1` walks the painter's draft |

## 6. Big files (over 40 KB; line ranges approximate)

**web/components/game/DefaultIslandWorld.tsx** (1383): 1-216 imports; 217-350 types, constants, `villageLayout`; 351-411 probes, `SeatWatch`; 412-552 `IslandScene`; 553-692 monument, landmarks, `Clubhouse`; 693-1383 `DefaultIslandWorldContent` (state, input, sheets, HUD, interior switch ~1219).

**web/app/lab/map/page.tsx** (2272): 1-224 imports; 225-490 library, `World`, undo, `terrainRaster`; 491-2253 `MapLab` (one component); 2254-2272 `Legend`.

**web/lib/game/grid.ts** (1939): 1-148 constants; 149-331 height field; 332-580 `Surface`, `IslandMap`, cell access; 582-850 props, parse/serialise, resize; 852-1060 chunks, `Dir`, `autotile`; 1061-1365 kit pieces, cliff logic; 1367-1700 coast/natural terrain (`terrainOf`); 1700-1939 `cellPieces`, `ShoreSdf`.

**web/lib/game/movement/sim.test.ts** (1069): 37 jump; 251 skids/rolls; 371 in-game; 521 leaf glider.

**web/components/game/character/Character.tsx** (1031): 1-160 consts, atlases, hair shader; 161-234 ghost trail; 235-631 `Puppet` class; 632-789 weapons, leaf; 790-871 held items; 872-970 `Character`; 971-1031 LOD, `preloadLooks`.

**web/components/game/PlayerAvatar.tsx** (854): 1-183 helpers; 184-824 `PlayerAvatar` (one component); 825-854 `heldView`, `PlayerCharacter`.

**web/components/recruit/ApplicationForm.tsx** (1228): 1-137 types, helpers; 142-1195 `ApplicationFormInner`; 1196-1228 review rows.

**web/app/finalround/FinalRound.tsx** (1139): 1-78 helpers; 79-1139 `FinalRound` (one component).

**web/lib/game/combat/abilities.ts** (667): 1-81 consts, cues; 82-216 kit, hits, `strike`; 217-276 heal, shield, `mitigate`; 277-358 `fireSlot`, `resolveCast`; 359-492 `runEffects`; 493-667 units, targets.

**web/lib/net/protocol.ts** (803): 1-152 version, close codes, areas; 153-291 enums, quantization; 292-393 pose packet; 394-548 state schema, messages; 549-686 chat, friends; 687-803 limits, clock. Test `protocol.test.ts` mirrors it.

**web/lib/game/waterShader.ts** (858): 1-242 params, depth ramp, uniforms; 243-459 optics, chop, clouds, foam; 460-769 swell, waves, ripple; 770-858 `waterMaterial`, underwater.

**web/components/game/peaceful/VillageLife.tsx** (637): 1-211 nodes, rocks, holes, bugs; 212-284 fade/lift; 285-637 `VillageLife`.

**web/lib/game/combat/balance.ts** (527): 1-250 sim harness; 251-527 classes v2 harness.

**web/lib/combat/kits.ts** (512): 1-200 types; 201-395 `SUBCLASSES`; 396-487 units, traits; 488-512 loadout.

## 7. Specs

Specs live in `specs/`; `specs/INDEX.md` lists them by area. Ledger `specs/game-world-development-plan.md`, order `specs/development-roadmap.md`, rules `specs/lane-rules.md`.
