## before-none-warm: NET=none CACHE=warm DWELL=3s

### Title (ms from its navigation)
first paint 56, first contentful paint 56, interactive (title ready) 2855, DOMContentLoaded 55
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (2855 ms) | 1 / 0.01 | 41 / 0.00 | 7 / 0.00 | 199 / 0.06 |  | 10 / 0.00 | 9 / 0.00 |  |  | 6 / 0.00 | 2 / 0.00 |  | 1 / 0.01 | 276 / 0.08 |
| Play (5855 ms) | 2 / 0.01 | 103 / 0.00 | 7 / 0.00 | 495 / 0.14 |  | 32 / 0.01 | 25 / 0.01 |  | 4 / 0.00 | 6 / 0.00 | 2 / 0.00 |  | 2 / 0.01 | 678 / 0.18 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 4 (528 ms); worst: 343 [338 FrameRequestCallback b29ba28996376b6a.js] | 66 [35 http://localhost:3322/_next/static/chunks/ee66cc183b861f44.js ee66cc183b861f44.js] | 63 [62 Worker.onmessage a8ae19fb608b2598.js] | 56 [54 Response.arrayBuffer.then a8ae19fb608b2598.js]

### Play to walking (ms from Play)
loading screen 51 | canvas 1891 | stage: files - | stage: warm-up - | first island frame 5836 | can move 5954
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (51 ms) | 5 / 0.00 | 54 / 0.00 | 9 / 0.00 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 79 / 0.00 |
| canvas (1891 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 78 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 219 / 0.06 |
| stage: files | not reached |
| stage: warm-up | not reached |
| first island frame (5836 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 273 / 0.08 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 16 / 0.01 | 9 / 0.00 | 3 / 0.01 | 460 / 0.13 |
| can move (5954 ms) | 39 / 0.03 | 71 / 0.00 | 9 / 0.00 | 273 / 0.08 |  | 23 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 16 / 0.01 | 9 / 0.00 | 4 / 0.01 | 461 / 0.14 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 11 (1119 ms); worst: 4699+251 [250 FrameRequestCallback b29ba28996376b6a.js] | 1976+206 [204 MessagePort.onmessage b29ba28996376b6a.js] | 89+107 [101 http://localhost:3322/_next/static/chunks/c3805d6ee339bbc4.js c3805d6ee339bbc4.js] | 3203+91 [89 MessagePort.onmessage b29ba28996376b6a.js] | 2253+87 [85 MessagePort.onmessage b29ba28996376b6a.js]
long frames in the 3 s after: 0
WebGL: 257 programs linked; compile 0 ms, link and its waits 131 ms (main thread)
memory once in: JS heap 838 MB; GPU uploads ~324.28 MB textures + 57.05 MB buffers; three: [{"geometries":484,"textures":253,"programs":245}]
API and Supabase requests (25):
- 39-43 /api/admin/me
- 40-47 /api/admin/me
- 40-45 /api/profile
- 1897-1900 /api/economy/wallet
- 1898-1901 /api/collections
- 1898-1902 /api/collections/bag
- 1899-1903 /api/profile
- 1899-1904 /api/identity/me
- 1900-1906 /api/progression/state
- 1900-1901 /api/weather
- 1901-1905 /api/homes
- 1902-1908 /api/economy/inventory
- 1906-1910 /api/combat/progression
- 1906-1911 /api/collections
- 1925-1928 /api/weather
- 1955-1955 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 1955-1955 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 1955-1956 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3141-3142 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3193-3193 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3300-3300 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4028-4034 /api/crafting/recipes
- 5176-5176 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5204-5205 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5328-5329 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
largest over the wire before can move:

