# Ponytail audit: game snapshot 2026-09-26

Scope: `git diff 30db173 wip/game-snapshot-2026-09-26 -- web` (snapshot commit 662dd76). Measured: 364 files, +20,520 / -1,265 lines. The 29k figure includes working-tree edits made after the snapshot. Line refs are at 662dd76; re-find by symbol before editing. Read-only audit: nothing was built, run or tested.

Estimated removable: **~1,400 lines** with no product decision, **~1,800** including the two items tagged DECISION.

---

## Correctness risks (fix in the 029-034 drafts before they are applied)

**R1. HIGH: members can mint coins through member_collections.**
023 lets members INSERT/UPDATE their own `member_collections` rows with no bound on `count` (023_member_collections.sql:36-45, "Collections insert own" / "Collections update own"; 023 is applied in prod). The route comment "no economy rides on this counter" (app/api/collections/route.ts:87-89) stops being true with 033: `economy_sell` (20260926150600_economy.sql:264) pays up to 600 coins per legendary, and `progression_commit_contribution` (029) turns materials/specimens into monument points. A member can PATCH `count` through PostgREST, sell, then buy rooms and shop items or push the club goal. Separately, POST /api/collections -> `collections_record_catch` (031:97) takes any `item_key` with no key, cap or rate limit.
- Fix: in 033 drop both 023 write policies; delete the 023 read-modify-write fallback in app/api/collections/route.ts:87-115 in the same batch; add a per-member daily cap (or a server-issued catch token) to `collections_record_catch`.
- Test: in 033_smoke.sql, as `authenticated`, `UPDATE member_collections SET count = 999` affects 0 rows.

**R2. HIGH (verify on prod): column-level REVOKEs do nothing in Supabase.**
Postgres ignores `REVOKE UPDATE (col)` while the role holds table-level UPDATE, and Supabase grants table-level ALL on public tables to `authenticated`. So 20260926150700_identity.sql:15 (`membership, class, subclass`) and 20260926150000_game_coins.sql:24,213 protect nothing. Under 001's "Users can update own profile" (001_initial_schema.sql:462) a member can also write `profiles.tier` and `profiles.tethos_coins`. The tier hole predates this branch, but every new T1/T2 gate trusts it (lib/server/memberContext.ts:25, `merch_resolve`, `adminCredit`, `moderate`), and 033 makes Gems redeemable for physical merch (`merch_reserve`). A public account can also self-set `membership = 'member'`. The 034 smoke assert (supabase/tests/034_smoke.sql:74) passes only because it runs on a throwaway cluster ("Never run against Supabase").
- Fix: `REVOKE UPDATE ON profiles FROM authenticated; GRANT UPDATE (<self-editable columns>) ON profiles TO authenticated;`, or a BEFORE UPDATE trigger that rejects changes to tier/tethos_coins/membership/class.
- Test: on prod, `SELECT has_column_privilege('authenticated','profiles','tier','UPDATE')` is false (same for tethos_coins, membership).

**R3. MEDIUM: `economy_sell` loses items on an overlapping same-key retry.**
It checks the replay key (20260926150600_economy.sql:276) before taking any lock. A retry that arrives while the first call is still running passes the check, waits on the `member_collections` row, decrements again, then `wallet_apply` sees the committed key and replays without paying. The function still returns `replayed = false` with `paid`. This loses items whenever the member holds at least 2x qty. Every other money function either locks first (`home_buy_room`, `study_settle`, `oracle_start`) or fails on a unique insert (`economy_buy` through the item lock, `merch_reserve`, `progression_commit_contribution`, `museum_donate`).
- Fix: make the first statement `PERFORM pg_advisory_xact_lock(hashtext(p_member_id::text || v_key));`, or lock the wallets row, before the EXISTS check.
- Test: two sessions call `economy_sell(m, 'fish_dace', 1, 'k1234567')` at the same time with count 5. Result: count 4 and one ledger row.

