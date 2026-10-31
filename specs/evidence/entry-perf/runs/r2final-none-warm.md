## r2final-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 60, first contentful paint 60, interactive (title ready) 2359, DOMContentLoaded 37
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2359 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 6 / 0.00 | 15 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 283 / 0.02 |
| Play (5359 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (159 ms); worst: 55 [31 LINK.onload turbopack-4da6ec9caf62642a.js] | 53 [52 Worker.onmessage ad8649c185500d2f.js] | 51 [47 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 49 | canvas 1157 | stage: files 1430 | stage: warm-up 1157 | first island frame 3380 | can move 3559
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (49 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.00 |
| canvas (1157 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1430 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 83 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 257 / 0.05 |
| stage: warm-up (1157 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (3380 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 18 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 467 / 0.05 |
| can move (3559 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 18 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 468 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 8 (1372 ms); worst: 2520+569 [566 FrameRequestCallback 63397793691123ee.js] | 3090+216 [210 FrameRequestCallback 63397793691123ee.js] | 1246+172 [170 MessagePort.onmessage 63397793691123ee.js] | 85+128 [122 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 1913+77 [75 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 216 ms (main thread)
memory once in: JS heap 395 MB; GPU uploads ~330.63 MB textures + 45.81 MB buffers; three: [{"geometries":419,"textures":252,"programs":194}]
API and Supabase requests (32):
- 41-44 /api/admin/me
- 42-48 /api/admin/me
- 42-47 /api/profile
- 1163-1165 /api/economy/wallet
- 1164-1166 /api/collections
- 1165-1167 /api/progression/state
- 1165-1168 /api/collections/bag
- 1166-1169 /api/economy/wallet
- 1166-1174 /api/economy/wallet
- 1167-1177 /api/economy/wallet
- 1167-1170 /api/economy/tackle
- 1168-1170 /api/profile
- 1168-1171 /api/identity/me
- 1169-1169 /api/weather
- 1170-1172 /api/homes
- 1170-1173 /api/npc/friendship
- 1171-1174 /api/economy/inventory
- 1175-1178 /api/world/onboarding
- 1176-1179 /api/combat/progression
- 1176-1179 /api/collections
- 1198-1200 /api/weather
- 1227-1228 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1228-1228 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1228-1228 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2314-2314 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2328-2329 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2435-2437 /api/crafting/recipes
- 2436-2438 /api/traditions/treat
- 2513-2513 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4327-4327 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4478-4479 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4522-4522 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

game files without a version: 0
glTF parses on the island: 272 of 261 distinct files; parsed more than once: 9
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 51):
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
