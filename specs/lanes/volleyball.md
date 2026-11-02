# Lane: volleyball (beach volleyball minigame)

Worktree `.claude/worktrees/volleyball`, branch `game/volleyball`, cut from origin/main f0be2c5e. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (the design spec, with David's phase 1 review verbatim and round 2's root causes at the top), `specs/design-bible.md` (UI and Models), `specs/references/volleyball/` (camera-and-court.png for the camera only; beach-ball.png is David's ball). CODEMAP sections: Movement, Camera, UI kit, Multiplayer.

## Round 5: David's round 4 review (2026-11-02, verbatim; https://claude.ai/artifact/KxJpWfHN8dd5rddG1Lrajm)

Approved: p4-board, p4-board-dance, p4-podium-kit, p4-fx-bump, p4-fx-call, p4-fx-dive, p4-fx-heat, p4-fx-net (so Out, Net and Tape under the score stay), p4-fx-serve, p4-fx-set, p4-fx-spike, p4-fx-win.
- p4-calls (redo): "still needs the text tag just a redesign"
- p4-fx-block (redo, no note): with the note above, the block gets its text tag back, in the new design.
- p4-impact-dive (redo): "no imact frame just a white flash on the charater "
- p4-impact-spike (redo): "maybe remove the line, "

Build:
1. Keep a text tag on every action (block included), redesigned: round 4's small pill is approved in spirit as quiet, but give the tag a better look of its own that fits the UI kit. Show two or three directions side by side on one sheet so David can pick.
2. Dive: drop the split impact frame; the diving character flashes white for a beat (the character only, not the screen).
3. Perfect spike: keep the one impact frame, without the radiating lines. Show with and without side by side.

## Status

**Round 5 built, waiting for David's review (branch head: see the last commit; last origin/main merge 3f9f2b4d; origin/main has moved since, not merged: the lane file didn't ask).** No migration, no protocol change.

