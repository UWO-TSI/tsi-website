## r2s2-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 52, first contentful paint 52, interactive (title ready) 2349, DOMContentLoaded 45
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2349 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 12 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 283 / 0.02 |
| Play (5349 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 13 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (123 ms); worst: 69 [34 LINK.onload turbopack-4da6ec9caf62642a.js] | 54 [52 Worker.onmessage ad8649c185500d2f.js]

### Play to walking (ms from Play)
loading screen 50 | canvas 1168 | stage: files 1445 | stage: warm-up 1168 | first island frame 3403 | can move 3608
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (50 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.00 |
| canvas (1168 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1445 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 83 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 257 / 0.05 |
| stage: warm-up (1168 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (3403 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 22 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 465 / 0.05 |
| can move (3608 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 267 / 0.00 |  | 22 / 0.00 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 466 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 9 (1417 ms); worst: 2483+570 [564 FrameRequestCallback 63397793691123ee.js] | 3053+215 [211 FrameRequestCallback 63397793691123ee.js] | 1255+178 [176 MessagePort.onmessage 63397793691123ee.js] | 87+130 [127 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2027+77 [76 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 209 programs linked; compile 0 ms, link and its waits 227 ms (main thread)
memory once in: JS heap 425 MB; GPU uploads ~329.71 MB textures + 45.72 MB buffers; three: [{"geometries":419,"textures":247,"programs":201}]
API and Supabase requests (32):
- 39-42 /api/admin/me
- 39-47 /api/admin/me
- 40-44 /api/profile
- 1175-1177 /api/economy/wallet
- 1175-1178 /api/collections
- 1176-1178 /api/progression/state
- 1177-1180 /api/collections/bag
- 1177-1181 /api/economy/wallet
- 1177-1184 /api/economy/wallet
- 1178-1185 /api/economy/wallet
- 1178-1179 /api/economy/tackle
- 1179-1182 /api/profile
- 1179-1181 /api/identity/me
- 1180-1180 /api/weather
- 1181-1184 /api/homes
- 1181-1183 /api/npc/friendship
- 1182-1187 /api/economy/inventory
- 1186-1188 /api/world/onboarding
- 1186-1189 /api/combat/progression
- 1187-1190 /api/collections
- 1210-1212 /api/weather
- 1240-1240 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1240-1240 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1240-1240 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2385-2387 /api/crafting/recipes
- 2386-2387 /api/traditions/treat
- 2441-2441 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2461-2461 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2464-2465 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4459-4460 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4473-4474 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4473-4474 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

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
