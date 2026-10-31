## r2s4-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 100, first contentful paint 100, interactive (title ready) 2667, DOMContentLoaded 119
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2667 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 6 / 0.00 | 14 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 281 / 0.02 |
| Play (5667 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (624 ms); worst: 344 [341 FrameRequestCallback 63397793691123ee.js] | 95 [94 Worker.onmessage ad8649c185500d2f.js] | 68 [67 MessagePort.onmessage 63397793691123ee.js] | 62 [60 Response.arrayBuffer.then ad8649c185500d2f.js] | 55 [53 FrameRequestCallback 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 115 | canvas 1563 | stage: files 1999 | stage: warm-up 1563 | first island frame 5962 | can move 6208
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (115 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 2 / 0.01 | 31 / 0.01 |
| canvas (1563 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1999 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 81 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.05 |
| stage: warm-up (1563 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (5962 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 268 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 470 / 0.05 |
| can move (6208 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 268 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 471 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (2592 ms); worst: 4770+688 [685 FrameRequestCallback 63397793691123ee.js] | 5458+344 [336 FrameRequestCallback 63397793691123ee.js] | 1684+314 [308 MessagePort.onmessage 63397793691123ee.js] | 162+256 [251 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3957+140 [138 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 90 ms (main thread)
memory once in: JS heap 408 MB; GPU uploads ~330.00 MB textures + 45.72 MB buffers; three: [{"geometries":413,"textures":248,"programs":194}]
API and Supabase requests (32):
- 117-165 /api/admin/me
- 118-215 /api/admin/me
- 119-166 /api/profile
- 1565-1608 /api/economy/wallet
- 1566-1608 /api/collections
- 1568-1609 /api/progression/state
- 1569-1609 /api/collections/bag
- 1570-1706 /api/economy/wallet
- 1571-1751 /api/economy/wallet
- 1571-1800 /api/economy/wallet
- 1572-1613 /api/economy/tackle
- 1573-1614 /api/profile
- 1574-1656 /api/identity/me
- 1576-1576 /api/weather
- 1577-1656 /api/homes
- 1578-1657 /api/npc/friendship
- 1579-1657 /api/economy/inventory
- 1583-1658 /api/world/onboarding
- 1584-1659 /api/combat/progression
- 1585-1706 /api/collections
- 1608-1708 /api/weather
- 1639-1639 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1640-1640 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1640-1640 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2688-2689 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2754-2754 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2811-2811 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4615-4655 /api/crafting/recipes
- 4618-4660 /api/traditions/treat
- 4770-4771 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5824-5825 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5863-5864 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

game files without a version: 0
glTF parses on the island: 270 of 259 distinct files; parsed more than once: 9
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
