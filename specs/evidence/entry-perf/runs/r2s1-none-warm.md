## r2s1-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 64, first contentful paint 64, interactive (title ready) 2355, DOMContentLoaded 37
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2355 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 12 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 283 / 0.02 |
| Play (5355 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 13 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 1 (56 ms); worst: 56 [51 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 49 | canvas 1129 | stage: files 1402 | stage: warm-up 1129 | first island frame 3386 | can move 3544
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (49 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.00 |
| canvas (1129 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1402 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 83 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 257 / 0.05 |
| stage: warm-up (1129 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (3386 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 25 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 468 / 0.05 |
| can move (3544 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 25 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 469 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 9 (1397 ms); worst: 2520+558 [553 FrameRequestCallback 63397793691123ee.js] | 3078+209 [205 FrameRequestCallback 63397793691123ee.js] | 1216+176 [174 MessagePort.onmessage 63397793691123ee.js] | 84+129 [126 http://localhost:3322/_next/static/chunks/f5b4921d6112e89e.js f5b4921d6112e89e.js] | 1908+78 [75 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 235 ms (main thread)
memory once in: JS heap 406 MB; GPU uploads ~330.09 MB textures + 45.75 MB buffers; three: [{"geometries":415,"textures":249,"programs":194}]
API and Supabase requests (32):
- 37-40 /api/admin/me
- 38-45 /api/admin/me
- 38-43 /api/profile
- 1136-1138 /api/economy/wallet
- 1136-1140 /api/collections
- 1137-1141 /api/progression/state
- 1138-1142 /api/collections/bag
- 1138-1144 /api/economy/wallet
- 1139-1147 /api/economy/wallet
- 1139-1152 /api/economy/wallet
- 1139-1151 /api/economy/tackle
- 1140-1143 /api/profile
- 1140-1156 /api/identity/me
- 1141-1142 /api/weather
- 1142-1144 /api/homes
- 1142-1149 /api/npc/friendship
- 1143-1145 /api/economy/inventory
- 1147-1155 /api/world/onboarding
- 1147-1153 /api/combat/progression
- 1148-1154 /api/collections
- 1171-1173 /api/weather
- 1201-1201 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1201-1201 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1201-1201 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2238-2238 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2253-2253 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2338-2338 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2443-2445 /api/crafting/recipes
- 2445-2446 /api/traditions/treat
- 4251-4251 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4326-4326 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4474-4475 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

game files without a version: 0
console (errors and warm-up lines, 51):
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
