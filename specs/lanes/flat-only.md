# Lane: flat-only (remove the cream kit)

Worktree `.claude/worktrees/flat-only`, branch `game/flat-only`, cut from `feat/game-default-island` (= main) at the commit that adds this file. Agent type `uwotsi-lane`. Dev port 3482.

## Round 2: David's marks on Flat UI Only 1 (2026-11-19, verbatim; https://claude.ai/artifact/QoFX7c6WjEG2d6KToBNUMC)

Approved with no note: fo-creator, fo-portal, fo-guard.
- fo-settings (approve): "make the design of the settings page more intuitive and clear by haveing good layout, spacing and use of icons"
- fo-wallet (redo): "wallet ui needs to be redesigned and formatted, it should use icons for simplicity, and the main things to show is just the tc and gems and option to purchase gems small, and should be better designed, maybe an actual wallet that shows how many coins and gems or smth"
- fo-esc (redo): "remove tethos uisland text, remove click to lokok around, make the quest tab nicer looking, the time location wallen looks cramed and poorly designed, give feedback and suggestions on the overall hui layout"
- fo-friends (redo): "give sugegstions and redo the friends tab, should show their character, stats and when added and nickname and last online"
- fo-tourney (redo): "this needs to be redone this looks horrible should have character icon, take inspo from volley ball"
- fo-posters (redo): "what"
- fo-cafe (redo): "redo the ui, we need a better universal contribution open cafe ui, where its just icons and less text and make it easy to contribute and understand and clean innovative fun interface"
- fo-trophies (redo): "remove"
- fo-donate (redo): "all the colors look fine but the overally ui design needs to be redesigned, like for this one its hould have less text, and it should simply be like more intuitive and you open your bag on the right side and you drag and drop what you wanna donate to the left side, mroe interactive design elements, make a lot of donations, giving action opening bag on the right and you can drag the thing over to the left to feel like you are giving physically"
- fo-oracle (redo): "ok but like this looks so ugly we gotta redo this, it should be a scene where the oracle sits infront of you, crystial ball betweel, its likea sushi first person kinda vibem, and asks you question and hands you 4 cards on the floor which you choose"
- fo-hqid (redo): "were not doing ids anymore remove"
- fo-paper (no mark): "yes but all ui needs to be redesigned"
- fo-pieces-a (approve): "the old design should old keep the font, and color and card format, so it can be a possible ui design back you load in for the game like the vintage vibe and the plain new one is the default"
- fo-pieces-b (approve): "new is good"
- fo-packs (approve): "looks goood"
- fo-unchanged (redo): "the recruitment is archived for now, we will redo later"
- fo-questions (no mark, no note)
- Not marked: fo-questions.

Keep (approved): the flat kit pieces (both pages), the creator and closet, the portal pages, the guard, the UI packs with the dark sample. Settings is approved but gets a redesign (2b).

**2a, this round, then merge:**
1. **The old look as a pack (fo-pieces-a).** The old cream kit's font, colours and card format come back as a UI pack, one theme file in `web/styles/themes/` (name it "Vintage"), loadable the same way as the dark sample. The plain flat kit stays the default every player has. Restore the tokens, the font and the card styles from this branch's history; the deleted showroom crops stay deleted. This narrows ledger row 334: the cream kit returns only as a pack.
2. **Remove the HQ ID card (fo-hqid)** and its entry points. The tutorial lane removes the ID steps from the arrival (its round 17); whichever merges second resolves the overlap.
3. **Remove the trophy case (fo-trophies)** and its entry point.
4. **Recruitment (fo-unchanged)** is archived for now: leave it as it is, no further checks there.
5. Merge origin/main, gates, then the coordinator merges this lane so the moderation card and every later lane build on the flat kit.

