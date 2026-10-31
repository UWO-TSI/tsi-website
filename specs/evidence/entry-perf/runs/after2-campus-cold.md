## after2-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 256, first contentful paint 256, interactive (title ready) 4164, DOMContentLoaded 215
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4164 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 182 / 7.69 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.84 |
| Play (7164 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 182 / 7.69 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.84 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (591 ms); worst: 168 [] | 105 [104 http://localhost:3322/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 104 [98 FrameRequestCallback b29ba28996376b6a.js] | 82 [81 Worker.onmessage 6a764e44c60fc2d8.js] | 70 [69 MessagePort.onmessage b29ba28996376b6a.js]

### Play to walking (ms from Play)
loading screen 142 | canvas 2133 | stage: files 2697 | stage: warm-up 2133 | first island frame 8888 | can move 9035
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (142 ms) | 1 / 0.01 | 15 / 0.02 | 7 / 0.02 |  |  |  |  |  |  | 5 / 0.00 |  |  |  | 28 / 0.04 |
| canvas (2133 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 116 / 0.08 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 251 / 1.37 |
| stage: files (2697 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 135 / 1.19 |  | 5 / 0.44 | 13 / 1.39 |  |  | 6 / 0.00 | 15 / 0.01 | 3 / 0.00 | 2 / 0.01 | 298 / 4.29 |
| stage: warm-up (2133 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 116 / 0.08 |  | 2 / 0.00 | 3 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 251 / 1.37 |
| first island frame (8888 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 450 / 7.78 |  | 25 / 7.04 | 20 / 1.40 |  |  | 6 / 0.00 | 17 / 0.01 | 9 / 0.00 | 3 / 0.01 | 649 / 17.48 |
| can move (9035 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 450 / 7.78 |  | 25 / 7.04 | 20 / 1.40 |  | 2 / 0.00 | 6 / 0.00 | 17 / 0.01 | 9 / 0.00 | 3 / 0.01 | 651 / 17.48 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 15 (2706 ms); worst: 7769+618 [615 FrameRequestCallback b29ba28996376b6a.js] | 2390+294 [291 MessagePort.onmessage b29ba28996376b6a.js] | 8412+292 [286 FrameRequestCallback b29ba28996376b6a.js] | 775+248 [247 http://localhost:3322/_next/static/chunks/c3805d6ee339bbc4.js c3805d6ee339bbc4.js] | 2145+182 [172 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 196 programs linked; compile 0 ms, link and its waits 20 ms (main thread)
memory once in: JS heap 413 MB; GPU uploads ~324.19 MB textures + 46.26 MB buffers; three: [{"geometries":414,"textures":248,"programs":184}]
API and Supabase requests (29):
- 193-242 /api/admin/me
- 194-293 /api/admin/me
- 195-243 /api/profile
- 2147-2197 /api/economy/wallet
- 2148-2198 /api/collections
- 2150-2199 /api/collections/bag
- 2151-2199 /api/profile
- 2152-2200 /api/identity/me
- 2153-2200 /api/progression/state
- 2154-2155 /api/weather
- 2156-2246 /api/homes
- 2157-2247 /api/economy/inventory
- 2313-2355 /api/combat/progression
- 2314-2355 /api/collections
- 2354-2403 /api/weather
- 2376-2376 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2376-2377 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2376-2377 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3525-3525 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3568-3568 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3754-3754 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5836-5879 /api/crafting/recipes
- 5839-5880 /api/traditions/treat
- 5933-5934 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5969-5969 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5991-5992 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9989-9989 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10014-10014 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10088-10088 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.66 MB /assets/branding/shop-sign-v1.png (5867-7743)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png (5867-7692)
- 0.97 MB /assets/acnh/buildings/shop-market.glb (2778-5059)
- 0.93 MB /assets/fx/move-pack.webp (2681-5734)
- 0.83 MB /assets/acnh/buildings/hq-office.glb (2680-4757)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png (5867-7081)
- 0.60 MB /assets/acnh/buildings/oracle-museum.glb (2779-4333)
- 0.55 MB /assets/game/interiors/hq/ground.glb (8842-10485)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (8848-11108)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb (2784-4114)
- 0.44 MB /assets/game/interiors/hq/upper.glb (8842-10230)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png (8848-11066)
console (errors and warm-up lines, 25):
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