**R4. MEDIUM: Gems are still written outside `wallet_apply`.**
The pre-existing app/api/economy/route.ts POST (marketplace purchase, avatar purchase, award) and lib/supabase/helpers.ts `awardRewards` (bounties, achievements, onboarding) read-modify-write `profiles.tethos_coins` with no lock and no idempotency key. After 033 they race the gem branch of `wallet_apply` (merch reserve and refund) and can lose updates, so the "one write path" claim in 033's header is false. Two Gem shops also coexist: /student/dashboard/shop (ShopView -> /api/economy) and /student/dashboard/economy/shop (ShopBody -> economy_buy/merch_reserve).
- Fix: send the Gem part of `awardRewards` and the legacy purchase through `wallet_apply(..., 'gems', ...)` on the admin client, and retire one shop.
- Test: `rg -n "tethos_coins" web/app web/lib` shows no `.update(` writer outside wallet_apply.

**R5. MEDIUM: 034 renames classes to families, but the portal still uses the old names.**
034 sets `profiles.class` to Arcane/Ranger/Vanguard/Warden (20260926150700_identity.sql:269, 316). components/portal/classIdentity.tsx:14 `CLASS_META` and the MemberDirectory.tsx:132-135 filter only know Warrior/Mage/Healer/Rogue. After 034, class badges vanish from Sidebar, MemberCard and ProfileView, and the directory filter matches nobody.
- Fix: build `CLASS_META` from `FAMILIES` in lib/game/oracle/family.ts (item 17).
- Test: `<ClassBadge cls="Arcane" />` renders.

**R6. LOW: the price shown differs from the price paid.**
- `sellList` shows the TS `SELL_PRICES` (lib/wallet/service.ts:130), but `economy_sell` pays from the `sell_prices` table, which T1/T2 may edit (033:176) and which has no admin UI. The `economy_settings` rows `special_count` and `special_discount_pct` are seeded (033:485) but never read, because TS uses the `SETTINGS` constants (rules.ts:72).
- Local mirrors: WharfSellSheet pays locally from fishing.ts `SELL_PRICES` (seaking 2500) while the server pays 600, and gear.ts sells `rod_cedar` for 350 locally against 400 in the catalogue. ContributeSheet (new code) shows `localCoins()` (ContributeSheet.tsx:28, 54), not the server wallet.
- Fix: items 3 and 21.

**R7. LOW: a donate retry is not idempotent.** DonateSheet.tsx:20 builds a fresh key per click (`donate:${key}:${Date.now()}`), so a retry after a timeout tells the member who already donated "already donated". Use `donate:${speciesKey}`, since each species can only be donated once anyway.

**R8. LOW: some routes authenticate twice.** /api/study/chat POST (route.ts:17-23) calls `studyContext()` and then `memberContext()` again. /api/collections POST calls `createClient().auth.getUser()` and then `collectionsContext()`. /api/progression/letters POST builds a second admin client for the mute check. Each of these costs two `getUser` calls and two profile reads per request. See item 19.

Not a bug: the daily login gift (033 `daily_gift_claim`) and per-minute study coins reward online activity, which CLAUDE.md principle 3 rules out. It needs a one-line confirm from David that economy v2 overrides the principle.

---

## Cleanup list (prioritised)

Format: Files / Keep / Delete or merge / ~lines / Test.

