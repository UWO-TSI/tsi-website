# Lane: volleyball (beach volleyball minigame)

Worktree `.claude/worktrees/volleyball`, branch `game/volleyball`, cut from origin/main f0be2c5e. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (the design spec, with David's phase 1 review verbatim and round 2's root causes at the top), `specs/design-bible.md` (UI and Models), `specs/references/volleyball/` (camera-and-court.png for the camera only; beach-ball.png is David's ball). CODEMAP sections: Movement, Camera, UI kit, Multiplayer.

## Status

**Round 3 built, waiting for David's review (branch head: see the last commit; merged origin/main de6ff1bb).** Round 2 shipped in v1.2 (main 2e7d7de8; migration 20261030120000_volleyball_casual applied). Round 3 changes no migration and no protocol.

- **Play (root cause of "the timing for balls is off when in the air"):** an airborne press waited for the ball to reach where the hands were at the press, ignoring the jump still moving them. Now a spike or a jump set in the air plans its meeting on both flights (`match.ts meetOf`, the jump's arc and the ball's stepped together, up to 0.42 s), touches then with a little arm stretch, and grades by the press's lead (0.08 s before is perfect; `feel.ts air`). Jump 1.75 u / 0.44 s, fall ×1.3, no apex hang; apex slow-mo 0.62. The jump plays vb_spike_jump posed by the arc (`moves.ts jumpPose`; Character poses a held vb one-shot by `air`). Block: 2 u off the net, 0.85 u wide, 0.5 u over the hand, 0.25 u under the tape.
- **Dive:** Q only (Ctrl does nothing, no dash, no slide dive in the court; `vb_slide_dive` is unused now). 7.6 u/s easing, 0.55 s, 0.8 s down; steers onto a ball within 3.8 u and 75° of your push; the dig is always playable (q ≥ 0.5) with a slow-mo save beat (`feel.ts dive`, `match.ts diveTarget/startDive`).
- **Camera:** back 4.9, right 0.85, up 2.75, ahead 8, look 0.75, FOV 58; height smoothed (sand plus 30% of the jump).
- **Action bar (kit `ActionBar`, rebuilt):** sand Bump/Set/Dive, air Spike/Jump set/Block; bold silhouettes, mouse glyph for clicks (`MouseKey`), air row with a sky edge; the HUD flips the row on the DOM the frame your stance changes (`shownStance`; the old steadying removed). Call and jump work but aren't on the bar.
- **Rings:** a high ball you'd jump for gets a ring riding the ball that closes on the moment to jump, then on the moment to press (gold at the moment); a flat ball keeps the landing circle (`VolleyMatch highBall`).
- **Serve:** meter and curve moved low either side of the bar; meter glow, notches, edge sparks, rays at Max; perfect serve catches fire.
- **Effects:** fire on perfect spikes and serves (flight trail, ignition, landing explosion); block as a wall; bump/set pop rings; squash 45% with a damped wobble; jump and landing rings; stamps with animated glyphs for OUT, NET, TAPE!, Miss, BLOCK!, SAVED!; heat chip under the score (4th touch on, "On fire!" at 6); point rays and a +1 (their point sags); win rays behind the trophy; MINE! speech bubble.
- **Sounds:** every one distinct (fork commit 88e678d8: block slap-thump-oof, spike whip-boom-rip, rubbery bump, fingertip set, serve smack-whoosh, flame layer on perfect, net rattle and twang, whistle on out, brass point sting and win fanfare, synthesised "hey!" call, swish-womp whiff). `vb-slide` deleted, `vb-flame` added. Not listened to by ear.
- **Leaderboard:** kit `Podium` (`components/gui/flat/Podium.tsx`, in /lab/gui) with the top three's characters in one canvas while the sheet is open, places 4 to 6 as quiet rows (`leaderboard.ts boardView`, `nameSeed`); `--ui-silver`, `--ui-bronze` tokens. Fork commit 6ec04778.
- **Benches:** `volley-bench-2` at (-10.5, 94.7) mirrors the first across the net's line; world regenerated (pier-bench yaw restored).
- **Gates (round 3, after the merge):** tsc clean; vitest one full run 3742 passed, 4 skipped, 0 failed; eslint clean on every changed file (one old `<img>` warning in VolleyHud); real-input checks on the island all 27 PASS incl. airborne spike, early spike, jump set, block, clutch dive and the bar's frame-exact swap (`p3/input-results.json`); rally pilot PASS (`p3/rally-results.json`). perf:check SCENES=v2 FAILED on frame time with load 5.1 to 5.5 (another lane's bench running): high 5.20 ms (+8.3%), lite 3.40 ms (+17.2%, the same 3.40 as round 2), draw calls 359 (0%) and 286 (−1%), triangles +0.7% and +1.4% (the bench). Not rerun (the rules).
- **Evidence:** `specs/evidence/volleyball/p3/`: `p3-camera-before-after.png`, `p3-zoom-*`, `p3-bar-*` and `p3-bar-air.png`, `p3-air-spike.png`, `p3-air-jumpset.png`, `p3-meter-strip.png`, `p3-ring.png`, `p3-rally-strip.webp`, `fx/*.webp` (one per effect; before in `p2/fx/`), `sfx/*.ogg` (one per sound), `board-podium.png` (before `p2/p2-board-open.png`), `podium-showroom.png`, `benches.png`.
- **Not verified:** the sounds by ear; a signed-in podium with your own look; E at the board and sitting on bench 2 with real input; the high-ball ring and the action bar's ready glows as a player would see them through a whole live rally (checked in pieces).

