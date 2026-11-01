# Lane: title-r2 (the title screen's left side, as a game title screen)

Worktree `.claude/worktrees/title-r2`, branch `game/title-r2`, cut from origin/main. Agent type `uwotsi-lane`. Dev port 3330.

## The ask

- David, 2026-10-29, on the approved title A: "the left side needs to be remade so that its more of a game title screen and less of a student portal screen".
- David, 2026-10-31: "for the game, dont do like say student portal". The coordinator already renamed the wordmark to "Tethos" over "ISLAND" and the tab to "Tethos Island" (25d37655). That was the words only; the look is this lane.

Title A (the scene, the camera dolly through the four phases) is approved and stays. This lane remakes the left column only: the logo lockup, the menu card and the footer line.

## Task

1. Read `web/app/student/TitleScreen.tsx`, `TitleScreen.module.css`, `TitleMenu.tsx` (and its test), `web/components/title/` (TitleScene, shots.ts) and `specs/design-bible.md` (UI rules, rule 1: flat with warmth, the old vibe in the new palette).
2. Shoot the current title (desktop 1440x900 and phone 390x844, day and night) as the before.
3. Build three directions for the left side as real code behind a dev-only switch (`?titleStyle=a|b|c`, ignored in production). Each one should read as a game's title screen at a glance: a logo lockup with presence on the scene, a menu that feels like a game's start menu, and footer text that doesn't look like a login page. Keep every function: Let's Play, Settings, Exit, the sign-in, sign-up, forgot and check views, Google sign-in, "Signed in as", the time and place line, and the Apply to TSI link (recruitment's way in; it stays, restyled).
4. Shoot all three at both sizes and day and night, plus the sign-in view for each. Evidence in `specs/evidence/title-r2/`.
5. Report to the coordinator for a review page. After David picks, delete the other two and the switch.

## Constraints

- Words: never "portal" or "student" anywhere on the title. The game is Tethos Island.
- The title's load stays as lean as title-perf left it (`specs/lanes/title-perf.md`): no new models, no new fonts unless the bible already lists them, no layout shift when the scene arrives.
- Keyboard and controller-style navigation in TitleMenu keeps working (its test).
- Phone: the menu card sits at the bottom today; keep it thumb-reachable.
- No fetched art or fonts; David supplies references. If a direction needs an asset that doesn't exist, mock it with what's in the repo and say so.

## Gates

tsc, vitest on `app/student`, eslint on changed files, headless shots. No perf:check unless the scene changes (it shouldn't).

## Rules

- Headless only: never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Never port 3000.
- Locks: `LANE=game/title-r2 /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>`; exit 75 means retry. Start, use and kill your dev server inside one devserver lock, Supabase env blanked.
- Commit `[build]`, never push, never bare `git stash`. No em dashes. Real names never show. Ponytail code (`specs/lane-rules.md`).

## Status

Not started.

## Next

The task above, in order.
