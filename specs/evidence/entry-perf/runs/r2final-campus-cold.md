## r2final-campus-cold: NET=campus CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 240, first contentful paint 240, interactive (title ready) 4055, DOMContentLoaded 205
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (4055 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 187 / 8.16 |  | 5 / 0.40 | 7 / 1.63 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 257 / 11.59 |
| Play (7055 ms) | 2 / 0.02 | 59 / 1.13 | 8 / 0.09 | 187 / 8.16 |  | 5 / 0.40 | 8 / 1.65 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 277 / 11.63 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 5 (498 ms); worst: 158 [] | 111 [110 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 92 [91 Worker.onmessage ad8649c185500d2f.js] | 71 [71 MessagePort.onmessage 63397793691123ee.js] | 66 [60 Response.arrayBuffer.then ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 124 | canvas 2143 | stage: files 2728 | stage: warm-up 2143 | first island frame 7655 | can move 7809
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (124 ms) | 1 / 0.00 | 16 / 0.00 | 6 / 0.00 |  |  |  |  |  |  | 6 / 0.00 |  |  | 1 / 0.00 | 30 / 0.00 |
| canvas (2143 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.49 |
| stage: files (2728 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 83 / 0.29 |  | 5 / 0.00 | 10 / 0.82 |  |  | 6 / 0.00 | 21 / 0.01 | 2 / 0.00 | 2 / 0.01 | 256 / 2.49 |
| stage: warm-up (2143 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 65 / 0.08 |  | 2 / 0.00 | 1 / 0.03 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 1.49 |
| first island frame (7655 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 267 / 4.02 |  | 15 / 2.17 | 17 / 4.39 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 467 / 11.96 |
| can move (7809 ms) | 39 / 0.03 | 80 / 1.32 | 8 / 0.02 | 267 / 4.02 |  | 15 / 2.17 | 17 / 4.39 |  | 1 / 0.00 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 468 / 11.96 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (2676 ms); worst: 6475+648 [642 FrameRequestCallback 63397793691123ee.js] | 7149+343 [337 FrameRequestCallback 63397793691123ee.js] | 2387+322 [318 MessagePort.onmessage 63397793691123ee.js] | 744+260 [260 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2143+176 [163 MessagePort.onmessage 4fa395d360c87cc3.js]
long frames in the 3 s after: 0
WebGL: 210 programs linked; compile 0 ms, link and its waits 20 ms (main thread)
memory once in: JS heap 400 MB; GPU uploads ~336.29 MB textures + 45.76 MB buffers; three: [{"geometries":416,"textures":249,"programs":198}]
API and Supabase requests (35):
- 141-183 /api/admin/me
- 142-230 /api/admin/me
- 143-184 /api/profile
- 2146-2196 /api/economy/wallet
- 2147-2197 /api/collections
- 2148-2197 /api/progression/state
- 2150-2198 /api/collections/bag
- 2151-2246 /api/economy/wallet
- 2152-2292 /api/economy/wallet
- 2152-2342 /api/economy/wallet
- 2153-2198 /api/economy/tackle
- 2154-2199 /api/profile
- 2155-2244 /api/identity/me
- 2157-2157 /api/weather
- 2158-2245 /api/homes
- 2159-2245 /api/npc/friendship
- 2160-2246 /api/economy/inventory
- 2300-2343 /api/world/onboarding
- 2301-2344 /api/combat/progression
- 2302-2344 /api/collections
- 2348-2397 /api/weather
- 2369-2369 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2385-2386 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2748-2748 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3473-3473 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3801-3801 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3835-3835 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4873-4916 /api/crafting/recipes
- 4876-4917 /api/traditions/treat
- 5534-5535 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5818-5819 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5868-5868 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9578-9578 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 9845-9846 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 9931-9931 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.29 MB /assets/branding/shop-sign-v1.webp?v=JKG3Ytf8 (4915-6457)
- 0.93 MB /assets/characters/v6/colour_atlas.webp?v=Jguu8HuJ (4915-6309)
- 0.84 MB /assets/characters/v6/hair/hair_colour_world.webp?v=yW1XUNYb (4915-6231)
- 0.65 MB /assets/fx/move-pack.webp?v=mdygWYNj (2706-3857)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (7624-9535)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (7617-8917)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (7624-9488)
- 0.41 MB /assets/characters/v6/base/v7_face_atlas_2_512.webp?v=kELc4Bj7 (4915-5689)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (7623-9368)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (7624-9487)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (7617-8757)
- 0.33 MB /assets/acnh/buildings/chalet-wall-a.glb?v=DX0rtXTd (2839-3531)
game files without a version: 0
glTF parses on the island: 272 of 261 distinct files; parsed more than once: 9
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
