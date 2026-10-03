# Classes v2, wave 5: performance in the worst case

The design sheet's acceptance (§1.7): 30 FPS minimum on integrated graphics in the worst case, a full pack fight with an
ult. Measured by `specs/evidence/classes/k5-perf.mjs` (raw rows: `K5-perf-runs.jsonl`).

## How

- **Machine:** Apple Mac mini, M4 (integrated GPU), 16 GB unified memory, Darwin 25.6. Chromium for Testing 147
  (Playwright), headed, ANGLE on Metal, a 1280×800 viewport at device pixel ratio 1, on a display that paces frames at
  about 144 Hz (the median frame is 6.9 ms, so the frame rate tops out near 144).
- **Scene:** the combat demo in the ruins (the outskirts at (2, −16)) at mastery 20, so every skill and the stat direction
  at its top are in play; a pack of 17 hunting you (five foxes, three crabs, three mushrooms, three wisps, three pollen
  sprites) at 30× health; you can't fall. The kit's keys 1–5 on a loop with the left click, the ult at 1 s, and every
  frame's time over 8 s (`requestAnimationFrame`).
- **Tiers:** High (lite mode off, shadow maps on) and Lite (lite mode on: no shadow map, no wind sway, half the combat
  particles, no FX lights). The pixel finish at the members' default (on), bloom off.
