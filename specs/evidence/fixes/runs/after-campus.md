## after-campus: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 296, first contentful paint 296, interactive (title ready) 4359, DOMContentLoaded 253
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4359 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 187 / 8.16 |  | 6 / 0.71 | 7 / 1.63 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 258 / 11.90 |
| Play (7359 ms) | 2 / 0.02 | 60 / 1.17 | 8 / 0.09 | 195 / 8.26 |  | 6 / 0.71 | 8 / 1.65 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 287 / 12.09 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (624 ms); worst: 193 [] | 124 [123 http://localhost:3333/_next/static/chunks/c55f74de4777a683.js c55f74de4777a683.js] | 96 [94 Worker.onmessage ad8649c185500d2f.js] | 78 [68 FrameRequestCallback 63397793691123ee.js] | 70 [68 MessagePort.onmessage 63397793691123ee.js]

### Play to walking (ms from Play)
loading screen 512 | canvas 2586 | stage: files 3193 | stage: warm-up 2586 | first island frame 7775 | can move 7990
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (512 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (2586 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.46 |
| stage: files (3193 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 79 / 0.20 |  | 5 / 0.00 | 10 / 0.34 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 252 / 1.93 |
| stage: warm-up (2586 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.46 |
| first island frame (7775 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 267 / 3.84 |  | 17 / 2.17 | 17 / 3.18 |  |  | 6 / 0.00 | 22 / 0.01 | 9 / 0.00 | 3 / 0.01 | 468 / 10.58 |
| can move (7990 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 267 / 3.84 |  | 17 / 2.17 | 17 / 3.18 |  | 1 / 0.00 | 6 / 0.00 | 22 / 0.01 | 9 / 0.00 | 3 / 0.01 | 469 / 10.58 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 13 (2656 ms); worst: 6494+678 [672 FrameRequestCallback 63397793691123ee.js] | 7189+402 [400 FrameRequestCallback 63397793691123ee.js] | 2847+330 [327 MessagePort.onmessage 63397793691123ee.js] | 1125+262 [262 http://localhost:3333/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2585+194 [179 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 212 programs linked; compile 0 ms, link and its waits 31 ms (main thread)
memory once in: JS heap 413 MB; GPU uploads ~328.63 MB textures + 45.65 MB buffers; three: [{"geometries":407,"textures":238,"programs":200}]
API and Supabase requests (34):
- 534-577 /api/admin/me
- 534-626 /api/admin/me
- 536-578 /api/profile
- 2588-2639 /api/economy/wallet
- 2590-2640 /api/collections
- 2592-2640 /api/progression/state
- 2593-2641 /api/collections/bag
- 2594-2691 /api/economy/wallet
- 2594-2741 /api/economy/wallet
- 2595-2789 /api/economy/wallet
- 2596-2642 /api/economy/tackle
- 2596-2642 /api/profile
- 2598-2689 /api/identity/me
- 2599-2600 /api/weather
- 2601-2689 /api/homes
- 2601-2690 /api/npc/friendship
- 2602-2690 /api/economy/inventory
- 2759-2804 /api/world/onboarding
- 2760-2805 /api/combat/progression
- 2761-2806 /api/collections
- 2810-2860 /api/weather
- 2845-2846 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3178-3178 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3247-3248 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4248-4249 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4310-4310 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4375-4375 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5143-5190 /api/crafting/recipes
- 6281-6282 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6331-6332 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 6398-6398 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10321-10321 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10390-10391 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10467-10467 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.17 MB /assets/branding/shop-sign-v1.webp?v=JKG3Ytf8 (5190-6472)
- 0.76 MB /assets/characters/v6/colour_atlas.webp?v=Jguu8HuJ (5190-6301)
- 0.64 MB /assets/characters/v6/hair/hair_colour_world.webp?v=yW1XUNYb (5190-6198)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (7739-9657)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (7732-9035)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (7739-9610)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (7739-9493)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (7739-9607)
- 0.34 MB /assets/fx/move-pack.webp?v=mdygWYNj (3174-4004)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (7732-8876)
- 0.33 MB /assets/acnh/buildings/chalet-wall-a.glb?v=DX0rtXTd (3308-4025)
- 0.26 MB /assets/acnh/buildings/chalet-wall-e.glb?v=s-7ok5HO (3308-3899)
game files without a version: 0
glTF parses on the island: 267 of 263 distinct files; parsed more than once: 4
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x acc_glasses_round (14720 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 29):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3333/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3333/assets/branding/shop-sign-v1.webp?v=JKG3Ytf8
- 512x512 
- 512x512 http://localhost:3333/assets/game/water/seabed-sand.webp?v=uTWPDano
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
