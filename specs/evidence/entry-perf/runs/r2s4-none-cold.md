## r2s4-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 80, first contentful paint 80, interactive (title ready) 2148, DOMContentLoaded 42
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2148 ms) | 1 / 0.01 | 41 / 1.12 | 8 / 0.09 | 199 / 7.85 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 277 / 15.39 |
| Play (5148 ms) | 2 / 0.02 | 107 / 2.27 | 8 / 0.09 | 249 / 10.23 |  | 7 / 0.75 | 17 / 6.75 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 20.30 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (462 ms); worst: 351 [347 FrameRequestCallback 63397793691123ee.js] | 58 [54 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 53 [52 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 53 | canvas 1231 | stage: files 1649 | stage: warm-up 1231 | first island frame 3755 | can move 3902
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (53 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (1231 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1649 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 81 / 0.03 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.32 |
| stage: warm-up (1231 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3755 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.02 |  | 16 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 463 / 4.44 |
| can move (3902 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.02 |  | 16 / 2.13 | 17 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 464 / 6.67 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (1585 ms); worst: 2795+360 [355 FrameRequestCallback 63397793691123ee.js] | 3408+272 [269 FrameRequestCallback 63397793691123ee.js] | 1458+178 [176 MessagePort.onmessage 63397793691123ee.js] | 1237+155 [149 MessagePort.onmessage 4fa395d360c87cc3.js] | 98+149 [141 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 427 MB; GPU uploads ~329.75 MB textures + 45.70 MB buffers; three: [{"geometries":413,"textures":248,"programs":194}]
API and Supabase requests (32):
- 55-68 /api/admin/me
- 55-74 /api/admin/me
- 56-72 /api/profile
- 1238-1244 /api/economy/wallet
- 1239-1247 /api/collections
- 1240-1249 /api/progression/state
- 1240-1251 /api/collections/bag
- 1241-1255 /api/economy/wallet
- 1241-1262 /api/economy/wallet
- 1242-1263 /api/economy/wallet
- 1242-1253 /api/economy/tackle
- 1242-1254 /api/profile
- 1243-1261 /api/identity/me
- 1244-1244 /api/weather
- 1244-1257 /api/homes
- 1245-1258 /api/npc/friendship
- 1245-1260 /api/economy/inventory
- 1383-1389 /api/world/onboarding
- 1384-1392 /api/combat/progression
- 1385-1395 /api/collections
- 1404-1407 /api/weather
- 1442-1442 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1442-1442 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1442-1442 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2495-2496 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2510-2510 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2597-2598 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2715-2719 /api/crafting/recipes
- 2716-2721 /api/traditions/treat
- 4507-4507 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4528-4528 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4610-4610 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3821-3859)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3754-3839)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (3751-3853)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3754-3841)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3754-3838)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3755-3841)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (3751-3848)
game files without a version: 0
glTF parses on the island: 270 of 259 distinct files; parsed more than once: 9
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 27):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.webp?v=JKG3Ytf8
- 512x512 
- 512x512 http://localhost:3322/assets/game/water/seabed-sand.webp?v=uTWPDano
- 512x512 Image_1
- 512x512 Image_2
- 512x512 Image_0
- 512x512 
- 512x512 Image_7
- 512x512 Image_4
- 512x512 
- 512x512 
- 512x512 
- 512x512 
- 512x512 
