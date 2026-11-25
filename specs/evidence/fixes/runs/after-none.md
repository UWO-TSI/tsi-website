## after-none: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 84, first contentful paint 84, interactive (title ready) 2221, DOMContentLoaded 45
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2221 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 198 / 7.48 |  | 6 / 0.71 | 14 / 5.42 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 276 / 15.01 |
| Play (5221 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 10.23 |  | 7 / 0.75 | 18 / 6.78 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 400 / 20.32 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (485 ms); worst: 370 [365 FrameRequestCallback 63397793691123ee.js] | 59 [57 http://localhost:3333/_next/static/chunks/e40f48c31fd57444.js e40f48c31fd57444.js] | 56 [55 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 57 | canvas 1226 | stage: files 1661 | stage: warm-up 1226 | first island frame 3643 | can move 3845
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (57 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1226 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1661 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 79 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 1 / 0.00 | 2 / 0.01 | 251 / 0.29 |
| stage: warm-up (1226 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3643 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 267 / 2.04 |  | 16 / 2.13 | 17 / 0.00 |  |  | 6 / 0.00 | 22 / 0.01 | 6 / 0.00 | 3 / 0.01 | 464 / 4.46 |
| can move (3845 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 267 / 2.04 |  | 16 / 2.13 | 17 / 0.00 |  | 1 / 1.12 | 6 / 0.00 | 22 / 0.01 | 6 / 0.00 | 4 / 0.02 | 466 / 5.58 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 10 (1520 ms); worst: 2599+371 [368 FrameRequestCallback 63397793691123ee.js] | 3249+290 [285 FrameRequestCallback 63397793691123ee.js] | 1459+190 [188 MessagePort.onmessage 63397793691123ee.js] | 1233+165 [159 MessagePort.onmessage 4fa395d360c87cc3.js] | 93+151 [145 http://localhost:3333/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 208 programs linked; compile 0 ms, link and its waits 13 ms (main thread)
memory once in: JS heap 397 MB; GPU uploads ~322.42 MB textures + 45.64 MB buffers; three: [{"geometries":407,"textures":238,"programs":200}]
API and Supabase requests (31):
- 43-55 /api/admin/me
- 44-63 /api/admin/me
- 44-60 /api/profile
- 1235-1243 /api/economy/wallet
- 1235-1251 /api/collections
- 1236-1254 /api/progression/state
- 1237-1257 /api/collections/bag
- 1238-1268 /api/economy/wallet
- 1238-1269 /api/economy/wallet
- 1238-1270 /api/economy/wallet
- 1239-1259 /api/economy/tackle
- 1239-1260 /api/profile
- 1240-1248 /api/identity/me
- 1241-1241 /api/weather
- 1241-1263 /api/homes
- 1242-1265 /api/npc/friendship
- 1242-1267 /api/economy/inventory
- 1388-1395 /api/world/onboarding
- 1389-1397 /api/combat/progression
- 1389-1399 /api/collections
- 1411-1415 /api/weather
- 1458-1459 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1674-1674 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1698-1698 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2514-2518 /api/crafting/recipes
- 2983-2983 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2988-2988 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2988-2988 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4993-4994 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4993-4994 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4994-4994 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 1.12 MB /audio/ambient/dusk.ogg?v=ZVuy6maK (3746-3751)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3619-3666)
- 0.42 MB /assets/game/interiors/hq/ground.glb?v=wJvg-lTr (3616-3681)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3619-3668)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3619-3663)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3619-3668)
- 0.34 MB /assets/game/interiors/hq/upper.glb?v=LaMVE-bb (3616-3674)
game files without a version: 0
glTF parses on the island: 267 of 263 distinct files; parsed more than once: 4
- 2x acc_glasses_round (14720 B)
- 2x Crown,Trunk (23676 B)
- 2x acc_glasses_square (12864 B)
- 2x bottom_shorts (7576 B)
console (errors and warm-up lines, 26):
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
