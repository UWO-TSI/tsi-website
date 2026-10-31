## rc0-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 104, first contentful paint 104, interactive (title ready) 3224, DOMContentLoaded 60
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (3224 ms) | 1 / 0.01 | 40 / 1.08 | 8 / 0.09 | 202 / 10.60 |  | 12 / 6.97 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 281 / 22.06 |
| Play (6224 ms) | 2 / 0.02 | 105 / 2.23 | 8 / 0.09 | 495 / 17.02 |  | 33 / 17.37 | 25 / 3.18 |  | 4 / 0.03 | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 681 / 40.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 2 (119 ms); worst: 66 [61 http://localhost:3322/_next/static/chunks/5ccf17ecfcbdfff9.js 5ccf17ecfcbdfff9.js] | 53 [52 Worker.onmessage 862dff5829ce9945.js]

### Play to walking (ms from Play)
loading screen 56 | canvas 1987 | stage: files 2450 | stage: warm-up 1987 | first island frame 6042 | can move 6163
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (56 ms) | 5 / 0.00 | 57 / 0.00 | 8 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 81 / 0.03 |
| canvas (1987 ms) | 39 / 0.03 | 80 / 0.23 | 8 / 0.02 | 80 / 0.03 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.33 |
| stage: files (2450 ms) | 39 / 0.03 | 80 / 0.23 | 8 / 0.02 | 97 / 0.07 |  | 13 / 0.00 | 10 / 0.00 |  |  | 6 / 0.00 | 21 / 0.01 | 3 / 0.00 | 2 / 0.01 | 279 / 0.38 |
| stage: warm-up (1987 ms) | 39 / 0.03 | 80 / 0.23 | 8 / 0.02 | 80 / 0.03 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 229 / 0.33 |
| first island frame (6042 ms) | 39 / 0.03 | 80 / 0.23 | 8 / 0.02 | 266 / 0.12 |  | 24 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 3 / 0.01 | 469 / 0.44 |
| can move (6163 ms) | 39 / 0.03 | 80 / 0.23 | 8 / 0.02 | 266 / 0.12 |  | 24 / 0.01 | 11 / 0.00 |  | 1 / 2.23 | 6 / 0.00 | 23 / 0.01 | 9 / 0.00 | 4 / 0.02 | 471 / 2.67 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 17 (1739 ms); worst: 5659+273 [271 FrameRequestCallback 63397793691123ee.js] | 2216+219 [218 MessagePort.onmessage 63397793691123ee.js] | 1993+163 [157 MessagePort.onmessage 4fa395d360c87cc3.js] | 94+137 [133 http://localhost:3322/_next/static/chunks/9cf8104cd35d1f5d.js 9cf8104cd35d1f5d.js] | 2510+88 [87 MessagePort.onmessage 63397793691123ee.js]
long frames in the 3 s after: 0
WebGL: 254 programs linked; compile 0 ms, link and its waits 23 ms (main thread)
memory once in: JS heap 714 MB; GPU uploads ~330.63 MB textures + 55.75 MB buffers; three: [{"geometries":491,"textures":258,"programs":246}]
API and Supabase requests (32):
- 42-53 /api/admin/me
- 43-59 /api/admin/me
- 43-56 /api/profile
- 1995-2000 /api/economy/wallet
- 1995-2006 /api/collections
- 1996-2008 /api/progression/state
- 1997-2009 /api/collections/bag
- 1997-2013 /api/economy/wallet
- 1997-2018 /api/economy/wallet
- 1998-2019 /api/economy/wallet
- 1998-2011 /api/economy/tackle
- 1999-2012 /api/profile
- 1999-2003 /api/identity/me
- 2000-2000 /api/weather
- 2001-2014 /api/homes
- 2001-2016 /api/npc/friendship
- 2001-2017 /api/economy/inventory
- 2148-2153 /api/world/onboarding
- 2148-2156 /api/combat/progression
- 2149-2157 /api/collections
- 2170-2173 /api/weather
- 2204-2205 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2205-2205 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2205-2205 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3264-3264 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3291-3291 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3398-3399 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4861-4868 /api/crafting/recipes
- 4863-4874 /api/traditions/treat
- 5660-5660 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5943-5944 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5964-5965 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:
- 2.23 MB /audio/ambient/night.ogg (6082-6090)
console (errors and warm-up lines, 27):
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
