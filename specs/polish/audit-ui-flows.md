# Polish audit: UI and flows (2026-10-01, read-only survey)

Paths are relative to `web/`; DIW = `components/game/DefaultIslandWorld.tsx`. The conversion-rate leak in item 1 of section 2 was fixed in `4c3e5179`.

The most unfinished part is what's missing or out of reach, more than how things look. Members can't open the shop from the world, there's no daily gift button in the game, there's no coin readout, residents can't be talked to, and there's no boat arrival or HQ greeting. Four HUD elements overlap each other, and the dark legacy styles are still mixed in with the cream kit.

All paths are under `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/restart-art-cohesion/web/`. DIW means `components/game/DefaultIslandWorld.tsx` and DIW.css is its module CSS.

## 1. Surfaces and flows

| Surface / flow | State | Weakest moment |
|---|---|---|
| E prompt + controls bar | Works | Toasts sit at 96px (`ToastHub.module.css:1`), on top of the prompt at 78–122px (DIW.css:44). The applicant island moves its toasts to 132px; the member island doesn't. |
| Notifications | Two systems | A dark `actionNote` pill (DIW.css:91) next to cream toasts. Its timers are never cleared (DIW:563, 567, 571, 597), so a second note gets cut short. |
| Nameplate / level | Dark | Black chip with 11px name and 9px "Lv." (`PlayerAvatar.tsx:420-434`). This is the only place level shows; there is no XP display. |
| Minimap + objective | Good | Once closed there is no button to reopen it. Hidden indoors, at home and in the ruins (DIW:731). "M to hide" ignores remaps (`MiniMap.tsx:61`). |
| Clock / weather | Missing | Only a 10px hint inside "View options" (DIW:703). |
| Coins / daily gift | Missing | No coin chip. The daily gift button is only on the portal Wallet page (`EconomySheets.tsx:254-275`). |
| "View options" panel | Dev tool shipped to members | Always open on desktop (238px, top-right): pixel filter, time override, "Return to clearing", "includes development overhead" (DIW:687-718). |
| Island sheets (settings, Oracle, donate, trophy, showcase, missions, tourney) | Work | No focus handling and no open animation. Escape stops working once a button inside has focus, because the key handler returns early (DIW:624). The donate sheet never closes on Escape (DIW:635). |
| Journal, notice board, mail, shop panel | Most finished | J and L open these but don't close them. Mail load errors show as "The mailbox is empty for now" (`LettersSheet.tsx:54`). |
| Collection book | Nice open animation | Inline styles, 36px close button. Titled "🧺 Collection", while the HUD button says "Journal" (DIW:730) and J opens a different "Journal" (quests). |
| Shop / sell | Can't be reached in the world | No shop door prompt (DIW:120-130); `ShopInterior` is only used in the lab. Selling exists only as a portal page. Shop tiles use emoji art and empty tabs show nothing. |
| Creator / wardrobe | Uses the cream kit | The typed name is dropped if you confirm within the 400ms name check or press Skip (`CharacterCreator.tsx:136, 181`). `saveName` swallows failures (`PlayerCharacterUI.tsx:14-18`). OS dark mode turns it dark (`CharacterCreator.module.css:49`). |
| Oracle | Good | Tie-breaker uses `styles.tieBreaker`, which doesn't exist (`OracleQuizSheet.tsx:107`), so it renders raw browser buttons. The reveal card is dark (DIW.css:168). |
| Resident dialogue | Absent | The "!" bubble implies "click to talk" (`NPC.tsx:305`), but clicking only makes them hop (DIW:281). `NPCChatOverlay` is mounted nowhere. |
| First login | Doesn't match row 211 | Middleware sends new members to the dark portal profile wizard first (`lib/supabase/middleware.ts:120`). Then the creator, then the default spawn: no boat arrival, no HQ greeting. |
| Signed-out / returning | Dark | `/student/login` is email and password only (row 224 says Google only). In-game "Sign in…" messages have no link. |
| Loading | Three different looks | Dashboard loader (`app/student/dashboard/page.tsx:9`), a drei percentage card, and no warm-up wait (`WarmupProbe` is only used in `ApplicantWorld.tsx:88`), so the world pops in while shaders compile. |
| Companion | Usable | Emoji tab icons (🏳 for Club), system-ui font. The embedded bounty page hardcodes white text and its filter chips clip ("Cor", evidence `P-iphone-club-bounties`). "Journal" here opens the collection. No coins, quests or settings. |

## 2. Rough edges, most unfinished first

1. **Conversion-rate leak:** the portal shop prints "$X.XX or N 💎" side by side (`components/portal/ShopView.tsx:163-166, 206-207`). That reveals the Gem ≈ CAD rate that `lib/economy.ts:11-12` forbids showing.
2. **Promised features that aren't there:** resident dialogue, boat arrival and greeting, coin chip, daily gift, a shop entrance, and an unread-mail badge. The game already gets an `unreadLetters` count but never shows it, so ceremony letters (row 183) go unseen.
3. **Overlapping corners:**
   - The portal menu button (`MemberDashboardShell.tsx:57`, 12px from the top-left corner) covers the "Tethos Island" title (DIW.css:2).
   - The sound-on bell (`AudioController.tsx:38`) overlaps the options panel.
   - The mute button and the navy `QuestChecklist` bubble (`QuestChecklist.tsx:134`) share the bottom-right corner.
