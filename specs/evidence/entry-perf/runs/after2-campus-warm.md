## after2-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 96, first contentful paint 96, interactive (title ready) 2783, DOMContentLoaded 120
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2783 ms) | 1 / 0.01 | 41 / 0.00 | 7 / 0.00 | 376 / 0.03 |  | 18 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 470 / 0.06 |
| Play (5783 ms) | 2 / 0.01 | 103 / 0.00 | 7 / 0.00 | 469 / 0.05 |  | 22 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 638 / 0.07 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (578 ms); worst: 355 [352 FrameRequestCallback b29ba28996376b6a.js] | 97 [95 Worker.onmessage 6a764e44c60fc2d8.js] | 68 [67 MessagePort.onmessage b29ba28996376b6a.js] | 58 [56 Response.arrayBuffer.then 6a764e44c60fc2d8.js]

### Play to walking (ms from Play)
loading screen 110 | canvas 1520 | stage: files 1926 | stage: warm-up 1520 | first island frame 5319 | can move 5534
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (110 ms) | 1 / 0.00 | 15 / 0.00 | 7 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 2 / 0.01 | 31 / 0.01 |
| canvas (1520 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 126 / 0.00 |  | 2 / 0.00 | 5 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 263 / 0.04 |
| stage: files (1926 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 141 / 0.00 |  | 5 / 0.00 | 15 / 0.00 |  |  | 6 / 0.00 | 15 / 0.01 | 3 / 0.00 | 2 / 0.01 | 306 / 0.05 |
| stage: warm-up (1520 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 126 / 0.00 |  | 2 / 0.00 | 5 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 263 / 0.04 |
| first island frame (5319 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 499 / 0.16 |  | 34 / 0.00 | 26 / 0.00 |  |  | 6 / 0.00 | 17 / 0.01 | 9 / 0.00 | 4 / 0.01 | 714 / 0.21 |
| can move (5534 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 514 / 0.16 |  | 42 / 0.01 | 26 / 0.00 |  |  | 6 / 0.00 | 17 / 0.01 | 9 / 0.00 | 5 / 0.01 | 738 / 0.23 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 15 (2495 ms); worst: 4124+660 [658 FrameRequestCallback b29ba28996376b6a.js] | 1629+293 [290 MessagePort.onmessage b29ba28996376b6a.js] | 4784+282 [272 FrameRequestCallback b29ba28996376b6a.js] | 162+243 [237 http://localhost:3322/_next/static/chunks/c3805d6ee339bbc4.js c3805d6ee339bbc4.js] | 3308+158 [155 MessagePort.onmessage b29ba28996376b6a.js]
long frames in the 3 s after: 0
WebGL: 199 programs linked; compile 0 ms, link and its waits 89 ms (main thread)
memory once in: JS heap 412 MB; GPU uploads ~317.27 MB textures + 46.64 MB buffers; three: [{"geometries":402,"textures":245,"programs":191}]
API and Supabase requests (26):
- 112-154 /api/admin/me
- 113-200 /api/admin/me
- 114-155 /api/profile
- 1532-1580 /api/economy/wallet
- 1533-1581 /api/collections
- 1535-1581 /api/collections/bag
- 1536-1582 /api/profile
- 1537-1582 /api/identity/me
- 1538-1583 /api/progression/state
- 1540-1540 /api/weather
- 1541-1631 /api/homes
- 1542-1632 /api/economy/inventory
- 1547-1632 /api/combat/progression
- 1548-1633 /api/collections
- 1571-1635 /api/weather
- 1603-1603 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1604-1604 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1604-1604 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2665-2665 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2714-2714 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2752-2752 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3950-3999 /api/crafting/recipes
- 3953-3999 /api/traditions/treat
- 5168-5169 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5194-5194 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5219-5219 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

console (errors and warm-up lines, 41):
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
