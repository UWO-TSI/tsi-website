## r2s2-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 244, first contentful paint 244, interactive (title ready) 4079, DOMContentLoaded 202
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4079 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
| Play (7079 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 184 / 8.00 |  | 2 / 0.19 | 6 / 1.61 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 250 / 11.21 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 6 (538 ms); worst: 155 [] | 106 [106 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 91 [89 Worker.onmessage ad8649c185500d2f.js] | 66 [65 MessagePort.onmessage 63397793691123ee.js] | 61 [21 http://localhost:3322/_next/static/chunks/eaf468666801eaef.js eaf468666801eaef.js]

### Play to walking (ms from Play)
loading screen 407 | canvas 2421 | stage: files 2986 | stage: warm-up 2421 | first island frame 9277 | can move 9438
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (407 ms) | 1 / 0.01 | 16 / 0.02 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.03 |
| canvas (2421 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| stage: files (2986 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 81 / 0.31 |  | 5 / 0.12 | 10 / 1.31 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 3.15 |
| stage: warm-up (2421 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 65 / 0.09 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.52 |
| first island frame (9277 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 265 / 6.25 |  | 22 / 8.57 | 11 / 1.32 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 466 / 17.56 |
| can move (9438 ms) | 39 / 0.04 | 80 / 1.33 | 8 / 0.02 | 265 / 6.25 |  | 22 / 8.57 | 11 / 1.32 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 467 / 17.56 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (2477 ms); worst: 8148+614 [609 FrameRequestCallback 63397793691123ee.js] | 8795+338 [333 FrameRequestCallback 63397793691123ee.js] | 2666+307 [303 MessagePort.onmessage 63397793691123ee.js] | 1028+289 [289 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2421+172 [160 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 210 programs linked; compile 0 ms, link and its waits 14 ms (main thread)
memory once in: JS heap 443 MB; GPU uploads ~336.21 MB textures + 45.73 MB buffers; three: [{"geometries":414,"textures":248,"programs":198}]
API and Supabase requests (35):
- 433-479 /api/admin/me
- 434-525 /api/admin/me
- 435-480 /api/profile
- 2424-2465 /api/economy/wallet
- 2424-2466 /api/collections
- 2426-2468 /api/progression/state
- 2427-2468 /api/collections/bag
- 2428-2516 /api/economy/wallet
- 2429-2560 /api/economy/wallet
- 2429-2606 /api/economy/wallet
- 2430-2471 /api/economy/tackle
- 2431-2472 /api/profile
- 2432-2513 /api/identity/me
- 2433-2434 /api/weather
- 2435-2514 /api/homes
- 2435-2514 /api/npc/friendship
- 2436-2515 /api/economy/inventory
- 2576-2618 /api/world/onboarding
- 2577-2618 /api/combat/progression
- 2578-2619 /api/collections
- 2620-2669 /api/weather
- 2641-2642 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2641-2642 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2642-2642 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3725-3725 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3772-3772 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3823-3823 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5431-5472 /api/crafting/recipes
- 5433-5474 /api/traditions/treat
- 5760-5761 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5806-5806 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5864-5864 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9816-9816 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 9869-9869 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 9941-9941 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.86 MB /assets/characters/v6/colour_atlas.png?v=sqCcOC4s (5472-8125)
- 1.66 MB /assets/branding/shop-sign-v1.png?v=5NaqjA_L (5471-8040)
- 1.54 MB /assets/characters/v6/hair/hair_colour_world.png?v=Cz2YA7JD (5471-7938)
- 0.97 MB /assets/acnh/buildings/shop-market.glb?v=qfV6MG-Z (3077-4863)
- 0.93 MB /assets/fx/move-pack.webp?v=mdygWYNj (2969-5205)
- 0.80 MB /assets/characters/v6/base/v7_face_atlas_2_512.png?v=1QJqrclo (5472-7020)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (9257-10897)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (9263-11413)
- 0.50 MB /assets/acnh/buildings/chalet-wall-a.glb?v=j5oUGxt7 (3082-4200)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (9257-10641)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (9263-11385)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (9263-11203)
game files without a version: 0
glTF parses on the island: 270 of 257 distinct files; parsed more than once: 11
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
console (errors and warm-up lines, 38):
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/dd7c246a-6935-453a-bda0-0337091400fa
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/db0e3aaa-6f22-4502-8454-b6505fc0248d
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/5adb1dc5-033c-4aca-a89d-f6374a3085c9
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/315a8f65-af28-409d-a3f4-cd2299c771d4
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/3293e902-20b1-465e-b68a-8da77268af15
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/4c9d6ea3-9efb-431a-b220-4f02640c9354
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/005a8a23-5b00-4043-a4d2-4e357b0363b0
- error: THREE.GLTFLoader: Couldn't load texture blob:http://localhost:3322/708b4025-75ed-462d-a380-b884b6d7d64b
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
