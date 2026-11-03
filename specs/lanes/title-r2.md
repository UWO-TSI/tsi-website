# Lane: title-r2 (the title screen's left side, as a game title screen)

Worktree `.claude/worktrees/title-r2`, branch `game/title-r2`, cut from origin/main. Agent type `uwotsi-lane`. Dev port 3330.

## Round 3: David's note on C (saved 2026-11-02 02:37 UTC, read 2026-11-03; https://claude.ai/artifact/4Jp1L8AExKJUB3a6EMvuoq)

- title-c (approve): "looks good out of the 3, i want yout to take the option a diamond dot, the sign in ui needs to be simplified and to make cleaner"
- title-forms (approve), title-now: "C"

C is live (main 98e42ab8). Build:
1. **Option A's diamond dot** on C: find it in round 1's option A (commit 122adbf0, `?titleStyle=a`, deleted since) and bring that diamond marker into C's menu in place of C's current one. One look only, no switch.
2. **A simpler, cleaner sign-in:** fewer elements, less text, clear hierarchy, in C's banner style (the UI kit and design bible). Keep every sign-in path that works today; say what you removed or merged.
3. Before and after shots, desktop and phone, day and night: the menu and the sign-in (ids title3-*).

## The ask

- David, 2026-10-29, on the approved title A: "the left side needs to be remade so that its more of a game title screen and less of a student portal screen".
- David, 2026-10-31: "for the game, dont do like say student portal". The coordinator already renamed the wordmark to "Tethos" over "ISLAND" and the tab to "Tethos Island" (25d37655). That was the words only; the look is this lane.

Title A (the scene, the camera dolly through the four phases) is approved and stays. This lane remakes the left column only: the logo lockup, the menu card and the footer line.

## Task

1. Read `web/app/student/TitleScreen.tsx`, `TitleScreen.module.css`, `TitleMenu.tsx` (and its test), `web/components/title/` (TitleScene, shots.ts) and `specs/design-bible.md` (UI rules, rule 1: flat with warmth, the old vibe in the new palette).
2. Shoot the current title (desktop 1440x900 and phone 390x844, day and night) as the before.
3. Build three directions for the left side as real code behind a dev-only switch (`?titleStyle=a|b|c`, ignored in production). Each one should read as a game's title screen at a glance: a logo lockup with presence on the scene, a menu that feels like a game's start menu, and footer text that doesn't look like a login page. Keep every function: Let's Play, Settings, Exit, the sign-in, sign-up, forgot and check views, Google sign-in, "Signed in as", the time and place line, and the Apply to TSI link (recruitment's way in; it stays, restyled).
4. Shoot all three at both sizes and day and night, plus the sign-in view for each. Evidence in `specs/evidence/title-r2/`.
5. Report to the coordinator for a review page. David picked C; the other two and the switch are deleted.

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

## David's decisions

- 2026-11-01, picking the banner: "i already chose C". Direction C is the title's only look. A, B, the old cream-card look and the `?titleStyle=` switch are deleted.

## Status

Round 3 done 2026-11-03 (head: `git log -1` on game/title-r2, on origin/main 1ae98ff6). Round 2's status (C as the plain `.screen` styles, no switch) still holds.
- **Diamond:** option A's marker from 122adbf0 replaces C's small ink diamonds: 13 px gold diamonds with a 3 px `--ui-title-outline` edge, nudging 5 px in and out (`nudge-l`/`nudge-r`, off under reduced motion), still on C's soft gold marker. CSS only.
- **Sign-in:** the forms now use the flat kit, not the cream recruit kit. New kit piece `FlatField` (`components/gui/flat/index.tsx`, `.field` in flat.module.css: a grey well, the label read aloud and shown as the placeholder), in the showroom at `/lab/gui#flat-fields`. Sign in, Create account and Send link are `DarkButton`; Google is a `GhostButton` with a thin line; Back is the kit's `RoundButton`, quieted to the grey well on this screen. Removed: the visible field labels and the four "Required" tags, the butter Google button, the "or" rules, the underlined teal links, the coloured error and notice boxes (now plain lines in `--ui-error` / `--ui-ink-2`), the `--title-r` squaring override. Merged: one "Continue with Google" for sign-in and sign-up. Shorter words: "Create account", "New account", "I have an account", "We'll email you a link.", "Send link", "Open the link we sent to ...". Every path kept: Google, email sign-in, sign-up with name and optional invite code (validity and use count), forgot, check your email, Esc and Back. Settings keeps its cream toggles and slider (out of this round); its Back is now the same kit round button and its Sign out is a plain pill.
- Gates: tsc clean; eslint clean on the changed TSX; `npm run build` ok; full vitest 3736 passed, 1 failed: `lib/game/shoreField.test.ts` village crossing, a 5000 ms timeout (5.35 s alone, swap at 11 GB), unrelated and the same as round 2. No perf:check (UI only).
- Evidence in `specs/evidence/title-r2/`: `title3-before-*` and `title3-*`, each `{desktop,phone}-{day-menu,night-menu,day-signin,night-signin,day-signup}`. `shoot.mjs` now shoots those five per size.

## Next

1. David reviews the title3 shots. Open: whether the primary should be the banner's teal instead of the kit's ink black (one line, `.form` override), and whether Settings should go flat too (needs a flat Toggle and Slider in the kit).

## Tools and gotchas

- Shots: `specs/evidence/title-r2/shoot.mjs` (PORT, OUT; label arg; ten shots per run). Wrap it in a script that starts `next dev -p 3330` with the Supabase env blanked, waits on `curl /student`, shoots and kills the server, all inside `withlock.sh devserver`. The script hides the Next dev badge, which otherwise covers the footer.
- The column has `overflow-y: auto`, so anything that pokes past its edge gets clipped (B's tilt and tile ring did). Pad the column and translate it back.
- `clip-path` clips box-shadow. C puts the panel on `column::before` and the drop-shadow filter on the column.
