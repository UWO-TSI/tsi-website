# Lane: volleyball (beach volleyball minigame)

Worktree `.claude/worktrees/volleyball`, branch `game/volleyball`, cut from origin/main f0be2c5e. Agent type `uwotsi-lane`.

**Read first:** `specs/minigames/beach-volleyball.md` (the design spec: phases, controls, rules, bots, HUD, phase 2 and 3 designs), `specs/design-bible.md` (UI and Models), `specs/references/volleyball/camera-and-court.png` (camera and proportions only). CODEMAP sections: Movement, Camera, UI kit, Multiplayer.

## Status

- 2026-10-29: spec and lane file written. Phase 1 build started.

## David's decisions (newest first)

- 2026-10-29 (via coordinator): right click on the ground is "Call it" (the "Mine!" call). No tip alternative.
- 2026-10-29 (via coordinator): build phase 1 on clearly labelled stand-in models; mechanics and feel are reviewed first. Stamina hooks stay in the spec only.
- 2026-10-29: the brief, verbatim in the spec.

## Next

1. Pure logic with tests: court, ball, timing, rules, bot, match.
2. The arena at `/lab/volleyball`: scene, camera, players, HUD, `PowerMeter` kit piece (+ `/lab/gui`).
3. Evidence in `specs/evidence/volleyball/p1/` (list in the coordinator's brief), beach spot proposals.
4. Gates, commit, report.

## Tools and gotchas

- Locks: `LANE=game/volleyball /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver|blender <cmd>`; exit 75 = retry. Swap is high: hold one lock at a time.
- Never ports 3000 or 3300. Meshy keychain item is absent on this machine.
- Ctrl is the Mac crouch key in the movement system; the court handles Ctrl itself.
