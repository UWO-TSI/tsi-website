## before-campus: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 324, first contentful paint 324, interactive (title ready) 4326, DOMContentLoaded 280
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4326 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 187 / 8.16 |  | 6 / 0.71 | 7 / 1.63 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 258 / 11.90 |
| Play (7326 ms) | 2 / 0.02 | 60 / 1.17 | 8 / 0.09 | 197 / 8.30 |  | 6 / 0.71 | 8 / 1.65 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 289 / 12.12 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (660 ms); worst: 221 [] | 129 [128 http://localhost:3333/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 96 [95 Worker.onmessage ad8649c185500d2f.js] | 77 [76 MessagePort.onmessage 63397793691123ee.js] | 74 [28 http://localhost:3333/_next/static/chunks/5ad3b07c411533dd.js 5ad3b07c411533dd.js]

### Play to walking (ms from Play)
loading screen 540 | canvas 2545 | stage: files 3581 | stage: warm-up 2545 | first island frame 8306 | can move 8469
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (540 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (2545 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.46 |
| stage: files (3581 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 80 / 0.23 |  | 5 / 0.00 | 10 / 0.29 |  |  | 6 / 0.00 | 21 / 0.01 |  | 2 / 0.01 | 251 / 1.91 |
| stage: warm-up (2545 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.46 |
| first island frame (8306 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 271 / 3.87 |  | 17 / 2.17 | 17 / 3.09 |  |  | 6 / 0.00 | 22 / 0.01 | 9 / 0.00 | 3 / 0.01 | 472 / 10.52 |
| can move (8469 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 271 / 3.87 |  | 17 / 2.17 | 17 / 3.09 |  | 1 / 0.00 | 6 / 0.00 | 22 / 0.01 | 9 / 0.00 | 3 / 0.01 | 473 / 10.52 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 13 (3286 ms); worst: 6839+732 [726 FrameRequestCallback 63397793691123ee.js] | 2545+625 [610 MessagePort.onmessage 4fa395d360c87cc3.js] | 7571+565 [553 FrameRequestCallback 63397793691123ee.js] | 3241+339 [335 MessagePort.onmessage 63397793691123ee.js] | 1149+258 [257 http://localhost:3333/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 59 ms (main thread)
memory once in: JS heap 411 MB; GPU uploads ~332.44 MB textures + 45.66 MB buffers; three: [{"geometries":410,"textures":246,"programs":196}]
API and Supabase requests (33):
- 566-609 /api/admin/me
- 566-657 /api/admin/me
- 568-610 /api/profile
- 2548-2598 /api/economy/wallet
- 2549-2599 /api/collections
- 2551-2599 /api/progression/state
- 2552-2600 /api/collections/bag
- 2553-2650 /api/economy/wallet
- 2554-2700 /api/economy/wallet
- 2554-2748 /api/economy/wallet
- 2555-2600 /api/economy/tackle
- 2556-2601 /api/profile
- 2557-2648 /api/identity/me
- 2559-2559 /api/weather
- 2560-2649 /api/homes
- 2561-2649 /api/npc/friendship
- 2562-2650 /api/economy/inventory
- 3149-3196 /api/world/onboarding
- 3150-3197 /api/combat/progression
- 3151-3197 /api/collections
- 3200-3249 /api/weather
- 3680-3681 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3713-3713 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3766-3766 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4789-4789 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4814-4815 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4971-4971 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5550-5596 /api/crafting/recipes
- 6808-6809 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6821-6821 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 8175-8176 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10845-10846 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10875-10876 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
largest over the wire before can move:
- 1.29 MB /assets/branding/shop-sign-v1.webp?v=JKG3Ytf8 (5595-6817)
- 0.70 MB /assets/characters/v6/colour_atlas.webp?v=Jguu8HuJ (5595-6610)
- 0.59 MB /assets/characters/v6/hair/hair_colour_world.webp?v=yW1XUNYb (5595-6514)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (8292-10207)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (8284-9591)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (8292-10161)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (8291-10043)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (8292-10160)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (8285-9428)
- 0.33 MB /assets/acnh/buildings/chalet-wall-a.glb?v=DX0rtXTd (3717-4433)
- 0.29 MB /assets/fx/move-pack.webp?v=mdygWYNj (3577-4376)
- 0.26 MB /assets/acnh/buildings/chalet-wall-e.glb?v=s-7ok5HO (3717-4344)
game files without a version: 0
glTF parses on the island: 276 of 264 distinct files; parsed more than once: 10
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x acc_glasses_round (14720 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 28):
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