### 1. Two Oracle reading UIs (~535)
- Files: components/oracle/OracleReading.tsx (248), components/oracle/oracle.module.css (26), lib/oracle/transport.ts (43; `httpOracleTransport` is used only by OracleReading and `memoryOracleTransport` has no importer), app/dev/oracle/* (216). Compare with components/game/oracle/OracleQuizSheet.tsx, OracleSheetEmbed.tsx and lib/game/oracle/{client,family}.ts.
- Keep: OracleQuizSheet, lib/game/oracle/client.ts, family.ts (in-world, keyboard input, embedded mode, demo hook).
- Delete or merge: app/student/dashboard/oracle/page.tsx renders `<OracleSheetEmbed />`, which the OverlaySheet path already does. Delete OracleReading, oracle.module.css and lib/oracle/transport.ts. That also removes duplicate tables that disagree today: answer labels ("Strongly agree", OracleReading.tsx:15, vs "That's me", family.ts:34), KEEPER vs REACTIONS, BLURB vs `FAMILIES.blurb`, HEX (OracleReading.tsx:30, OracleHarness.tsx:18) vs `FAMILIES.color`, and POLE (two copies). Delete /dev/oracle: `/student/dashboard?oracle=demo&family=INTJ&name=Maya` covers the quiz, tie, result and settings views, and its NamePicker previews a UI that doesn't exist. The 4-line family reveal appears in both DefaultIslandWorld.tsx:611-617 and OracleSheetEmbed.tsx:17-21; replace both with one `FamilyReveal`.
- Test: `npx vitest run lib/oracle lib/game/oracle` passes, and `/student/dashboard/oracle?oracle=demo` shows `[data-testid=oracle-quiz]` and completes a reading.

### 2. Shared server plumbing: auth, Result, errors (~220)
- Files:
  - lib/progression/deps.ts (41): lines 18-37 are memberContext.ts:17-36 verbatim.
  - lib/progression/http.ts (18): `respond` is `jsonResult` (memberContext.ts:38).
  - The five one-line wrappers in lib/{homes-sync,collections,study,wallet,identity}/deps.ts.
  - `Result<T>`, 8 copies: wallet/service.ts:11, collections/service.ts:8, progression/service.ts:20, oracle/service.ts:11, homes-sync/service.ts:4, identity/service.ts:6, study/service.ts:9, study/chat.ts:15.
  - Error classes, 6 copies: wallet/store.ts:6, collections/store.ts:5, progression/store.ts:12, homes-sync/store.ts:4, identity/store.ts:5, study/store.ts:19.
  - PG `raise()`, 6 copies with the same MISSING code list: wallet/supabaseStore.ts:7, collections/supabaseStore.ts:8, progression/supabaseStore.ts:19, homes-sync/supabaseStore.ts:5, identity/supabaseStore.ts:8, study/supabaseStore.ts:6.
  - `fail`/ERR mappers, 6 copies.
  - try/catch `storeFailure` in 5 progression routes (goals, goals/sync, letters, letters/[id], prefs).
  - T1/T2 check, 4 copies: progression/deps.ts:39, economy/admin/merch/route.ts:10, economy/admin/merch/[id]/route.ts:13, identity/service.ts:89.
- Keep: `memberContext()` and `jsonResult()` in lib/server/memberContext.ts, and each domain's ERR message table (the copy differs by domain; that is content, not duplication).
- Delete or merge: add `isAdminTier`, `withStore(make)`, `Result<T>`, `DomainError(code)`, `raisePg(error, codes)` and `toFailure(ERR)` to memberContext.ts. `raisePg` must sort codes by length like wallet does, so `insufficient` doesn't shadow `insufficient_items`. Delete progression/deps.ts, progression/http.ts and the five wrappers; routes call `withStore(supabaseXStore)`. `momentFrom` moves to the time helper (item 10). Progression routes return service Results through `jsonResult`.
- Test: `npx vitest run lib/progression lib/wallet lib/collections lib/study lib/identity lib/oracle lib/homes-sync`. The mock target in lib/progression/routes.test.ts moves from `@/lib/progression/deps` to `@/lib/server/memberContext`.

### 3. DECISION: the legacy local-first economy is superseded (~380)
- Files:
  - lib/game/coins.ts: `earnCoins` still POSTs /api/coins on every sale (coins.ts:40), and that route now returns 410.
  - lib/game/gear.ts (72): `buyGear` debits locally at the old price.
  - components/game/WharfSellSheet.tsx (227): local `SELL_PRICES`.
  - app/api/sell/route.ts (29) and app/api/gear/route.ts (44): shims that invent a random key per call, so they are not idempotent.
  - app/api/coins POST (returns 410).
  - ContributeSheet.tsx:28, 54: reads and spends `localCoins`.
- Keep: the 033 wallet as the only balance, plus `SellBody`/`ShopBody` from EconomySheets.
- Delete or merge: the Wharf renders `SellBody` and `ShopBody` (tools tab); ContributeSheet reads `httpEconomyTransport.wallet()`; delete the `earnCoins` POST, `buyGear`, the WharfSellSheet local sale, /api/sell, /api/gear and the /api/coins POST. Needs David's call, because it ends offline/env-less coin play in the legacy GameWorld.
- Test: selling one dace at the Wharf sends one POST /api/economy/sell that returns 200, and the wallet sheet balance equals the latest `wallet_ledger.balance_after`.

### 4. Overlapping dev harnesses (~205)
- Files: app/dev/systems/* (192); app/dev/progression/Harness.tsx:39-50 (a copy of lib/game/progressionDemo.ts:25-34); app/dev/economy/EconomyHarness.tsx:57, which inlines `EconomySheets.ShopSheet` (EconomySheets.tsx:286; no other importer).
- Keep: /dev/economy and /dev/progression, which render the real product sheets.
- Delete or merge: delete /dev/systems (it says "Not product UI" at SystemsHarness.tsx:7-8); `?collections=demo` shows the real journal, museum and trophies, and `?home=1` the home. Export the fetch route switch from progressionDemo and call it from Harness. The economy harness uses `ShopSheet` with an `initialTab` prop.
- Test: `/dev/progression?demo=1&sheet=contribute` and `/dev/economy?view=shop&tab=specials` render as before.

### 5. One client fetch helper and one key helper (~70)
- Files:
  - `call<T>()`: lib/wallet/transport.ts:30, lib/study/transport.ts:34, lib/progression/client.ts:19, lib/game/oracle/client.ts:11 (lib/oracle/transport.ts goes in item 1).
  - Four RequestError classes plus `OracleError`.
  - Ad-hoc collections fetch-and-parse: JournalPages.tsx:20, ShowcaseSheets.tsx:19,48,60, DonateSheet.tsx:19, DefaultIslandWorld.tsx:388, lib/game/identity.ts:43,57.
  - Key generators, 5 copies: wallet/transport.ts:52, progression/client.ts:67, homes-sync/remoteStore.ts:36, OracleReading.tsx:41, and lib/game/oracle/client.ts:27 (Date.now plus random, no randomUUID).
- Keep: the pre-existing error shape (ChatRequestError and GuestbookRequestError use the same `{message, status}`), and the Oracle client's friendly 401/cooldown wording as a thin wrapper.
- Delete or merge: lib/apiClient.ts with `ApiError`, `apiCall(path, key, body?, method?)` and `newKey()`. Transports become maps of `apiCall`. The island Oracle start uses `newKey()`, so a retried start is a replay.
- Test: `npx vitest run lib/game/oracle/client.test.ts lib/study lib/wallet lib/homes-sync`, and `rg -c "randomUUID\(\) :" web/lib web/components` returns 1.

### 6. Homes: dead store, unused barrel, speculative mailbox (~55)
- Files:
  - lib/homes/store.ts `createHomeStore`: remoteStore.ts:2 calls itself its "drop-in replacement", and only layout.test.ts:107-116 still uses it.
  - lib/homes/index.ts: no importer.
  - `HomeRecord.mailbox` and `DEFAULT_MAILBOX` (homes-sync/store.ts:14, rules.ts:20, memoryStore.ts:19, supabaseStore.ts:19,30), plus 20260926150300_homes.sql:19-20 `mailbox_x`/`mailbox_z`. Nothing writes them, and HomeIslandScene uses `HOME_MAILBOX` from homeIsland.ts.
  - Optional: `home_room_purchases` (030:39-58) duplicates the wallet_ledger `room:` row.
- Keep: `createRemoteHomeStore`, layout.ts, `HOME_MAILBOX`.
- Delete or merge: move `HOME_LAYOUT_KEY` into remoteStore.ts and delete the rest. 030 is a draft, so editing it is allowed.
- Test: `npx vitest run lib/homes lib/homes-sync`.

### 7. The progression world bridge is two layers (~45)
- Files: lib/progression/worldBridge.ts (77) and lib/game/progressionBridge.ts (150).
  - `WorldGoalId` is defined twice (worldBridge.ts:19, progressionBridge.ts:25).
  - `ProgressionWorldState`, `WorldGoal` and `WorldObjective` restate `WorldProgression`.
  - `useProgressionSource` (91-93) is a one-line wrapper.
  - `STUB_STATE` (49-54) has no reader.
  - The local `monumentStage(progress)` (57-60) recomputes the `stage` the server already puts on GoalProgressView (goals.ts:128, service.ts:86).
- Keep: `toWorldProgression`, the ceremony helpers, `resolveAnchor`, `chapterOneActions`.
- Delete or merge: use one type (`WorldProgression` plus the ceremony fields) and carry `stage` through `activeGoal`. Delete `STUB_STATE`, the second `WorldGoalId` and the local `monumentStage`.
- Test: `npx vitest run lib/progression/bridge.test.ts lib/game/progressionBridge.test.ts`. Move the stage-table assertion to `goals.monumentStage` in percent.

### 8. Three copies of the profanity list (~40)
- Files: lib/moderation/profanity.ts (new, 14 lines), lib/npc/chatHelpers.ts:15-44 (pre-existing `PROFANITY_BLOCKLIST` + `containsProfanity`), app/api/guestbook/route.ts:59 (a pre-existing private copy). The new file's own comment says "same list as the guestbook and NPC chat routes".
- Keep: lib/moderation/profanity.ts, which is the right home.
- Delete or merge: chatHelpers re-exports it and guestbook imports it. `RESERVED_BAD` in identity/names.ts stays, because it does substring matching, which is a different job.
- Test: `npx vitest run lib/npc/chatHelpers.test.ts lib/identity lib/study`.

### 9. Demo fetch shims (~35)
- Files: lib/game/collectionsDemo.ts (66), lib/game/progressionDemo.ts (35), lib/game/oracle/demo.ts (59) and app/dev/progression/Harness.tsx:39-50 repeat the same boilerplate four times: installed flag, prod guard, URL parse, `realFetch`, JSON body parse, Result-to-Response encoder. There are three different flags (`?collections=demo`, `?progression=demo`, `?oracle=demo`), plus `?demo=` on the study companion.
- Keep: each domain's seed and route switch.
- Delete or merge: lib/game/demoFetch.ts `installDemoFetch(flag, prefix, handle)`; each shim becomes a seed plus a switch. Optional: a single `?demo=collections,progression,oracle` flag.
- Test: `/student/dashboard?collections=demo&progression=demo&oracle=demo` shows the seeded journal, monument and temple. Unit test: `installDemoFetch` is a no-op when `NODE_ENV=production`.

### 10. Nine Toronto time helpers (~30, fixes a month bug)
- Files:
  - wallet/rules.ts:32 `torontoDay`, season.ts:20 `torontoDay`, sunTimes.ts:50 `torontoDate`.
  - islandTime.ts:11 `torontoHour`, islandWeather.ts:53 `torontoHourKey`, and peaceful.ts:73 `hourKey`, which equals `torontoHourKey` minus ":00".
  - collections/logic.ts:204 `weekStart`, collections/deps.ts:13 `momentFrom`, collectionsDemo.ts:55.
  - main has a tenth: lib/game/applicantTime.ts:3.
  - Bug: usePeacefulContext.ts:39 and collectionsDemo.ts:56 take the month from local `getMonth()` while the hour is Toronto time.
- Keep: islandTime.ts as the home (or lib/time.ts, since server code uses it too).
- Delete or merge: `torontoParts(date)` returning `{year, month, day, hour, minute, weekday}`; every helper above becomes 1-3 lines. `weekStart` moves out of collections (study/service.ts:5 imports it from there today).
- Test: `npx vitest run lib/game/season.test.ts lib/game/sunTimes.test.ts lib/game/islandTime.test.ts lib/game/islandWeather.test.ts lib/game/peaceful.test.ts lib/collections lib/wallet lib/study`, and `rg -c 'timeZone: "America/Toronto"' web/lib/game web/lib/wallet web/lib/collections` returns 1.

### 11. Dead code (~30, +35 optional)
- `resetSyncThrottle` (progression/sync.ts:27), `MIN_ANSWERED` (oracle/engine.ts:17), `ITEM_COUNT` (oracle/items.ts:121), and `ShopSheet` if item 4 doesn't adopt it.
- /api/study/tables (12 lines): no caller, and it returns `getState().tables`, which /api/study/state already returns.
- The "Catch board" placeholder sheet (DefaultIslandWorld.tsx:619-624, "Placeholder · village core milestone", plus `"catch"` in `Sheet`). The collections journal now shows exactly those clues, so the catch board should open the journal instead.
- Optional: /api/identity/name and /api/identity/report have no UI caller (only the dev harness calls the service). Keep them only if the name creator ships this sprint.
- Also: about 60 exports are only used inside their own file (e.g. goals.ts `normalizeWeights`, study/chat.ts `CHAT_*`). Drop the `export` while touching those files; no line change.
- Test: `rg -n "study/tables|resetSyncThrottle|MIN_ANSWERED|ITEM_COUNT|island-sheet-title" web` finds nothing, and `npx vitest run` passes.

### 12. Five in-memory wallets (~25)
- Files: coin maps in homes-sync/memoryStore.ts:34-46, identity/memoryStore.ts:112, progression/memoryStore.ts:157-162, study/memoryStore.ts:100, wallet/memoryStore.ts:136. In SQL these are one `wallet_apply`; in the demos a member has five balances.
- Keep: the memory stores. They are the test doubles for six services and back the demos. Because they mirror the SQL rules by hand, the SQL smoke tests stay the authority for money paths; don't add logic here.
- Delete or merge: one `memoryWallet()` passed into each memory store.
- Test: `npx vitest run lib`.

### 13. The study chime bypasses AudioManager (~20)
- lib/study/chime.ts (22) builds its own AudioContext and ignores the player's volume and mute settings (lib/game/audio.ts `AudioManager`). Use `AudioManager.playSFX("confirm")`, or add a "chime" SFX asset.
- Test: with audio muted in settings, the companion page plays no chime.

### 14. A double barrel for three sheets (~18)
- components/progression/index.ts (9) is re-exported by components/game/progressionSheets.tsx (9) for a single importer (DefaultIslandWorld.tsx:23). Import the sheets directly and delete both files.
- Test: `npx tsc --noEmit`.

### 15. Hash and RNG copies (~15)
- FNV-1a appears four times: wallet/rules.ts:36, wallet/service.ts:168 `pickupCode`, oracle/engine.ts:112 `itemOrder`, peaceful.ts:83. `rng` at wallet/rules.ts:44 is byte-for-byte the pre-existing `seededRandom` (lib/game/weatherSystem.ts:296).
- Keep: `seededRandom`. Add `fnv1a(str)` beside it; the four hash prefixes become one call and the outputs stay identical.
- Test: before the refactor, snapshot `dailySpecials(seedItems(), "2026-09-26")`, `itemOrder("x")`, `pickupCode("m","k")` and one `rollNode(...)`, then assert they are equal afterwards.

### 16. Island sheet chrome, 7 copies (~15)
- `<section role="dialog" aria-modal="false"><header><h2/><button aria-label="Close">×</button></header>` appears in ShowcaseSheets.tsx:24,65, DonateSheet.tsx:42, WardrobeSheet.tsx:38, SettingsSheet.tsx:45, OracleQuizSheet.tsx:102 and DefaultIslandWorld.tsx:620.
- Keep: the DefaultIslandWorld.module.css styles and the world's global Escape handler (DefaultIslandWorld.tsx:506). ProgressionPanel stays for the modal sheets.
- Delete or merge: `IslandSheet({title, onClose, className, testId, embedded})` in components/game.
- Test: each sheet keeps its data-testid and closes on × and Escape.

### 17. Duplicate tables and formatters (~15)
- EconomySheets.tsx:16-17 `sym`/`fmt` re-implement `fmtCoins`/`fmtGems` from lib/economy, which already existed and which no new code uses. About 10 other sites build `${n} ${COINS.symbol}` by hand.
- ShopEditor's `EditorCategory`/`TIERS`/`SLOTS` re-type `ShopCategory`/`Tier`/`Slot` from lib/wallet/catalogue.ts.
- JournalPages.tsx `RARITY_COLOR` duplicates `RARITY_META` in lib/game/fishing.ts.
- Family colour lives in 4 places: engine.ts:20 `FAMILY_COLOR` (colour names), family.ts `FAMILIES` (hex), and the two HEX maps removed in item 1. Portal classIdentity.tsx `CLASS_META` is the fifth (see R5).
- Keep: the lib/economy formatters, the catalogue.ts types and `FAMILIES`.
- Test: `npx vitest run lib/wallet`, then a visual check of the shop, the journal and a member card.

### 18. Seed generator scripts (~14)
- scripts/gen-economy-seed.mjs and scripts/gen-collections-seed.mjs are the same 14 lines with a different import, and `jiti` is only a transitive dependency. Merge them into one gen-seeds.mjs.
- progression/defaults.ts and study/tables.ts mirror the 029 and 032 seeds by hand with no sync test. Add the same `toContain` test the other two have.
- Test: run the script, then `git diff --exit-code web/supabase/migrations`.

### 19. Mute check and double auth (~10, halves auth calls on these routes)
- Files: app/api/study/chat/route.ts:17-23, app/api/progression/letters/route.ts:35, app/api/collections/route.ts:52-64 and 80, lib/identity/mute.ts.
- Delete or merge: `mutedUntil(ctx)` reuses the context's db; study chat uses a single context; collections POST uses only `collectionsContext()` (the 023 path goes with R1).
- Test: a muted member gets 403 with code "muted" from POST /api/study/chat and /api/progression/letters; an unmuted member gets 200.

### 20. Idempotency-key schema, 8 copies (~6)
- `z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/)` is repeated in economy/buy, economy/sell, economy/merch/reserve, collections/museum/donate, homes/layout, homes/rooms, progression/contribute, oracle/start (plus the legacy gear and sell routes). progression/goals/[slug]/credit/route.ts:11 uses `min(8).max(128)` with no charset. Export one `IdemKey` from memberContext.ts. Tightening the credit route changes behaviour, so do it in its own commit or leave credit as is.
- Test: the route tests pass, and POST /api/economy/buy with a 7-character key returns 400.

### 21. Admin-tunable tables with no admin UI and one reader (~5 SQL)
- 033 `sell_prices` is writable by T1/T2, but the shop shows the TS `SELL_PRICES`. `economy_settings` seeds `special_count` and `special_discount_pct`, which nothing reads.
- Two options: drop the T1/T2 write policies and the two unused rows, so the constants stay the single source and the generator keeps SQL in sync; or have `sellList` read `sell_prices`. The first is smaller.
- Test: the economy.test "seed in migration" check still passes.

### 22. DECISION: stubs that the shop now duplicates (0 lines now)
- lib/game/wardrobe.ts `WARDROBE_STUB` gives away hair/top/bottom/accessory items for free (localStorage), while the shop sells outfit/hair/accessory items with server-side equip. The slots don't match either (top/bottom vs outfit).
- lib/homes/catalogue.ts furniture can be placed for free in DecorateSheet ("catalogue stub (inventory later)"), while the shop sells the same pieces as `furn-*` items.
- The world gives away what the shop sells. Once David picks the rule, wire WardrobeSheet and DecorateSheet to /api/economy/inventory and delete the stubs.

---

## Deliberately not flagged
Zod validation on every route; SQL re-checks of prices, caps and tiers inside the SECURITY DEFINER functions; REVOKE/GRANT on the functions; per-member idempotency tables; the "unavailable" 503 fallbacks; the memory stores as test doubles; and the inline RLS tier subquery (36 copies across 029-034). The tier subquery matches the pre-branch pattern; an `is_admin()` SQL function is optional.

---

## Order for the cleanup agent
Small `[build]` commits, running `npx vitest run` after each. Re-find symbols first; line numbers are at 662dd76, and other agents are editing this worktree.

0. Risk fixes in the draft migrations first, as separate commits and with David's OK: R1, R3, R2, then R5 together with item 17. 029-034 are unapplied drafts, so editing them is allowed.
1. Pure deletions: item 11, item 14, item 6, item 4 (/dev/systems and ShopSheet).
2. Item 8 (profanity), item 15 (hash), item 10 (time; the month fix in its own commit).
3. Item 2 (server plumbing): the result/error module, then `withStore` and the deps deletions, then the progression routes. Then items 19 and 20.
4. Item 5 (client `apiCall`/`newKey`).
5. Item 1 (Oracle consolidation), then delete /dev/oracle.
6. Item 9 (demo shim), then the Harness reuse (the rest of item 4).
7. Item 7 (bridge collapse).
8. Items 16, 17, 13, 12, 18, 21.
9. Items 3 and 22, only after David decides.
