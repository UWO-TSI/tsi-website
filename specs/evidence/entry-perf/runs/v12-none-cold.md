## v12-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2193, DOMContentLoaded 62
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2193 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 198 / 9.27 |  | 11 / 5.31 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 275 / 19.08 |
| Play (5193 ms) | 2 / 0.02 | 105 / 2.23 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 12 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 398 / 25.86 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (599 ms); worst: 359 [353 FrameRequestCallback 63397793691123ee.js] | 120 [94 FrameRequestCallback 63397793691123ee.js] | 68 [61 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 52 [50 Worker.onmessage b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 47 | canvas 1195 | stage: files 1615 | stage: warm-up 1195 | first island frame 3688 | can move 3866
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (47 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 81 / 0.03 |
| canvas (1195 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.30 |
| stage: files (1615 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 146 / 0.05 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 325 / 0.34 |
| stage: warm-up (1195 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.30 |
| first island frame (3688 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 514 / 2.66 |  | 42 / 2.13 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 749 / 5.09 |
| can move (3866 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 514 / 2.66 |  | 42 / 2.13 | 28 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 5 / 0.02 | 751 / 7.32 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 8 (1362 ms); worst: 3242+349 [274 FrameRequestCallback 63397793691123ee.js] | 2745+331 [326 FrameRequestCallback 63397793691123ee.js] | 1430+174 [172 MessagePort.onmessage 63397793691123ee.js] | 1201+167 [161 MessagePort.onmessage 4fa395d360c87cc3.js] | 88+130 [125 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 7 ms (main thread)
memory once in: JS heap 409 MB; GPU uploads ~329.79 MB textures + 45.72 MB buffers; three: [{"geometries":412,"textures":249,"programs":198}]
API and Supabase requests (32):
- 40-49 /api/admin/me
- 40-55 /api/admin/me
- 40-53 /api/profile
- 1203-1209 /api/economy/wallet
- 1203-1213 /api/collections
- 1204-1215 /api/progression/state
- 1205-1217 /api/collections/bag
- 1205-1221 /api/economy/wallet
- 1206-1227 /api/economy/wallet
- 1206-1228 /api/economy/wallet
- 1207-1218 /api/economy/tackle
- 1207-1219 /api/profile
- 1208-1227 /api/identity/me
- 1208-1209 /api/weather
- 1209-1222 /api/homes
- 1210-1224 /api/npc/friendship
- 1210-1225 /api/economy/inventory
- 1359-1364 /api/world/onboarding
- 1360-1367 /api/combat/progression
- 1360-1369 /api/collections
- 1382-1386 /api/weather
- 1419-1420 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1429-1429 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1626-1626 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2521-2521 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2641-2644 /api/crafting/recipes
- 2643-2647 /api/traditions/treat
- 2733-2733 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2741-2742 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4531-4532 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4747-4748 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4747-4748 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg (3782-3792)
- 0.55 MB /assets/game/interiors/hq/ground.glb (3666-3742)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (3670-3722)
- 0.44 MB /assets/game/interiors/hq/upper.glb (3666-3736)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png (3670-3723)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png (3670-3719)
- 0.38 MB /assets/acnh/interior/floor-simple00.png (3670-3730)
- 0.21 MB /assets/game/interiors/hq/tank.glb (3666-3729)
console (errors and warm-up lines, 27):
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
