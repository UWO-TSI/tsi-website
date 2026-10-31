## v12-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 92, first contentful paint 92, interactive (title ready) 2790, DOMContentLoaded 120
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2790 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 380 / 0.03 |  | 16 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 472 / 0.05 |
| Play (5790 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 477 / 0.04 |  | 24 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 651 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (639 ms); worst: 348 [345 FrameRequestCallback 63397793691123ee.js] | 91 [86 Worker.onmessage b299fae64d43fd32.js] | 70 [69 MessagePort.onmessage 63397793691123ee.js] | 67 [33 Response.arrayBuffer.then e40f48c31fd57444.js] | 63 [61 Response.arrayBuffer.then b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 118 | canvas 1638 | stage: files 2076 | stage: warm-up 1638 | first island frame 5925 | can move 6172
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (118 ms) | 1 / 0.00 | 15 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 2 / 0.01 | 30 / 0.01 |
| canvas (1638 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 124 / 0.15 |  | 2 / 0.00 | 4 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 267 / 0.19 |
| stage: files (2076 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 142 / 0.15 |  | 5 / 0.00 | 13 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 318 / 0.20 |
| stage: warm-up (1638 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 124 / 0.15 |  | 2 / 0.00 | 4 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 267 / 0.19 |
| first island frame (5925 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 513 / 0.36 |  | 48 / 0.01 | 24 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 753 / 0.42 |
| can move (6172 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 523 / 0.37 |  | 56 / 0.01 | 24 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 5 / 0.01 | 772 / 0.43 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (2493 ms); worst: 4707+686 [684 FrameRequestCallback 63397793691123ee.js] | 5394+334 [323 FrameRequestCallback 63397793691123ee.js] | 1763+310 [306 MessagePort.onmessage 63397793691123ee.js] | 184+276 [267 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 4199+149 [147 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 93 ms (main thread)
memory once in: JS heap 435 MB; GPU uploads ~329.67 MB textures + 45.73 MB buffers; three: [{"geometries":417,"textures":247,"programs":194}]
API and Supabase requests (32):
- 121-167 /api/admin/me
- 121-215 /api/admin/me
- 122-168 /api/profile
- 1640-1686 /api/economy/wallet
- 1641-1686 /api/collections
- 1643-1687 /api/progression/state
- 1644-1688 /api/collections/bag
- 1645-1785 /api/economy/wallet
- 1646-1835 /api/economy/wallet
- 1647-1883 /api/economy/wallet
- 1648-1689 /api/economy/tackle
- 1648-1689 /api/profile
- 1649-1737 /api/identity/me
- 1651-1651 /api/weather
- 1653-1737 /api/homes
- 1654-1738 /api/npc/friendship
- 1654-1738 /api/economy/inventory
- 1659-1739 /api/world/onboarding
- 1661-1740 /api/combat/progression
- 1662-1786 /api/collections
- 1689-1787 /api/weather
- 1722-1722 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1722-1722 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1722-1722 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2757-2757 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2801-2801 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2846-2846 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4558-4608 /api/crafting/recipes
- 4560-4609 /api/traditions/treat
- 5765-5765 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5794-5794 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5833-5833 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
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
