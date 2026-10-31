## v12-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 252, first contentful paint 252, interactive (title ready) 4176, DOMContentLoaded 210
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4176 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
| Play (7176 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (490 ms); worst: 163 [] | 112 [112 http://localhost:3322/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 87 [86 Worker.onmessage b299fae64d43fd32.js] | 70 [69 MessagePort.onmessage 63397793691123ee.js] | 58 [56 Response.arrayBuffer.then b299fae64d43fd32.js]

### Play to walking (ms from Play)
loading screen 200 | canvas 2195 | stage: files 2760 | stage: warm-up 2195 | first island frame 9525 | can move 9714
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (200 ms) | 1 / 0.01 | 15 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 29 / 0.03 |
| canvas (2195 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 118 / 0.09 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 260 / 1.52 |
| stage: files (2760 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 133 / 1.14 |  | 5 / 0.45 | 13 / 1.38 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 308 / 4.38 |
| stage: warm-up (2195 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 118 / 0.09 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 260 / 1.52 |
| first island frame (9525 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 451 / 7.68 |  | 24 / 8.90 | 20 / 1.39 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 662 / 19.39 |
| can move (9714 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 451 / 7.68 |  | 24 / 8.90 | 20 / 1.39 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 663 / 19.39 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (2554 ms); worst: 8383+627 [622 FrameRequestCallback 63397793691123ee.js] | 9048+327 [321 FrameRequestCallback 63397793691123ee.js] | 2439+306 [303 MessagePort.onmessage 63397793691123ee.js] | 801+254 [253 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2195+177 [165 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 210 programs linked; compile 0 ms, link and its waits 17 ms (main thread)
memory once in: JS heap 425 MB; GPU uploads ~336.71 MB textures + 45.75 MB buffers; three: [{"geometries":412,"textures":250,"programs":198}]
API and Supabase requests (35):
- 221-266 /api/admin/me
- 221-307 /api/admin/me
- 222-266 /api/profile
- 2197-2245 /api/economy/wallet
- 2198-2246 /api/collections
- 2200-2246 /api/progression/state
- 2201-2247 /api/collections/bag
- 2202-2298 /api/economy/wallet
- 2203-2347 /api/economy/wallet
- 2203-2392 /api/economy/wallet
- 2204-2247 /api/economy/tackle
- 2205-2248 /api/profile
- 2206-2296 /api/identity/me
- 2208-2208 /api/weather
- 2209-2296 /api/homes
- 2210-2297 /api/npc/friendship
- 2210-2297 /api/economy/inventory
- 2355-2398 /api/world/onboarding
- 2356-2398 /api/combat/progression
- 2357-2399 /api/collections
- 2401-2451 /api/weather
- 2438-2438 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2746-2746 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2815-2815 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3831-3831 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3843-3844 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3885-3886 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5655-5699 /api/crafting/recipes
- 5658-5705 /api/traditions/treat
- 5859-5860 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5871-5871 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5926-5926 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9913-9914 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 9936-9936 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10026-10026 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.86 MB /assets/characters/v6/colour_atlas.png (5686-8362)
- 1.66 MB /assets/branding/shop-sign-v1.png (5685-8262)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png (5686-8174)
- 0.97 MB /assets/acnh/buildings/shop-market.glb (2845-5064)
- 0.93 MB /assets/fx/move-pack.webp (2742-5738)
- 0.83 MB /assets/acnh/buildings/hq-office.glb (2741-4762)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png (5686-7287)
- 0.60 MB /assets/acnh/buildings/oracle-museum.glb (2846-4346)
- 0.55 MB /assets/game/interiors/hq/ground.glb (9502-11147)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (9509-11652)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb (2850-4163)
- 0.44 MB /assets/game/interiors/hq/upper.glb (9503-10887)
console (errors and warm-up lines, 30):
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
