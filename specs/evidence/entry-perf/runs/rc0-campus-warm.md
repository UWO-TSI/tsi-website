## rc0-campus-warm: NET=campus CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 108, first contentful paint 108, interactive (title ready) 3262, DOMContentLoaded 118
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (3262 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 181 / 0.05 |  | 6 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 254 / 0.07 |
| Play (6262 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 376 / 0.11 |  | 24 / 0.01 | 20 / 0.01 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 545 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (625 ms); worst: 345 [342 FrameRequestCallback 63397793691123ee.js] | 97 [95 Worker.onmessage 862dff5829ce9945.js] | 68 [67 MessagePort.onmessage 63397793691123ee.js] | 62 [59 Response.arrayBuffer.then 862dff5829ce9945.js] | 53 [50 FrameRequestCallback 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 108 | canvas 2293 | stage: files 2814 | stage: warm-up 2293 | first island frame 9741 | can move 9881
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (108 ms) | 1 / 0.00 | 15 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 29 / 0.00 |
| canvas (2293 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 80 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.06 |
| stage: files (2814 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 96 / 0.03 |  | 13 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 278 / 0.08 |
| stage: warm-up (2293 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 80 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.06 |
| first island frame (9741 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.08 |  | 22 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 11 / 0.00 | 3 / 0.01 | 468 / 0.14 |
| can move (9881 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.08 |  | 22 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 11 / 0.00 | 4 / 0.01 | 469 / 0.15 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 25 (4070 ms); worst: 2411+402 [399 MessagePort.onmessage 63397793691123ee.js] | 9178+336 [335 FrameRequestCallback 63397793691123ee.js] | 3970+295 [289 MessagePort.onmessage 63397793691123ee.js] | 3562+292 [290 MessagePort.onmessage 63397793691123ee.js] | 2826+281 [271 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 256 programs linked; compile 1 ms, link and its waits 97 ms (main thread)
memory once in: JS heap 699 MB; GPU uploads ~336.58 MB textures + 55.67 MB buffers; three: [{"geometries":485,"textures":257,"programs":246}]
API and Supabase requests (35):
- 111-158 /api/admin/me
- 111-208 /api/admin/me
- 112-158 /api/profile
- 2295-2338 /api/economy/wallet
- 2296-2339 /api/collections
- 2298-2340 /api/progression/state
- 2300-2341 /api/collections/bag
- 2301-2436 /api/economy/wallet
- 2302-2480 /api/economy/wallet
- 2302-2522 /api/economy/wallet
- 2303-2344 /api/economy/tackle
- 2304-2345 /api/profile
- 2305-2386 /api/identity/me
- 2307-2307 /api/weather
- 2308-2387 /api/homes
- 2309-2387 /api/npc/friendship
- 2310-2387 /api/economy/inventory
- 2314-2388 /api/world/onboarding
- 2316-2389 /api/combat/progression
- 2317-2437 /api/collections
- 2342-2438 /api/weather
- 2373-2374 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2374-2374 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2374-2374 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3447-3447 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3483-3484 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3855-3855 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5579-5580 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5602-5602 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5911-5912 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8283-8332 /api/crafting/recipes
- 8285-8333 /api/traditions/treat
- 9627-9628 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 9683-9683 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 9944-9944 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

console (errors and warm-up lines, 57):
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
