## r2s4before-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 108, first contentful paint 108, interactive (title ready) 2258, DOMContentLoaded 70
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2258 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 9.27 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 16.81 |
| Play (5258 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 7 / 0.75 | 17 / 6.75 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 23.22 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (488 ms); worst: 372 [367 FrameRequestCallback 63397793691123ee.js] | 63 [60 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 53 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 68 | canvas 1184 | stage: files 1610 | stage: warm-up 1184 | first island frame 3846 | can move 10230
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (68 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1184 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1610 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 84 / 0.06 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 257 / 0.36 |
| stage: warm-up (1184 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3846 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 268 / 2.62 |  | 17 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 467 / 5.04 |
| can move (10230 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 268 / 2.62 |  | 17 / 2.13 | 17 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 12 / 0.00 | 4 / 0.02 | 475 / 7.28 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (1618 ms); worst: 2802+361 [360 FrameRequestCallback 63397793691123ee.js] | 3435+311 [305 FrameRequestCallback 63397793691123ee.js] | 1420+178 [176 MessagePort.onmessage 63397793691123ee.js] | 1190+170 [163 MessagePort.onmessage 4fa395d360c87cc3.js] | 100+136 [130 http://localhost:3322/_next/static/chunks/f5b4921d6112e89e.js f5b4921d6112e89e.js]
long frames in the 3 s after: 0
WebGL: 212 programs linked; compile 0 ms, link and its waits 9 ms (main thread)
memory once in: JS heap 431 MB; GPU uploads ~346.15 MB textures + 45.85 MB buffers; three: [{"geometries":422,"textures":252,"programs":194}]
API and Supabase requests (35):
- 53-62 /api/admin/me
- 53-68 /api/admin/me
- 54-67 /api/profile
- 1191-1196 /api/economy/wallet
- 1192-1200 /api/collections
- 1193-1202 /api/progression/state
- 1193-1203 /api/collections/bag
- 1194-1208 /api/economy/wallet
- 1194-1217 /api/economy/wallet
- 1194-1218 /api/economy/wallet
- 1195-1205 /api/economy/tackle
- 1195-1207 /api/profile
- 1196-1216 /api/identity/me
- 1196-1197 /api/weather
- 1197-1210 /api/homes
- 1198-1212 /api/npc/friendship
- 1198-1214 /api/economy/inventory
- 1350-1354 /api/world/onboarding
- 1351-1358 /api/combat/progression
- 1351-1359 /api/collections
- 1375-1378 /api/weather
- 1410-1412 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1420-1420 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1622-1623 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2466-2466 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2717-2719 /api/crafting/recipes
- 2718-2721 /api/traditions/treat
- 2787-2787 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2798-2799 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4493-4494 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4799-4799 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4806-4807 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8495-8496 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 8807-8807 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 8827-8827 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (10145-10153)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3816-3889)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3820-3867)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3816-3876)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3820-3869)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3820-3865)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3820-3871)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3817-3872)
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
console (errors and warm-up lines, 30):
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