**2b, the redesign round after the merge** (one screen per card, David's notes are the brief; less text, icons, clean, playful):
- **Settings:** clearer layout, spacing and icons.
- **Wallet:** an actual wallet showing coins and gems with their icons, and a small "Buy gems" that opens the gem shop. Nothing else on the main view.
- **HUD (fo-esc):**
  - remove the "Tethos Island" text and "Click to look around";
  - a nicer quest tab;
  - un-cramp the time, location and wallet group;
  - plus a written card of feedback and suggestions on the overall HUD layout.
- **Friends:** each friend's character, stats, date added, nickname and last online, plus suggestions on the card.
- **Fishing tourney:** rows with character icons, taking its cue from the volleyball UI.
- **Cafe goals:** one universal contribution UI: icons, little text, easy to contribute, fun.
- **Museum curator:**
  - the bag opens on the right, and you drag an item to the left to donate it;
  - a physical giving action, less text;
  - several donations in one go.
- **Oracle quiz:** a scene. The oracle sits in front of you with a crystal ball between you, first-person like the sushi bar. She asks the question and lays four cards on the floor to choose from.
- **Paper things (fo-paper):** "yes but all ui needs to be redesigned": letters, notices and the journal get the same pass.

Open: fo-posters was marked "what" (the GENESIS posters sheet card wasn't understood); fo-questions (museum plaques, wheels following the theme, photo prints) has no answer.

## David's decisions (newest first)

- 2026-11-13, relayed by the coordinator (ledger row 335): "in the future well design ui packs, which will the entire game ui that ppl can buy with gems" (step 13).
- 2026-11-13, relayed by the coordinator: "make sure future dont drift back" (step 12).

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

12. **Make a return fail the gates** (coordinator, 2026-11-13, David: "make sure future dont drift back"):
    - ESLint `no-restricted-imports` in the web config: `@/components/recruit/ui` (and relative paths) forbidden outside `components/recruit/**`, `app/student/apply/**`, `components/admin/**` and wherever the applicant creator's cream CSS lives; any `components/gui/cream` path forbidden. The message names the flat kit, design bible UI and row 334.
    - A vitest guard (`web/components/gui/flatOnly.test.ts`) reading the tree with fs, failing with file and line when: a file outside those paths imports the recruit kit or a cream path; `components/gui/cream` exists; `UI_THEMES` has "cream" or `styles/themes/cream.css` exists; `variant="cream"`, `variant: "cream"`, `uitheme=cream` or `data-ui-theme="cream"` appears in `web/app`, `web/components`, `web/lib`; a cream palette hex (`#f7f1da #fffbe7 #fffff7 #f8f4e8 #eee9ca #e3d9b8 #d3c39c #ffeea0 #3a2e22 #4f3f31 #6b5843 #726450 #8a7b66 #946429 #bb813f #725c4e`) appears in `.css`, `.tsx`, `.ts` outside the one paper token file and the recruitment/applicant paths. Each message says what to use instead.
    - Prove both: a scratch cream import and a cream hex in a game CSS module fail lint and the guard; revert. In the report.
    - Run the guard against the ten open lane branches; list which would fail once merged.
    - The design bible's "How it's built" lists the guard and the lint rule next to rule 2.

13. **Ready for UI packs** (coordinator, 2026-11-13, ledger row 335; David: "in the future well design ui packs, which will the entire game ui that ppl can buy with gems"):
    - A pack is one theme file in `web/styles/themes/` that swaps the whole UI under `[data-ui-theme="<name>"]`, shapes as well as colours. The flat shape values (radii, shadows, border widths, panel and card surfaces, font family and weights, textures such as grain) are `--ui-*` tokens the clean theme sets on `:root`; the kit's CSS reads them. Nothing hard-coded as the `.gui` default.
    - `dark.css` stays as the dev sample and sets at least one shape token too. No shop item, no purchase flow.
    - Cream still goes. Nothing defaults to any theme but clean; no component names a theme.
    - Guard additions: files in `styles/themes/` may hold any values (cream hexes too); only `clean.css` may set `:root`/`body`, every other theme only its own `[data-ui-theme="<name>"]`; a theme name (any `UI_THEMES` entry) in component code fails, except `styles/themes/index.ts`, `DevUiTheme`, `/lab` and `/dev`. The cream-hex check covers everything outside the themes folder, the paper block and the recruitment paths.
    - Paper stays outside the theme tokens: paper things stay paper in every pack.
    - Evidence `fo-packs`: one in-game sheet and the HUD in clean and in the dark sample, colour and shape changing together.
    - Docs: `specs/polish/ui-themes.md` gets a "UI packs (row 335)" section: the token list a pack sets, components read tokens only, `<body data-ui-theme>` wears it, buying one is later work.

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

- **Review page (2026-11-14):** Flat UI Only 1, https://claude.ai/artifact/QoFX7c6WjEG2d6KToBNUMC (collection `approvals`, 20 cards). Waiting on David's marks; main moved to 3297d5aa5 (row 335 and the one-UI lane rule), merge it before the next round.

- **Done, waiting on review.** Build commit `9649cda10`; this file updated on top of it. Steps 1 to 13 built.
- **Gates:** tsc clean; vitest one run, new world (`NEXT_PUBLIC_GAME_WORLD=new`, lane rules: once): 415 files, 3856 tests pass, 4 skipped; eslint on the 52 touched files: 0; the cream grep finds only the guard itself and one quoted design note (`flat/flat.module.css` 285, David 10-28 on the reward pop). Guard and lint proven to fail on a scratch cream import and a cream hex, then reverted (`specs/evidence/flat-only/guard-proof.txt`).
- **0 px:** `/student/apply` (desktop, phone), `/student/apply/ui-preview`, the applicant portal on a phone, the applicant creator and collection (desktop, phone), the marketing home (desktop, phone). Inside the paper sheets (notice board with its club goal and HQ notice, mailbox, journal): 0 px. The member closet: 0 px; the member first creator differs only in its name field (the kit's own Field).
- **What changed:**
  - Tokens: clean on `:root` (`styles/themes/clean.css`) with the pack shape tokens (`--ui-font`, weights, `--ui-r-*`, `--ui-border`, `--ui-shadow-*`, `--ui-panel-texture`); `dark.css` sets them too (squarer, deeper). `cream.css` deleted, `UI_THEMES = ["clean", "dark"]`. `game-tokens.css`: the `--gui-*` aliases resolve on `:root, [data-ui-theme]`; the painted paper tokens, the recruit-kit hooks, the reveal hooks and `[data-gui-flat]` are gone. Paper: `styles/paper.css` (`[data-gui-paper]`, the one paper block), imported by the root layout.
  - Kit: `Sheet` has no `variant` or `tone`; `IslandSheet`, `ProgressionPanel`, `ConfirmDialog` no `flat`/`variant`/`tone`; `variant.tsx` deleted. The kit's own `Button` (+ `buttonClass` for links), `Field`, `TextArea`, `Keycap`, `Dialogue` in `components/gui/index.tsx`; `Panel` dropped. Card: no `torn`, `tone` default plain ("paper" kept as its name, see questions); Banner, NameTag, Badge, sign-in pill flat. `components/gui/cream` became `components/gui/flat/folds.tsx`.
  - Creator: no `flat`; the applicant island hands in its studio (`components/recruit/applicantStudio.ts`: `applicantCreator.module.css`, the frozen cream copy, and the recruit button) through `CharacterCreator`'s `applicant` prop; `creatorStudio.ts` carries it to the controls. The game's `CharacterCreator.module.css` is merged flat.
  - Applicant island: `<main>` wears `components/recruit/applicantLook.module.css` (the old cream `--gui-*` values). `FishingOverlay` and `FishReveal` (applicant-only) moved to `components/recruit`; `celebrate` takes its colours from the caller.
  - Cream hexes out of game code: HUD wheels, chat, touch buttons, companion, minimap dot, member badge, rune guide, trip veil, toasts; museum plaques now white with ink; photo prints use the paper material values.
  - Deleted: `styles/themes/cream.css`, `components/gui/variant.tsx` (+ test), `components/gui/cream/`, `scripts/gui-paper.mjs`, `app/lab/gui/ref/` (the ACNH kit crops). `/lab/gui` shows flat only.
  - Gates: `web/components/gui/flatOnly.test.ts`, ESLint `no-restricted-imports` in `web/eslint.config.mjs`. Docs: design bible UI (row 334/335 paragraphs, "How it's built" 2 and 2b), `specs/polish/flat-ui.md`, `specs/polish/ui-themes.md` (UI packs section), `specs/recruitment-ui-kit.md`, `CODEMAP.md`.
- **Evidence** (`specs/evidence/flat-only/`): `fo-sheets.webp`, `fo-sheets-phone.webp`, `fo-pieces.webp`, `fo-paper.webp`, `fo-portal.webp`, `fo-unchanged.webp`, `fo-packs.webp`, `fo-creator.webp`, `guard-proof.txt`, `shoot.mjs`. No motion changed, so no mp4.
- **Open lanes (scan of their added lines vs this branch):** analytics (`GameAnalytics.tsx`: `data-gui-flat`, and `data-ui-theme={dark ? "dark" : "clean"}` fails the guard; `app/lab/gui/page.tsx` `data-gui-flat`; edits `cream.css`); club (`ClubSheet.tsx`: `<ProgressionPanel flat>`, fails tsc); parties and tutorial-v2 (`MiniMap.tsx` friend dot `#FFFBE7`, fails the guard); rod-titanium (`flat/moments.tsx` `data-gui-flat`; edits `cream.css`). sfx-library, title-r2, daily-return, gem-shop, market: clean. Any lane adding a `--ui-*` token must add it to clean and dark only (and every pack).

## Questions for David (fo-questions)

1. The museum's wing signs and case plaques were the cream kit's bark plaques drawn into the 3D labels; they are now flat (white, ink). Keep, or should they be world art (wood signs) instead?
2. The tool wheel, emote wheel, chat bar, touch buttons and talk box were cream HUD pieces; they now read the theme (white, ink). Fine as is?
3. `Card tone="paper"` stays as the name of the plain card because portal page files (owned by the play.tethos.ca session: admin/quests, portfolio, quests) pass it. Rename it there later?
4. Photo prints (the photo frame) use the paper material's values (`--ui-paper`, nearly the old cream). Paper or flat white?
5. The top-level student pages (check-in, opening-soon, election, onboarding, marketplace) still name `--gui-confetti`; it now resolves to the pack texture (none in clean). Their owner may want to drop it.

## Next

1. Coordinator review of the evidence; David's answers to the questions above.
2. Merge notes: club, analytics, parties, tutorial-v2 and rod-titanium need the fixes listed above when they merge after this.

## Tools and gotchas

- New worktree: `node_modules` is cloned (`cp -Rc`), and `web/.env.local` is symlinked to the main checkout's.
- Locks: `LANE=game/flat-only /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|devserver <cmd>` for vitest, builds and the dev server.
- Never use ports 3000, 3300, 3301 or 3390.
- Stale `.next/types` can break tsc: `rm -rf web/.next/types web/.next/dev/types`.
- Shots: `specs/evidence/flat-only/shoot.mjs` (headless, muted, reduced motion; `PORT=3482 node ../specs/evidence/flat-only/shoot.mjs <out> [scene ...]` from web/). World sheets load fast at `/lab/island?sheet=<name>` (~12 s each); `sheet=path` opens nothing there. The real applicant island needs Supabase (blanked), so its creator and collection are shot on `/dev/flat-ui?surface=creator-applicant|collection-applicant`, which now renders them in the island's own frame. The marketing home animates: shoot it with `frozen` (seeded random, Playwright clock) to compare.
- Before shots ran from an APFS clone of the base tree (`cp -Rc web <scratch>`), so building and shooting could overlap.
- zsh doesn't word-split `$FILES`: feed eslint a file list through xargs.
