## v12-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 60, first contentful paint 60, interactive (title ready) 2378, DOMContentLoaded 37
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2378 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 389 / 0.05 |  | 17 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 483 / 0.07 |
| Play (5378 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 483 / 0.07 |  | 24 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 657 / 0.09 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (119 ms); worst: 67 [31 LINK.onload turbopack-4da6ec9caf62642a.js] | 52 [51 Worker.onmessage b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 56 | canvas 1180 | stage: files 1455 | stage: warm-up 1180 | first island frame 3471 | can move 3616
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (56 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 81 / 0.00 |
| canvas (1180 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.06 |
| stage: files (1455 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 147 / 0.02 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 327 / 0.07 |
| stage: warm-up (1180 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.06 |
| first island frame (3471 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 517 / 0.07 |  | 44 / 0.00 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 754 / 0.13 |
| can move (3616 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 532 / 0.08 |  | 52 / 0.01 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 5 / 0.01 | 778 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 8 (1362 ms); worst: 2564+583 [578 FrameRequestCallback 63397793691123ee.js] | 3147+216 [212 FrameRequestCallback 63397793691123ee.js] | 1271+173 [171 MessagePort.onmessage 63397793691123ee.js] | 96+132 [128 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2271+73 [72 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 234 ms (main thread)
memory once in: JS heap 405 MB; GPU uploads ~329.75 MB textures + 46.27 MB buffers; three: [{"geometries":416,"textures":248,"programs":194}]
API and Supabase requests (32):
- 44-47 /api/admin/me
- 45-52 /api/admin/me
- 45-50 /api/profile
- 1187-1189 /api/economy/wallet
- 1188-1190 /api/collections
- 1189-1191 /api/progression/state
- 1189-1193 /api/collections/bag
- 1190-1194 /api/economy/wallet
- 1190-1198 /api/economy/wallet
- 1191-1202 /api/economy/wallet
- 1191-1192 /api/economy/tackle
- 1191-1196 /api/profile
- 1192-1195 /api/identity/me
- 1193-1193 /api/weather
- 1193-1195 /api/homes
- 1194-1197 /api/npc/friendship
- 1194-1200 /api/economy/inventory
- 1198-1201 /api/world/onboarding
- 1199-1203 /api/combat/progression
- 1199-1204 /api/collections
- 1222-1224 /api/weather
- 1255-1255 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1255-1255 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1255-1255 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2344-2344 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2359-2360 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2469-2471 /api/crafting/recipes
- 2470-2473 /api/traditions/treat
- 2550-2550 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4351-4352 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4504-4505 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4559-4559 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
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
