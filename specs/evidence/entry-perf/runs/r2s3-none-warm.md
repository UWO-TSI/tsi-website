## r2s3-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 44, first contentful paint 44, interactive (title ready) 2334, DOMContentLoaded 43
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2334 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 6 / 0.00 | 15 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 283 / 0.02 |
| Play (5334 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (123 ms); worst: 66 [30 LINK.onload turbopack-4da6ec9caf62642a.js] | 57 [56 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 57 | canvas 1182 | stage: files 1457 | stage: warm-up 1182 | first island frame 3678 | can move 3851
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (57 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.00 |
| canvas (1182 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1457 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 81 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.05 |
| stage: warm-up (1182 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (3678 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 464 / 0.05 |
| can move (3851 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 465 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1640 ms); worst: 2772+574 [571 FrameRequestCallback 63397793691123ee.js] | 3347+213 [209 FrameRequestCallback 63397793691123ee.js] | 1271+175 [173 MessagePort.onmessage 63397793691123ee.js] | 87+133 [124 http://localhost:3322/_next/static/chunks/f5b4921d6112e89e.js f5b4921d6112e89e.js] | 1796+82 [81 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 224 ms (main thread)
memory once in: JS heap 427 MB; GPU uploads ~330.46 MB textures + 45.80 MB buffers; three: [{"geometries":415,"textures":251,"programs":198}]
API and Supabase requests (32):
- 46-49 /api/admin/me
- 46-53 /api/admin/me
- 47-51 /api/profile
- 1189-1191 /api/economy/wallet
- 1190-1193 /api/collections
- 1191-1193 /api/progression/state
- 1191-1195 /api/collections/bag
- 1192-1196 /api/economy/wallet
- 1192-1199 /api/economy/wallet
- 1192-1202 /api/economy/wallet
- 1193-1194 /api/economy/tackle
- 1193-1198 /api/profile
- 1194-1200 /api/identity/me
- 1194-1195 /api/weather
- 1195-1197 /api/homes
- 1196-1197 /api/npc/friendship
- 1196-1203 /api/economy/inventory
- 1200-1203 /api/world/onboarding
- 1201-1204 /api/combat/progression
- 1201-1205 /api/collections
- 1223-1225 /api/weather
- 1255-1255 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1255-1255 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1255-1256 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2295-2295 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2310-2310 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2394-2395 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2690-2692 /api/crafting/recipes
- 2691-2694 /api/traditions/treat
- 4308-4308 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4322-4322 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4413-4413 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

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
