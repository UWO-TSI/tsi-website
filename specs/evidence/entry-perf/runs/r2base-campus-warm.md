## r2base-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 100, first contentful paint 100, interactive (title ready) 2784, DOMContentLoaded 122
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2784 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 380 / 0.03 |  | 20 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 476 / 0.05 |
| Play (5784 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 477 / 0.04 |  | 24 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 651 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (634 ms); worst: 347 [343 FrameRequestCallback 63397793691123ee.js] | 97 [95 Worker.onmessage b299fae64d43fd32.js] | 65 [36 Response.arrayBuffer.then e40f48c31fd57444.js] | 64 [63 MessagePort.onmessage 63397793691123ee.js] | 61 [60 Response.arrayBuffer.then b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 109 | canvas 1581 | stage: files 2019 | stage: warm-up 1581 | first island frame 5882 | can move 6152
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (109 ms) | 1 / 0.00 | 15 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 29 / 0.00 |
| canvas (1581 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.00 |  | 2 / 0.00 | 5 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 274 / 0.04 |
| stage: files (2019 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 146 / 0.00 |  | 5 / 0.00 | 15 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 324 / 0.05 |
| stage: warm-up (1581 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.00 |  | 2 / 0.00 | 5 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 274 / 0.04 |
| first island frame (5882 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 516 / 0.18 |  | 50 / 0.01 | 26 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 760 / 0.24 |
| can move (6152 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 531 / 0.19 |  | 58 / 0.01 | 26 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 5 / 0.01 | 784 / 0.25 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 15 (2628 ms); worst: 4677+698 [696 FrameRequestCallback 63397793691123ee.js] | 5375+333 [322 FrameRequestCallback 63397793691123ee.js] | 1704+315 [308 MessagePort.onmessage 63397793691123ee.js] | 157+257 [252 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 3513+144 [143 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 103 ms (main thread)
memory once in: JS heap 430 MB; GPU uploads ~330.00 MB textures + 45.71 MB buffers; three: [{"geometries":410,"textures":248,"programs":194}]
API and Supabase requests (32):
- 111-160 /api/admin/me
- 112-208 /api/admin/me
- 113-160 /api/profile
- 1584-1627 /api/economy/wallet
- 1585-1628 /api/collections
- 1586-1628 /api/progression/state
- 1588-1629 /api/collections/bag
- 1589-1715 /api/economy/wallet
- 1589-1759 /api/economy/wallet
- 1590-1805 /api/economy/wallet
- 1591-1632 /api/economy/tackle
- 1592-1633 /api/profile
- 1593-1674 /api/identity/me
- 1594-1594 /api/weather
- 1596-1675 /api/homes
- 1597-1675 /api/npc/friendship
- 1597-1676 /api/economy/inventory
- 1602-1676 /api/world/onboarding
- 1604-1677 /api/combat/progression
- 1605-1716 /api/collections
- 1631-1718 /api/weather
- 1662-1663 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1663-1663 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1663-1663 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2689-2689 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2748-2749 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2804-2804 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4521-4570 /api/crafting/recipes
- 4524-4571 /api/traditions/treat
- 5731-5731 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5757-5757 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5794-5794 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

console (errors and warm-up lines, 51):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.png
- 512x512 
- 512x512 http://localhost:3322/assets/game/water/seabed-sand.webp
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
