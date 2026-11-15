# Lane: flat-only (remove the cream kit)

Worktree `.claude/worktrees/flat-only`, branch `game/flat-only`, cut from `feat/game-default-island` (= main) at the commit that adds this file. Agent type `uwotsi-lane`. Dev port 3482.

## David's decision (2026-11-13, verbatim; ledger row 334)

"im fed up wit hthe game keep trying to use the old animal crossing ui kit, remove that so taht all future ui are the new flat ui"

Row 320 (2026-10-28) already made clean flat the one look (`specs/design-bible.md`, UI chapter). The code never followed, so every new screen that calls `Sheet`, `Button`, `Card` or `Banner` still lands on cream paper. This lane makes flat the only thing the code can produce. After it, there is no cream option to reach for.

## Where the cream lives today (coordinator's scan)

- **Tokens:** `web/styles/themes/cream.css` sets the cream `--ui-*` values on `:root` ("the cream base"). `web/styles/game-tokens.css` resolves the `--gui-*` tokens from them on `:root` (line ~110), so everything outside `[data-gui-flat]` is cream. The flat shapes (radii, shadows, no grain, wood or stripes) only apply under `[data-gui-flat]` (line ~248). The paper values are copied a second time under `[data-gui-flat] [data-gui-paper]` (line ~283).
- **The switch:** `web/components/gui/variant.tsx` (`GuiVariant` "cream" | "flat", default "cream"). `Sheet` in `web/components/gui/index.tsx` takes `variant = "cream"`. `IslandSheet` (`components/game/IslandSheet.tsx`) and `ProgressionPanel` (`components/progression/ProgressionPanel.tsx`) take `flat`. Only the journal, the mailbox, the notice board, the monument and the ruins mission board pass it.
- **Sheets still cream (default):**
  - the Esc menu (`EscLayers`), the map (`MiniMap`), `PresenceList`, `PlayerCard`, `FriendsSheet`;
  - `StudyHud` (the seat sheet and top studiers), `CafeGoalSheet`, the HQ cards (`hq/HqCards`), the tourney and GENESIS posters (`SeasonalEvents`);
  - the trophy case (`ShowcaseSheets`), `DonateSheet`, the path (`oracle/PathSheet`), `OracleQuizSheet`, `SettingsSheet`, `ContributeSheet` opened alone;
  - the Sell, Inventory and Wallet sheets (`economy/EconomySheets`).
  - The portal's sheets under `app/student/dashboard/*` and `components/portal/*` also use `Sheet`.
- **Cream pieces:** `web/components/gui/cream/` (`Section`, `Folds`, `Fold`, `QuietButton`), used by the four flat menus (journal, letters, notice, mission board), where they already render flat.
- **The recruit kit as the game's kit:** `components/gui/index.tsx` line 19 re-exports `components/recruit/ui` as `Button`, `Field`, `TextArea`, `Panel`, `Dialogue` and `Keycap`. Its header comment still says "drawn from David's Animal Crossing UI kit". Counts of files importing each from `@/components/gui`: Button 54, Field 14, TextArea 9, Keycap 6, Dialogue 2, Panel 0.
- **Cream-shaped kit pieces:** `Card` (tones `paper`, `pinned`, `torn`, `tilt`), `Banner` (butter ribbon), `NameTag`, `Badge` tones, and the blob radii, grain, confetti, wood and stripe tokens in `gui.module.css` and `game-tokens.css`.
- **The creator:** `CharacterCreator` is cream unless passed `flat`. The member game passes it, and the applicant island mounts it without it.
- **The theme list:** `styles/themes/index.ts` has `UI_THEMES = ["clean", "cream", "dark"]`. `DevUiTheme` offers `?uitheme=cream`.
- **The showroom:** `/lab/gui` (`app/lab/gui/page.tsx`, `FlatPieces.tsx`) still shows cream sections.

## Build

1. **Flat is the base.**
   - The clean values sit on `:root`, and the flat shape rules become the `.gui` default, with no `[data-gui-flat]` needed.
   - `cream.css` goes, as a base and as a theme. `UI_THEMES` becomes clean and dark, and `?uitheme=cream` goes.
   - The `--gui-*` tokens nothing reads any more go too: grain, confetti, stripes, wood and the blob radii, unless paper still needs them.
2. **Paper is a material only:**
   - It holds its values in one place under `[data-gui-paper]`, used only by paper things in the world: letters, the notice board's notices, the club goal, HQ notices, a menu (row 320 rule 2).
   - Keep `lib/gui/contrast.test.ts` (or its successor) checking paper's contrast.