## David's decisions (newest first)

- 2026-11-01, round 3 review, verbatim:
  - Approved with no note: p3-bar, p3-bar-more, p3-benches, p3-camera, p3-fx-jump, p3-fx-jumpset, p3-fx-land, p3-fx-out, p3-fx-point, p3-fx-set, p3-fx-whiff, p3-jumpset, p3-meter, p3-play, p3-rally, p3-ring.
  - p3-board (approve): "make them dance, and make it more podium like ,"
  - p3-podium-kit (redo, no note): make it match the reworked podium.
  - p3-fx-block (redo): "the text that shows up doesnt look good, it should feel like a block and not say a block"
  - p3-fx-bump (redo): "the text that shows up doesnt look good"
  - p3-fx-dive (redo): "the text that shows up doesnt look good, i also want like a split character flash frame to show its hit and more juice"
  - p3-fx-net (redo): "sound is fine the text should show somewhere else it doesnt look goodf"
  - p3-fx-serve (approve): "the text that shows up doesnt look good, better design and less noticable"
  - p3-fx-spike (redo): "the text that shows up doesnt look good, should be less noticable, should have a 1 frame impact frame for perfect spikes, and more animation vfx juice to it"
  - p3-fx-call (approve): "redo the call sfx, just do a alert sound effect"
  - p3-fx-heat (redo): "redo sfx, should feel simple sfx fitting for game"
  - p3-fx-win (redo): "redo sfx"
  - Round 4 brief (coordinator): one new smaller, quieter callout design for every action that fits the UI kit; the net call moves elsewhere; the block shows no word; 1 frame impact frame on perfect spikes, split character flash frame on dive hits (one or two frames, never back to back, dropped under reduced motion); more juice on spike and dive; call a plain alert, heat simple, win redone (synth or CC0, ogg for review); podium: top three dance, stepped 1-2-3 blocks with numbers; showroom kit piece matches.
