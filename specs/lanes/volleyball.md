# Lane: volleyball (beach volleyball minigame)

Worktree `.claude/worktrees/volleyball`, branch `game/volleyball`, cut from origin/main f0be2c5e. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (the design spec: phases, controls, rules, bots, HUD, the two views, phase 2 and 3 designs, open questions), `specs/design-bible.md` (UI and Models), `specs/references/volleyball/camera-and-court.png` (camera and proportions only). CODEMAP sections: Movement, Camera, UI kit, Multiplayer.

## Status

Head: the commit that updates this file, after 482f1a3e. Phase 1 is built and waiting for David's review. Nothing is approved yet.

- **Engine** (`web/lib/game/volleyball/`): court, ball, timing, rules, bot, match: pure, seeded, 24 tests. `session.ts` is the client store.
- **In the game:** the court at the beach's net, (-7.5, 103.8), turned a quarter so it runs along the beach. E at the net ("Play volleyball") starts you and a bot partner against two bots. You play through your own avatar's ride (`myTrip.ride`), so others see you move. The HUD's Leave or the final panel ends a match.
- **Two views:** passers-by get the line tapes and the LP net (`Court.tsx`); the player gets everything else (`VolleyMatch.tsx`, `VolleyHud.tsx`). Frame times are in spec §10.
- **Net remodelled:** `art/props/build_volleyball_net.py`, HD 2400 tris and LP 1600 (the old net was 960). The old net builder was removed from `build_beach_things.py`.
- **Kit:** `PowerMeter` (`components/gui/flat/`), shown in `/lab/gui`. New tokens `--ui-gold`, `--ui-home`, `--ui-away` in all three themes.
- **World:** `generate.ts` got the VOLLEY spot and a court keep-out for shells and gather spots, and `world.json` was regenerated. The objects that changed: the net, its ball, gather-shell-2, and the shells, which lost 4 and were renumbered. `PROP_FOOTPRINT` and `PROP_TOP` were updated for the net.
- **Gates at 482f1a3e:** tsc clean; vitest 3532 passed (one run); eslint clean on changed files; perf:check v2 passed (high 4.60 ms median frame, 359 calls; lite 2.90 ms, 290 calls).
- **Evidence:** `specs/evidence/volleyball/p1/` (strips and the net's HD vs LP in `models/`).

## David's decisions (newest first)

- 2026-10-29 (via coordinator): "i need you to remodel the beach ball net on the beach to be bigger, i want you to incorperate this mini game in the game but watch out for performance, i want it so the people who are playing have a differeny view than ppl walking by so it doesnt affect their perforamnce." The spot is the existing net's; no spot proposals.
- 2026-10-29 (via coordinator): right click on the ground is "Call it" (the "Mine!" call). No tip alternative.
- 2026-10-29 (via coordinator): build phase 1 on clearly labelled stand-in models (except the net, remodelled from his direction); mechanics and feel are reviewed first. Stamina hooks stay in the spec only.
- 2026-10-29: the brief, verbatim in the spec.

## Next

1. David's phase 1 review: apply his notes. The open questions are at the end of the spec.
2. When references come: the ball model (HD and LP), and the line tapes if he wants more.
3. Phase 2 (multiplayer, spec "Phase 2" and §10), only after David approves phase 1.

## Tools and gotchas

- Locks: `LANE=game/volleyball /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 means retry. Swap is high, so hold one lock at a time.
- Evidence: `PORT=3471 node specs/evidence/volleyball/shoot.mjs <out> [camera,serve,late,early,receive,rally,dive,point,island]` against a dev server on 3471 with Supabase blanked and `NEXT_PUBLIC_GAME_WORLD=new`. Start, warm and kill the server inside one devserver lock. Lab scenes drive `window.__volley.dev` (input, yaw and pitch, pause and steps of a 60th of a second, the event log). The `island` scene times frames with `window.__perf`, and `?vbcourt=0` (dev only) leaves the court out, which is the "before".
- `/lab/volleyball?seed=7` starts with you serving; `?seed=2` with a good bot serve to you; `?bots=1` lets a bot play your place.
- The world regenerates with `cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts`. It wrote `study:pier-bench`'s yaw at full precision; restore main's `-1.5708` by hand.
- React compiler lint: per-frame mutation lives in module-scope functions (`frameStep`, `juice`, `lean` in VolleyMatch), not in component code.
- The lab's sand texture has dark pebble spots that look like stains; they are in the texture.
- Ctrl is the Mac crouch key in the movement system; in a match the court's own key handler takes it (`bindCourtInput`), and the world's keys stand back (DefaultIslandWorld checks `volley.match`).
- Meshy keychain item is absent on this machine. Never ports 3000 or 3300.
