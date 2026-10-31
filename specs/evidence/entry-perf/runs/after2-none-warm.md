## after2-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 52, first contentful paint 52, interactive (title ready) 2378, DOMContentLoaded 45
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2378 ms) | 1 / 0.01 | 41 / 0.00 | 7 / 0.00 | 385 / 0.05 |  | 20 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 483 / 0.08 |
| Play (5378 ms) | 2 / 0.01 | 103 / 0.00 | 7 / 0.00 | 475 / 0.07 |  | 22 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 644 / 0.09 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (124 ms); worst: 69 [34 http://localhost:3322/_next/static/chunks/ee66cc183b861f44.js ee66cc183b861f44.js] | 55 [54 Worker.onmessage 6a764e44c60fc2d8.js]

### Play to walking (ms from Play)
loading screen 49 | canvas 1171 | stage: files 1443 | stage: warm-up 1171 | first island frame 3390 | can move 3561
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (49 ms) | 5 / 0.00 | 54 / 0.00 | 9 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 79 / 0.00 |
| canvas (1171 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 126 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 265 / 0.06 |
| stage: files (1443 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 143 / 0.02 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 15 / 0.01 | 1 / 0.00 | 2 / 0.01 | 308 / 0.06 |
| stage: warm-up (1171 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 126 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 265 / 0.06 |
| first island frame (3390 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 509 / 0.07 |  | 42 / 0.00 | 28 / 0.00 |  |  | 6 / 0.00 | 17 / 0.01 | 6 / 0.00 | 4 / 0.01 | 731 / 0.12 |
| can move (3561 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 524 / 0.07 |  | 50 / 0.01 | 28 / 0.00 |  |  | 6 / 0.00 | 17 / 0.01 | 6 / 0.00 | 5 / 0.01 | 755 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 9 (1370 ms); worst: 2546+549 [544 FrameRequestCallback b29ba28996376b6a.js] | 3095+193 [189 FrameRequestCallback b29ba28996376b6a.js] | 1259+172 [171 MessagePort.onmessage b29ba28996376b6a.js] | 85+117 [113 http://localhost:3322/_next/static/chunks/c3805d6ee339bbc4.js c3805d6ee339bbc4.js] | 2089+85 [84 MessagePort.onmessage b29ba28996376b6a.js]
long frames in the 3 s after: 0
WebGL: 192 programs linked; compile 0 ms, link and its waits 207 ms (main thread)
memory once in: JS heap 685 MB; GPU uploads ~317.82 MB textures + 46.64 MB buffers; three: [{"geometries":404,"textures":248,"programs":184}]
API and Supabase requests (26):
- 37-42 /api/admin/me
- 38-46 /api/admin/me
- 38-44 /api/profile
- 1178-1180 /api/economy/wallet
- 1179-1181 /api/collections
- 1180-1183 /api/collections/bag
- 1180-1185 /api/profile
- 1181-1186 /api/identity/me
- 1181-1184 /api/progression/state
- 1182-1182 /api/weather
- 1183-1187 /api/homes
- 1183-1190 /api/economy/inventory
- 1187-1192 /api/combat/progression
- 1188-1193 /api/collections
- 1208-1209 /api/weather
- 1258-1258 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1454-1456 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1481-1481 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2442-2448 /api/crafting/recipes
- 2444-2450 /api/traditions/treat
- 2538-2538 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2542-2542 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2542-2542 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4548-4548 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4548-4548 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4548-4548 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
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