3. **One API:**
   - `Sheet` loses `variant`. `GuiVariant`, `GuiVariantContext`, `useGuiVariant` and `variant.tsx` go.
   - `IslandSheet`, `ProgressionPanel` and `ConfirmDialog` lose `flat` and `variant`.
   - Every caller is updated.
4. **No `components/gui/cream`.**
   - Its pieces move into the flat kit (`components/gui/flat`) under plain names, already flat as they render today. The folder and `cream.module.css` go.
5. **The game's Button, Field, TextArea, Keycap and Dialogue are the kit's own, flat.**
   - They live in `components/gui` (the bible's "canonical Button, Keycap and Dialogue move into components/gui"). They are built on the flat pieces that exist (`DarkButton`, `GhostButton`, `Pill`, `FlatField`) where they fit.
   - Keep the export names so the 54 callers keep working. Drop `Panel` (no users).
   - `components/recruit/ui` itself is untouched: recruitment keeps it.
6. **The cream-shaped pieces become flat:**
   - `Card`, `Banner`, `NameTag` and `Badge` take the flat look.
   - Paper-only props (`pinned`, `torn`, `tilt`, `tone="paper"`) stay only if a paper thing in the world uses them. Delete the ones with no users after the change.
7. **The creator:** flat always in the game; drop the `flat` prop. The applicant island's cream creator must stay pixel-identical. Its cream CSS moves next to recruitment or applicant code, named for recruitment, so no game lane can reach it from `components/gui`.
8. **Recruitment, the applicant island and the marketing site look exactly as before** (0 px diff on before and after shots). If they read the cream values from `:root` today, give them their own scope holding those values in their own code.
9. **The doc comments and the showroom:**
   - `components/gui/index.tsx`'s header says what the kit is now: the flat kit, one look, design bible UI chapter.
   - `/lab/gui` shows flat only.
10. **Docs:**
    - Design bible UI chapter: replace the "Defaulted, David can overturn" paragraph with the decision (row 334): no cream base, no cream theme, Button, Keycap and Dialogue in `components/gui`, recruitment and the applicant island keep their own look in recruitment code.
    - `specs/polish/flat-ui.md` and `specs/polish/ui-themes.md`: a short dated note.
    - `CODEMAP.md`'s UI row: point at the kit.
    - `specs/recruitment-ui-kit.md`: one line at the top saying it is recruitment-only.
11. **Ownership:**
    - Don't edit `web/app/student/*` page files (another session owns them); they follow the kit.
    - Don't edit `next.config.ts`, `middleware.ts`, `web/lib/supabase/*`, nav or footer, or `web/app/student/TitleSplash.tsx`.
    - If a portal page passes a prop you remove, stop and report instead of editing it.

## Evidence

All shots are headless and muted; never open a window. Before shots come from this branch's base commit, after shots from your head. Before and after go side by side, desktop and phone, on the new world.

- `fo-sheets`: every in-game sheet that was cream, before and after (the list above).
- `fo-pieces`: the kit's Button, Field, Card, Banner, Badge and Dialogue, before and after, plus `/lab/gui`.
- `fo-paper`: a letter, the notice board and an HQ notice, unchanged in look, inside the flat panel.
- `fo-portal`: two portal pages with a sheet open (`/student/dashboard/bounty`, `/student/dashboard/kanban`).
- `fo-unchanged`: recruitment (`/apply` and one more), the applicant island's creator and collection, and the marketing home. Each shows a 0 px diff count.
- `fo-questions`: anything you had to decide that David might overturn.

Gates:
- tsc clean;
- vitest in both worlds;
- lint on the files you touched;
- `grep -rn "cream" web/components/gui web/styles` finds only paper or recruitment mentions. Report what's left.

Skip perf:check (UI only).

## Merge notes for the coordinator

Ten lanes are open and unmerged: sfx-library, analytics, title-r2, club, daily-return, gem-shop, parties, market, tutorial-v2 and rod-titanium.
- Any of them passing `variant`, `flat` or cream pieces will fail tsc after this merges.
- List in your report which of their branches touch the removed API: `git diff main...game/<lane> | grep -n 'variant=\|flat\b\|gui/cream\|tone="paper"'`.
- Don't edit their branches.

## Status

- Not started.

## Next

1. Read the files named above (line ranges via `CODEMAP.md` for big ones).
2. Take the before shots first.
3. Build steps 1 to 11, then the after shots.
4. Run the gates, update this file, commit and report.

## Tools and gotchas

- New worktree: `node_modules` is cloned (`cp -Rc`), and `web/.env.local` is symlinked to the main checkout's.
- Locks: `LANE=game/flat-only /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>` for vitest, builds and the dev server.
- Never use ports 3000, 3300, 3301 or 3390.
- Stale `.next/types` can break tsc: `rm -rf web/.next/types web/.next/dev/types`.
