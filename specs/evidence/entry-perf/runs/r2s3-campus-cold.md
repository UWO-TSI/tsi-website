## r2s3-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 256, first contentful paint 256, interactive (title ready) 4177, DOMContentLoaded 222
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4177 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
| Play (7177 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (502 ms); worst: 170 [] | 108 [107 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 90 [89 Worker.onmessage ad8649c185500d2f.js] | 71 [71 MessagePort.onmessage 63397793691123ee.js] | 63 [56 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 390 | canvas 2368 | stage: files 2935 | stage: warm-up 2368 | first island frame 8868 | can move 9043
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (390 ms) | 1 / 0.01 | 16 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.03 |
| canvas (2368 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| stage: files (2935 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 83 / 1.18 |  | 5 / 0.16 | 10 / 1.32 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 256 / 4.06 |
| stage: warm-up (2368 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| first island frame (8868 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 267 / 7.72 |  | 15 / 2.35 | 17 / 4.91 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 467 / 16.40 |
| can move (9043 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 267 / 7.72 |  | 15 / 2.35 | 17 / 4.91 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 468 / 16.40 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (2840 ms); worst: 7674+674 [669 FrameRequestCallback 63397793691123ee.js] | 8348+364 [356 FrameRequestCallback 63397793691123ee.js] | 2619+316 [312 MessagePort.onmessage 63397793691123ee.js] | 987+247 [247 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2368+185 [166 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 210 programs linked; compile 0 ms, link and its waits 48 ms (main thread)
memory once in: JS heap 425 MB; GPU uploads ~336.79 MB textures + 45.84 MB buffers; three: [{"geometries":419,"textures":251,"programs":198}]
API and Supabase requests (35):
- 410-456 /api/admin/me
- 411-499 /api/admin/me
- 412-457 /api/profile
- 2370-2421 /api/economy/wallet
- 2371-2422 /api/collections
- 2373-2422 /api/progression/state
- 2374-2423 /api/collections/bag
- 2375-2471 /api/economy/wallet
- 2376-2519 /api/economy/wallet
- 2376-2566 /api/economy/wallet
- 2377-2423 /api/economy/tackle
- 2378-2424 /api/profile
- 2379-2468 /api/identity/me
- 2381-2381 /api/weather
- 2382-2469 /api/homes
- 2383-2470 /api/npc/friendship
- 2384-2470 /api/economy/inventory
- 2528-2569 /api/world/onboarding
- 2529-2570 /api/combat/progression
- 2530-2571 /api/collections
- 2582-2631 /api/weather
- 2602-2602 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2617-2618 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2969-2969 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3693-3693 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4112-4112 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4118-4119 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5866-5867 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6066-6108 /api/crafting/recipes
- 6070-6110 /api/traditions/treat
- 6215-6215 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 6231-6231 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10220-10221 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10290-10290 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10356-10356 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.29 MB /assets/branding/shop-sign-v1.webp?v=JKG3Ytf8 (6106-7652)
- 0.97 MB /assets/acnh/buildings/shop-market.glb?v=qfV6MG-Z (3040-5236)
- 0.93 MB /assets/fx/move-pack.webp?v=mdygWYNj (2931-5774)
- 0.93 MB /assets/characters/v6/colour_atlas.webp?v=Jguu8HuJ (6106-7503)
- 0.84 MB /assets/characters/v6/hair/hair_colour_world.webp?v=yW1XUNYb (6106-7424)
- 0.83 MB /assets/acnh/buildings/hq-office.glb?v=E9g1_hMU (2930-4900)
- 0.60 MB /assets/acnh/buildings/oracle-museum.glb?v=klbFjgY_ (3040-4594)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (8846-10488)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (8853-11000)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb?v=j5oUGxt7 (3047-4372)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (8846-10233)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (8853-10974)
game files without a version: 0
glTF parses on the island: 272 of 259 distinct files; parsed more than once: 11
- 4x pCube48__mDoorR-mesh (154328 B)
- 2x Crown,Hull,Stem,Trunk (172208 B)
- 2x log-bench (36648 B)
- 2x FishCrate (139900 B)
- 2x plaza-bench (46360 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (491648 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (354368 B)
- 2x Crown,Trunk (24416 B)
- 2x Crown,Trunk (25536 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 30):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp?v=mdygWYNj
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.webp?v=JKG3Ytf8
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
