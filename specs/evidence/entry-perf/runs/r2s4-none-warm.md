## r2s4-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 60, first contentful paint 60, interactive (title ready) 2399, DOMContentLoaded 38
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2399 ms) | 1 / 0.01 | 41 / 0.00 | 8 / 0.00 | 202 / 0.00 |  | 6 / 0.00 | 15 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 283 / 0.02 |
| Play (5399 ms) | 2 / 0.01 | 107 / 0.00 | 8 / 0.00 | 249 / 0.00 |  | 7 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 400 / 0.02 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (118 ms); worst: 61 [58 Worker.onmessage ad8649c185500d2f.js] | 57 [34 LINK.onload turbopack-4da6ec9caf62642a.js]

### Play to walking (ms from Play)
loading screen 49 | canvas 1141 | stage: files 1416 | stage: warm-up 1141 | first island frame 3438 | can move 3612
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (49 ms) | 5 / 0.00 | 58 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 82 / 0.00 |
| canvas (1141 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| stage: files (1416 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 81 / 0.00 |  | 5 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 255 / 0.05 |
| stage: warm-up (1141 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 65 / 0.00 |  | 2 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 206 / 0.04 |
| first island frame (3438 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 3 / 0.01 | 464 / 0.05 |
| can move (3612 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.00 |  | 17 / 0.00 | 17 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 6 / 0.00 | 4 / 0.01 | 465 / 0.06 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 10 (1513 ms); worst: 2545+580 [575 FrameRequestCallback 63397793691123ee.js] | 3124+221 [217 FrameRequestCallback 63397793691123ee.js] | 1231+174 [172 MessagePort.onmessage 63397793691123ee.js] | 91+129 [125 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2266+79 [77 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 202 programs linked; compile 0 ms, link and its waits 232 ms (main thread)
memory once in: JS heap 412 MB; GPU uploads ~330.00 MB textures + 45.71 MB buffers; three: [{"geometries":410,"textures":248,"programs":194}]
API and Supabase requests (32):
- 37-40 /api/admin/me
- 37-45 /api/admin/me
- 38-42 /api/profile
- 1147-1149 /api/economy/wallet
- 1147-1150 /api/collections
- 1148-1151 /api/progression/state
- 1149-1153 /api/collections/bag
- 1149-1153 /api/economy/wallet
- 1150-1156 /api/economy/wallet
- 1150-1159 /api/economy/wallet
- 1150-1152 /api/economy/tackle
- 1151-1155 /api/profile
- 1151-1158 /api/identity/me
- 1152-1152 /api/weather
- 1153-1154 /api/homes
- 1153-1157 /api/npc/friendship
- 1154-1160 /api/economy/inventory
- 1158-1161 /api/world/onboarding
- 1158-1162 /api/combat/progression
- 1159-1163 /api/collections
- 1179-1182 /api/weather
- 1212-1212 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1212-1212 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1212-1212 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 2259-2260 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2345-2345 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2464-2466 /api/crafting/recipes
- 2465-2467 /api/traditions/treat
- 2494-2495 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4276-4276 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 4352-4352 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 4532-4533 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

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
console (errors and warm-up lines, 51):
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
