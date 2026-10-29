## after-fast-cold: NET=fast CACHE=cold DWELL=10s  (ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version))

### title page (ms from its navigation)
nav: ttfb 84, DOMContentLoaded 178, load 247
marks: first canvas 439 | title ready 2996
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| model | 503 | 17273 | 27851 | 0 | 395 | 5690 |
| texture | 57 | 18600 | 26457 | 0 | 255 | 6378 |
| js | 103 | 2232 | 3061 | 28 | 89 | 4106 |
| world | 2 | 199 | 198 | 0 | 510 | 674 |
| font | 6 | 188 | 186 | 0 | 88 | 203 |
| css | 7 | 69 | 67 | 0 | 89 | 134 |
| audio | 4 | 35 | 34 | 0 | 5673 | 5713 |
| other | 1 | 8 | 8 | 0 | 3286 | 3370 |
| api | 1 | 3 | 2 | 0 | 2671 | 3549 |

frames: 1690, over 50 ms: 6 (1026 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| start | 1 | 54 | 0 | 0 | 0 |
| first canvas | 2 | 214 | 189 | 21 | 1 |
| title ready | 3 | 368 | 454 | 62 | 2 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 43 links, 22 materials; 6 x [SHADOWMAP,PCF]; 16 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 6 x [SHADOWMAP,FOG,PCF]; 15 x []
- title ready: 62 links, 31 materials; 3 x [SHADOWMAP,PCF]; 19 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 3 x [SHADOWMAP,FOG,PCF]; 37 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
programs alive (three's cache), over time: 

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 430 54.3 start sh 0 (0) tex 0 (0) buf 0 (0) 63 http://localhost:3157/_next/static/chunks/c55f74de4777a683.js
- 2625 214.1 first canvas sh 127.6 (1533) tex 20.6 (85) buf 1 (234) 
- 2757 131.9 first canvas sh 61.5 (922) tex 0.8 (4) buf 0 (23) 
- 3189 194.9 title ready sh 145.2 (2031) tex 0.6 (123) buf 1.5 (1318) 
- 3745 368.4 title ready sh 308.3 (6619) tex 14.1 (135) buf 0.3 (305) 372 FrameRequestCallback
- 3821 62.5 title ready sh 0 (0) tex 47 (12) buf 0 (34) 58 FrameRequestCallback

### world page (ms from its navigation)
nav: ttfb 4, DOMContentLoaded 73, load 466
marks: loading screen 89 | loading: undefined 89 | first canvas 1914 | world ready 7460 | arrival: aboard 7460 | arrival: creator 12039 | arrival: clearing 15489 | arrival: crossing 17376 | boat: load 17376 | boat: cross 17591 | boat: dock 41290 | arrival: landing 42658 | boat: land 42658 | arrival: tutorial 43854 | play 48225 | end 108233
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| texture | 44 | 1931 | 20500 | 0 | 61 | 89061 |
| model | 343 | 365 | 18599 | 0 | 157 | 94801 |
| js | 72 | 152 | 1999 | 57 | 36 | 655 |
| audio | 10 | 1950 | 1947 | 0 | 48254 | 90320 |
| world | 2 | 0 | 198 | 2 | 265 | 266 |
| font | 6 | 0 | 186 | 6 | 36 | 59 |
| css | 7 | 19 | 83 | 6 | 36 | 58 |
| other | 50 | 31 | 20 | 12 | 83 | 10657 |
| api | 19 | 8 | 5 | 1 | 75 | 48248 |

frames: 14572, over 50 ms: 25 (4665 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| loading screen | 1 | 146 | 0 | 0 | 0 |
| first canvas | 17 | 1604 | 1006 | 155 | 8 |
| arrival: aboard | 4 | 124 | 53 | 278 | 0 |
| arrival: clearing | 1 | 63 | 39 | 0 | 1 |
| arrival: crossing | 2 | 77 | 12 | 0 | 0 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 251 links, 74 materials; 25 x [SHADOWMAP,PCF]; 119 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 20 x [SHADOWMAP,FOG,PCF]; 19 x []; 68 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
- arrival: aboard: 28 links, 10 materials; 12 x []; 8 x [spotLightMatrix0,directionalShadowMatrix0,directionalLightShadow0,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap0,directionalShadowMap0,directionalLightShadow0,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: EquirectangularToCubeUV, PMREMGGXConvolution, ?, StrcKppShip_mat0(map+double_sided+emissivemap), StrcKppShip_mat1(map+double_sided), CharacterBody(skinning+color+double_sided), CharacterFace(skinning), broom_Handle(color+double_sided), M_CratePost(map+double_sided), M_Net(double_sided)
- arrival: clearing: 4 links, 4 materials; 4 x [SHADOWMAP,PCF]
  drawing: ?(instancing+map+double_sided), ?(map+double_sided), ?(instancing+double_sided), ?(double_sided)
- arrival: crossing: 6 links, 5 materials; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x []
  drawing: MoveTarget(map), broom_Handle(color+double_sided), EquirectangularToCubeUV, PMREMGGXConvolution, InsectHotaru_mat0(instancing+map+double_sided)
programs alive (three's cache), over time: 6475:140 6537:142 6913:243 8334:251 17376:255 17482:257 17805:258 42658:259

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 262 145.8 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 139 http://localhost:3157/_next/static/chunks/5cb1f14b1151f9cd.js
- 1915 55.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 55 MessagePort.onmessage
- 2088 173 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 55 MessagePort.onmessage
- 2359 207.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 208 MessagePort.onmessage
- 2497 82.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 84 MessagePort.onmessage
- 2797 90.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 76 MessagePort.onmessage
- 3067 76.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 3186 97.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 95 Response.arrayBuffer.then
- 3436 83.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 80 MessagePort.onmessage
- 3554 76.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 75 MessagePort.onmessage
- 3742 83.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 79 MessagePort.onmessage
- 3846 62.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 63 MessagePort.onmessage
- 4034 76.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 74 MessagePort.onmessage
- 4131 70.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 69 MessagePort.onmessage
- 4867 722.4 first canvas sh 476.5 (10038) tex 102.8 (521) buf 7.4 (2009) 
- 6472 1604.4 first canvas sh 444.5 (9850) tex 2.2 (50) buf 0.1 (144) 
- 6590 90.7 first canvas sh 0 (0) tex 49 (18) buf 0 (56) 55 FrameRequestCallback
- 6902 243 first canvas sh 85.4 (1071) tex 0.7 (103) buf 0.1 (60) 242 FrameRequestCallback
- 7902 97.2 arrival: aboard sh 53.4 (348) tex 34.3 (14) buf 0.1 (18) 
- 8033 118.6 arrival: aboard sh 0 (0) tex 121.5 (6) buf 0 (0) 122 FrameRequestCallback
- 8166 124 arrival: aboard sh 0 (0) tex 121.6 (6) buf 0 (0) 122 FrameRequestCallback
- 8333 69.5 arrival: aboard sh 0 (0) tex 0.1 (3) buf 0 (0) 75 TimerHandler:setInterval
- 17342 62.5 arrival: clearing sh 39.1 (10648) tex 0 (20) buf 1 (375) 
- 17473 76.1 arrival: crossing sh 0 (11) tex 0 (6) buf 0.1 (53) 76 FrameRequestCallback
- 42653 76.7 arrival: crossing sh 11.7 (1089) tex 0 (10) buf 0.1 (70) 
