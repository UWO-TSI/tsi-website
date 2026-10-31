## r2final-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2187, DOMContentLoaded 65
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2187 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 7.48 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 15.01 |
| Play (5187 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 10.23 |  | 7 / 0.75 | 17 / 6.75 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 20.29 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (471 ms); worst: 354 [348 FrameRequestCallback 63397793691123ee.js] | 63 [59 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 54 [53 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 55 | canvas 1191 | stage: files 1604 | stage: warm-up 1191 | first island frame 3643 | can move 3812
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (55 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1191 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1604 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 80 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 254 / 0.29 |
| stage: warm-up (1191 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3643 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 264 / 1.99 |  | 15 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 461 / 4.41 |
| can move (3812 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 264 / 1.99 |  | 15 / 2.13 | 17 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.02 | 463 / 6.65 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1578 ms); worst: 2657+347 [343 FrameRequestCallback 63397793691123ee.js] | 3267+271 [266 FrameRequestCallback 63397793691123ee.js] | 1416+177 [175 MessagePort.onmessage 63397793691123ee.js] | 1197+158 [152 MessagePort.onmessage 4fa395d360c87cc3.js] | 91+128 [124 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 669 MB; GPU uploads ~329.34 MB textures + 45.70 MB buffers; three: [{"geometries":413,"textures":246,"programs":198}]
API and Supabase requests (32):
- 40-51 /api/admin/me
- 41-58 /api/admin/me
- 41-56 /api/profile
- 1199-1204 /api/economy/wallet
- 1199-1209 /api/collections
- 1200-1211 /api/progression/state
- 1201-1213 /api/collections/bag
- 1201-1217 /api/economy/wallet
- 1202-1222 /api/economy/wallet
- 1202-1222 /api/economy/wallet
- 1202-1215 /api/economy/tackle
- 1203-1216 /api/profile
- 1203-1207 /api/identity/me
- 1204-1204 /api/weather
- 1205-1218 /api/homes
- 1205-1220 /api/npc/friendship
- 1206-1221 /api/economy/inventory
- 1347-1350 /api/world/onboarding
- 1347-1353 /api/combat/progression
- 1348-1354 /api/collections
- 1368-1372 /api/weather
- 1402-1403 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1402-1403 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1402-1403 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2568-2571 /api/crafting/recipes
- 2570-2574 /api/traditions/treat
- 2620-2620 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2647-2648 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2651-2652 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4665-4665 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4675-4675 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4675-4675 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3739-3749)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3615-3669)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (3612-3683)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3615-3671)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3615-3667)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3615-3672)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (3612-3678)
game files without a version: 0
glTF parses on the island: 269 of 258 distinct files; parsed more than once: 9
- 4x pCube48__mDoorR-mesh (119612 B)
- 2x log-bench (35568 B)
- 2x FishCrate (135888 B)
- 2x plaza-bench (43832 B)
- 2x Brick00__mWallA-mesh,BrickBack__mHouseInner-mesh,CL__mCurtain-mesh,Hou (362188 B)
- 2x Cm00_low__mRoofB-mesh,Hole__mChimneyhole-mesh,Thatched00_low__mRoofA-m (230352 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 27):
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
