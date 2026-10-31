## before-none-cold: NET=none CACHE=cold DWELL=3s

### Title (ms from its navigation)
first paint 112, first contentful paint 112, interactive (title ready) 3481, DOMContentLoaded 73
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title ready (3481 ms) | 1 / 0.01 | 41 / 1.08 | 7 / 0.07 | 199 / 10.60 |  | 11 / 5.11 | 9 / 3.12 |  |  | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 277 / 20.19 |
| Play (6481 ms) | 2 / 0.02 | 103 / 2.16 | 7 / 0.07 | 495 / 16.83 |  | 32 / 15.51 | 25 / 3.18 |  | 4 / 0.03 | 6 / 0.18 | 1 / 0.00 |  | 2 / 0.01 | 677 / 37.99 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms: 3 (172 ms); worst: 65 [61 http://localhost:3322/_next/static/chunks/ee66cc183b861f44.js ee66cc183b861f44.js] | 55 [54 Worker.onmessage a8ae19fb608b2598.js] | 52 []

### Play to walking (ms from Play)
loading screen 56 | canvas 1997 | stage: files - | stage: warm-up - | first island frame 6601 | can move 6747
| before | doc | js | css | glb | ktx2 | png | webp | jpg | audio | font | api | supabase | other | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| loading screen (56 ms) | 1 / 0.00 | 54 / 0.00 | 9 / 0.02 |  |  |  | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 1 / 0.00 | 75 / 0.03 |
| canvas (1997 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 78 / 0.02 |  | 10 / 0.00 | 1 / 0.00 |  |  | 6 / 0.00 | 3 / 0.00 |  | 2 / 0.01 | 219 / 0.24 |
| stage: files | not reached |
| stage: warm-up | not reached |
| first island frame (6601 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 273 / 0.09 |  | 22 / 0.01 | 11 / 0.00 |  |  | 6 / 0.00 | 16 / 0.01 | 9 / 0.00 | 3 / 0.01 | 459 / 0.32 |
| can move (6747 ms) | 39 / 0.03 | 71 / 0.15 | 9 / 0.02 | 273 / 0.09 |  | 22 / 0.01 | 11 / 0.00 |  | 2 / 2.71 | 6 / 0.00 | 16 / 0.01 | 9 / 0.00 | 4 / 0.02 | 462 / 3.04 |
(requests / MB over the wire; requests started before the milestone)
long frames over 50 ms before can move: 13 (1535 ms); worst: 5420+296 [295 FrameRequestCallback b29ba28996376b6a.js] | 2262+216 [215 MessagePort.onmessage b29ba28996376b6a.js] | 2002+200 [193 MessagePort.onmessage 4fa395d360c87cc3.js] | 2986+141 [140 MessagePort.onmessage b29ba28996376b6a.js] | 103+137 [132 http://localhost:3322/_next/static/chunks/1254714f8c6bdbbb.js 1254714f8c6bdbbb.js]
long frames in the 3 s after: 0
WebGL: 259 programs linked; compile 0 ms, link and its waits 30 ms (main thread)
memory once in: JS heap 440 MB; GPU uploads ~327.05 MB textures + 57.06 MB buffers; three: [{"geometries":485,"textures":252,"programs":245}]
API and Supabase requests (26):
- 50-62 /api/admin/me
- 50-69 /api/admin/me
- 51-68 /api/profile
- 2003-2010 /api/economy/wallet
- 2004-2013 /api/collections
- 2005-2015 /api/collections/bag
- 2005-2016 /api/profile
- 2006-2020 /api/identity/me
- 2006-2022 /api/progression/state
- 2007-2008 /api/weather
- 2008-2027 /api/homes
- 2008-2025 /api/economy/inventory
- 2194-2197 /api/combat/progression
- 2194-2199 /api/collections
- 2214-2217 /api/weather
- 2249-2251 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 2249-2251 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 2249-2251 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 3329-3330 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 3444-3444 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 3472-3473 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 4563-4566 /api/crafting/recipes
- 5382-5383 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
- 5792-5793 http://127.0.0.1:9/rest/v1/npc_personas?select=*&active=eq.true&is_permanent=eq.true
- 5807-5808 http://127.0.0.1:9/rest/v1/seasonal_palettes?select=id%2Cslug%2Cdisplay_name%2Cpalette%2Cactive%2Cscheduled_start%2Cscheduled_end%2Ccreated_at&slug=in.%28spring%2Csummer%2Cautumn%2Cwinter%29
- 9413-9414 http://127.0.0.1:9/rest/v1/traditions?select=*&active=eq.true
largest over the wire before can move:
- 1.60 MB /audio/ambient/applicant-ocean-railway.ogg (6658-6664)
- 1.12 MB /audio/ambient/dusk.ogg (6658-6663)
