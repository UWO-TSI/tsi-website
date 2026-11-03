## before-none: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 108, first contentful paint 108, interactive (title ready) 2332, DOMContentLoaded 63
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2332 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 7.48 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 15.01 |
| Play (5332 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 10.23 |  | 7 / 0.75 | 18 / 6.78 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 400 / 20.32 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (495 ms); worst: 374 [369 FrameRequestCallback 63397793691123ee.js] | 67 [65 http://localhost:3333/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 54 [53 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 65 | canvas 1223 | stage: files 1639 | stage: warm-up 1223 | first island frame 3742 | can move 3982
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (65 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1223 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1639 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 80 / 0.04 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 254 / 0.33 |
| stage: warm-up (1223 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3742 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 271 / 2.08 |  | 17 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 22 / 0.01 | 6 / 0.00 | 3 / 0.01 | 469 / 4.50 |
| can move (3982 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 271 / 2.08 |  | 17 / 2.13 | 17 / 0.00 |  | 1 / 1.12 | 6 / 0.00 | 22 / 0.01 | 6 / 0.00 | 3 / 0.01 | 470 / 5.61 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 9 (1454 ms); worst: 2683+366 [363 FrameRequestCallback 63397793691123ee.js] | 3333+301 [295 FrameRequestCallback 63397793691123ee.js] | 1451+187 [185 MessagePort.onmessage 63397793691123ee.js] | 1229+161 [155 MessagePort.onmessage 4fa395d360c87cc3.js] | 103+135 [132 http://localhost:3333/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 204 programs linked; compile 0 ms, link and its waits 11 ms (main thread)
memory once in: JS heap 414 MB; GPU uploads ~329.17 MB textures + 45.68 MB buffers; three: [{"geometries":411,"textures":245,"programs":196}]
API and Supabase requests (31):
- 50-60 /api/admin/me
- 50-69 /api/admin/me
- 50-66 /api/profile
- 1231-1237 /api/economy/wallet
- 1231-1240 /api/collections
- 1232-1243 /api/progression/state
- 1233-1245 /api/collections/bag
- 1233-1249 /api/economy/wallet
- 1234-1257 /api/economy/wallet
- 1234-1258 /api/economy/wallet
- 1234-1246 /api/economy/tackle
- 1235-1248 /api/profile
- 1235-1256 /api/identity/me
- 1236-1237 /api/weather
- 1237-1251 /api/homes
- 1237-1253 /api/npc/friendship
- 1238-1255 /api/economy/inventory
- 1381-1385 /api/world/onboarding
- 1382-1388 /api/combat/progression
- 1382-1389 /api/collections
- 1405-1408 /api/weather
- 1440-1440 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1440-1440 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1440-1440 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2594-2598 /api/crafting/recipes
- 2629-2629 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2676-2676 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2684-2684 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4678-4678 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4687-4687 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4687-4687 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.12 MB /audio/ambient/dusk.ogg?v=ZVuy6maK (3909-3916)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3732-3838)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (3728-3875)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3732-3836)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3732-3835)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3732-3845)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (3728-3858)
game files without a version: 0
glTF parses on the island: 276 of 264 distinct files; parsed more than once: 10
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x acc_glasses_round (14720 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 26):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3333/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3333/assets/branding/shop-sign-v1.webp?v=JKG3Ytf8
- 512x512 
- 512x512 http://localhost:3333/assets/game/water/seabed-sand.webp?v=uTWPDano
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
