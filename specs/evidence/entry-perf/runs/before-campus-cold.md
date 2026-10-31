## before-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 260, first contentful paint 260, interactive (title ready) 5032, DOMContentLoaded 218
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (5032 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 183 / 7.97 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 248 / 11.12 |
| Play (8032 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 183 / 7.97 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 248 / 11.12 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (560 ms); worst: 173 [] | 110 [109 http://localhost:3322/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 86 [84 Worker.onmessage a8ae19fb608b2598.js] | 67 [66 MessagePort.onmessage b29ba28996376b6a.js] | 63 [53 FrameRequestCallback b29ba28996376b6a.js]

### Play to walking (ms from Play)
loading screen 172 | canvas 2870 | stage: files - | stage: warm-up - | first island frame 11913 | can move 12046
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (172 ms) | 1 / 0.01 | 15 / 0.02 | 7 / 0.02 |  |  |  |  |  |  | 5 / 0.00 |  |  |  | 28 / 0.04 |
| canvas (2870 ms) | 20 / 0.02 | 55 / 1.05 | 9 / 0.02 | 78 / 2.65 |  | 10 / 2.13 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 183 / 5.90 |
| stage: files | not reached |
| stage: warm-up | not reached |
| first island frame (11913 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 266 / 7.20 |  | 21 / 6.92 | 11 / 1.34 |  |  | 6 / 0.00 | 16 / 0.01 | 12 / 0.00 | 3 / 0.01 | 454 / 16.74 |
| can move (12046 ms) | 39 / 0.04 | 71 / 1.19 | 9 / 0.02 | 266 / 7.20 |  | 21 / 6.92 | 11 / 1.34 |  | 2 / 0.00 | 6 / 0.00 | 16 / 0.01 | 12 / 0.00 | 3 / 0.01 | 456 / 16.74 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 19 (3534 ms); worst: 3170+392 [386 MessagePort.onmessage b29ba28996376b6a.js] | 4347+298 [295 MessagePort.onmessage b29ba28996376b6a.js] | 7088+297 [295 MessagePort.onmessage b29ba28996376b6a.js] | 4903+294 [292 MessagePort.onmessage b29ba28996376b6a.js] | 10731+292 [291 FrameRequestCallback b29ba28996376b6a.js]
long frames in the 3 s after: 0
WebGL: 254 programs linked; compile 0 ms, link and its waits 29 ms (main thread)
memory once in: JS heap 457 MB; GPU uploads ~332.77 MB textures + 57.06 MB buffers; three: [{"geometries":485,"textures":253,"programs":242}]
API and Supabase requests (28):
- 220-270 /api/admin/me
- 221-318 /api/admin/me
- 222-270 /api/profile
- 2891-2962 /api/economy/wallet
- 2892-2968 /api/collections
- 2894-3005 /api/collections/bag
- 2895-3011 /api/profile
- 2896-3049 /api/identity/me
- 2897-3054 /api/progression/state
- 2898-2898 /api/weather
- 2899-3092 /api/homes
- 2900-3097 /api/economy/inventory
- 3062-3135 /api/combat/progression
- 3062-3140 /api/collections
- 3148-3308 /api/weather
- 3862-3863 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3886-3886 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3923-3923 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5247-5247 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5282-5282 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5329-5329 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 7408-7408 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 7444-7444 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 7619-7619 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8718-8758 /api/crafting/recipes
- 11471-11472 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 11497-11497 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 11666-11666 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.66 MB /assets/branding/shop-sign-v1.png (8757-10632)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png (8757-10582)
- 0.97 MB /assets/acnh/buildings/shop-market.glb (4681-6102)
- 0.93 MB /assets/fx/move-pack.webp (3558-5118)
- 0.83 MB /assets/acnh/buildings/hq-office.glb (3557-4695)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png (8758-9969)
- 0.55 MB /assets/game/interiors/hq/ground.glb (1005-2925)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (1046-3366)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb (4685-5870)
- 0.44 MB /assets/game/interiors/hq/upper.glb (1005-2711)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png (1046-3319)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png (1046-3208)
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
