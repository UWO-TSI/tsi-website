## before-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 100, first contentful paint 100, interactive (title ready) 3247, DOMContentLoaded 121
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (3247 ms) | 1 / 0.01 | 41 / 0.00 | 7 / 0.00 | 180 / 0.05 |  | 6 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 253 / 0.07 |
| Play (6247 ms) | 2 / 0.01 | 103 / 0.00 | 7 / 0.00 | 369 / 0.11 |  | 23 / 0.01 | 20 / 0.01 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 534 / 0.13 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (566 ms); worst: 353 [350 FrameRequestCallback b29ba28996376b6a.js] | 93 [91 Worker.onmessage a8ae19fb608b2598.js] | 62 [61 MessagePort.onmessage b29ba28996376b6a.js] | 58 [56 Response.arrayBuffer.then a8ae19fb608b2598.js]

### Play to walking (ms from Play)
loading screen 114 | canvas 2225 | stage: files - | stage: warm-up - | first island frame 10265 | can move 10481
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (114 ms) | 1 / 0.00 | 15 / 0.00 | 7 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 2 / 0.01 | 31 / 0.01 |
| canvas (2225 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 78 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 219 / 0.06 |
| stage: files | not reached |
| stage: warm-up | not reached |
| first island frame (10265 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 271 / 0.61 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 16 / 0.01 | 12 / 0.00 | 3 / 0.01 | 461 / 0.66 |
| can move (10481 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 271 / 0.61 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 16 / 0.01 | 12 / 0.00 | 4 / 0.01 | 462 / 0.67 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 19 (3431 ms); worst: 2336+387 [384 MessagePort.onmessage b29ba28996376b6a.js] | 8983+319 [318 FrameRequestCallback b29ba28996376b6a.js] | 4425+294 [290 MessagePort.onmessage b29ba28996376b6a.js] | 3975+293 [291 MessagePort.onmessage b29ba28996376b6a.js] | 2732+285 [276 MessagePort.onmessage b29ba28996376b6a.js]
long frames in the 3 s after: 0
WebGL: 257 programs linked; compile 0 ms, link and its waits 74 ms (main thread)
memory once in: JS heap 441 MB; GPU uploads ~332.81 MB textures + 57.03 MB buffers; three: [{"geometries":484,"textures":253,"programs":245}]
API and Supabase requests (28):
- 116-164 /api/admin/me
- 117-205 /api/admin/me
- 118-164 /api/profile
- 2237-2288 /api/economy/wallet
- 2238-2289 /api/collections
- 2240-2289 /api/collections/bag
- 2241-2290 /api/profile
- 2242-2290 /api/identity/me
- 2243-2291 /api/progression/state
- 2245-2245 /api/weather
- 2246-2337 /api/homes
- 2247-2338 /api/economy/inventory
- 2253-2338 /api/combat/progression
- 2253-2339 /api/collections
- 2277-2340 /api/weather
- 2314-2315 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2315-2315 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2315-2315 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3555-3556 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3592-3592 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3623-3623 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5869-5869 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5902-5903 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5938-5938 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8012-8053 /api/crafting/recipes
- 9938-9939 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 9988-9988 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10014-10014 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 0.41 MB /assets/game/buildings/sushi-bar.glb (5455-6445)
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
