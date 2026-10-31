## r2base-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 108, first contentful paint 108, interactive (title ready) 2480, DOMContentLoaded 70
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2480 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 202 / 10.60 |  | 12 / 6.97 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 281 / 22.06 |
| Play (5480 ms) | 2 / 0.02 | 105 / 2.23 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 12 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 398 / 25.86 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (117 ms); worst: 65 [62 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 52 []

### Play to walking (ms from Play)
loading screen 54 | canvas 1171 | stage: files 1599 | stage: warm-up 1171 | first island frame 3638 | can move 3820
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (54 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.02 |  |  |  | 2 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1171 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.30 |
| stage: files (1599 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 146 / 0.06 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 326 / 0.35 |
| stage: warm-up (1171 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 130 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 276 / 0.30 |
| first island frame (3638 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 513 / 2.67 |  | 44 / 2.13 | 28 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 750 / 5.10 |
| can move (3820 ms) | 39 / 0.03 | 79 / 0.22 | 8 / 0.02 | 513 / 2.67 |  | 44 / 2.13 | 28 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 5 / 0.02 | 752 / 7.33 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 9 (1364 ms); worst: 2713+326 [321 FrameRequestCallback 63397793691123ee.js] | 3277+259 [257 FrameRequestCallback 63397793691123ee.js] | 1176+178 [172 MessagePort.onmessage 4fa395d360c87cc3.js] | 1414+175 [173 MessagePort.onmessage 63397793691123ee.js] | 85+132 [124 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 407 MB; GPU uploads ~329.75 MB textures + 45.73 MB buffers; three: [{"geometries":414,"textures":248,"programs":194}]
API and Supabase requests (32):
- 41-49 /api/admin/me
- 41-57 /api/admin/me
- 42-54 /api/profile
- 1178-1182 /api/economy/wallet
- 1178-1185 /api/collections
- 1179-1187 /api/progression/state
- 1180-1189 /api/collections/bag
- 1180-1199 /api/economy/wallet
- 1180-1199 /api/economy/wallet
- 1181-1200 /api/economy/wallet
- 1181-1191 /api/economy/tackle
- 1182-1192 /api/profile
- 1182-1193 /api/identity/me
- 1183-1183 /api/weather
- 1183-1195 /api/homes
- 1184-1196 /api/npc/friendship
- 1184-1198 /api/economy/inventory
- 1346-1349 /api/world/onboarding
- 1346-1351 /api/combat/progression
- 1347-1352 /api/collections
- 1367-1370 /api/weather
- 1401-1401 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1401-1401 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1401-1401 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2498-2498 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2514-2514 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2618-2622 /api/crafting/recipes
- 2620-2623 /api/traditions/treat
- 2702-2702 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4507-4507 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4652-4652 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4708-4708 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg (3733-3749)
- 0.55 MB /assets/game/interiors/hq/ground.glb (3605-3683)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (3609-3661)
- 0.44 MB /assets/game/interiors/hq/upper.glb (3605-3675)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png (3609-3661)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png (3609-3658)
- 0.38 MB /assets/acnh/interior/floor-simple00.png (3609-3662)
- 0.21 MB /assets/game/interiors/hq/tank.glb (3605-3667)
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
