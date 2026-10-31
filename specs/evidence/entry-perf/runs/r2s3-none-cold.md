## r2s3-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2174, DOMContentLoaded 64
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2174 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 9.27 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 16.81 |
| Play (5174 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 7 / 0.75 | 17 / 6.75 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 23.22 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (441 ms); worst: 379 [373 FrameRequestCallback 63397793691123ee.js] | 62 [59 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 54 | canvas 1173 | stage: files 1583 | stage: warm-up 1173 | first island frame 3676 | can move 3813
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (54 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1173 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1583 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 82 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 256 / 0.29 |
| stage: warm-up (1173 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3676 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 266 / 2.56 |  | 15 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 463 / 4.98 |
| can move (3813 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 266 / 2.56 |  | 15 / 2.13 | 17 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.02 | 465 / 7.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1548 ms); worst: 2726+339 [336 FrameRequestCallback 63397793691123ee.js] | 3343+260 [257 FrameRequestCallback 63397793691123ee.js] | 1404+167 [165 MessagePort.onmessage 63397793691123ee.js] | 1179+158 [151 MessagePort.onmessage 4fa395d360c87cc3.js] | 82+132 [124 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 9 ms (main thread)
memory once in: JS heap 420 MB; GPU uploads ~330.00 MB textures + 45.73 MB buffers; three: [{"geometries":414,"textures":248,"programs":194}]
API and Supabase requests (32):
- 39-49 /api/admin/me
- 39-54 /api/admin/me
- 40-52 /api/profile
- 1180-1185 /api/economy/wallet
- 1181-1190 /api/collections
- 1181-1191 /api/progression/state
- 1182-1193 /api/collections/bag
- 1182-1197 /api/economy/wallet
- 1183-1202 /api/economy/wallet
- 1183-1203 /api/economy/wallet
- 1184-1195 /api/economy/tackle
- 1184-1196 /api/profile
- 1185-1188 /api/identity/me
- 1185-1186 /api/weather
- 1186-1199 /api/homes
- 1186-1200 /api/npc/friendship
- 1187-1202 /api/economy/inventory
- 1328-1331 /api/world/onboarding
- 1328-1334 /api/combat/progression
- 1329-1335 /api/collections
- 1351-1365 /api/weather
- 1386-1387 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1386-1387 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1386-1387 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2439-2439 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2454-2454 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2539-2539 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2643-2650 /api/crafting/recipes
- 2644-2653 /api/traditions/treat
- 4449-4449 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4525-4525 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4679-4680 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3740-3758)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3672-3731)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3676-3715)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3672-3725)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3676-3718)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3676-3715)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3676-3719)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3673-3722)
game files without a version: 0
glTF parses on the island: 271 of 258 distinct files; parsed more than once: 11
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
