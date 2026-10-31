## r2s2-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2208, DOMContentLoaded 62
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2208 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 9.27 |  | 11 / 5.31 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 19.11 |
| Play (5208 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 11 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 25.89 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (484 ms); worst: 367 [362 FrameRequestCallback 63397793691123ee.js] | 62 [59 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 55 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 50 | canvas 1172 | stage: files 1595 | stage: warm-up 1172 | first island frame 3741 | can move 3927
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (50 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1172 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1595 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 84 / 0.05 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 258 / 0.35 |
| stage: warm-up (1172 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3741 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 268 / 2.61 |  | 22 / 2.13 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 466 / 5.03 |
| can move (3927 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 268 / 2.61 |  | 22 / 2.13 | 11 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.02 | 468 / 7.26 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 10 (1481 ms); worst: 2761+346 [341 FrameRequestCallback 63397793691123ee.js] | 3357+285 [279 FrameRequestCallback 63397793691123ee.js] | 1408+177 [175 MessagePort.onmessage 63397793691123ee.js] | 1178+165 [159 MessagePort.onmessage 4fa395d360c87cc3.js] | 85+135 [127 http://localhost:3322/_next/static/chunks/f5b4921d6112e89e.js f5b4921d6112e89e.js]
long frames in the 3 s after: 0
WebGL: 200 programs linked; compile 0 ms, link and its waits 6 ms (main thread)
memory once in: JS heap 396 MB; GPU uploads ~330.38 MB textures + 45.79 MB buffers; three: [{"geometries":421,"textures":249,"programs":192}]
API and Supabase requests (32):
- 42-52 /api/admin/me
- 42-57 /api/admin/me
- 43-54 /api/profile
- 1179-1185 /api/economy/wallet
- 1180-1188 /api/collections
- 1180-1190 /api/progression/state
- 1181-1191 /api/collections/bag
- 1182-1195 /api/economy/wallet
- 1182-1202 /api/economy/wallet
- 1182-1203 /api/economy/wallet
- 1183-1193 /api/economy/tackle
- 1183-1194 /api/profile
- 1184-1201 /api/identity/me
- 1184-1185 /api/weather
- 1185-1197 /api/homes
- 1185-1198 /api/npc/friendship
- 1186-1200 /api/economy/inventory
- 1334-1339 /api/world/onboarding
- 1335-1341 /api/combat/progression
- 1335-1342 /api/collections
- 1356-1359 /api/weather
- 1391-1392 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1391-1392 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1392-1392 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2446-2447 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2462-2463 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2550-2550 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2663-2666 /api/crafting/recipes
- 2664-2669 /api/traditions/treat
- 4458-4458 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4541-4542 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4701-4702 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3838-3850)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3717-3780)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3721-3761)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3717-3774)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3721-3762)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3721-3759)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3721-3764)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3718-3767)
game files without a version: 0
glTF parses on the island: 273 of 260 distinct files; parsed more than once: 11
- 4x pCube48__mDoorR-mesh (154328 B)
- 2x Crown,Hull,Stem,Trunk (172208 B)
- 2x log-bench (36648 B)
- 2x FishCrate (139900 B)
- 2x plaza-bench (46360 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (491648 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (354368 B)
- 2x Crown,Trunk (24416 B)
- 2x Crown,Trunk (25536 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 27):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.png?v=5NaqjA_L
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
