## rc0-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 244, first contentful paint 244, interactive (title ready) 4842, DOMContentLoaded 207
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4842 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
| Play (7842 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 182 / 7.37 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 247 / 10.55 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 7 (595 ms); worst: 159 [] | 110 [109 http://localhost:3322/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 91 [89 Worker.onmessage 862dff5829ce9945.js] | 65 [64 MessagePort.onmessage 63397793691123ee.js] | 61 [21 http://localhost:3322/_next/static/chunks/eb7961ed4145c398.js eb7961ed4145c398.js]

### Play to walking (ms from Play)
loading screen 146 | canvas 2836 | stage: files 2836 | stage: warm-up 7981 | first island frame 12962 | can move 13101
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (146 ms) | 1 / 0.01 | 15 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 29 / 0.03 |
| canvas (2836 ms) | 12 / 0.02 | 57 / 1.11 | 8 / 0.02 | 80 / 2.66 |  | 10 / 2.13 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 178 / 5.96 |
| stage: files (2836 ms) | 12 / 0.02 | 57 / 1.11 | 8 / 0.02 | 80 / 2.66 |  | 10 / 2.13 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 178 / 5.96 |
| stage: warm-up (7981 ms) | 39 / 0.04 | 80 / 1.34 | 8 / 0.02 | 246 / 7.70 |  | 16 / 2.66 | 11 / 1.44 |  |  | 6 / 0.00 | 21 / 0.01 | 9 / 0.00 | 2 / 0.01 | 438 / 13.22 |
| first island frame (12962 ms) | 39 / 0.04 | 80 / 1.34 | 8 / 0.02 | 266 / 8.03 |  | 23 / 8.94 | 11 / 1.44 |  |  | 6 / 0.00 | 23 / 0.01 | 12 / 0.00 | 3 / 0.01 | 471 / 19.84 |
| can move (13101 ms) | 39 / 0.04 | 80 / 1.34 | 8 / 0.02 | 266 / 8.03 |  | 23 / 8.94 | 11 / 1.44 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 12 / 0.00 | 3 / 0.01 | 472 / 19.84 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 24 (4026 ms); worst: 3105+398 [392 MessagePort.onmessage 63397793691123ee.js] | 4233+308 [294 MessagePort.onmessage 63397793691123ee.js] | 4691+294 [289 MessagePort.onmessage 63397793691123ee.js] | 6205+294 [291 MessagePort.onmessage 63397793691123ee.js] | 12532+292 [291 FrameRequestCallback 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 263 programs linked; compile 1 ms, link and its waits 49 ms (main thread)
memory once in: JS heap 446 MB; GPU uploads ~339.51 MB textures + 56.27 MB buffers; three: [{"geometries":491,"textures":257,"programs":253}]
API and Supabase requests (35):
- 167-215 /api/admin/me
- 167-257 /api/admin/me
- 168-216 /api/profile
- 2846-2898 /api/economy/wallet
- 2847-2941 /api/collections
- 2848-2961 /api/progression/state
- 2849-2984 /api/collections/bag
- 2850-3132 /api/economy/wallet
- 2851-3217 /api/economy/wallet
- 2851-3274 /api/economy/wallet
- 2852-3003 /api/economy/tackle
- 2853-3028 /api/profile
- 2854-3046 /api/identity/me
- 2855-2855 /api/weather
- 2856-3071 /api/homes
- 2857-3089 /api/npc/friendship
- 2858-3114 /api/economy/inventory
- 2999-3156 /api/world/onboarding
- 3000-3175 /api/combat/progression
- 3000-3198 /api/collections
- 3069-3327 /api/weather
- 4075-4076 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4129-4129 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4191-4191 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5144-5144 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5384-5385 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5454-5454 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 7360-7360 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 7463-7463 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 7565-7565 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9759-9801 /api/crafting/recipes
- 9762-9802 /api/traditions/treat
- 11418-11419 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 11508-11508 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 11616-11617 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.86 MB /assets/characters/v6/colour_atlas.png (9788-12441)
- 1.66 MB /assets/branding/shop-sign-v1.png (9788-12356)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png (9788-12255)
- 0.97 MB /assets/acnh/buildings/shop-market.glb (5019-6687)
- 0.93 MB /assets/fx/move-pack.webp (3498-4909)
- 0.83 MB /assets/acnh/buildings/hq-office.glb (3497-4789)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png (9788-11341)
- 0.60 MB /assets/acnh/buildings/oracle-museum.glb (5019-6466)
- 0.55 MB /assets/game/interiors/hq/ground.glb (958-2917)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (998-3320)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb (5023-6333)
- 0.45 MB /assets/sky/layers/luxuryVariation.webp (3498-4615)
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
