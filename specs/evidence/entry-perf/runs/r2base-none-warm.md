## r2base-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 64, first contentful paint 64, interactive (title ready) 2354, DOMContentLoaded 36
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2354 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 389 / 0.05 |  | 17 / 0.00 | 18 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 483 / 0.07 |
| Play (5354 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 483 / 0.07 |  | 24 / 0.00 | 24 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 3 / 0.01 | 657 / 0.09 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (127 ms); worst: 67 [32 LINK.onload turbopack-4da6ec9caf62642a.js] | 60 [56 Worker.onmessage b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 47 | canvas 1152 | stage: files 1427 | stage: warm-up 1152 | first island frame 3612 | can move 3792
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (47 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 81 / 0.00 |
| canvas (1152 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.06 |
| stage: files (1427 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 145 / 0.02 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 325 / 0.07 |
| stage: warm-up (1152 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.06 |
| first island frame (3612 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 513 / 0.07 |  | 44 / 0.00 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 750 / 0.13 |
| can move (3792 ms) | 39 / 0.03 | 79 / 0.00 | 8 / 0.00 | 523 / 0.07 |  | 52 / 0.01 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 5 / 0.01 | 769 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (1513 ms); worst: 2763+548 [544 FrameRequestCallback 63397793691123ee.js] | 3310+209 [205 FrameRequestCallback 63397793691123ee.js] | 1240+175 [173 MessagePort.onmessage 63397793691123ee.js] | 79+132 [124 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2010+75 [74 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 228 ms (main thread)
memory once in: JS heap 432 MB; GPU uploads ~329.67 MB textures + 45.68 MB buffers; three: [{"geometries":409,"textures":247,"programs":194}]
API and Supabase requests (32):
- 37-40 /api/admin/me
- 37-45 /api/admin/me
- 37-43 /api/profile
- 1159-1161 /api/economy/wallet
- 1159-1162 /api/collections
- 1160-1162 /api/progression/state
- 1161-1163 /api/collections/bag
- 1161-1164 /api/economy/wallet
- 1162-1169 /api/economy/wallet
- 1162-1173 /api/economy/wallet
- 1162-1165 /api/economy/tackle
- 1163-1166 /api/profile
- 1163-1165 /api/identity/me
- 1164-1164 /api/weather
- 1165-1167 /api/homes
- 1165-1170 /api/npc/friendship
- 1165-1168 /api/economy/inventory
- 1169-1174 /api/world/onboarding
- 1170-1172 /api/combat/progression
- 1170-1174 /api/collections
- 1194-1195 /api/weather
- 1222-1223 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1223-1223 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1223-1223 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2266-2267 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2292-2293 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2312-2313 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2684-2685 /api/crafting/recipes
- 2685-2686 /api/traditions/treat
- 4291-4292 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4299-4299 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4388-4388 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
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
