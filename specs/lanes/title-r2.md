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

Steps 1 to 4 done 2026-11-01, waiting on David's pick (step 5). Head: see `git log -1` on game/title-r2.
- Three directions behind a dev-only switch, `?titleStyle=a|b|c`. `TitleScreen.tsx` sets `data-look` on `<main>` from the query in an effect, only when NODE_ENV isn't production. With no switch, the title is unchanged: that look is the "before". The CSS for each direction is one block at the end of `TitleScreen.module.css`, scoped to `.screen[data-look="x"]`.
  - **A, crest:** the emblem on a round white medallion, a chunky white "Tethos" with a teal extrude, ISLAND on a gold notched ribbon, floating gently. The menu is big outlined words on the scene with no card, and the chosen one sits between two bobbing gold diamonds.
  - **B, start buttons:** a sticker lockup, tilted -4deg: the emblem on a teal tile beside a teal wordmark cut out in white, with ISLAND on a teal tag. The menu is chunky white buttons with a pressed edge. Let's Play is the biggest, and the chosen button is ink black, slid out, with a play arrow. The footer is a white chip with a dark Apply pill.
  - **C, banner:** one white panel hanging from the top edge with a swallowtail. It holds the teal emblem, the wordmark, ISLAND between gold rules and the menu, with the chosen row on a soft gold marker between two diamonds. It drops in on a spring. On a phone it splits: a short pennant at the top holds the logo, and a white panel at the bottom holds the menu.
  - All three: the forms sit on one flat white panel with no dashed seam, the hint pill gains "Move", and Apply to TSI is restyled per direction.
- New token: `--ui-title-outline` (the logo's teal) in `styles/themes/clean.css`.
- Gates: tsc clean; vitest app/student 16/16; eslint clean on TitleScreen.tsx and TitleMenu.tsx. No perf:check, because the scene is unchanged.
- Evidence in `specs/evidence/title-r2/`: `sheet-desktop.jpg` (rows: before, A, B, C; columns: day, night, sign-in), `sheet-phone.jpg` (columns, in triples: before, A, B, C) and every full shot (`before-now-*`, `after-{a,b,c}-*`).
- Open: the form fields and buttons inside are still the cream kit (VillageButton and VillageField: butter Google button, cream fields, green Sign in). The kit has no flat Button or Field (the `GuiVariantContext` only switches Tabs and ConfirmDialog). Making them flat is a kit change, so it's out of scope here unless David asks.

## Next

1. After David picks: delete the other two blocks, the switch (the effect, the `screen` ref and `data-look`) and the old default look. Then make the chosen direction the plain `.screen` styles, drop the `.move` toggle (always show Move), and fix the CSS header comment, which still says "portal". Reshoot the pick, then run the gates.

## Tools and gotchas

- Shots: `specs/evidence/title-r2/shoot.mjs` (PORT, STYLES="- a b c", OUT; label arg). Wrap it in a script that starts `next dev -p 3330` with the Supabase env blanked, waits on `curl /student`, shoots and kills the server, all inside `withlock.sh devserver`. One run of four styles takes about 3 min. The script hides the Next dev badge, which otherwise covers the footer.
- The column has `overflow-y: auto`, so anything that pokes past its edge gets clipped (B's tilt and tile ring did). Pad the column and translate it back.
- `clip-path` clips box-shadow. C puts the panel on `column::before` and the drop-shadow filter on the column.
- The React lint rule `set-state-in-effect` forbids a setState for the switch, which is why the effect writes the dataset directly.