- **Call tag, a kit piece now** (design bible UI, How it's built 2): `web/components/gui/flat/CallTag.tsx` + `callTag.module.css`, exported from the kit index, in the showroom (`/lab/gui#call-tag`, "Call tag (flat), three directions", with a Played row and a Play again button). `look`: **chip** (A, the live default: a white chip, a coloured cap with the call's picture: star, tick, clock, up arrow, bricks, dashed ring, bolt), **bubble** (B: a white speech bubble whose tail points at the touch, a thin edge in the call's colour), **letters** (C: no box, white Nunito 900 with an ink outline over a skewed swoosh). Gold for Perfect and Max, the team's colour for Saved and Block, grey for Early, Late and Miss. `live` plays it once (spring in, held, up and out; a block slams down and jolts; reduced motion fades). VolleyStamps renders it at the touch (`.at` wrapper). Once David picks, delete the other two looks, `CALL_LOOKS`, `fxBus.dev.tag` and the showroom's extra rows.
- **Block's tag back:** `contactPlan(...).stamp` is "Block" for every block (any team, as round 3); `stampOf` kind "block".
- **Dive:** no impact frame. `contactPlan(...).blink` (your dig) makes VolleyFx swap every opaque mesh under the diver's body for one unlit white `MeshBasicMaterial` for `BLINK` = 8 rendered frames (counted like the impact frame, so the dig's slow-mo can't stretch it; dev pauses hold it), then give the materials back (also on unmount). Calm (reduce flashing or reduced motion): none. The body comes from `fxBus.body(who)`, set by VolleyMatch: the bots' (and yours in the lab) groups, and on the island `scene.getObjectByName("player-body")`, a name added to PlayerAvatar's body group. `__volleyFx.probe().blink` = meshes held white.
- **Perfect spike:** still one impact frame (`IMPACT = { frames: 1, gap: 1.2 }`, `impact` now a boolean), the scene thresholded and inverted, no lines and no focus lines after. `fxBus.dev.lines = true` puts round 4's lines and focus lines back (for the with-and-without sheet); delete it, `.focus`, the `[data-lines]` rule and the focus state once David picks without.
- **Fixed on the way:** the impact frame stuck on after its frame when its data attribute was "" (my refactor; now `toggleAttribute`).
- **Gates (round 5):** tsc clean; vitest full run 3748 passed, 4 skipped (400 files); eslint clean on every changed file; real-input checks 29/29 PASS on the island (`p5/input-results.json`, new: "your dig flashes your avatar white (no impact frame) and gives its look back", 6 meshes); real-time checks PASS (`p5/checks.json`: spike frame 1 long, back to back none, dig no impact and 8 white frames then restored, reduced motion neither). No perf:check this round (coordinator runs one).
- **Evidence (`specs/evidence/volleyball/p5/`):** `p5-calls.png` (the sheet: a column per direction, a whole view plus Perfect, Good, Early, Block, Saved, Miss, Max at rest), `p5-calltag-showroom.png` (the kit piece, every call in each look, and played), `p5-fx-block.webp` (the block's tag played in each look; before: `p4/fx/block.webp`, no tag), `p5-impact-spike.webp` (row 1 with round 4's lines, row 2 without; before: `p4/p4-impact-spike.png`), `p5-impact-dive.webp` (frames 0 to 20 and a close crop: white on 1, 4, 7, itself on 9; before: `p4/p4-impact-dive.png`), `checks.json`, `input-results.json`.
- **Not verified:** the blink and tags by eye in a live rally at full speed (stepped and counted in real time only); the tags on a phone-sized view.

**Round 4 (reviewed 2026-11-02, notes at the top; superseded where round 5 says so):**

- **Calls (VolleyStamps.tsx, volleyStamps.module.css):** one small quiet design: a 13 px white pill with a coloured dot, a touch over the hit on screen (`fxBus.screen`, set by VolleyFx), rising 14 px and fading in 0.9 s. Perfect has a thin gold edge; Early, Late and Miss are grey and 12 px; Saved has the team dot; Max (your max toss) replaces the HUD's old "Max power" note (deleted with its CSS). The block says no word (`contactPlan` stamp null). The referee's calls (Out, Net, Tape) are a chip under the score beside the heat chip (`.under`). The win keeps its trophy and rays. Reduced motion: calls fade with no motion.
- **Impact frames:** `fxPlan IMPACT` (spike 1 frame, dive 2, gap 1.2 s on the effects' clock) and `impactOk`; `contactPlan(...).impact` is "spike" for your perfect spike and "dive" for your dive's dig. VolleyFx starts it (`fxBus.impact`) and counts it down by rendered frames (dev pause holds it); VolleyStamps draws it per frame: a full-screen backdrop filter that thresholds the scene to ink (the spike's the negative; the dive's split on a slant through the hit, ink and negative) with lines converging on the hit, then 0.36 s focus lines. Dropped under the comfort setting Reduce flashing or prefers-reduced-motion. Keyed to the dig contact event, not to the vb_dive clip.
- **Juice:** clean spikes punch two (perfect three) sonic-boom rings along the ball's new flight (ring face 3, aimed) and a star of streaks (`HIT_STREAKS`); your dig throws a shock ring across the sand, team-colour rings and sparkles round the ball, and streaks.
- **Sounds:** `vb-call` a plain two-note alert (E5, A5), `vb-heat` a three-note blip (C5 E5 G5), `vb-win` a short jingle up to a held C6 over a bell chord. `synth_volleyball.py` burns the old versions' noise draws, so the other 26 sounds render bit for bit the same (checked with cmp). SOURCES.md updated.
- **Podium (kit Podium.tsx, podium.module.css; BoardSheet.tsx):** three white blocks joined into one stepped stand (1 middle 96 px, 2 left 68, 3 right 48), big gold, silver and bronze numbers and a thin top edge, a lighter top face; names and wins in a row under it (`PODIUM.names`, `podiumFeet` includes it). The three dance on one beat (`motion.beat` = the stage clock): 1 DanceSpin, 2 DanceSway, 3 DanceWiggle. The showroom's BoardBody shows the same piece (note updated).
- **Gates (round 4):** tsc clean; vitest full run 3746 passed, 1 failed (a float edge in my new test, fixed; the volleyball files then 88/88); eslint clean on every changed file (the one old `<img>` warning in VolleyHud); real-input checks 28/28 PASS (`p4/input-results.json`); impact checks PASS (spike 1 frame, dive 2, none back to back, none under reduced motion). perf:check SCENES=v2 FAILED on frame time with the machine loaded (load 5.5 to 7.5; game/fishing-depth held the devserver lock just before): high 5.70 ms (+18.8%), lite 3.80 ms (+31.0%); draw calls 363 (+1.1%) and 287 (-0.7%), triangles +0.8% and +1.6%, as in round 3. The v2 scene draws no match, so round 4's effects do not render in it. Not rerun (the rules).
- **Evidence:** `specs/evidence/volleyball/p4/`: `fx/*.webp` (bump, spike, block, set, jumpset, serve, out, net, dive, heat, whiff; before in `p3/fx/`), `p4-impact-spike.png`, `p4-impact-dive.png`, `p4-calls-before-after.png`, `p4-net-call.png`, `board-podium.png`, `board-dance.webp`, `podium-showroom.png` (before `p3/`), `sfx/call.ogg`, `heat.ogg`, `win.ogg`.
- **Not verified:** the sounds by ear; the impact frames in a live rally by eye (checked in real time by frame counts, and stepped); the podium signed in with your own look.

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

1. Coordinator: review page for round 5 from the evidence above (David picks a call tag direction, and with or without lines); his notes go in "David's decisions". Run the perf:check on a quiet machine before merging.
2. After his pick: delete the losing looks and dev toggles (see Status), keep the one look, update the showroom note.
3. The vb-anim lane owns `vb_clips.glb` and the dive clip, and the clip contract in `clips.ts`: don't edit them; dive work here stays VFX, flash, camera and sound.
4. Phase 2 (multiplayer) waits until David approves.

## Tools and gotchas

- Locks: `LANE=game/volleyball /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Swap is high, so hold one lock at a time.
- Real-input checks: `PORT=3471 node specs/evidence/volleyball/p3input.mjs specs/evidence/volleyball/p3 inputs,rally` (round 3: airborne presses with the ball arriving for real, the clutch dive, the block, the bar's swap frame by frame) against a dev server on 3471 (Supabase blanked, `NEXT_PUBLIC_GAME_WORLD=new`), started, warmed and killed inside one devserver lock. Pointer lock is emulated on the game's own calls. `?vbseed=N` (dev) seeds the island's match; seed 7 has you serve.
- `window.__volley` (dev): `dev` (pause, steps, yaw, pitch, `side` close-up camera), `match()`, `controls`, `probe` (serveErr, reach, stance, hand, screen, ring).
- Round 5 script: `p5fx.mjs <out> [calls,block,spike,dive,checks,showroom]` (port 3472, via vbrun.sh); `fxBus.dev.tag` and `.lines` switch the looks for its sheets. `p3input.mjs` now also checks the island dig's blink.
- Round 4 scripts: `p4fx.mjs` (effects strips plus `impact`, the real-time flash checks) and `p4court.mjs` (the podium still, its dance strip, the showroom). KEEP=1 keeps `.frames`; delete it before committing.
- Effects strips: `specs/evidence/volleyball/p3fx.mjs` (port 3472); it pins the HUD's CSS animations to each frame's time and finishes old ones first, so stamps strip deterministically. Court shots (board, benches): `p3court.mjs`.
- A dev-server wrapper that starts, warms, runs and kills inside one lock: `vbrun.sh <port> <cmd>` (write it to your scratchpad: next dev with Supabase blanked and NEXT_PUBLIC_GAME_WORLD=new, curl warm-up, run, kill by port).
- The island's curved-world bend patches every three.js canvas on the page, UI canvases too: keep a UI canvas's camera close (the podium's is 1.2 u off).
- perf:check on this machine: build first under the heavy lock (`withlock.sh heavy env NODE_OPTIONS=--max-old-space-size=8192 sh ../specs/perf/measure-build.sh`), then `SKIP_BUILD=1 SCENES=v2 LOCK_OWNER=game/volleyball npm run perf:check`, then delete web/.next.
- The island's post pass drops materials with depthTest off: the rings depth-test and draw late.
- React compiler lint: per-frame mutation lives in module-scope functions (`frameStep`, `juice`, `camera`, `ballView`).
- The palms at about (-10.8, 98.4) and (-8.4, 98.1) stand in the court's free zone and can block the camera near the land-side line: David's layout, flagged.
- The world regenerates with `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts`; restore `study:pier-bench`'s yaw to -1.5708 by hand.
- Never ports 3000, 3300 or 3301.
