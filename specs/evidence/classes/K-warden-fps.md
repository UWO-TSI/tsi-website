# Classes v2, the Warden wave: FPS in its busiest scenes

Measured by `k-warden-shots.mjs fps` (headed Chromium, Apple M4 Mac mini, 1280×940, High graphics with shadows, the ruins, a 12-enemy pack held in place; frames counted over 3 s while the scene runs). The machine was busy (load average 14.4: other agents' tests and a game running), so read the rows against the baseline row, not as absolute numbers. Screens: K-warden-fps.webp.

| Kit | Scene | FPS |
|---|---|---|
| summoner | baseline: a 12-enemy pack | 67 |
| summoner | four beasts, then Shadow Garden | 68 |
| summoner | the rabbit flood kept up (144 rabbits) | 54 |
| shaman | three linked totems, Spirit Awakening | 59 |
| druid | World Tree, Wild Ground, a thorn wall | 69 |
| priest | Sanctify, Divine Descent's pillar | 79 |

Two earlier runs the same night, same scenes: baseline 94 and 73 FPS; Shadow Garden 75 and 77; the rabbit flood 79 and 65; Spirit Awakening 78 and 81; World Tree 80 and 75; Divine Descent 75 and 78. Run to run, the machine's load moves the numbers more than the scenes do. The rabbit flood costs the most: about 13 FPS under its run's baseline, and it lasts 1.6 s a press.

The simulation's own cost per frame (vitest, `stepClass` + `stepCombat` at 60 Hz, 12 foxes): nothing out 9 µs; four beasts and Shadow Garden 20 µs; three rabbit floods 10 µs (the flood is one instanced effect, not entities); three linked totems and Spirit Awakening 24 µs; World Tree, Wild Ground and a thorn wall 18 µs.
