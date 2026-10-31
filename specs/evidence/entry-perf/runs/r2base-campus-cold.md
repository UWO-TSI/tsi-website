## r2base-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 248, first contentful paint 248, interactive (title ready) 4121, DOMContentLoaded 207
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4121 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
| Play (7121 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (579 ms); worst: 158 [] | 108 [107 http://localhost:3322/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 98 [92 FrameRequestCallback 63397793691123ee.js] | 93 [88 Worker.onmessage b299fae64d43fd32.js] | 64 [63 MessagePort.onmessage 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 228 | canvas 2195 | stage: files 2760 | stage: warm-up 2195 | first island frame 9744 | can move 9881
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (228 ms) | 1 / 0.01 | 15 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 29 / 0.03 |
| canvas (2195 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 118 / 0.09 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 260 / 1.52 |
| stage: files (2760 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 134 / 1.13 |  | 5 / 0.44 | 13 / 1.37 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 310 / 4.35 |
| stage: warm-up (2195 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 118 / 0.09 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 260 / 1.52 |
| first island frame (9744 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 452 / 7.67 |  | 28 / 8.89 | 20 / 1.38 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 667 / 19.35 |
| can move (9881 ms) | 39 / 0.04 | 79 / 1.33 | 8 / 0.02 | 452 / 7.67 |  | 28 / 8.89 | 20 / 1.38 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 668 / 19.35 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (2714 ms); worst: 8615+613 [608 FrameRequestCallback 63397793691123ee.js] | 9228+348 [340 FrameRequestCallback 63397793691123ee.js] | 2442+305 [302 MessagePort.onmessage 63397793691123ee.js] | 835+247 [247 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2195+173 [162 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 210 programs linked; compile 0 ms, link and its waits 32 ms (main thread)
memory once in: JS heap 415 MB; GPU uploads ~335.88 MB textures + 45.72 MB buffers; three: [{"geometries":414,"textures":247,"programs":198}]
API and Supabase requests (35):
- 249-299 /api/admin/me
- 250-340 /api/admin/me
- 251-299 /api/profile
- 2198-2244 /api/economy/wallet
- 2199-2245 /api/collections
- 2200-2245 /api/progression/state
- 2202-2246 /api/collections/bag
- 2203-2295 /api/economy/wallet
- 2203-2341 /api/economy/wallet
- 2204-2383 /api/economy/wallet
- 2205-2246 /api/economy/tackle
- 2205-2247 /api/profile
- 2206-2292 /api/identity/me
- 2208-2208 /api/weather
- 2209-2293 /api/homes
- 2210-2294 /api/npc/friendship
- 2211-2294 /api/economy/inventory
- 2351-2393 /api/world/onboarding
- 2353-2394 /api/combat/progression
- 2353-2395 /api/collections
- 2396-2447 /api/weather
- 2421-2422 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2421-2422 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2422-2422 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3600-3600 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3636-3636 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3808-3808 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5895-5938 /api/crafting/recipes
- 5898-5939 /api/traditions/treat
- 6008-6008 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6043-6044 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 6064-6065 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10079-10079 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10109-10109 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10189-10190 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.86 MB /assets/characters/v6/colour_atlas.png (5937-8592)
- 1.66 MB /assets/branding/shop-sign-v1.png (5937-8508)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png (5937-8406)
- 0.97 MB /assets/acnh/buildings/shop-market.glb (2853-5062)
- 0.93 MB /assets/fx/move-pack.webp (2744-5716)
- 0.83 MB /assets/acnh/buildings/hq-office.glb (2742-4726)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png (5938-7487)
- 0.60 MB /assets/acnh/buildings/oracle-museum.glb (2854-4387)
- 0.55 MB /assets/game/interiors/hq/ground.glb (9704-11344)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (9710-11851)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb (2856-4172)
- 0.44 MB /assets/game/interiors/hq/upper.glb (9704-11088)
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
