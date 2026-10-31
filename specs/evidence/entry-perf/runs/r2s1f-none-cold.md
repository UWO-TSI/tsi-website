## r2s1f-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 84, first contentful paint 84, interactive (title ready) 2129, DOMContentLoaded 41
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2129 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 9.27 |  | 11 / 5.31 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 19.11 |
| Play (5129 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 11 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 25.89 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (450 ms); worst: 338 [334 FrameRequestCallback 63397793691123ee.js] | 58 [55 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 54 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 55 | canvas 1141 | stage: files 1551 | stage: warm-up 1141 | first island frame 3838 | can move 4019
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (55 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1141 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1551 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 82 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 256 / 0.29 |
| stage: warm-up (1141 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3838 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 266 / 2.56 |  | 25 / 2.13 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 467 / 4.98 |
| can move (4019 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 266 / 2.56 |  | 25 / 2.13 | 11 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.02 | 469 / 7.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1576 ms); worst: 2903+357 [352 FrameRequestCallback 63397793691123ee.js] | 3484+254 [247 FrameRequestCallback 63397793691123ee.js] | 1365+175 [174 MessagePort.onmessage 63397793691123ee.js] | 1147+157 [151 MessagePort.onmessage 4fa395d360c87cc3.js] | 87+132 [124 http://localhost:3322/_next/static/chunks/f5b4921d6112e89e.js f5b4921d6112e89e.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 432 MB; GPU uploads ~330.00 MB textures + 45.73 MB buffers; three: [{"geometries":414,"textures":248,"programs":194}]
API and Supabase requests (32):
- 42-52 /api/admin/me
- 42-60 /api/admin/me
- 42-57 /api/profile
- 1148-1154 /api/economy/wallet
- 1148-1159 /api/collections
- 1149-1161 /api/progression/state
- 1150-1162 /api/collections/bag
- 1150-1166 /api/economy/wallet
- 1151-1172 /api/economy/wallet
- 1151-1173 /api/economy/wallet
- 1151-1164 /api/economy/tackle
- 1152-1165 /api/profile
- 1152-1157 /api/identity/me
- 1153-1153 /api/weather
- 1154-1168 /api/homes
- 1154-1169 /api/npc/friendship
- 1155-1171 /api/economy/inventory
- 1295-1300 /api/world/onboarding
- 1296-1303 /api/combat/progression
- 1296-1304 /api/collections
- 1317-1320 /api/weather
- 1352-1352 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1352-1352 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1352-1352 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2394-2394 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2422-2422 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2443-2443 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2825-2828 /api/crafting/recipes
- 2826-2830 /api/traditions/treat
- 4427-4427 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4434-4434 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4523-4523 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3929-3938)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3809-3872)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3812-3859)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3809-3865)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3812-3860)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3812-3858)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3812-3860)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3809-3861)
game files without a version: 0
glTF parses on the island: 293 of 258 distinct files; parsed more than once: 24
- 6x V6_Body.001,V8_Head.001 (49744 B)
- 4x pCube48__mDoorR-mesh (154328 B)
- 4x top_tee.001 (10372 B)
- 3x V6_Body,V6_Bottom,V6_HairBack,V6_HairBangs,V6_Top,V8_Head (865532 B)
- 3x acc_glasses_square (12864 B)
- 3x bottom_shorts (7576 B)
- 2x Crown,Hull,Stem,Trunk (172208 B)
- 2x log-bench (36648 B)
- 2x FishCrate (139900 B)
- 2x plaza-bench (46360 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (491648 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (354368 B)
- 2x Crown,Trunk (24416 B)
- 2x Crown,Trunk (25536 B)
- 2x top_tee (8812 B)
- 2x top_stripe_ls.001 (11332 B)
- 2x bottom_joggers,bottom_joggers.001 (13672 B)
- 2x shoes_sneakers,shoes_sneakers.001,shoes_sneakers.002 (11824 B)
- 2x acc_wheat_stalk.001 (14652 B)
- 2x acc_propeller_cap.001 (10024 B)
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
