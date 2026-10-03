# Classes v2, the Warden wave: FPS in its busiest scenes

Measured by `k-warden-shots.mjs fps` (headed Chromium, Apple M4 Mac mini, 1280×940, High graphics with shadows, the ruins, a 12-enemy pack held in place; frames counted over 3 s while the scene runs). The machine was busy (load average 13.4: other agents' tests and a game running), so read the rows against the baseline row, not as absolute numbers. Screens: K-warden-fps.webp.

| Kit | Scene | FPS |
|---|---|---|
| summoner | baseline: a 12-enemy pack | 90 |
| summoner | four beasts, then Shadow Garden | 82 |
| summoner | the rabbit flood kept up (144 rabbits) | 90 |
| shaman | three linked totems, Spirit Awakening | 80 |
| druid | World Tree, Wild Ground, a thorn wall | 81 |
| priest | Sanctify, Divine Descent's pillar | 89 |

This run had the browser lock to itself (load average about 10). The busiest Warden scenes sit within 10 FPS of the baseline; the rabbit flood costs nothing measurable now. An earlier run overlapped another agent's filming and read 50–79 FPS.

The simulation's own cost per frame (vitest, `stepClass` + `stepCombat` at 60 Hz, 12 foxes): nothing out 9 µs; four beasts and Shadow Garden 20 µs; three rabbit floods 10 µs (the flood is one instanced effect, not entities); three linked totems and Spirit Awakening 24 µs; World Tree, Wild Ground and a thorn wall 18 µs.
