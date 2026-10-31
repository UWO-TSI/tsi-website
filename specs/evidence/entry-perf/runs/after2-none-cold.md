## after2-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 2072, DOMContentLoaded 62
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2072 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 195 / 9.28 |  | 7 / 0.76 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 1 / 0.01 | 268 / 14.51 |
| Play (5072 ms) | 2 / 0.02 | 103 / 2.15 | 7 / 0.07 | 244 / 13.14 |  | 12 / 5.15 | 12 / 3.19 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 389 / 23.92 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (478 ms); worst: 364 [359 FrameRequestCallback b29ba28996376b6a.js] | 61 [58 http://localhost:3322/_next/static/chunks/3840cf05d075aae9.js 3840cf05d075aae9.js] | 53 [51 Worker.onmessage 6a764e44c60fc2d8.js]

### Play to walking (ms from Play)
loading screen 58 | canvas 1176 | stage: files 1583 | stage: warm-up 1176 | first island frame 3545 | can move 3729
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (58 ms) | 5 / 0.00 | 54 / 0.00 | 9 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 79 / 0.03 |
| canvas (1176 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 126 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 265 / 0.23 |
| stage: files (1583 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 144 / 0.05 |  | 5 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 15 / 0.01 | 3 / 0.00 | 2 / 0.01 | 311 / 0.27 |
| stage: warm-up (1176 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 126 / 0.02 |  | 2 / 0.00 | 7 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 265 / 0.23 |
| first island frame (3545 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 510 / 2.66 |  | 42 / 2.13 | 28 / 0.00 |  |  | 6 / 0.00 | 17 / 0.01 | 6 / 0.00 | 4 / 0.01 | 732 / 5.02 |
| can move (3729 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 510 / 2.66 |  | 42 / 2.13 | 28 / 0.00 |  | 2 / 4.16 | 6 / 0.00 | 17 / 0.01 | 6 / 0.00 | 5 / 0.02 | 735 / 9.19 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 10 (1330 ms); worst: 2657+347 [343 FrameRequestCallback b29ba28996376b6a.js] | 3234+219 [216 FrameRequestCallback b29ba28996376b6a.js] | 1408+165 [163 MessagePort.onmessage b29ba28996376b6a.js] | 1181+161 [155 MessagePort.onmessage 4fa395d360c87cc3.js] | 92+125 [119 http://localhost:3322/_next/static/chunks/c3805d6ee339bbc4.js c3805d6ee339bbc4.js]
long frames in the 3 s after: 0
WebGL: 196 programs linked; compile 0 ms, link and its waits 6 ms (main thread)
memory once in: JS heap 414 MB; GPU uploads ~317.65 MB textures + 46.16 MB buffers; three: [{"geometries":408,"textures":247,"programs":188}]
API and Supabase requests (26):
- 45-55 /api/admin/me
- 45-60 /api/admin/me
- 45-58 /api/profile
- 1183-1188 /api/economy/wallet
- 1184-1193 /api/collections
- 1184-1194 /api/collections/bag
- 1185-1196 /api/profile
- 1185-1198 /api/identity/me
- 1186-1199 /api/progression/state
- 1187-1187 /api/weather
- 1187-1191 /api/homes
- 1188-1201 /api/economy/inventory
- 1335-1339 /api/combat/progression
- 1336-1340 /api/collections
- 1354-1357 /api/weather
- 1388-1388 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1388-1388 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1388-1388 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2557-2560 /api/crafting/recipes
- 2558-2563 /api/traditions/treat
- 2581-2581 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2644-2644 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2652-2652 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4639-4639 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4651-4652 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4653-4654 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg (3622-3642)
- 1.94 MB /audio/ambient/applicant-willow-tree.ogg (3622-3628)
- 0.55 MB /assets/game/interiors/hq/ground.glb (3522-3601)
- 0.52 MB /assets/acnh/interior/floor-tatami00.png (3525-3577)
- 0.44 MB /assets/game/interiors/hq/upper.glb (3522-3592)
- 0.42 MB /assets/acnh/interior/floor-simplecarpet01.png (3525-3579)
- 0.40 MB /assets/acnh/interior/floor-simpleparquet00.png (3525-3573)
- 0.38 MB /assets/acnh/interior/floor-simple00.png (3525-3582)
- 0.21 MB /assets/game/interiors/hq/tank.glb (3522-3581)
console (errors and warm-up lines, 22):
- error: Failed to load resource: the server responded with a status of 401 (Unauthorized)
- error: Failed to load resource: net::ERR_UNSAFE_PORT
biggest textures in the scene:
- 1024x3584 http://localhost:3322/assets/fx/move-pack.webp
- 1774x887 http://localhost:3322/assets/branding/shop-sign-v1.png
- 512x512 
- 512x512 http://localhost:3322/assets/game/water/seabed-sand.webp
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
