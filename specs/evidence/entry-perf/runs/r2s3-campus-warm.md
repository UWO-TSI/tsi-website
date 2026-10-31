## r2s3-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2704, DOMContentLoaded 124
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2704 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 199 / 0.00 |  | 6 / 0.00 | 14 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 278 / 0.02 |
| Play (5704 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (631 ms); worst: 350 [347 FrameRequestCallback 63397793691123ee.js] | 99 [97 Worker.onmessage ad8649c185500d2f.js] | 64 [63 MessagePort.onmessage 63397793691123ee.js] | 62 [59 Response.arrayBuffer.then ad8649c185500d2f.js] | 56 [54 FrameRequestCallback 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 110 | canvas 1559 | stage: files 1987 | stage: warm-up 1559 | first island frame 5966 | can move 6215
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (110 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 2 / 0.01 | 31 / 0.01 |
| canvas (1559 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1987 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 82 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 256 / 0.05 |
| stage: warm-up (1559 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (5966 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 269 / 0.00 |  | 19 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 473 / 0.05 |
| can move (6215 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 269 / 0.00 |  | 19 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 474 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (2468 ms); worst: 4721+718 [715 FrameRequestCallback 63397793691123ee.js] | 5439+350 [342 FrameRequestCallback 63397793691123ee.js] | 1679+305 [301 MessagePort.onmessage 63397793691123ee.js] | 159+268 [264 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3594+141 [140 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 94 ms (main thread)
memory once in: JS heap 427 MB; GPU uploads ~330.25 MB textures + 45.77 MB buffers; three: [{"geometries":416,"textures":249,"programs":194}]
API and Supabase requests (32):
- 112-159 /api/admin/me
- 113-205 /api/admin/me
- 114-159 /api/profile
- 1561-1605 /api/economy/wallet
- 1562-1606 /api/collections
- 1563-1606 /api/progression/state
- 1565-1607 /api/collections/bag
- 1566-1698 /api/economy/wallet
- 1566-1748 /api/economy/wallet
- 1567-1796 /api/economy/wallet
- 1568-1609 /api/economy/tackle
- 1569-1610 /api/profile
- 1570-1652 /api/identity/me
- 1572-1572 /api/weather
- 1573-1653 /api/homes
- 1574-1653 /api/npc/friendship
- 1574-1654 /api/economy/inventory
- 1579-1654 /api/world/onboarding
- 1580-1655 /api/combat/progression
- 1581-1699 /api/collections
- 1605-1700 /api/weather
- 1635-1635 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1636-1636 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1636-1636 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2729-2729 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2756-2756 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2831-2831 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4562-4603 /api/crafting/recipes
- 4565-4606 /api/traditions/treat
- 5826-5827 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5852-5852 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5888-5888 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

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
