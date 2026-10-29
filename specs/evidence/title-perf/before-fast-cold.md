## before-fast-cold: NET=fast CACHE=cold DWELL=10s  (ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version))

### title page (ms from its navigation)
nav: ttfb 96, DOMContentLoaded 207, load 290
marks: first canvas 488 | title ready 3549
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| model | 199 | 10855 | 10797 | 0 | 442 | 3698 |
| texture | 20 | 7889 | 7883 | 0 | 304 | 4428 |
| js | 40 | 1100 | 1088 | 0 | 104 | 415 |
| world | 2 | 199 | 198 | 0 | 563 | 723 |
| font | 6 | 188 | 186 | 0 | 103 | 239 |
| css | 7 | 69 | 67 | 0 | 104 | 148 |
| api | 1 | 3 | 2 | 0 | 2871 | 3695 |

frames: 513, over 50 ms: 143 (8988 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| start | 3 | 57 | 0 | 0 | 0 |
| first canvas | 5 | 257 | 407 | 58 | 4 |
| title ready | 135 | 535 | 483 | 32 | 8 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 64 links, 33 materials; 7 x [SHADOWMAP,PCF]; 35 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 7 x [SHADOWMAP,FOG,PCF]; 15 x []
- title ready: 45 links, 31 materials; 6 x [SHADOWMAP,PCF]; 37 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point61,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x [SHADOWMAP,FOG,PCF]
programs alive (three's cache), over time: 

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 199 55.7 start sh 0 (0) tex 0 (0) buf 0 (0) 
- 262 56.8 start sh 0 (0) tex 0 (0) buf 0 (0) 
- 477 55.1 start sh 0 (0) tex 0 (0) buf 0 (0) 65 http://localhost:3157/_next/static/chunks/c55f74de4777a683.js
- 2818 256.9 first canvas sh 151.7 (1533) tex 27.8 (85) buf 1.2 (234) 
- 2985 167.2 first canvas sh 69.4 (922) tex 8.9 (7) buf 0.2 (23) 
- 3039 54.5 first canvas sh 0 (0) tex 20.5 (6) buf 0 (3) 
- 3171 89.6 first canvas sh 45.6 (450) tex 0 (3) buf 0.5 (330) 57 FrameRequestCallback
- 3532 187.4 first canvas sh 140.5 (1827) tex 0.7 (120) buf 2 (1151) 
- 4249 535.4 title ready sh 441.2 (21595) tex 14.2 (139) buf 0.7 (332) 
- 4310 61.2 title ready sh 41.5 (84) tex 0 (1) buf 0 (34) 56 FrameRequestCallback
- 4463 62.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 22 FrameRequestCallback
- 4520 57.2 title ready sh 0 (0) tex 15.9 (4) buf 0.1 (34) 22 FrameRequestCallback
- 4576 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 7 FrameRequestCallback
- 4630 54 title ready sh 0 (0) tex 0 (1) buf 0.2 (34) 7 FrameRequestCallback
- 4693 63.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 4846 55 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 4908 62.9 title ready sh 0 (0) tex 0 (1) buf 0 (34) 8 FrameRequestCallback
- 4964 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 5068 55 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5123 55.1 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 5179 55.7 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 7 FrameRequestCallback
- 5235 56.3 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5290 54.5 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 6 FrameRequestCallback
- 5345 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 5400 55.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5506 56.3 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5561 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 5617 56 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 5673 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 5727 54 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 5831 54.7 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5888 56.5 title ready sh 0 (0) tex 0 (1) buf 0 (35) 7 FrameRequestCallback
- 5943 55.2 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 5 FrameRequestCallback
- 5999 56.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 6102 55.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 6159 56.8 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 6 FrameRequestCallback
- 6215 55.7 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 6277 62.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 6380 54.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 6437 56.5 title ready sh 0 (0) tex 0.1 (1) buf 0.2 (34) 6 FrameRequestCallback
- 6491 54.7 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 6548 56.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 6604 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 6708 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 7 FrameRequestCallback
- 6762 54 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 6867 56.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 6923 55.9 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 6979 55.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 7034 55.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 7090 56 title ready sh 0 (0) tex 0 (1) buf 0.1 (36) 6 FrameRequestCallback
- 7145 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 7256 62.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 7311 54.1 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 6 FrameRequestCallback
- 7366 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 7423 56.9 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 7534 62.5 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 5 FrameRequestCallback
- 7637 55.1 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 7694 56.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 7749 54.8 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 7805 56.7 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 7909 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 7965 55.4 title ready sh 0 (0) tex 0 (1) buf 0.2 (34) 5 FrameRequestCallback
- 8020 55.1 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 5 FrameRequestCallback
- 8125 55.6 title ready sh 0 (0) tex 0.1 (1) buf 0.2 (34) 6 FrameRequestCallback
- 8180 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 8236 55.8 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 5 FrameRequestCallback
- 8292 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 7 FrameRequestCallback
- 8346 53.9 title ready sh 0 (0) tex 0 (1) buf 0.2 (34) 5 FrameRequestCallback
- 8401 55.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 8458 56.9 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 8513 55 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 8625 64.2 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 8680 54.7 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 8736 56.2 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 5 FrameRequestCallback
- 8840 57 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 8896 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 9006 62.1 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 9061 54.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 9159 56 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 9264 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 9320 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 9422 54.1 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 5 FrameRequestCallback
- 9479 56.9 title ready sh 0 (0) tex 0 (1) buf 0 (34) 7 FrameRequestCallback
- 9582 55 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 9639 56.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 9694 55.6 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 5 FrameRequestCallback
- 9798 54.8 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 9853 55.2 title ready sh 0 (0) tex 0.1 (1) buf 0 (34) 6 FrameRequestCallback
- 9910 56.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 9965 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 10068 54.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 10124 56.1 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 5 FrameRequestCallback
- 10179 55 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 10285 57 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 
- 10339 54.2 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 10395 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 10445 50.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 10500 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 10556 55.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 10659 54.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 10716 57 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 10770 54.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 10825 55.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 10881 55.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 10938 57.2 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 10992 54 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 11048 55.6 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 5 FrameRequestCallback
- 11104 56.7 title ready sh 0 (0) tex 0 (1) buf 0.2 (35) 6 FrameRequestCallback
- 11160 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 11263 54.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 11320 57 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 11423 54.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 11478 55 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 11535 56.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 11638 54 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 7 FrameRequestCallback
- 11694 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 11749 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 11806 56.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 11862 55.7 title ready sh 0 (0) tex 0 (1) buf 0.2 (34) 5 FrameRequestCallback
- 11917 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 11971 54.3 title ready sh 0 (0) tex 0 (1) buf 0 (34) 6 FrameRequestCallback
- 12027 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 12131 55 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 6 FrameRequestCallback
- 12236 56.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 12292 55.8 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 12348 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 12451 55 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 
- 12508 56.3 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 
- 12562 54.2 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 12667 55.1 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 8 FrameRequestCallback
- 12729 62.1 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 7 FrameRequestCallback
- 12792 63.5 title ready sh 0 (0) tex 0 (1) buf 0.2 (34) 7 FrameRequestCallback
- 12848 55.5 title ready sh 0 (0) tex 0 (1) buf 0 (34) 8 FrameRequestCallback
- 12902 54.4 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 6 FrameRequestCallback
- 12958 55.6 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 13015 56.9 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 13125 61.6 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 13180 54.9 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 9 FrameRequestCallback
- 13242 62.6 title ready sh 0 (0) tex 0.1 (1) buf 0.1 (34) 8 FrameRequestCallback
- 13299 56.9 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 5 FrameRequestCallback
- 13355 55.4 title ready sh 0 (0) tex 0 (1) buf 0 (34) 5 FrameRequestCallback
- 13459 55.7 title ready sh 0 (0) tex 0 (1) buf 0 (34) 
- 13515 55.5 title ready sh 0 (0) tex 0 (1) buf 0.1 (34) 

### world page (ms from its navigation)
nav: ttfb 19, DOMContentLoaded 353, load 1274
marks: loading screen 388 | loading: undefined 388 | first canvas 2549 | world ready 8574 | arrival: aboard 8635 | arrival: creator 13215 | arrival: clearing 16665 | arrival: crossing 18625 | boat: load 18625 | boat: cross 18871 | boat: dock 42567 | arrival: landing 43966 | boat: land 43966 | arrival: tutorial 45117 | play 49362 | end 109373
| kind | files | KB over the wire | KB body | from cache | first start | last end |
|---|---|---|---|---|---|---|
| model | 344 | 6546 | 18632 | 0 | 530 | 102537 |
| texture | 42 | 12631 | 12619 | 0 | 338 | 102861 |
| audio | 10 | 3907 | 3904 | 0 | 49379 | 98881 |
| js | 72 | 1241 | 1999 | 25 | 312 | 1274 |
| world | 2 | 0 | 198 | 2 | 655 | 657 |
| font | 6 | 0 | 186 | 6 | 311 | 335 |
| css | 7 | 19 | 83 | 6 | 311 | 334 |
| other | 50 | 31 | 20 | 12 | 371 | 12175 |
| api | 19 | 8 | 5 | 1 | 361 | 49398 |

frames: 10665, over 50 ms: 29 (5578 ms in all)
| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |
|---|---|---|---|---|---|
| loading screen | 3 | 139 | 0 | 0 | 0 |
| first canvas | 18 | 1744 | 1189 | 194 | 8 |
| arrival: aboard | 4 | 139 | 48 | 300 | 0 |
| arrival: clearing | 2 | 96 | 112 | 0 | 1 |
| arrival: crossing | 2 | 104 | 17 | 0 | 0 |

programs linked, by phase (count, distinct materials, the light and shadow state they were built for):
- first canvas: 239 links, 72 materials; 25 x [SHADOWMAP,PCF]; 115 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 20 x [SHADOWMAP,FOG,PCF]; 15 x []; 64 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
- world ready: 4 links, 2 materials; 4 x []
  drawing: EquirectangularToCubeUV, PMREMGGXConvolution
- arrival: aboard: 30 links, 10 materials; 14 x []; 8 x [spotLightMatrix0,directionalShadowMatrix0,directionalLightShadow0,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point0,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap0,directionalShadowMap0,directionalLightShadow0,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 4 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: EquirectangularToCubeUV, PMREMGGXConvolution, ?, StrcKppShip_mat0(map+double_sided+emissivemap), StrcKppShip_mat1(map+double_sided), CharacterBody(skinning+color+double_sided), CharacterFace(skinning), broom_Handle(color+double_sided), M_CratePost(map+double_sided), M_Net(double_sided)
- arrival: clearing: 5 links, 5 materials; 4 x [SHADOWMAP,PCF]; 1 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: ?(instancing+map+double_sided), ?(map+double_sided), ?(instancing+double_sided), ?(double_sided), ?(skinning)
- arrival: crossing: 8 links, 7 materials; 2 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional3,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 3 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]; 2 x []; 1 x [SHADOWMAP,PCF]
  drawing: MoveTarget(map), ?(skinning), broom_Handle(color+double_sided), EquirectangularToCubeUV, PMREMGGXConvolution, InsectHotaru_mat0(instancing+map+double_sided), ?(map)
- play: 1 links, 1 materials; 1 x [SHADOWMAP,FOG,PCF,spotLightMatrix0,directionalShadowMatrix2,directionalLightShadow2,spotLightShadow0,pointShadowMatrix0,pointLightShadow0,directional2,point9,spot0,rectArea0,hemisphere1,spotLightMap0,directionalShadowMap2,directionalShadowMap2,directionalLightShadow2,spotShadowMap0,spotShadowMap0,spotLightShadow0,pointShadowMap0,pointShadowMap0,pointLightShadow0]
  drawing: knife_Handle(color+double_sided)
programs alive (three's cache), over time: 7935:140 8101:142 8484:235 8669:233 9944:241 18625:244 18730:247 19001:248 43966:250 49427:246 103716:247

long frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts
- 646 138.6 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 143 http://localhost:3157/_next/static/chunks/1a60d380abea1e18.js
- 730 62.5 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 47 Response.arrayBuffer.then
- 2487 62.6 loading screen sh 0 (0) tex 0 (0) buf 0 (0) 62 Worker.onmessage
- 2549 62.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 62 Worker.onmessage
- 2807 257.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 61 MessagePort.onmessage
- 3098 229.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 230 MessagePort.onmessage
- 3258 83.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 79 MessagePort.onmessage
- 3647 98 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 86 MessagePort.onmessage
- 3946 90.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 83 MessagePort.onmessage
- 4217 118.8 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 115 Response.arrayBuffer.then
- 4335 83.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 79 MessagePort.onmessage
- 4592 76.4 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 79 MessagePort.onmessage
- 4717 90.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 93 MessagePort.onmessage
- 4869 76.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 75 MessagePort.onmessage
- 4988 90.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 89 MessagePort.onmessage
- 5217 90.2 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 86 MessagePort.onmessage
- 5328 83.3 first canvas sh 0 (0) tex 0 (0) buf 0 (0) 86 MessagePort.onmessage
- 6189 847.3 first canvas sh 550.3 (10110) tex 120.1 (530) buf 7.8 (2032) 
- 7933 1743.5 first canvas sh 499.1 (9778) tex 3 (47) buf 0.4 (126) 
- 8065 132 first canvas sh 18.1 (62) tex 66.5 (24) buf 0.1 (60) 
- 8468 284.8 first canvas sh 121.8 (1025) tex 3.9 (100) buf 0.2 (56) 287 FrameRequestCallback
- 9078 82.2 arrival: aboard sh 47.6 (348) tex 26.6 (14) buf 0.1 (18) 82 FrameRequestCallback
- 9503 126.7 arrival: aboard sh 0 (0) tex 129.3 (6) buf 0 (0) 130 FrameRequestCallback
- 9857 138.9 arrival: aboard sh 0 (0) tex 143.8 (6) buf 0 (0) 144 FrameRequestCallback
- 9940 76.3 arrival: aboard sh 0 (0) tex 0.1 (3) buf 0 (0) 78 TimerHandler:setInterval
- 18525 69.4 arrival: clearing sh 42.4 (10648) tex 0 (20) buf 0.7 (364) 68 FrameRequestCallback
- 18621 96.2 arrival: clearing sh 69.9 (249) tex 0 (18) buf 0.1 (79) 68 FrameRequestCallback
- 18720 83.5 arrival: crossing sh 0 (15) tex 0 (6) buf 0.1 (49) 79 FrameRequestCallback
- 43954 104.1 arrival: crossing sh 16.9 (1120) tex 0 (10) buf 0.1 (74) 
