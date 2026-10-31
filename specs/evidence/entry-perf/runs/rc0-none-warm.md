## rc0-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 56, first contentful paint 56, interactive (title ready) 3115, DOMContentLoaded 37
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (3115 ms) | 1 / 0.01 | 40 / 0.00 | 8 / 0.00 | 202 / 0.06 |  | 12 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 282 / 0.08 |
| Play (6115 ms) | 2 / 0.01 | 105 / 0.00 | 8 / 0.00 | 495 / 0.14 |  | 33 / 0.01 | 25 / 0.01 |  | 4 / 0.00 | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 682 / 0.18 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (121 ms); worst: 66 [31 LINK.onload turbopack-4da6ec9caf62642a.js] | 55 [51 Worker.onmessage 862dff5829ce9945.js]

### Play to walking (ms from Play)
loading screen 48 | canvas 1938 | stage: files 2265 | stage: warm-up 1938 | first island frame 5360 | can move 5489
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (48 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 81 / 0.00 |
| canvas (1938 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 80 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.06 |
| stage: files (2265 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 96 / 0.03 |  | 13 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 278 / 0.08 |
| stage: warm-up (1938 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 80 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.06 |
| first island frame (5360 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.08 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 467 / 0.13 |
| can move (5489 ms) | 39 / 0.03 | 80 / 0.00 | 8 / 0.00 | 265 / 0.08 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.01 | 468 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 14 (1447 ms); worst: 5010+259 [258 FrameRequestCallback 63397793691123ee.js] | 2030+221 [220 MessagePort.onmessage 63397793691123ee.js] | 78+147 [137 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2325+86 [84 MessagePort.onmessage 63397793691123ee.js] | 2559+83 [81 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 254 programs linked; compile 0 ms, link and its waits 137 ms (main thread)
memory once in: JS heap 436 MB; GPU uploads ~330.55 MB textures + 55.70 MB buffers; three: [{"geometries":490,"textures":257,"programs":246}]
API and Supabase requests (32):
- 37-41 /api/admin/me
- 38-45 /api/admin/me
- 38-44 /api/profile
- 1945-1947 /api/economy/wallet
- 1945-1948 /api/collections
- 1946-1949 /api/progression/state
- 1947-1950 /api/collections/bag
- 1947-1952 /api/economy/wallet
- 1948-1957 /api/economy/wallet
- 1948-1959 /api/economy/wallet
- 1948-1950 /api/economy/tackle
- 1949-1951 /api/profile
- 1949-1952 /api/identity/me
- 1950-1950 /api/weather
- 1951-1953 /api/homes
- 1951-1954 /api/npc/friendship
- 1952-1955 /api/economy/inventory
- 1956-1958 /api/world/onboarding
- 1956-1959 /api/combat/progression
- 1957-1960 /api/collections
- 1979-1981 /api/weather
- 2009-2009 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2009-2009 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2009-2009 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3134-3134 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3151-3152 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3172-3172 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4349-4350 /api/crafting/recipes
- 4350-4352 /api/traditions/treat
- 5291-5291 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5304-5305 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5323-5324 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

console (errors and warm-up lines, 54):
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
