## r2s4after-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 108, first contentful paint 108, interactive (title ready) 2216, DOMContentLoaded 65
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2216 ms) | 1 / 0.01 | 41 / 1.12 | 8 / 0.09 | 198 / 7.48 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 15.02 |
| Play (5216 ms) | 2 / 0.02 | 107 / 2.27 | 8 / 0.09 | 249 / 10.23 |  | 7 / 0.75 | 17 / 6.75 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 20.30 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (498 ms); worst: 379 [373 FrameRequestCallback 63397793691123ee.js] | 66 [62 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 53 [52 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 55 | canvas 1168 | stage: files 1580 | stage: warm-up 1168 | first island frame 3719 | can move 10088
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (55 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1168 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1580 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 81 / 0.03 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.32 |
| stage: warm-up (1168 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3719 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.02 |  | 15 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 462 / 4.44 |
| can move (10088 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.02 |  | 15 / 2.13 | 17 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 12 / 0.00 | 4 / 0.02 | 470 / 6.67 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (1485 ms); worst: 2764+348 [344 FrameRequestCallback 63397793691123ee.js] | 3356+264 [262 FrameRequestCallback 63397793691123ee.js] | 1395+174 [173 MessagePort.onmessage 63397793691123ee.js] | 1175+159 [152 MessagePort.onmessage 4fa395d360c87cc3.js] | 88+133 [127 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 216 programs linked; compile 0 ms, link and its waits 8 ms (main thread)
memory once in: JS heap 415 MB; GPU uploads ~346.07 MB textures + 45.80 MB buffers; three: [{"geometries":417,"textures":251,"programs":198}]
API and Supabase requests (35):
- 42-51 /api/admin/me
- 42-57 /api/admin/me
- 42-54 /api/profile
- 1176-1182 /api/economy/wallet
- 1177-1186 /api/collections
- 1177-1188 /api/progression/state
- 1178-1190 /api/collections/bag
- 1178-1194 /api/economy/wallet
- 1179-1200 /api/economy/wallet
- 1179-1201 /api/economy/wallet
- 1180-1191 /api/economy/tackle
- 1180-1193 /api/profile
- 1181-1200 /api/identity/me
- 1181-1182 /api/weather
- 1182-1196 /api/homes
- 1183-1197 /api/npc/friendship
- 1183-1198 /api/economy/inventory
- 1325-1329 /api/world/onboarding
- 1325-1331 /api/combat/progression
- 1326-1332 /api/collections
- 1346-1349 /api/weather
- 1382-1382 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1382-1382 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1382-1382 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2427-2427 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2454-2454 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2478-2478 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2679-2682 /api/crafting/recipes
- 2680-2683 /api/traditions/treat
- 4448-4448 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4467-4467 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4489-4489 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 8454-8454 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 8488-8488 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 8519-8519 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (10014-10021)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3694-3729)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (3690-3748)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3694-3731)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3694-3727)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3694-3732)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (3690-3737)
game files without a version: 0
glTF parses on the island: 270 of 259 distinct files; parsed more than once: 9
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
