## r2s1-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 96, first contentful paint 96, interactive (title ready) 2722, DOMContentLoaded 111
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2722 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 11 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 281 / 0.02 |
| Play (5722 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 13 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (571 ms); worst: 344 [341 FrameRequestCallback 63397793691123ee.js] | 95 [94 Worker.onmessage ad8649c185500d2f.js] | 70 [68 MessagePort.onmessage 63397793691123ee.js] | 62 [60 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 106 | canvas 1536 | stage: files 1969 | stage: warm-up 1536 | first island frame 5909 | can move 6156
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (106 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (1536 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1969 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 81 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.05 |
| stage: warm-up (1536 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (5909 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 268 / 0.00 |  | 24 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 471 / 0.05 |
| can move (6156 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 268 / 0.00 |  | 24 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 472 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (2546 ms); worst: 4703+703 [701 FrameRequestCallback 63397793691123ee.js] | 5406+335 [327 FrameRequestCallback 63397793691123ee.js] | 1652+314 [309 MessagePort.onmessage 63397793691123ee.js] | 153+253 [249 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3585+148 [147 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 114 ms (main thread)
memory once in: JS heap 412 MB; GPU uploads ~330.09 MB textures + 45.73 MB buffers; three: [{"geometries":412,"textures":249,"programs":198}]
API and Supabase requests (32):
- 109-157 /api/admin/me
- 109-206 /api/admin/me
- 110-158 /api/profile
- 1538-1581 /api/economy/wallet
- 1539-1581 /api/collections
- 1541-1582 /api/progression/state
- 1542-1583 /api/collections/bag
- 1543-1679 /api/economy/wallet
- 1544-1729 /api/economy/wallet
- 1544-1778 /api/economy/wallet
- 1545-1586 /api/economy/tackle
- 1546-1587 /api/profile
- 1547-1630 /api/identity/me
- 1549-1549 /api/weather
- 1550-1631 /api/homes
- 1551-1631 /api/npc/friendship
- 1552-1632 /api/economy/inventory
- 1557-1632 /api/world/onboarding
- 1558-1633 /api/combat/progression
- 1559-1680 /api/collections
- 1583-1681 /api/weather
- 1613-1614 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1614-1614 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1614-1614 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2659-2659 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2689-2690 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2725-2725 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4553-4603 /api/crafting/recipes
- 4555-4603 /api/traditions/treat
- 4703-4704 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5742-5743 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5743-5743 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

game files without a version: 0
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
