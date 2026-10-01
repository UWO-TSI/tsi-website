# Polish: menus and sheets

Audit: `audit-ui-flows.md` items 5–11 and its spec B (plus parts of C). Paths under `web/`; DIW = `components/game/DefaultIslandWorld.tsx`. The standard is in `README.md`. Runs after `hud-first-login.md`.

## Problems
- **Island sheets** (settings, Oracle, donate, trophy, showcase, missions, tourney):
  - no focus handling and no open or close animation;
  - Escape stops working once a button inside has focus (DIW:624);
  - the donate sheet never closes on Escape (DIW:635);
  - E/J/M/L still fire behind the collection book, so you can walk through a door behind it;
  - G opens the emote menu over the creator (`PlayerCharacterUI.tsx:27`);
  - J and L open their sheets but don't close them.
- **Dark surfaces against the cream kit:** the nameplate, emote menu, audio buttons, Oracle reveal card (DIW.css:168), `actionNote`, and the fish-reveal backdrop (`FishReveal.tsx:212`). `styles/game-tokens.css` (navy tokens) is imported nowhere.
- **Text and fonts:**
  - 34 uses of 9–10px text (21 in DIW.css);
  - five font setups;
  - the text-size setting skips toasts, nameplates, emotes, fishing and the creator.
- **Names:**
  - The HUD button "Journal" opens the collection, while J opens a different "Journal" (quests).
  - HQ, Clubhouse and Village Hall all name the same building.
  - Coins vs TC vs 🪙.
- **Keys:**
  - "Open wallet" (K) and "Confirm" (Enter) are listed in Settings, but nothing listens.
  - The ruins controls bar hardcodes 1–4 and R (DIW:759).
  - The [ and ] tab keys work only in `JournalPages`.
  - Ability keys use `toUpperCase` instead of `keyName` (`SettingsSheet.tsx:114`).
- **Copy, errors and empty states:**
  - Mail load errors say "The mailbox is empty for now" (`LettersSheet.tsx:54`).
  - The trophy sheet turns every error into "Sign in" and prints a raw date (`ShowcaseSheets.tsx:26-27`).
  - The showcase has no empty state and no way to clear a slot.
  - Shop tiles use emoji art and empty tabs show nothing.
  - Leftover developer copy: "Saved collection loaded", "Toronto now", "Eyes 3".
  - The collection book is titled "🧺 Collection" and uses ❔/🧺 emoji with an out-of-date fruit list (`CollectionBook.tsx:30-97`).
- **Creator:**
  - The typed name is dropped if you confirm within the 400ms name check or press Skip (`CharacterCreator.tsx:136, 181`).
  - `saveName` swallows failures (`PlayerCharacterUI.tsx:14-18`).
  - OS dark mode turns it dark (`CharacterCreator.module.css:49`).
  - The Oracle tie-breaker uses a missing `styles.tieBreaker` (`OracleQuizSheet.tsx:107`), so it renders raw browser buttons.
- **Performance:** `MissionBoardSheet.tsx:22` re-renders about 10×/s while closed in the ruins.

## Deliverable, in order (a commit each)
1. **One dialog system.**
   - Every island sheet and overlay goes on `useWorldDialog`: focus moves in and is restored on close, Escape and the opening key close it, and world hotkeys are blocked while any dialog is open.
   - A short open and close animation (scale and fade) with a soft page or paper sound.
   - Tests for the key ordering.
2. **The cream kit everywhere.** Reskin every dark surface listed above; turn `game-tokens.css` into the cream token set and import it once.
3. **Type:** a 12px minimum, one font setup across game, creator and companion, and the text-size setting applied to every overlay.
4. **Naming pass:**
   - Journal (quests and chapters), Collection (catches), Bag (items).
   - "HQ" everywhere.
   - "TC" with 🪙.
   - Remove or wire the wallet and confirm keys.
   - `keyName` everywhere, ability keys included.
5. **Copy and states:**
   - real error states (not "empty", not "sign in");
   - formatted dates;
   - a showcase empty state and slot clearing;
   - shop empty states;
   - silhouettes or real icons instead of emoji in the collection book and shop (the 10 roster entries without icons get them);
   - remove developer copy.
6. **Creator and Oracle:**
   - Keep the typed name through confirm and Skip; surface save failures.
   - Keep the creator cream regardless of OS dark mode.
   - Style the tie-breaker and the reveal card in the kit.
7. **Performance:** `MissionBoardSheet` subscribes only while open.

## Evidence
`specs/evidence/polish-menus/`:
- every sheet before and after;
- open and close frame strips;
- the text-size setting at its largest;
- keyboard-only navigation through two sheets.
