## r2s2-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 96, first contentful paint 96, interactive (title ready) 2716, DOMContentLoaded 121
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2716 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 199 / 0.00 |  | 11 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 278 / 0.02 |
| Play (5716 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 13 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (580 ms); worst: 348 [344 FrameRequestCallback 63397793691123ee.js] | 100 [99 Worker.onmessage ad8649c185500d2f.js] | 69 [68 MessagePort.onmessage 63397793691123ee.js] | 63 [61 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 110 | canvas 1535 | stage: files 1982 | stage: warm-up 1535 | first island frame 5714 | can move 5940
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (110 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (1535 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1982 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 83 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 257 / 0.05 |
| stage: warm-up (1535 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (5714 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 270 / 0.00 |  | 22 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 471 / 0.05 |
| can move (5940 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 270 / 0.00 |  | 22 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 472 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (2377 ms); worst: 4523+694 [692 FrameRequestCallback 63397793691123ee.js] | 1642+322 [306 MessagePort.onmessage 63397793691123ee.js] | 5218+317 [309 FrameRequestCallback 63397793691123ee.js] | 164+268 [264 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3404+146 [145 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 105 ms (main thread)
memory once in: JS heap 398 MB; GPU uploads ~330.09 MB textures + 45.75 MB buffers; three: [{"geometries":415,"textures":249,"programs":194}]
API and Supabase requests (32):
- 113-154 /api/admin/me
- 113-197 /api/admin/me
- 115-156 /api/profile
- 1537-1580 /api/economy/wallet
- 1539-1580 /api/collections
- 1540-1581 /api/progression/state
- 1542-1583 /api/collections/bag
- 1543-1679 /api/economy/wallet
- 1543-1727 /api/economy/wallet
- 1544-1774 /api/economy/wallet
- 1545-1586 /api/economy/tackle
- 1546-1587 /api/profile
- 1547-1630 /api/identity/me
- 1548-1549 /api/weather
- 1550-1630 /api/homes
- 1551-1631 /api/npc/friendship
- 1551-1631 /api/economy/inventory
- 1556-1632 /api/world/onboarding
- 1557-1632 /api/combat/progression
- 1558-1680 /api/collections
- 1583-1681 /api/weather
- 1612-1612 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1612-1612 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1612-1613 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2647-2647 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2679-2680 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2734-2734 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4369-4411 /api/crafting/recipes
- 4372-4414 /api/traditions/treat
- 5572-5572 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5597-5598 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5637-5638 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

game files without a version: 0
glTF parses on the island: 272 of 259 distinct files; parsed more than once: 11
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