4. **Old portal systems on the island:**
   - `QuestChecklist` shows old quests (bounty, leaderboard, "riverbank") next to the chapter objective.
   - The sidebar's Settings link opens the portal settings page, not the in-game sheet.
   - Graphics options live in the options panel, separate from the Settings sheet.
5. **Dark panels against the cream kit:** nameplate, emote menu, audio buttons, Oracle reveal, `actionNote`, and the fish-reveal backdrop (`FishReveal.tsx:212`). `styles/game-tokens.css:58, 105-106` still defines navy panel and nameplate tokens and is imported nowhere. The recruit UI kit is used only by the creator.
6. **Confusing names:** Journal / Collection / Quests / Bag; HQ / Clubhouse / Village Hall (`NoticeSheet.tsx:22`); coins vs "TC" (`lib/economy.ts:22-26`) vs 🪙.
7. **Key labels and bindings:**
   - "Open wallet" (K) and "Confirm" (Enter) appear in Settings but nothing listens for them (`lib/identity/settings.ts:10`).
   - The ruins controls bar hardcodes 1–4 and R (DIW:759), ignoring ability remaps.
   - The [ and ] tab keys only work in `JournalPages`.
   - Ability keys are displayed with `toUpperCase` instead of `keyName` (`SettingsSheet.tsx:114`).
8. **Keyboard bugs:**
   - E/J/M/L still fire while the collection book is open (DIW:624), so you can walk through a door behind it.
   - G opens the emote menu over the creator (`PlayerCharacterUI.tsx:27`).
9. **Text and fonts:**
   - 34 uses of 9–10px text, 21 of them in DIW.css.
   - Five different font setups across the game, creator, companion and portal.
   - The text-size setting (DIW.css:190) skips toasts, nameplates, emotes, fishing and the creator.
10. **Motion and sound:**
    - Only the collection book plays open sounds (`CollectionBook.tsx:121`).
    - Nothing animates closed.
    - Door fades are silent (DIW:601-620), and the title text swaps abruptly between scenes.
11. **Copy, errors and empty states:**
    - The trophy sheet turns every error into "Sign in" and prints a raw date (`ShowcaseSheets.tsx:26-27`).
    - The showcase has no empty state and no way to clear a slot.
    - Leftover developer copy: "Saved collection loaded", "Toronto now", "Eyes 3".
12. **Probably stale label:** the forage/net prompt label is read at render (DIW:723), so walking from one node to the next likely keeps the old name.
13. **Performance:**
    - `MissionBoardSheet.tsx:22` subscribes to combat updates before checking whether it's open, so it re-renders about 10 times a second while closed in the ruins.
    - The creator adds a second WebGL canvas on top of the live world.

## 3. Proposed polish specs, in priority order

**A. HUD frame and first-login flow**
- Lay out the corners so nothing overlaps: hide the portal menu button on the island, set `--game-toast-bottom: 132px`, and fold `actionNote` into the toasts.
- Add a cream top cluster with coins, level/XP and clock/weather, plus a mail badge.
- Add a button to reopen the minimap and make its key label follow remaps.
- Move graphics and performance options into Settings; make the time override dev-only.
- Hide `QuestChecklist` on the island.
- First login: skip the portal wizard for the game, then creator → boat arrival (the boat spawn already exists) → HQ greeting using `NPCDialogue` from the recruit kit → chapter 1 objective. Add a daily gift pop-up.
- One cream "Preparing" screen that waits for `WarmupProbe`.
- Files: DIW.tsx/.css, `AudioController`, `MemberDashboardShell`, `QuestChecklist`, `ToastHub`, `MiniMap`, `SettingsSheet`, `PlayerCharacterUI`, `lib/supabase/middleware.ts`, `app/student/dashboard/page.tsx`, `LoadGate`.

**B. Sheets and menus**
- Move `IslandSheet` onto `useWorldDialog` (focus, Escape, close key) with open and close animations and sounds.
- Fix the Escape ordering at DIW:624 and block world hotkeys while any dialog is open.
- Reskin the dark surfaces to cream and turn `game-tokens.css` into the cream token set.
- 12px minimum text, one font setup, and the text-size setting applied to every overlay.
- Naming pass; remove or wire the wallet and confirm keys; use `keyName` everywhere.
- Fix the letters, trophy and showcase copy; add shop empty states and real icons; style the Oracle tie-breaker; fix the creator name bug.

**C. Reachability and companion**
- Add a shop door (shop and sell) and a wallet sheet on K.
- Either add a resident talk prompt and dialogue box (row 123) or remove the "!" bubble.
- Remove the conversion-rate leak in `ShopView`.
- Add Google sign-in and make the login page honour `?next=`.
- Companion: real icons and the kit font, a coin chip, make embedded pages readable on light backgrounds, scrollable filter chips, and a max height for `ShowcaseSheet`.

**Decisions for David:**
- The coin's name and symbol.
- What the top HUD shows (real time, date, whether coins are always visible).
- Whether members can force the time of day or use the pixel filter.
- Whether to retire the portal onboarding wizard and `QuestChecklist` for game players.
- The HQ lead's lines (waits on the resident roster, row 217).
- How far resident talk goes in v1.
- Whether the Oracle keeps its lavender look.
- Whether the portal shop should show $ prices at all.
- The companion tab icons.