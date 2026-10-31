## r2s2shot-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 80, first contentful paint 80, interactive (title ready) 2468, DOMContentLoaded 42
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2468 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 202 / 10.60 |  | 12 / 6.97 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 282 / 22.09 |
| Play (5468 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 11 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 25.89 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (110 ms); worst: 58 [56 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 52 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 56 | canvas 1191 | stage: files 1605 | stage: warm-up 1191 | first island frame 3870 | can move 8249
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (56 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1191 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1605 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 81 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.29 |
| stage: warm-up (1191 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3870 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.56 |  | 24 / 2.13 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 465 / 4.98 |
| can move (8249 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.56 |  | 24 / 2.13 | 11 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.02 | 470 / 7.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1593 ms); worst: 2940+362 [356 FrameRequestCallback 63397793691123ee.js] | 3535+243 [242 FrameRequestCallback 63397793691123ee.js] | 1415+179 [177 MessagePort.onmessage 63397793691123ee.js] | 1197+157 [151 MessagePort.onmessage 4fa395d360c87cc3.js] | 88+137 [128 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 216 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 420 MB; GPU uploads ~345.69 MB textures + 45.80 MB buffers; three: [{"geometries":416,"textures":249,"programs":198}]
API and Supabase requests (35):
- 43-53 /api/admin/me
- 43-59 /api/admin/me
- 44-57 /api/profile
- 1198-1204 /api/economy/wallet
- 1198-1209 /api/collections
- 1199-1211 /api/progression/state
- 1200-1212 /api/collections/bag
- 1200-1216 /api/economy/wallet
- 1201-1222 /api/economy/wallet
- 1201-1222 /api/economy/wallet
- 1201-1214 /api/economy/tackle
- 1202-1215 /api/profile
- 1202-1207 /api/identity/me
- 1203-1203 /api/weather
- 1204-1218 /api/homes
- 1204-1219 /api/npc/friendship
- 1205-1220 /api/economy/inventory
- 1345-1351 /api/world/onboarding
- 1346-1354 /api/combat/progression
- 1346-1356 /api/collections
- 1366-1369 /api/weather
- 1402-1403 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1402-1403 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1403-1403 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2451-2451 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2466-2466 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2551-2551 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2858-2862 /api/crafting/recipes
- 2859-2865 /api/traditions/treat
- 4463-4463 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4477-4477 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4567-4567 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8464-8465 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 8491-8491 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 8574-8574 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (8159-8166)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3846-3931)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3850-3903)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3846-3913)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3850-3905)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3849-3902)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3850-3905)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3846-3906)
game files without a version: 0
glTF parses on the island: 270 of 257 distinct files; parsed more than once: 11
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
