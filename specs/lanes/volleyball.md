# Lane: volleyball (beach volleyball minigame)

Worktree `.claude/worktrees/volleyball`, branch `game/volleyball`, cut from origin/main f0be2c5e. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (the design spec, with David's phase 1 review verbatim and round 2's root causes at the top), `specs/design-bible.md` (UI and Models), `specs/references/volleyball/` (camera-and-court.png for the camera only; beach-ball.png is David's ball). CODEMAP sections: Movement, Camera, UI kit, Multiplayer.

## Status

**Round 2 shipped in v1.2 (main 2e7d7de8; migration 20261030120000_volleyball_casual applied).** David reviewed it (2026-10-30, below): round 3 is the build now. Merge origin/main first. The round 2 notes that follow describe what is live.

- **Controls (root causes fixed):** the avatar's keys stand back in a match (PlayerAvatar `frozen` while playing), the court takes the mouse on the window's capture phase (`courtInput.ts`; the orbit camera never sees its right button), Tab and G wheels are off in a match, presses wait up to 0.26 s for the ball. One controls table (`actions.ts`) drives the input and the action bar. Real-input checks on the island pass for every action (`specs/evidence/volleyball/p2/input-results.json`).
- **Clips:** game/vb-anim merged (13eead8a): the match players and your avatar (only while playing) load vb_clips.glb; hands are clips.ts contactPoints; a press's clip is timed to the ball (`moves.ts` syncRate); ready and shuffle under 1.8 u/s; dives last to the clips' `up`.
- **Occluders:** the match camera aims the island's see-through cut (lib/game/occluders) from its own position, so the palms in the free zone fade round you.
- **Feel:** `feel.ts` VB_FEEL (ball pace 0.52 → 0.9 through a rally, higher floatier jump with apex slow-mo, gentler movement, ready stance, squash and stretch, timing grades). Hands follow the vb_* contract's contact points.
- **Court:** ×1.3 plan, ×1.15 net (`COURT_GROW`); world regenerated (bench `volley-bench`, board `volley-board`, surfboards, shells, the net ball moved off the free zone). Camera glides in at the start; fog draws in; the island's top-right HUD hides.
- **Serve:** triangle `ServeMeter` (Max at the top, a harder serve), ring cursor sets the direction, `SpinPicker` sets the curve.
- **HUD:** kit `ActionBar` with pictograms, steadied rows; grade pops; pace line; bigger point word; final card with coins.
- **Models:** beach ball HD 5,520 / LP 288 (island balls repointed, old a/b/c deleted); net remodelled from the approved concept, HD 9,436 / LP 2,378.
- **Effects and sounds:** the 15 approved effects with four timing grades (`VolleyFx.tsx`, `VolleyStamps.tsx` via `fxBus.ts`); 29 synthesised CC0 sounds (`sfx.ts`, `web/public/audio/sfx/vb-*.ogg`, SOURCES.md).
- **Rewards:** casual win 15 coins, 5 paid wins a day, server tickets (migration `20261030120000_volleyball_casual`, smoke in the chain). Ranked rewards wait for phase 3 (spec).
- **Island:** leaderboard board (sample data, labelled), spectator bench, residents route round the court, others see a steady vb_spectate stand. Bram's arrival stops keep off the court too (the beach landmark sits on it).
- **Gates (round 2, after 8439167b):** tsc clean; vitest one run 3586 passed with 2 failures, both fixed and their files rerun green (the HD copies listed as budget exceptions; Bram's beach stop moved off the court); eslint clean on every changed file; SQL smoke chain passed (volleyball casual smoke ok); perf:check v2 FAILED on frame time with the machine loaded (load average about 4): high 5.40 ms (+12.5% on 4.8), lite 3.40 ms (+17.2% on 2.9), draw calls 366 and 293 (+1.9% and +1.4%), triangles +2%. Not rerun (the rules); the coordinator's combined check decides.
- **Evidence:** `specs/evidence/volleyball/p2/` (strips, `input-results.json`, `fx/` per effect, `sfx/` previews).

## David's decisions (newest first)

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

## Next: round 3 (coordinator, 2026-11-01)

Order: the play first (it has to work and feel smooth before any effect matters), then the HUD, then effects and sounds.

1. **Play:** fix the bugs in p2-play. The timing in the air is off: a press while airborne has to meet the ball. Jump to a proper height with a smoother clip; refine the jump set. Dive is Q only (drop Ctrl), slower than today's dash, and clutch: it reaches a ball you'd otherwise miss. Block works and isn't laggy. Rerun the real-input checks for every action, airborne ones included.
2. **Camera:** the character takes up too much of the frame. Pull back or raise it so the court reads. Before and after stills.
3. **Action bar:** rebuild it. On the ground it shows only bump, set and dive (no jump, no right-click call). In the air it switches to the jump actions (spike, block, jump set). Clear icons, flat kit look (design bible UI rules), switches the instant you leave or touch the ground.
4. **Timing ring:** follows the ball when it's high (for jump set, spike and block); a flat ball shows only the ground ring.
5. **Serve:** move the ball-height UI somewhere intuitive that doesn't block the view; a perfect serve gets a flame trail; juicier serves. The power meter fill gets juice.
6. **Effects:** every redo in the list above. Each of call, heat, net, out, point, whiff and win gets a micro-animation that says what it is at a glance. A perfect spike gets a fire trail. More squish on hits. One strip per effect, before and after.
7. **Sounds:** every sound distinct (block, bump, spike, serve, set, net, out, point, win, call, whiff). Synthesised or CC0 only, logged in `web/public/audio/sfx/SOURCES.md`. A sound preview per effect on the page.
8. **Leaderboard board:** a podium with the top players' character models and names; more visual, fewer names.
9. **Benches:** two spectator benches.
10. Gates, one perf:check (SCENES=v2) when the machine is quiet, evidence in `specs/evidence/volleyball/p3/`, then report to the coordinator for a review page.

Phase 2 (multiplayer) waits until David approves round 3.

## Tools and gotchas

- Locks: `LANE=game/volleyball /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Swap is high, so hold one lock at a time.
- Real-input checks: `PORT=3471 node specs/evidence/volleyball/p2input.mjs specs/evidence/volleyball/p2 inputs,rally,lab,court` against a dev server on 3471 (Supabase blanked, `NEXT_PUBLIC_GAME_WORLD=new`), started, warmed and killed inside one devserver lock. Pointer lock is emulated on the game's own calls. `?vbseed=N` (dev) seeds the island's match; seed 7 has you serve.
- `window.__volley` (dev): `dev` (pause, steps, yaw, pitch, `side` close-up camera), `match()`, `controls`, `probe` (serveErr, reach, stance, hand, screen, ring).
- Effects strips: `specs/evidence/volleyball/p2fx.mjs` (port 3472).
- The island's post pass drops materials with depthTest off: the rings depth-test and draw late.
- React compiler lint: per-frame mutation lives in module-scope functions (`frameStep`, `juice`, `camera`, `ballView`).
- The palms at about (-10.8, 98.4) and (-8.4, 98.1) stand in the court's free zone and can block the camera near the land-side line: David's layout, flagged.
- The world regenerates with `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts`; restore `study:pier-bench`'s yaw to -1.5708 by hand.
- Never ports 3000, 3300 or 3301.
