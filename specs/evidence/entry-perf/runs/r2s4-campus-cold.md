## r2s4-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 260, first contentful paint 260, interactive (title ready) 4103, DOMContentLoaded 219
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4103 ms) | 1 / 0.01 | 41 / 1.12 | 8 / 0.09 | 187 / 8.16 |  | 6 / 0.71 | 7 / 1.63 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 258 / 11.90 |
| Play (7103 ms) | 2 / 0.02 | 59 / 1.14 | 8 / 0.09 | 191 / 8.22 |  | 6 / 0.71 | 8 / 1.65 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 282 / 12.01 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (516 ms); worst: 174 [] | 109 [108 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 93 [92 Worker.onmessage ad8649c185500d2f.js] | 73 [72 MessagePort.onmessage 63397793691123ee.js] | 67 [60 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 543 | canvas 2635 | stage: files 3220 | stage: warm-up 2635 | first island frame 8044 | can move 8211
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (543 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (2635 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.49 |
| stage: files (3220 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 82 / 0.26 |  | 5 / 0.00 | 10 / 0.41 |  |  | 6 / 0.00 | 21 / 0.01 | 1 / 0.00 | 2 / 0.01 | 254 / 2.06 |
| stage: warm-up (2635 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.49 |
| first island frame (8044 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 266 / 3.86 |  | 15 / 2.17 | 17 / 3.42 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 466 / 10.84 |
| can move (8211 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 266 / 3.86 |  | 15 / 2.17 | 17 / 3.42 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 467 / 10.84 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 13 (2665 ms); worst: 6872+646 [642 FrameRequestCallback 63397793691123ee.js] | 7539+351 [344 FrameRequestCallback 63397793691123ee.js] | 2884+319 [315 MessagePort.onmessage 63397793691123ee.js] | 1168+257 [256 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2635+183 [171 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 26 ms (main thread)
memory once in: JS heap 683 MB; GPU uploads ~336.38 MB textures + 45.76 MB buffers; three: [{"geometries":415,"textures":249,"programs":194}]
API and Supabase requests (35):
- 559-606 /api/admin/me
- 559-654 /api/admin/me
- 560-606 /api/profile
- 2637-2682 /api/economy/wallet
- 2638-2682 /api/collections
- 2640-2683 /api/progression/state
- 2641-2684 /api/collections/bag
- 2642-2733 /api/economy/wallet
- 2643-2779 /api/economy/wallet
- 2643-2822 /api/economy/wallet
- 2644-2685 /api/economy/tackle
- 2645-2685 /api/profile
- 2646-2731 /api/identity/me
- 2647-2648 /api/weather
- 2649-2732 /api/homes
- 2649-2732 /api/npc/friendship
- 2650-2733 /api/economy/inventory
- 2799-2845 /api/world/onboarding
- 2800-2845 /api/combat/progression
- 2801-2845 /api/collections
- 2847-2898 /api/weather
- 2885-2885 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3239-3239 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3296-3297 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4287-4288 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4354-4354 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4427-4428 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 5459-5500 /api/crafting/recipes
- 5462-5503 /api/traditions/treat
- 6312-6313 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 6401-6401 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 6443-6443 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 10349-10350 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 10428-10428 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 10504-10504 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.23 MB /assets/branding/shop-sign-v1.webp?v=JKG3Ytf8 (5498-6850)
- 0.78 MB /assets/characters/v6/colour_atlas.webp?v=Jguu8HuJ (5498-6659)
- 0.69 MB /assets/characters/v6/hair/hair_colour_world.webp?v=yW1XUNYb (5498-6580)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (8027-9933)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (8020-9315)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (8027-9887)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (8027-9772)
- 0.38 MB /assets/fx/move-pack.webp?v=mdygWYNj (3200-4167)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (8027-9885)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (8020-9161)
- 0.33 MB /assets/acnh/buildings/chalet-wall-a.glb?v=DX0rtXTd (3329-4035)
- 0.30 MB /assets/characters/v6/base/v7_face_atlas_2_512.webp?v=kELc4Bj7 (5498-6096)
game files without a version: 0
glTF parses on the island: 271 of 260 distinct files; parsed more than once: 9
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x Crown,Trunk (23676 B)
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
