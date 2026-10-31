## r2final-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 100, first contentful paint 100, interactive (title ready) 2799, DOMContentLoaded 120
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2799 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 6 / 0.00 | 14 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 281 / 0.02 |
| Play (5799 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (726 ms); worst: 354 [351 FrameRequestCallback 63397793691123ee.js] | 98 [96 Worker.onmessage ad8649c185500d2f.js] | 85 [59 Response.arrayBuffer.then e40f48c31fd57444.js] | 69 [68 MessagePort.onmessage 63397793691123ee.js] | 62 [60 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 113 | canvas 1566 | stage: files 2016 | stage: warm-up 1566 | first island frame 6058 | can move 6339
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (113 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (1566 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (2016 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 83 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 257 / 0.05 |
| stage: warm-up (1566 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (6058 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 270 / 0.00 |  | 18 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 473 / 0.05 |
| can move (6339 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 270 / 0.00 |  | 18 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 474 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 13 (2639 ms); worst: 4802+710 [707 FrameRequestCallback 63397793691123ee.js] | 5512+387 [379 FrameRequestCallback 63397793691123ee.js] | 1689+327 [320 MessagePort.onmessage 63397793691123ee.js] | 161+260 [252 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3706+149 [148 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 97 ms (main thread)
memory once in: JS heap 397 MB; GPU uploads ~330.00 MB textures + 45.75 MB buffers; three: [{"geometries":419,"textures":248,"programs":194}]
API and Supabase requests (32):
- 116-158 /api/admin/me
- 116-204 /api/admin/me
- 117-159 /api/profile
- 1569-1614 /api/economy/wallet
- 1570-1615 /api/collections
- 1572-1615 /api/progression/state
- 1573-1615 /api/collections/bag
- 1574-1705 /api/economy/wallet
- 1575-1748 /api/economy/wallet
- 1575-1796 /api/economy/wallet
- 1576-1617 /api/economy/tackle
- 1577-1618 /api/profile
- 1578-1657 /api/identity/me
- 1580-1580 /api/weather
- 1581-1658 /api/homes
- 1582-1659 /api/npc/friendship
- 1583-1659 /api/economy/inventory
- 1588-1660 /api/world/onboarding
- 1589-1660 /api/combat/progression
- 1590-1705 /api/collections
- 1617-1706 /api/weather
- 1656-1657 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1657-1657 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1657-1658 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2749-2749 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2781-2782 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2840-2840 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4649-4699 /api/crafting/recipes
- 4652-4700 /api/traditions/treat
- 4803-4803 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5935-5936 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5961-5961 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
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