- **Which ults:** the heaviest per family by what they put on screen (the simulation's FX events and live units in the
  6 s after F, a 17-enemy fight): Arcane, Army of the Dead (35 units), Cataclysm (58 FX events) and The Joker (the
  heaviest in the Arcane wave's FPS check); Ranger, Thousand Arrows (about 460 FX events, the most of any ult) and
  Russian Roulette (the mushroom cloud); Warden, Spirit Awakening (78 events, three spirits) and Shadow Garden (every
  beast); Vanguard, Death Lotus (88 events and the ink world) and Titan (the 2.5× body and its shockwaves).
- **Load:** each run samples the machine before, halfway and after: the 1-minute load average, swap used, memory and
  the top processes by CPU (in the raw rows; this pass misread names with spaces, the browser's helpers, so the script
  now reads `ps`). Each run first waits (up to 5 min) while another agent holds the heavy lock (tsc, the full test
  suite, long batches).

## Results

One run each, 2026-10-03 13:33–13:43 EDT, 8 s of frames a run (900–1,150 frames).

| Kit (ult) | Tier | FPS | p50 ms | p95 ms | p99 ms | Worst ms | Frames over 33 ms | Slowest 1 s | Load (1 min) before / during / after | Swap used |
|---|---|---|---|---|---|---|---|---|---|---|
| Illusionist (The Joker) | High | 115.4 | 7 | 13.9 | 15.1 | 465.4 | 4 of 923 | 48.3 FPS | 6.19 / 5.64 / 5.83 | 6824.62M |
| Necromancer (Army of the Dead) | High | 133.5 | 7 | 13.7 | 14.3 | 34.8 | 1 of 1068 | 129 FPS | 5.83 / 7.01 / 6.77 | 6824.62M |
| Elementalist (Cataclysm) | High | 125.7 | 7 | 13.9 | 14.3 | 347.3 | 1 of 1006 | 86.4 FPS | 6.77 / 6.39 / 6.28 | 6824.62M |
| Marksman (Thousand Arrows) | High | 128.5 | 7 | 13.9 | 15.3 | 132.1 | 2 of 1029 | 114 FPS | 6.28 / 6.33 / 6.47 | 6824.62M |
| Gunslinger (Russian Roulette) | High | 139.2 | 6.9 | 8.6 | 13.9 | 132.9 | 1 of 1114 | 121 FPS | 6.47 / 8.93 / 8.46 | 7291.88M |
| Shaman (Spirit Awakening) | High | 120.5 | 7 | 14 | 15.6 | 159.7 | 2 of 964 | 106.3 FPS | 8.46 / 9.08 / 8.92 | 7259.88M |
| Summoner (Shadow Garden) | High | 112.9 | 7 | 13.9 | 19.6 | 625.1 | 5 of 903 | 62.9 FPS | 8.92 / 9.53 / 9.57 | 7259.88M |
| Assassin (Death Lotus) | High | 131 | 6.9 | 13.5 | 14.2 | 151.8 | 3 of 1048 | 104 FPS | 9.57 / 8.55 / 8.35 | 7259.88M |
| Juggernaut (Titan) | High | 127 | 6.9 | 13 | 15.2 | 166.6 | 5 of 1017 | 86 FPS | 8.35 / 7.74 / 7.2 | 7259.88M |
| Illusionist (The Joker) | Lite | 137.6 | 6.9 | 8.6 | 8.7 | 118.5 | 3 of 1101 | 111.2 FPS | 7.2 / 6.67 / 6.86 | 7259.88M |
| Necromancer (Army of the Dead) | Lite | 143.2 | 6.9 | 8.6 | 8.7 | 27.8 | 0 of 1146 | 138 FPS | 6.86 / 6.18 / 6.17 | 7251.88M |
| Elementalist (Cataclysm) | Lite | 140.5 | 6.9 | 8.6 | 8.7 | 166.5 | 1 of 1124 | 116 FPS | 6.17 / 5.93 / 6.66 | 7019.88M |
| Marksman (Thousand Arrows) | Lite | 138.2 | 6.9 | 8.6 | 8.7 | 228.6 | 2 of 1106 | 111.2 FPS | 6.66 / 10.61 / 9.84 | 7447.12M |
| Gunslinger (Russian Roulette) | Lite | 143.7 | 6.9 | 8.6 | 8.7 | 20.4 | 0 of 1150 | 142 FPS | 9.84 / 9.46 / 9.42 | 7447.12M |
| Shaman (Spirit Awakening) | Lite | 143.2 | 6.9 | 8.6 | 8.7 | 22.4 | 0 of 1146 | 138 FPS | 9.42 / 8.8 / 8.41 | 7447.12M |
| Summoner (Shadow Garden) | Lite | 134.2 | 6.9 | 8.6 | 8.7 | 319.4 | 2 of 1074 | 74.5 FPS | 8.41 / 7.07 / 7.15 | 7439.12M |
| Assassin (Death Lotus) | Lite | 143.1 | 6.9 | 8.6 | 8.7 | 41.7 | 1 of 1145 | 137.2 FPS | 7.15 / 6.07 / 5.75 | 7335.06M |
| Juggernaut (Titan) | Lite | 143.8 | 6.9 | 8.6 | 8.7 | 13.9 | 0 of 1151 | 143 FPS | 5.75 / 5.62 / 5.49 | 7335.06M |

## Below 30 FPS on Lite

**Nothing, on average or in any second.** The means are 113–144 FPS; the slowest 1-second window is 48 FPS on High and
74.5 on Lite; the 99th-percentile frame is under 20 ms on High and 8.7 ms on Lite. What does dip under 30 FPS is single
frames: 1–5 hitches a run of 100–625 ms, the longest on Shadow Garden, The Joker, Cataclysm and Thousand Arrows.

The hitches, worst first (one frame each; the count is frames over 33 ms in the run):

| Ult | High | Lite |
|---|---|---|
| Shadow Garden | 625 ms (5) | 319 ms (2) |
| The Joker | 465 ms (4) | 119 ms (3) |
| Cataclysm | 347 ms (1) | 167 ms (1) |
| Thousand Arrows | 132 ms (2) | 229 ms (2) |
| Titan | 167 ms (5) | 14 ms (0) |
| Spirit Awakening | 160 ms (2) | 22 ms (0) |
| Death Lotus | 152 ms (3) | 42 ms (1) |
| Russian Roulette | 133 ms (1) | 20 ms (0) |
| Army of the Dead | 35 ms (1) | 28 ms (0) |

**The likely cause is first use**, not load: every run is a fresh page, so the first time an ult's effects, materials or
models appear in the session they compile and upload (Shadow Garden raises every beast's model at once, The Joker
brings its mirror material, Cataclysm its storm, Thousand Arrows its burning ground). Lite's hitches are shorter or gone
where its effects are fewer (no shadow map to recompile for, half the particles). The test that would settle it fires
the ult twice in one page and compares the two casts' frames: it's written (`TWICE=1` in k5-perf.mjs) but parked (below).

## How far to trust these numbers

- **Not repeated yet.** The run whose load spiked (Thousand Arrows on Lite: the load average went 6.7 → 10.6 halfway)
  and the two-casts test were queued for a second pass; the coordinator paused all browser work at 14:15 (David
  watching a show), so they wait for the pause to lift. The first pass's numbers stand as measured.
- **The machine was busy and short of memory the whole time:** a 1-minute load average of 5.5–10.6, 15 GB of 16 used
  with about 7 GB swapped and 4.7 GB compressed, a Roblox player at 60–130% CPU, `kernel_task` at 27–64% (memory
  compression), other agents' browsers and builds; two runs waited out another agent's heavy batch first. So the means
  are floors, and the hitches are likely longer than on a calm machine (a stall that has to page memory back in).
- **The display's 144 Hz pacing caps the means.** Read the p95/p99 and the slowest second for headroom: on High, about
  one frame in twenty takes two refreshes (p95 13.5–14 ms); on Lite nearly none (8.6 ms).
- **The M4 is not the integrated graphics §1.7 had in mind.** It is far stronger than the Intel UHD/Iris laptops many
  members will bring. These numbers say the worst case fits easily on a strong integrated GPU; they don't prove 30 FPS
  on a 2019 laptop. Proposal 4 below.
- **Repeatable:** the same scene, seeds and camera every run; one fresh page a run (so every run pays its first-use costs).

## The simulation's own cost

The combat simulation (`stepClass` + `stepCombat`, node, this machine, mastery 20, the same 17-enemy pack, the ult and
the 6 s after it): 5–26 µs a frame on average, 99th percentile at most 176 µs, the worst single frame 0.5 ms (the
Summoner). It doesn't register next to rendering.

## Proposals (not done: measure first, optimise after David's launch call)

1. **Warm the ult's first use at the ruins gate.** Compile the kit's FX materials and upload its ult's models and
   textures while the gate fades in (`renderer.compile` on a hidden scene holding them), so the first cast in a session
   doesn't stall for 100–600 ms. Confirm with the two-casts test first.
2. **Keep Lite's halving as it is.** On Lite the p99 frame sits at the display's refresh for every ult; nothing needs
   trimming.
3. **Watch High's two-refresh frames.** About 5% of High's frames take two refreshes in these fights (p95 ~14 ms) while
   Lite's don't, so the shadow map is the likely cost; it's still far from 30 FPS here.
4. **Measure on a weak integrated GPU before calling §1.7 met:** a low-end Intel laptop, or this machine with Chrome's
   CPU and GPU throttled, the same script (`PORT=… node specs/evidence/classes/k5-perf.mjs`).
5. **Co-op (multiplayer M3) changes the worst case.** §1.7's budgets are per caster (an ult ≤ 300 particles, ≤ 8 meshes,
   ≤ 2 lights), but the combat particle pool (1,024) and the 40 extra draw calls are per scene: four party members
   casting ults into one pack is four times the effects here, and none of this measures it. Today's runtime is single
   player in ways that matter for performance too: the caster's ult freeze and hitstop stop the encounter tick (on a
   co-op host they would stop everyone's enemies), and every FX event is `caster: "me"` in the local kit's colours.
   Proposal: a per-scene FX budget that sheds remote effects first (§1.6 already shows a remote ult at 50% lines and
   30% shake), and the same script with four casters once M3 lands. specs/classes/launch-cleanup.md §3 has the full
   single-player list.
