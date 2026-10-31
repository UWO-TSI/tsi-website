## r2s1-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2508, DOMContentLoaded 61
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2508 ms) | 1 / 0.01 | 41 / 1.11 | 8 / 0.09 | 202 / 10.60 |  | 12 / 6.97 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 282 / 22.09 |
| Play (5508 ms) | 2 / 0.02 | 107 / 2.26 | 8 / 0.09 | 249 / 13.16 |  | 13 / 7.01 | 11 / 3.17 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 399 / 25.89 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (114 ms); worst: 62 [59 http://localhost:3322/_next/static/chunks/63397793691123ee.js 63397793691123ee.js] | 52 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 54 | canvas 1169 | stage: files 1571 | stage: warm-up 1169 | first island frame 3602 | can move 3795
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (54 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.03 |
| canvas (1169 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| stage: files (1571 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 81 / 0.03 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.32 |
| stage: warm-up (1169 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.28 |
| first island frame (3602 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.58 |  | 22 / 2.13 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 463 / 5.00 |
| can move (3795 ms) | 39 / 0.03 | 80 / 0.22 | 8 / 0.02 | 265 / 2.58 |  | 22 / 2.13 | 11 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.02 | 465 / 7.24 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 12 (1519 ms); worst: 2693+331 [327 FrameRequestCallback 63397793691123ee.js] | 3283+246 [242 FrameRequestCallback 63397793691123ee.js] | 1396+174 [172 MessagePort.onmessage 63397793691123ee.js] | 1175+160 [154 MessagePort.onmessage 4fa395d360c87cc3.js] | 85+129 [122 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js]
long frames in the 3 s after: 0
WebGL: 206 programs linked; compile 0 ms, link and its waits 10 ms (main thread)
memory once in: JS heap 431 MB; GPU uploads ~329.92 MB textures + 45.75 MB buffers; three: [{"geometries":413,"textures":249,"programs":198}]
API and Supabase requests (32):
- 40-49 /api/admin/me
- 40-56 /api/admin/me
- 41-53 /api/profile
- 1177-1182 /api/economy/wallet
- 1177-1187 /api/collections
- 1178-1191 /api/progression/state
- 1179-1193 /api/collections/bag
- 1179-1198 /api/economy/wallet
- 1179-1203 /api/economy/wallet
- 1180-1204 /api/economy/wallet
- 1180-1195 /api/economy/tackle
- 1181-1196 /api/profile
- 1181-1185 /api/identity/me
- 1182-1182 /api/weather
- 1183-1199 /api/homes
- 1183-1201 /api/npc/friendship
- 1183-1202 /api/economy/inventory
- 1326-1332 /api/world/onboarding
- 1327-1333 /api/combat/progression
- 1327-1334 /api/collections
- 1348-1351 /api/weather
- 1382-1382 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1382-1382 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1382-1382 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2419-2420 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2431-2431 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2514-2514 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2617-2619 /api/crafting/recipes
- 2618-2622 /api/traditions/treat
- 4430-4430 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4500-4500 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4651-4652 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg?v=o7rxsKfa (3717-3727)
- 0.55 MB /assets/game/interiors/hq/ground.glb?v=Zn3_yWeR (3598-3657)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png?v=izYaS_fb (3602-3640)
- 0.44 MB /assets/game/interiors/hq/upper.glb?v=NxbWXxbx (3598-3650)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png?v=WzF4AU4n (3602-3642)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png?v=C7jne0HM (3601-3639)
- 0.38 MB /assets/acnh/interior/floor-simple00.png?v=_XC_Ur3L (3602-3643)
- 0.21 MB /assets/game/interiors/hq/tank.glb?v=w9lAS9lD (3598-3646)
game files without a version: 0
console (errors and warm-up lines, 27):
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