- 2026-10-30, round 2 review (https://claude.ai/artifact/4hADsrK2pAmYcMVRgEvFDK), verbatim:
  - Approved: p2-ball, p2-net, p2-rewards, fx-set, fx-land ("good improvements"), p2-zoom ("good"), p2-bench ("2 benches"), p2-squish ("more squish and should feel it").
  - p2-play: "many bugs, ui not responsive to jumps, the timing for balls is off when in the air."
  - p2-before-after: "camera angle needs to change for this game, needs tweak currently the camera angle charater takes up too much space,"
  - p2-meter: "i want there to be more juice to filling out the bar "
  - p2-ring: "timing ring is good for most part but timing ring should follow the ball when its high up in the air for timighing for jump set spike or block, and if its flat maybe just show the ground ring"
  - p2-bar: "the ui for the action bar needs heavy work, the current one looks ugly, the icon isnt intuitive, and its not responsive for when you jump. the bar should old show bump set dive, no jump or right click for callout. and jumping should switch the set of ui to jumping actions"
  - p2-rally: "better but still lacks the juice, and smoothness of gameplay"
  - p2-board: "redo the ui of this leader board with better ui, have a podium with character model and name, more visual less names"
  - fx-spike: "spike sound effect should feel it, recreate the spike sound. and it sohuld look really good with perfect splike, like fire trail or smth, should have juice, feel good, and satisfying"
  - fx-block: "all the sound effects sound the same rn and needs editing and changes, a block should feel like a block and not just any other shot. mechanic needs refinement currently laggy and doesnt work"
  - fx-bump: "sound effect needs to be different, good so far, but make it feel juicy"
  - fx-jumpset: "needs to be redone and refined for game mechanic and smoothness"
  - fx-jump: "jump needs to feel like a jump, and jump proper hight, animation needs to be better done and feel smooth"
  - fx-dive: "the q dash is too fast rn, im thinking dont do crtl and just do a dive qith q and thats it, it should feel nice and clutch with dives"
  - fx-serve: "the ui placement for the ball high is wrog and should be redone somewhere intuitive and not ruining the view, make the serve cooler have flame trail if its a perfect serve, and have juicy serves"
  - fx-out: "out need to show out with proper animation feel"
  - fx-net: "need to feel likes its tape with micro animatin and juice"
  - fx-point: "need to feel likes its point with micro animatin and juice"
  - fx-heat: "need to feel likes its rally with micro animatin and juice"
  - fx-win: "need to feel likes its winning with micro animatin and juice"
  - fx-call: "need to feel likes its mine with micro animatin and juice, need to be clear"
  - fx-whiff: "need to feel likes its miss with micro animatin and juice"
- 2026-10-30 (via coordinator): the 15 effects approved; "should have differnt effect for timed hits, good, perfect ,early or late. and make these individually and make sure its good, also make fitting sound effect or go online t ofind sound effect libraries".
- 2026-10-30 (via coordinator): the net concept approved; island beach balls move to the new LP ball; the casual reward as built (15 coins, 5 a day), keep the client-trust limit in the spec until phase 2.
- 2026-10-30: the phase 1 review, verbatim in the spec ("beach volley ball redo, the controlsl dont even work properly", and per item).
- 2026-10-29 (via coordinator): right click on the ground is "Call it"; phase 1 on labelled stand-ins; the brief, verbatim in the spec.

## Next

1. Coordinator: review page for round 3 from the evidence above; David's notes go in "David's decisions".
2. Phase 2 (multiplayer) waits until David approves round 3.

## Tools and gotchas

- Locks: `LANE=game/volleyball /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Swap is high, so hold one lock at a time.
- Real-input checks: `PORT=3471 node specs/evidence/volleyball/p3input.mjs specs/evidence/volleyball/p3 inputs,rally` (round 3: airborne presses with the ball arriving for real, the clutch dive, the block, the bar's swap frame by frame) against a dev server on 3471 (Supabase blanked, `NEXT_PUBLIC_GAME_WORLD=new`), started, warmed and killed inside one devserver lock. Pointer lock is emulated on the game's own calls. `?vbseed=N` (dev) seeds the island's match; seed 7 has you serve.
- `window.__volley` (dev): `dev` (pause, steps, yaw, pitch, `side` close-up camera), `match()`, `controls`, `probe` (serveErr, reach, stance, hand, screen, ring).
- Effects strips: `specs/evidence/volleyball/p3fx.mjs` (port 3472); it pins the HUD's CSS animations to each frame's time and finishes old ones first, so stamps strip deterministically. Court shots (board, benches): `p3court.mjs`.
- A dev-server wrapper that starts, warms, runs and kills inside one lock: `vbrun.sh <port> <cmd>` (write it to your scratchpad: next dev with Supabase blanked and NEXT_PUBLIC_GAME_WORLD=new, curl warm-up, run, kill by port).
- The island's curved-world bend patches every three.js canvas on the page, UI canvases too: keep a UI canvas's camera close (the podium's is 1.2 u off).
- perf:check on this machine: build first under the heavy lock (`withlock.sh heavy env NODE_OPTIONS=--max-old-space-size=8192 sh ../specs/perf/measure-build.sh`), then `SKIP_BUILD=1 SCENES=v2 LOCK_OWNER=game/volleyball npm run perf:check`, then delete web/.next.
- The island's post pass drops materials with depthTest off: the rings depth-test and draw late.
- React compiler lint: per-frame mutation lives in module-scope functions (`frameStep`, `juice`, `camera`, `ballView`).
- The palms at about (-10.8, 98.4) and (-8.4, 98.1) stand in the court's free zone and can block the camera near the land-side line: David's layout, flagged.
- The world regenerates with `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts`; restore `study:pier-bench`'s yaw to -1.5708 by hand.
- Never ports 3000, 3300 or 3301.
