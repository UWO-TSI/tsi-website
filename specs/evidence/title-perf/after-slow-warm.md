## after-slow-warm: NET=slow CACHE=warm DWELL=10s  (ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version))

### title page (ms from its navigation)
nav: ttfb 9, DOMContentLoaded 93, load 93
marks: first canvas 328 | title ready 2635
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| model | 503 | 301 | 27851 | 0 | 120 | 8473 |
| texture | 57 | 1409 | 21665 | 0 | 97 | 9512 |
| js | 103 | 43 | 3061 | 100 | 74 | 4430 |
| world | 2 | 0 | 198 | 2 | 366 | 367 |
| font | 6 | 0 | 186 | 6 | 74 | 84 |
| css | 7 | 0 | 67 | 7 | 74 | 74 |
| audio | 4 | 35 | 34 | 0 | 8471 | 8576 |
| other | 1 | 8 | 8 | 0 | 2650 | 3808 |
| api | 2 | 0 | 2 | 2 | 2280 | 3052 |

frames: 1663, over 50 ms: 4 (751 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| first canvas | 3 | 181 | 224 | 44 | 1 |
| title ready | 1 | 348 | 289 | 14 | 0 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 59 links, 29 materials; 7 x [SHADOWMAP,PCF]; 30 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 7 x [SHADOWMAP,FOG,PCF]; 15 x []
- title ready: 46 links, 29 materials; 5 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,PCF]; 37 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,FOG,PCF]
programs alive (three's cache), over time: 

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 2250 180.5 first canvas sh 75.7 (1533) tex 43.4 (94) buf 0.6 (234) 
- 2354 104.4 first canvas sh 47.7 (922) tex 0.3 (4) buf 0 (23) 
- 2625 118.1 first canvas sh 100.1 (1615) tex 0.6 (72) buf 0.5 (423) 
- 4354 347.7 title ready sh 288.7 (6619) tex 13.5 (135) buf 0.3 (305) 347 FrameRequestCallback

### world page (ms from its navigation)
nav: ttfb 2, DOMContentLoaded 89, load 105
marks: loading screen 140 | loading: undefined 140 | first canvas 1860 | world ready 8855 | arrival: aboard 8855 | arrival: creator 13438 | arrival: clearing 16688 | arrival: crossing 18552 | boat: load 18552 | boat: cross 18745 | boat: dock 42491 | arrival: landing 43856 | boat: land 43856 | arrival: tutorial 45048 | play 49382 | end 109386
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| texture | 44 | 1928 | 20500 | 1 | 91 | 95130 |
| model | 344 | 326 | 18632 | 0 | 172 | 96260 |
| audio | 12 | 4227 | 4223 | 0 | 49391 | 83191 |
| js | 72 | 0 | 1999 | 72 | 85 | 1932 |
| world | 2 | 0 | 198 | 2 | 279 | 280 |
| font | 6 | 0 | 186 | 6 | 85 | 89 |
| css | 7 | 0 | 83 | 7 | 85 | 85 |
| other | 50 | 31 | 20 | 12 | 112 | 9376 |
| api | 19 | 8 | 5 | 1 | 106 | 49464 |

frames: 14558, over 50 ms: 33 (5447 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| loading screen | 2 | 118 | 0 | 0 | 0 |
| first canvas | 24 | 1577 | 877 | 156 | 8 |
| arrival: aboard | 4 | 126 | 37 | 260 | 0 |
| arrival: clearing | 1 | 56 | 26 | 0 | 1 |
| arrival: crossing | 2 | 84 | 10 | 0 | 0 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 251 links, 74 materials; 25 x [SHADOWMAP,PCF]; 119 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 20 x [SHADOWMAP,FOG,PCF]; 19 x []; 68 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
- arrival: aboard: 28 links, 10 materials; 12 x []; 8 x [spotLightMatrix0,directionalShadowMatrix0,directionalLightShadow0,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap0,directionalShadowMap0,directionalLightShadow0,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: ?, StrcKppShip_mat0(map+double_sided+emissivemap), StrcKppShip_mat1(map+double_sided), EquirectangularToCubeUV, PMREMGGXConvolution, CharacterBody(skinning+color+double_sided), CharacterFace(skinning), broom_Handle(color+double_sided), M_CratePost(map+double_sided), M_Net(double_sided)
- arrival: clearing: 4 links, 4 materials; 4 x [SHADOWMAP,PCF]
  drawing: ?(instancing+map+double_sided), ?(map+double_sided), ?(instancing+double_sided), ?(double_sided)
- arrival: crossing: 6 links, 5 materials; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x []
  drawing: MoveTarget(map), broom_Handle(color+double_sided), EquirectangularToCubeUV, PMREMGGXConvolution, InsectHotaru_mat0(instancing+map+double_sided)
- play: 2 links, 2 materials; 2 x []
  drawing: EquirectangularToCubeUV, PMREMGGXConvolution
programs alive (three's cache), over time: 8287:140 8403:142 8737:243 9745:251 18552:255 18658:257 18998:258 43856:259

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 269 118.1 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 119 http://localhost:3157/_next/static/chunks/3d5755dcc04d1de7.js
- 1859 55.4 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 46 Worker.onmessage
- 2158 214.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 205 MessagePort.onmessage
- 2318 152.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 152 MessagePort.onmessage
- 2478 159.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 152 MessagePort.onmessage
- 2672 139.6 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 140 MessagePort.onmessage
- 2922 140.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 141 MessagePort.onmessage
- 3082 76.6 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 3263 70.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 68 MessagePort.onmessage
- 3436 76.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 78 MessagePort.onmessage
- 3617 69.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 67 MessagePort.onmessage
- 3839 145.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 142 MessagePort.onmessage
- 4040 75.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 75 MessagePort.onmessage
- 4193 68.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 66 MessagePort.onmessage
- 4770 96.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 108 Response.arrayBuffer.then
- 5228 76.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 78 MessagePort.onmessage
- 5331 75.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 74 MessagePort.onmessage
- 5471 76.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 75 MessagePort.onmessage
- 5680 145.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 141 MessagePort.onmessage
- 5777 69.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 63 MessagePort.onmessage
- 5923 76.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 6027 69.6 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 71 MessagePort.onmessage
- 6708 667.7 first canvas sh 414.5 (10038) tex 106.6 (527) buf 7.4 (2010) 
- 8284 1576.7 first canvas sh 349.6 (9850) tex 2.2 (50) buf 0.1 (144) 
- 8403 90.2 first canvas sh 0 (0) tex 46.8 (21) buf 0.1 (56) 53 FrameRequestCallback
- 8722 256.9 first canvas sh 112.6 (1110) tex 0.6 (100) buf 0 (56) 262 FrameRequestCallback
- 9083 76.8 arrival: aboard sh 36.6 (348) tex 27 (14) buf 0 (18) 
- 9193 104.1 arrival: aboard sh 0 (0) tex 107.5 (6) buf 0 (0) 108 FrameRequestCallback
- 9326 125.5 arrival: aboard sh 0 (0) tex 125.1 (6) buf 0 (0) 125 FrameRequestCallback
- 9743 83.4 arrival: aboard sh 0 (0) tex 0 (3) buf 0 (0) 88 TimerHandler:setInterval
- 18516 56.4 arrival: clearing sh 26.1 (10648) tex 0 (20) buf 0.9 (368) 
- 18648 76.1 arrival: crossing sh 0 (11) tex 0 (6) buf 0 (49) 76 FrameRequestCallback
- 43840 83.6 arrival: crossing sh 9.9 (1089) tex 0 (10) buf 0.1 (69) 
