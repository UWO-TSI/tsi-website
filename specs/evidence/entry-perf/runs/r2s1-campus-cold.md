## r2s1-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 256, first contentful paint 256, interactive (title ready) 4220, DOMContentLoaded 215
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4220 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
| Play (7220 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (497 ms); worst: 167 [] | 107 [106 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 91 [90 Worker.onmessage ad8649c185500d2f.js] | 71 [69 MessagePort.onmessage 63397793691123ee.js] | 61 [57 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 381 | canvas 2358 | stage: files 2925 | stage: warm-up 2358 | first island frame 9705 | can move 9863
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (381 ms) | 1 / 0.01 | 16 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.03 |
| canvas (2358 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| stage: files (2925 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 82 / 1.18 |  | 5 / 0.12 | 10 / 1.31 |  |  | 6 / 0.00 | 21 / 0.01 |  | 2 / 0.01 | 253 / 4.01 |
| stage: warm-up (2358 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| first island frame (9705 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 268 / 7.11 |  | 22 / 8.57 | 11 / 1.32 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 469 / 18.42 |
| can move (9863 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 268 / 7.11 |  | 22 / 8.57 | 11 / 1.32 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 470 / 18.42 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (2550 ms); worst: 8578+628 [623 FrameRequestCallback 63397793691123ee.js] | 9229+331 [325 FrameRequestCallback 63397793691123ee.js] | 2601+308 [304 MessagePort.onmessage 63397793691123ee.js] | 973+249 [249 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2358+176 [161 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 28 ms (main thread)
memory once in: JS heap 419 MB; GPU uploads ~336.29 MB textures + 45.77 MB buffers; three: [{"geometries":412,"textures":249,"programs":194}]
API and Supabase requests (35):
- 401-449 /api/admin/me
- 402-492 /api/admin/me
- 403-449 /api/profile
- 2361-2408 /api/economy/wallet
- 2362-2408 /api/collections
- 2364-2409 /api/progression/state
- 2365-2409 /api/collections/bag
- 2365-2459 /api/economy/wallet
- 2366-2505 /api/economy/wallet
- 2367-2551 /api/economy/wallet
- 2367-2410 /api/economy/tackle
- 2368-2411 /api/profile
- 2369-2456 /api/identity/me
- 2371-2371 /api/weather
- 2372-2457 /api/homes
- 2373-2458 /api/npc/friendship
- 2373-2458 /api/economy/inventory
- 2514-2557 /api/world/onboarding
- 2516-2558 /api/combat/progression
- 2516-2558 /api/collections
- 2568-2616 /api/weather
- 2942-2943 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2978-2979 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3010-3012 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4006-4006 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4009-4009 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4099-4099 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5866-5908 /api/crafting/recipes
- 5869-5909 /api/traditions/treat
- 6034-6034 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6047-6048 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 6155-6155 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10091-10091 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10121-10121 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10216-10216 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.86 MB /assets/characters/v6/colour_atlas.png?v=sqCcOC4s (5900-8555)
- 1.66 MB /assets/branding/shop-sign-v1.png?v=5NaqjA_L (5900-8470)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png?v=Cz2YA7JD (5900-8370)
- 0.97 MB /assets/acnh/buildings/shop-market.glb?v=qfV6MG-Z (3008-5103)
- 0.93 MB /assets/fx/move-pack.webp?v=mdygWYNj (2905-5356)
- 0.83 MB /assets/acnh/buildings/hq-office.glb?v=E9g1_hMU (2904-4816)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png?v=1QJqrclo (5900-7450)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (9687-11332)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (9692-11844)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb?v=j5oUGxt7 (3014-4318)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (9687-11076)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (9692-11817)
game files without a version: 0
console (errors and warm-up lines, 30):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.png?v=5NaqjA_L
- 512x512 
- 512x512 http://localhost:3322/assets/game/water/seabed-sand.webp?v=uTWPDano
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
