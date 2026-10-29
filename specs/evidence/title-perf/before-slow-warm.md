## before-slow-warm: NET=slow CACHE=warm DWELL=10s  (ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version))

### title page (ms from its navigation)
nav: ttfb 11, DOMContentLoaded 91, load 91
marks: first canvas 327 | title ready 2635
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| model | 503 | 329 | 27851 | 0 | 121 | 8725 |
| texture | 57 | 1340 | 21597 | 0 | 96 | 9718 |
| js | 103 | 43 | 3061 | 100 | 74 | 4584 |
| world | 2 | 0 | 198 | 2 | 366 | 368 |
| font | 6 | 0 | 186 | 6 | 73 | 86 |
| css | 7 | 0 | 67 | 7 | 74 | 74 |
| audio | 4 | 35 | 34 | 0 | 8723 | 8829 |
| other | 1 | 8 | 8 | 0 | 2652 | 3811 |
| api | 2 | 0 | 2 | 2 | 2273 | 3145 |

frames: 641, over 50 ms: 13 (1381 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| first canvas | 3 | 180 | 228 | 49 | 2 |
| title ready | 10 | 479 | 408 | 15 | 1 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 59 links, 29 materials; 7 x [SHADOWMAP,PCF]; 30 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 7 x [SHADOWMAP,FOG,PCF]; 15 x []
- title ready: 46 links, 29 materials; 5 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,PCF]; 37 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point61,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,FOG,PCF]
programs alive (three's cache), over time: 

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 2238 180.2 first canvas sh 76.1 (1533) tex 48 (94) buf 0.8 (234) 
- 2342 104.2 first canvas sh 47.5 (922) tex 0.9 (4) buf 0 (23) 
- 2627 125.4 first canvas sh 103.9 (1615) tex 0.1 (72) buf 0.9 (423) 
- 4488 479.3 title ready sh 408.2 (21595) tex 14.5 (135) buf 0.3 (305) 483 FrameRequestCallback
- 4820 54.2 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 4967 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 7 FrameRequestCallback
- 6912 55.6 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (36) 7 FrameRequestCallback
- 7307 54.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 
- 8038 56.8 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 7 FrameRequestCallback
- 8815 54.8 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 10128 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 10559 50.1 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 12170 55 title ready sh 0 (0) tex 0 (1) buf 0 (34) 

### world page (ms from its navigation)
nav: ttfb 7, DOMContentLoaded 306, load 341
marks: loading screen 354 | loading: undefined 354 | first canvas 2159 | world ready 9111 | arrival: aboard 9111 | arrival: creator 13755 | arrival: clearing 16756 | arrival: crossing 18709 | boat: load 18709 | boat: cross 18911 | boat: dock 42611 | arrival: landing 43996 | boat: land 43996 | arrival: tutorial 45171 | play 49535 | end 109531
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| texture | 44 | 1928 | 20500 | 1 | 310 | 88923 |
| model | 342 | 326 | 18594 | 0 | 422 | 93073 |
| audio | 10 | 4223 | 4221 | 0 | 49559 | 77336 |
| js | 72 | 0 | 1999 | 72 | 300 | 2166 |
| world | 2 | 0 | 198 | 2 | 531 | 531 |
| font | 6 | 0 | 186 | 6 | 300 | 307 |
| css | 7 | 0 | 83 | 7 | 300 | 300 |
| other | 50 | 31 | 20 | 12 | 353 | 9701 |
| api | 19 | 8 | 5 | 1 | 342 | 49624 |

frames: 14541, over 50 ms: 34 (5608 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| loading screen | 1 | 131 | 0 | 0 | 0 |
| first canvas | 26 | 1591 | 880 | 182 | 13 |
| arrival: aboard | 3 | 271 | 39 | 291 | 0 |
| arrival: clearing | 1 | 83 | 51 | 0 | 1 |
| arrival: crossing | 3 | 84 | 49 | 0 | 0 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 241 links, 72 materials; 25 x [SHADOWMAP,PCF]; 115 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 20 x [SHADOWMAP,FOG,PCF]; 17 x []; 64 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
- arrival: aboard: 30 links, 10 materials; 14 x []; 8 x [spotLightMatrix0,directionalShadowMatrix0,directionalLightShadow0,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap0,directionalShadowMap0,directionalLightShadow0,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: EquirectangularToCubeUV, PMREMGGXConvolution, ?, StrcKppShip_mat0(map+double_sided+emissivemap), StrcKppShip_mat1(map+double_sided), CharacterBody(skinning+color+double_sided), CharacterFace(skinning), broom_Handle(color+double_sided), M_CratePost(map+double_sided), M_Net(double_sided)
- arrival: clearing: 5 links, 5 materials; 4 x [SHADOWMAP,PCF]; 1 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: ?(instancing+map+double_sided), ?(map+double_sided), ?(instancing+double_sided), ?(double_sided), ?(skinning)
- arrival: crossing: 8 links, 7 materials; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 3 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x []; 1 x [SHADOWMAP,PCF]
  drawing: MoveTarget(map), ?(skinning), broom_Handle(color+double_sided), EquirectangularToCubeUV, PMREMGGXConvolution, InsectHotaru_mat0(instancing+map+double_sided), ?(map)
- play: 4 links, 2 materials; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: P_Paint(color), M_Wings(map+color)
programs alive (three's cache), over time: 8579:140 8695:142 9002:235 9155:233 10034:241 18709:244 18808:247 19115:248 43996:250 49578:246 56718:250

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 525 131.3 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 132 http://localhost:3157/_next/static/chunks/786153b8c9df2ab6.js
- 2164 62.6 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 48 Worker.onmessage
- 2463 215.7 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 211 MessagePort.onmessage
- 2616 139.7 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 141 MessagePort.onmessage
- 2776 160 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 141 MessagePort.onmessage
- 2984 138.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 140 MessagePort.onmessage
- 3116 76.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 69 MessagePort.onmessage
- 3248 69.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 68 MessagePort.onmessage
- 3420 75.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 3589 69.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 69 MessagePort.onmessage
- 3811 139.1 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 140 MessagePort.onmessage
- 3991 76.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 74 MessagePort.onmessage
- 4158 69.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 67 MessagePort.onmessage
- 4359 83.9 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 76 MessagePort.onmessage
- 4512 69.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 65 MessagePort.onmessage
- 5103 118.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 121 Response.arrayBuffer.then
- 5533 76.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 5651 90.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 87 MessagePort.onmessage
- 5789 68 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 71 MessagePort.onmessage
- 5887 69.6 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 71 MessagePort.onmessage
- 6033 77.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 77 MessagePort.onmessage
- 6151 70.7 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 68 MessagePort.onmessage
- 6256 69.5 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 74 MessagePort.onmessage
- 6985 715.8 first canvas sh 427.9 (10038) tex 128.5 (524) buf 13.1 (1992) 
- 8575 1590.6 first canvas sh 353.1 (9850) tex 2.6 (50) buf 0 (144) 
- 8693 90 first canvas sh 0 (0) tex 49.4 (18) buf 0 (56) 56 FrameRequestCallback
- 8999 250.1 first canvas sh 99.3 (1078) tex 1.2 (100) buf 0.1 (56) 246 FrameRequestCallback
- 9388 76.4 arrival: aboard sh 39.3 (348) tex 26.9 (14) buf 0.1 (18) 
- 9693 270.7 arrival: aboard sh 0 (0) tex 263.9 (9) buf 0 (0) 264 FrameRequestCallback
- 10034 90.3 arrival: aboard sh 0 (0) tex 0 (3) buf 0 (0) 93 TimerHandler:setInterval
- 18647 83.3 arrival: clearing sh 51.2 (10834) tex 0.1 (20) buf 1.2 (368) 
- 18709 62.5 arrival: crossing sh 29.7 (249) tex 0.1 (18) buf 0 (79) 
- 18800 76.7 arrival: crossing sh 0 (15) tex 0 (6) buf 0 (49) 73 FrameRequestCallback
- 43985 83.7 arrival: crossing sh 19.5 (1120) tex 0 (10) buf 0 (71) 
