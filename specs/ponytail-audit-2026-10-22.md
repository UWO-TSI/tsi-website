# Ponytail audit: the game since the Sep 30 audit (2026-10-22)

**Scope:** `git diff b855a148..d251c36e -- web realtime` (main, 1,186 commits). 2,384 files, +125,620 / −29,073 lines in all. Code (`.ts`, `.tsx`, `.mjs`): +104,588 / −26,555, of which tests are +27,400 / −550. In-scope code without tests (the member game, the portal overlays, shared lib, realtime; not the marketing site or recruitment): 852 files, +74,829 / −25,958. Binary assets: 509 GLB, 361 WebP, 20 PNG, 8 OGG.

**How measured:**
- An import-graph scan over all 1,612 source files in `web/` and `realtime/`, written on the TypeScript compiler API (no new dependency; knip, ts-prune and madge aren't installed). It resolves static imports, `import()`, `import("x").T` types, `require` and `vi.mock`, with both tsconfigs' path aliases. Results:
  - 40 modules with no importer, 34 of them marketing (out of scope);
  - 14 modules only tests import;
  - 172 exports that nothing uses, not even their own file;
  - 757 in-scope exports used only inside their own file. Dropping those `export`s is 0 lines, so they aren't listed.
  - Every candidate below was re-checked with `rg` over `web/`, `realtime/`, `art/`, `scripts/` and `specs/`, because scripts load some modules through a built `path.join` (that is how `coast.ts` hid).
- Five read-only passes, one per area: money, gems, RLS and idempotency; realtime, net, friends and moderation; frame time, memory and assets; UI leftovers, duplicates and dev pages; the status of every earlier item.
- I re-read every risk below at HEAD `d251c36e` before writing it down.
- Nothing was built, run or edited. Line estimates are net deletions after any replacement.

**Tags:** each item has one.
- **[LAUNCH-SAFE]:** no behaviour change (dead code, unused files, assets loaded while hidden). Safe before the Oct 24 freeze with tsc and the full vitest green.
- **[LAUNCH-FIX]:** a correctness, security or perf fix worth doing before launch.
- **[AFTER-LAUNCH]:** a refactor that touches live paths.
- **[DECISION]:** needs David.

**Two unmerged branches touch this ground.** `game/hq-interior` (12 commits ahead) and `game/flat-ui` (28 ahead) edit HQInterior, FounderDesk, Bag, ShopOverlay and `gui/flat`. Items in those files wait until both merge.

---

## 1. Status of the earlier audits

Paths are under `web/`. Every commit in the Sep 30 "Applied" table is an ancestor of HEAD.

### Sep 26 (`specs/ponytail-audit.md`)

| ID | Status | Evidence at HEAD |
|---|---|---|
| R1 | DONE | `20260926150900_collections_server_only.sql:15-17` drops the 023 write policies; `collections_record_catch` has hourly caps; the collections POST is `withStore` only. |
| R2 | DONE | The `profiles_guard_privileged` BEFORE UPDATE trigger; newest allowlist `20260926180000_ownership.sql:161-167` excludes tier, tethos_coins, membership, class, subclass. Prod check: the trigger exists (a column-privilege query can't prove a trigger). |
| R3 | DONE | `economy_sell` takes `pg_advisory_xact_lock` before the replay check; the newest copy (`20261003054110_backpack.sql:219-220`) keeps it. |
| R4 | DONE | `awardRewards` and the economy POST credit through the wallet; no `.update(` writer of `tethos_coins` is left. |
| R5 | DONE | `CLASS_META` is built from `FAMILIES` (`components/portal/classIdentity.tsx:19`). |
| R6 | DONE | `sell_prices` is select-only; the `special_*` rows are gone; WharfSellSheet, `gear.ts`, `localCoins` are gone. |
| R7 | DONE | `DonateSheet.tsx:28` keys on `donate:${key}`. |
| R8 | DONE | One context per route; `mutedUntil(ctx.db)` reuses it. |
| 1 | DONE | `components/oracle/`, `lib/oracle/transport.ts`, `/dev/oracle` gone; one `FamilyReveal`. |
| 2 | PARTIAL | `lib/result.ts`, `withStore`, `isAdminTier` in. Left: try/catch `storeFailure` in 4 progression routes; local `Result` in `lib/oracle/service.ts:12` and `lib/traditions/service.ts:23` (new). See A7. |
| 3 | DONE | The local-first economy (coins.ts, gear.ts, /api/sell, /api/gear, /api/coins) is gone. |
| 4 | DONE | `/dev/systems` and `ShopSheet` gone; the harness uses `routeDemoFetch`. |
| 5 | PARTIAL | `lib/apiClient.ts` in. Left: `lib/game/combat/progression.ts:19` has its own `call<T>` and a Date.now key (:29); raw collections fetches at FishingOverlay.tsx:135, DefaultIslandWorld.tsx:1047, CollectionBook.tsx:151. See A7 and R18. |
| 6 | DONE | Dead homes store, barrel and mailbox gone. |
| 7 | DONE | One `WorldGoalId`; `STUB_STATE` and the local `monumentStage` gone. |
| 8 | DONE | One profanity list. |
| 9 | DONE | `lib/game/demoFetch.ts`. |
| 10 | DONE | `lib/time.ts:8` `torontoParts`. |
| 11 | DONE | Listed symbols and `/api/study/tables` gone; the catch board opens the bag. |
| 12 | OPEN | Now 6 in-memory coin maps (combat added one, `lib/combat/memoryStore.ts:24`). See A7. |
| 13 | DONE | `lib/study/chime.ts` gone. |
| 14 | DONE | Both barrels gone. |
| 15 | DONE, with new drift | The 4 sites use `fnv1a`. 4 new hand copies: `collections/treats.ts:21`, `residentRoutine.ts:95`, `halloween.ts:20`, `crafting/memoryStore.ts:30`. See A3. |
| 16 | DONE | `components/game/IslandSheet.tsx`, 9 users. |
| 17 | PARTIAL | Left: literal `TIERS`/`SLOTS` in ShopEditor.tsx:42-43; `FAMILY_COLOR` in the oracle engine. See A7. |
| 18 | DONE | One `scripts/gen-seeds.mjs`; parity in `lib/seedMigrations.ts`. |
| 19 | DONE | See R8. |
| 20 | DONE | `IdemKey` in 17 routes; one local copy at `collections/service.ts:274`. |
| 21 | DONE | See R6. |
| 22 | DONE | Wardrobe stub gone; DecorateSheet uses `useOwned`; the server checks ownership. |

### Sep 30 (`specs/ponytail-audit-2026-09-30.md`)

| ID | Status | Evidence at HEAD |
|---|---|---|
| 1.1, 1.2, 1.3, 1.4 | DONE | AmbientLife exports only `Fireflies`; LeafGusts, the lab palette/grade/FOV state and the PostFX props are gone. |
| 1.5 | PARTIAL, by design | ENV_PHASES and ENV_KEY gone; audio keeps its "dusk" key. |
| 1.6, 1.7, 1.8, 1.9, 1.10 | DONE | `applyWaterShader` gone; uniforms generated (`waterShader.ts:389`); `applyTerrainMaterials` gone; `sunFromCamera` test-only; no per-frame traverse in GridWorld. |
| 1.11 | PARTIAL | Glow fixed (`components/recruit/ApplicantWorld.tsx:210`); the hand-built environment (:138) stays. Recruitment code, leave it. |
| 1.12, 1.13 | DONE | `treeParts` at IslandAtmosphere.tsx:108; `LIVE` pruned (LookMaterials.tsx:103). |
| 2.1, 2.2, 2.3 | DONE | |
| 3.1 to 3.15 | DONE | River, Path, landmarkDiscovery gone; `objectFootprint`, `isWater`/`isLandCell`, `cloneWorld` in place; the painter effect is split. |
| 4.1, 4.2, 4.3, 4.5, 4.6, 4.8, 4.10 | DONE | `FIXED_KEYS` and `useNextKey` in; `groundPick.ts` gone. New gap in FIXED_KEYS: R14. |
| 4.4 | OPEN | Focus plus `useFollowCamera` still in 4 scenes; the skip reason (PlayerAvatar remounts on travel) still holds. See A8. |
| 4.7 | OPEN | `preloadLooks` (Character.tsx:1027) and `clipLength` (:1031) still have no importer. In S5. |
| 4.9 | PARTIAL | `BASE_FOV` in; Character.tsx:904 still defaults `walkSpeed = 7.4`. In S5. |
| 5.1 to 5.9, 5.11 | DONE | `recordCatch` and `getTodayWeather` gone; the weather fallback is cached; `ownedGear` raises. |
| 5.10, Bug 14 | OPEN | `lib/progression/seasonal.ts:44` still unions `SEASONAL_GOALS` into the limited list. D14. |
| 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.9 | DONE | |
| 6.3 | DONE | The last `derived().energy` went with `/dev/combat` (78e4723b). |
| 6.8 | PARTIAL | `EncounterRender.tsx:467` still calls `color.set` per blast per frame; the `me`/`aim` objects stay. Ruins are v3. See A8. |
| 7.1, 7.2, 7.3, 7.5, 7.7 | DONE | AdminGate, `staffContext` (6 users), server-side name-report join. |
| 7.4, 7.6 | PARTIAL, by design | |
| 7.8 | OPEN | `admin/content/seasonal/[id]/edit/page.tsx` (23 lines) still there. See A8. |
| 7.9 | PARTIAL, by design | `api/directory/route.ts:11-12` still probes the tier through `adminContext`. |
| 8.1 to 8.4, 8.6 | DONE | |
| 8.5 | DONE | One `noSub` copy left in `app/dev/economy/EconomyHarness.tsx:45-47` (dev only). |
| 9.1 | DONE | `lib/seedMigrations.ts` holds each seed to its newest block. New risk in it: R6. |
| Bugs 1 to 13, 15 | DONE | Spot-checked: 2 (`collections/service.ts:99-100`), 3 (PlayerAvatar.tsx:796), 5 (TouchControls.tsx:26), 6, 12. |
| Bug 16 | first half DONE, second half OPEN | The persona cap is on the server (`residents.ts:65`). The Transmuter banner can still show twice (`lib/combat/service.ts:165-172`). See A8. |
| D1 to D5 | DONE | dcc37a45, 78e4723b, 299a57cf, 479fe915, 061b20fe. |

---

## 2. Risks

Ordered by what matters for Oct 31. All re-read at HEAD.

**R1. HIGH [DECISION]: placeholder merch is on sale for Gems.** **David, 2026-10-22: "Take both off sale". Done in Phase B:** both slugs join `RETIRED` (`PLACEHOLDER_MERCH`), the generator wrote `20261022212455_catalogue_seed.sql` (a soft deactivate, rows and prices kept), the 9 shop slots that showed them now show the keychain, the lanyard and the GENESIS sticker, the "staff pick" tag is gone, and `club_merch_smoke.sql` asserts both are off sale and a redeem is refused.
- `lib/wallet/catalogue.ts:84-85` sells "TSI sticker pack" (150 Gems, stock 100) and "TSI tote bag" (600 Gems, stock 30) as active rows. `specs/merch/` lists only the keycap keychain, the lanyard and the GENESIS sticker.
- The 3D shop puts them on 9 of the 12 merch slots, both featured slots included (`lib/game/shopDisplay.ts:24-27`, whose own comment says "placeholders until David's merch list"). The tote also has a "staff pick" tag (`lib/wallet/merchShelf.ts:30`).
- If the tote and the sticker pack don't exist, members will reserve them with Gems on Oct 31 and the desk has to cancel.
- **Fix (if they don't exist):** add both slugs to `RETIRED`, regenerate the seeds (a new migration), point the `SHOP_PICKS` merch slots at the three real slugs, drop the tag.
- **Test:** economy.test, "the merch tab is exactly the keychain, the lanyard and the GENESIS sticker".

**R2. Corrected (coordinator, 2026-10-22): not a risk. The moderation env vars are set.** `REALTIME_INTERNAL_URL` and `REALTIME_INTERNAL_SECRET` have been on Vercel Preview and Production since Oct 7, and `REALTIME_INTERNAL_SECRET` is on Fly. The launch lane's live test on Oct 22 showed `/internal/friend` applied, and `remove_mute` applied with the muted player's next line refused in 1.2 s. The repo docs that said otherwise were stale.
- What stays true: `lib/server/realtimeNotify.ts:41` returns "skipped" if either var goes missing, and `realtime/src/internal.ts:75` then answers 503 (fail closed). Only sanctions have a fallback, the 60 s poll (`realtime/src/world.ts:200-224`); blocks and friends are read only at join (`IslandRoom.ts:183`). R3 makes a block hold on the client even when a notify fails.

**R3. HIGH [LAUNCH-FIX]: the client keeps showing new lines from someone you blocked.**
- `lib/net/chat.ts:122`: `blocked(uid) { this.forget(uid); }` drops past lines and bubbles but never adds `uid` to `muted`. Whenever the server isn't told (a "failed" or "skipped" notify), the blocked player's new lines and bubbles still show.
- **Fix:** `blocked(uid) { this.muted.add(uid); this.forget(uid); }` (1 line).
- **Test:** after `blocked("u")`, `receive(<a line from "u">)` returns false.

**R4. MEDIUM [LAUNCH-FIX]: a muted player escapes the mute by following a friend.**
- `applySanction` updates only `s.sender` (`realtime/src/rooms/IslandRoom.ts:566`). `onFollow` reserves the new seat with the stale `s.card` (:542), and the new session builds its sender from that card (:287), skipping the `overlayCard` hold that a normal join gets (`realtime/src/app.config.ts:79`).
- Result: muted mid-session, follow a friend to another shard, and chat until the next poll (up to 60 s).
- **Fix:** in `applySanction`, also `s.card = { ...s.card, ...patch }`; or in `onFollow`, `card: o.world.overlayCard(s.uid, s.card)` (1 line, needs a realtime deploy).
- **Test (world-chat.test):** mute through `/internal/sanction`, follow, chat in the new shard: `refused: muted`.

**R5. MEDIUM [LAUNCH-FIX]: "Remove and mute" on a world report can't be retried when the mute fails.**
- `app/api/admin/moderation/route.ts:150-154` closes the report first; the mute runs after (:155-160). If `setMute` throws, the admin sees "Try again", the retry gets "already closed", the mute never lands and nothing is logged.
- **Fix:** move the mute block above the close. Hiding the line twice is harmless.
- **Test:** route test with a throwing `setMute`: the report is still open.

**R6. MEDIUM [LAUNCH-FIX]: the seed generator resets live stock.**
- `lib/seedMigrations.ts:78` puts every non-key column, `stock` included, into `DO UPDATE SET`. After launch, any edit to a stocked row (or a position shift) silently restocks it, whatever was reserved.
- **Fix:** leave `stock` out of the SET list (1 line).
- **Test:** `expect(changedRowsUpsert(prev, next)).not.toMatch(/stock = EXCLUDED/)`.

**R7. Corrected (Phase B, 2026-10-22): not a risk.** The admin hub already links `/student/dashboard/admin/merch` as "Merch pickups" through the game content index (`components/portal/GameContentIndex.tsx:29`, built as `${A}/merch`, which the string search missed). The hub's separate "Marketplace" card (`app/student/dashboard/admin/page.tsx:69-74`) is the legacy system in D2. Phase B added only a test that pins the link.

**R8. MEDIUM [DECISION]: the legacy marketplace purchase is unsafe.**
- `POST /api/economy` (`app/api/economy/route.ts`) mints a random key per request (:130, :202), so a double submit charges twice and makes two orders. Stock is read, then written back as `item.stock - qty` (:125, :159-162), so concurrent buyers oversell. The avatar branch inserts into `player_inventory` with the member's client, which has had no INSERT policy since `20260926155000_schema_drift_reconcile.sql:74`, so it charges and then refunds.
- Its only caller is the unlinked `app/student/dashboard/marketplace/page.tsx:87`, but the admin hub still lets staff stock `marketplace_items`.
- **Fix:** retire the legacy marketplace (D2), or move the purchase into an RPC.

**R9. MEDIUM [DECISION]: v1 sells home items with no home to put them in.**
- Furniture, wallpaper and flooring are on sale, in the daily specials (`lib/wallet/service.ts:91-105`, `lib/wallet/shopShelves.ts:20`) and on the in-world displays (`lib/game/shopDisplay.ts:19-21`). The home island is drop 4 (`DefaultIslandWorld.tsx:933` blocks the site in v1).
- **Fix if hiding:** filter them in `getShop` and `buy` by `DROPS.homeIsland` and keep them out of the specials (about 10 lines). Otherwise decide that buying ahead is fine.

**R10. MEDIUM [LAUNCH-FIX]: the combat pack is on the GPU in v1, up to twice.**
- `public/assets/fx/combat-pack.webp` is 331 KB on disk but 1024x4224 pixels: 16.5 MiB decoded, about 22 MiB with mips. That is the "44 MB": two copies.
- No module-scope loader; five lazy ones, each with its own module `pack`, so each is a separate Texture and upload: `campfire/Campfire.tsx:62`, `oracle/SubclassAura.tsx:34`, `oracle/CandleFire.tsx:33`, `combat/CombatFx.tsx:30`, `combat/WardenRender.tsx:40`.
- In v1, the village mounts the campfire all day (`DefaultIslandWorld.tsx:537`), and it uses 2 of the 33 rows (`flame`, `mote`, `Campfire.tsx:48,51`).
- The local aura is gated by `DROPS.classes` (`DefaultIslandWorld.tsx:1225`), but remote players are not: `net/RemoteAvatars.tsx:100` sets `lod.hasAura = showsAura(p)`. Any remote player whose profile has a family or kit mounts SubclassAura (the second copy), and family auras show in v1 although the drop table holds them for v3.
- **Fixes:** R10a, gate remote auras on `DROPS.classes` (1 line, F7). R10b, one shared texture for the five loaders (S9). R10c, a 2-row fire pack (1024x256, about 1.3 MiB) for Campfire and CandleFire; `fxMaterial.ts:74` hard-codes `COMBAT_PACK_ROWS`, so the material needs a `rows` parameter (F8).
- **Test:** on the village in a v1 build, the network tab shows no combat-pack.webp; `renderer.info.memory.textures` drops.

**R11. MEDIUM [LAUNCH-FIX]: the creator's hair atlas replaces the world one for the whole session.**
- `components/game/character/Character.tsx:56-75`: one `HAIR_ATLAS` uniform for every character. `ensureHairAtlas("creator")` loads `hair_colour.png` (3072x2560, about 40 MiB with mips) and replaces the world copy (1536x1280, about 10 MiB) "for good".
- Every new player goes through the creator (`arrival/ReflectionScene.tsx:353-354`, `character/CreatorStage.tsx:101,197`), so every village session after the arrival carries about 30 MiB more than it needs.
- **Fix:** a separate creator uniform bound only by materials with `faceSize >= 1024`, disposed when the creator unmounts (about 15 lines).
- **Test:** after the arrival, `HAIR_ATLAS.value.image.width === 1536` on the village.

**R12. LOW [LAUNCH-FIX]: the admin Gem award can double-pay.**
- `app/api/economy/admin/award/route.ts:20` keys on `award:${crypto.randomUUID()}`, so a resend awards twice (up to 100k Gems). No UI caller; only `specs/evidence/hardening/flows.mjs`.
- **Fix:** require `idempotency_key: IdemKey` in the body (about 3 lines), or delete the route.
- **Test:** two POSTs with the same key credit once.

**R13. LOW [LAUNCH-FIX]: a paid NPC chat endpoint with no client.**
- Nothing in the app calls `/api/npc/chat`; its client `lib/npc/chatClient.ts` is imported only by its test. The route checks auth, profanity, a per-instance memory rate limit and a per-user cap of 200 a month (`lib/npc/chatHelpers.ts:14`). It doesn't check membership, tier or mute. Any signed-in account, applicants included, can spend Anthropic calls.
- **Fix:** return 404 in v1 unless a flag is set (1 line). Deleting the client and the routes is D8.
- **Test:** POST `/api/npc/chat` signed in returns 404 with the flag unset.

**R14. LOW [LAUNCH-FIX]: the fixed-key list disagrees with Settings.**
- `lib/identity/settings.ts:23` `FIXED_KEYS` leaves out `p` (photo mode, hard-coded at `photo/PhotoMode.tsx:94`, listed as fixed in SettingsSheet.tsx:53) and `r` (decorate rotate, DefaultIslandWorld.tsx:1189). A menu action can be bound to P, and then P does both.
- **Fix:** add `"p"` and `"r"` (1 line).
- **Test:** binding `openMap` to "p" is refused.

**R15. LOW [DECISION]: "Remove and mute" can shorten a longer mute.** It upserts `muted_until = now + 7 days` (`admin/moderation/route.ts:100-101`, `identity/supabaseStore.ts:102`) over a 30-day mute set through `/api/identity/moderate`. Fix: keep the later date.

**R16. LOW [AFTER-LAUNCH]: `merch_reserve` checks the replay before any lock** (`20260926150600_economy.sql:306`, unchanged since Sep 26). Two same-key requests get a 500 instead of a replay; no double charge (wallet_apply dedupes, the unique constraint rolls back). The 3-open-reservation cap (:314) isn't serialised per member. Fix in a new migration: `pg_advisory_xact_lock(hashtext('merch:' || p_member_id))` first.

**R17. LOW [AFTER-LAUNCH]: `economy_sell` checks `locked` in one statement and decrements in the next** (`20261003054110_backpack.sql:236-241`) without `AND NOT mc.locked`; `collections_drop` in the same file has the guard. 1 line in a new migration.

**R18. LOW [AFTER-LAUNCH]: the combat client mints a fresh key per paid call.** `lib/game/combat/progression.ts:29` builds keys from Date.now plus random for the subclass change (a fee), the stat reset (a fee), wear and mission start (:48-55), so a retry is not a replay. Combat is v3. Fix: one `newKey()` per user action, kept across retries.

**R19. LOW [AFTER-LAUNCH]: realtime edges.** Friend-code lookups don't count toward any limit (`lib/world/friends.ts:91-95`; 31^8 codes, so only database load). The typing dot crosses a block (`FLAG.typing` on Player, `IslandRoom.ts:444`). Friend presence walks every room and session per move (`IslandRoom.ts:623-640`, `world.ts:156-166`), fine at v1 scale.

**Checked and fine:**
- RLS is on for every table in the 31 new migrations; no member write policy touches balances, counts, stock or ownership. Table-level REVOKEs are used correctly.
- Every new SECURITY DEFINER function sets `search_path`, is revoked from PUBLIC/anon/authenticated and granted to service_role. (`finalround_track` has no explicit grant; recruitment, out of scope, unverified.)
- `wallet_apply` is still service-only and locks before its replay check. Buy, sell and reserve take no client price. The bag RPCs (`collections_drop`, `storage_move`, `storage_store_materials`) are keyed, and `storage_move` locks before its log.
- SQL `sell_prices` and `economy_settings` match the TS. Class cosmetics stay inactive while `classes_v2` is off. `PENDING_MERCH` is gone everywhere.
- Realtime join: ES256 tokens against the JWKS with issuer, audience, role and not-anonymous checks; `DEV_AUTH` refused in production. The server takes uid from the token and name, badge and look from the database. Every client message type is rate-limited; payloads are capped at 4 KB. The internal endpoint uses HMAC with `timingSafeEqual`, a 30 s window and nonce replay protection. Every per-room and per-session map is bounded and cleaned on leave. The protocol is single-sourced (`@net/protocol`).
- No React state set at 60 Hz; the remote avatar driver uses scratch objects.
- `/api/lab/world` and `/api/lab/world-map` 404 in production.

---

## 3. Cleanup list (prioritised)

Format: Files / Keep / Delete or merge / ~lines / Test. Line numbers at `d251c36e`; re-find by symbol.

### [LAUNCH-SAFE]

**S1. The legacy radial terrain and its one-off script (~690).**
- Files: `components/game/terrain.ts` (443; its header calls itself "the WRONG model ... scheduled for replacement"), `web/scripts/snap-world-to-grid.mjs` (274; reads the deleted `GameWorld.tsx` and `RoadTiles.tsx`, so it crashes on start, and calls itself "a one-off migration").
- In-game, only `setTerrainHeightProvider`, `getTerrainHeight` and `sampleTerrainHeightFast` are used (4 importers: GridWorld, SmoothTerrain, FlowerPickFX, RainFX). Every live island sets the provider, and RainFX's one caller passes `groundHeight`, so the radial fallback (noise, river, footprints, bridges, temple rise, baked grid) never runs.
- Keep: the provider and the two getters, returning `heightProvider?.(x, z) ?? 0`.
- Delete: the fallback and the dead exports (`sampleTerrainHeight`, `ISLAND_RADIUS`, `BUILDING_FOOTPRINTS`, `BRIDGE_CROSSINGS`, `TEMPLE_*`, `valueNoise`, `riverWidthScale`), and snap-world-to-grid.mjs. `coast.ts` goes with D4.
- Test: tsc, full vitest; `rg -n "snap-world" web` is empty.

**S2. Dead shop and catalogue read paths (~345).**
- Files: `app/api/shop/route.ts` (111, GET only); the GET handler in `app/api/economy/route.ts:18-56` (about 40); `lib/game/shopRead.ts` (53) and its test (39), their only callers; `useShopItems`, `fetchShopItems`, `filterShop` (`lib/content/loader.ts:161-204`) and `DEFAULT_SHOP_ITEMS` (`data/content-defaults.ts:243-287`), whose Gem prices (hoodie 1500, aura 800, badge 5000) disagree with the real catalogue; `useEmoteTypes` (`loader.ts:262-273`).
- Keep: the POST in `app/api/economy/route.ts` until D2.
- Fix the stale comment at `lib/content/adminShop.ts:3`.
- Test: tsc, full vitest; `rg -n "shopRead|useShopItems|DEFAULT_SHOP_ITEMS|useEmoteTypes" web` is empty.

**S3. ShopGreybox (~135).**
- Files: `components/game/ShopGreybox.tsx` (129, 0 importers since ShopRoom replaced it in 57fdb0b2); `SHOP_PATHS` (`lib/game/shopLayout.ts:282-291`), read only by the greybox and one walkability test (`shopLayout.test.ts:86`).
- Also fix the comments that name it: ShopInterior.tsx:4-5, shopLayout.ts:3, `specs/interiors/shop.md:23`.
- Test: vitest `shopLayout`, `shopDisplay`.

**S4. /dev/playground (~280).**
- `app/dev/playground/` (281, last commit 2026-04-14): a marketing UI playground. Its only link is `app/dev/page.tsx:9`; no spec or script uses the route.
- `components/ui/PixelLogoCarousel.tsx` (244) then has no importer; it's marketing code, so the marketing owner confirms before it goes (not counted).
- Test: `/dev` renders its other links.

**S5. Dead exports and small dead files (~260).** Each has 0 importers outside its own file (and its test where noted), checked with `rg`:
- `components/game/ContactShadows.tsx:204-209` `SoftDiscs`; `NatureModels.tsx:162-169` `NatureRock`; `character/Character.tsx:1027-1031` `preloadLooks`, `clipLength` (Sep 30 4.7) and the `walkSpeed = 7.4` literal at :904 to `MOVE_TUNING.walkSpeed` (4.9, same value); `photo/PhotoMode.tsx:175-178` `PhotoButton`; `world/terrainView.ts:191-192` `VIEW_CHUNK_CELLS`, `VIEW_WATER_BLOCK`; `net/active.ts:60-63` `useAreaHeadcount`, plus `areaHeadcount`/`AreaHeadcount` (`lib/net/types.ts:137-146`, test-only).
- `lib/game/`: `waterShader.ts:528-540` `waterSwellAt`; `grid.ts:377-388` `SURFACE_ROAD_KIT`, `:1332-1334` `sameSurface`, `:923` `DirId`; `world/brushes.ts:267-270` `roadEnd`; `world/terrain.ts:29` `PaintId`; `treeShake.ts:121-125` `fallTime`; `movement/juice.ts` `handPuff` (:260), `leafBits` (:256), `stepSound` (:87), `takesPrints` (:324); `movement/course.ts:80` `SLIDE_LIP`; `character/clips.ts:95-96` `SNAPPY_CLIPS`; `skyVariants.ts:324` `ALL_SKY_TEXTURES`; `waterLevels.ts:2` `RIVER_WATER_Y`; `drops.ts:49` `LATEST_DROP`; `forageWorld.ts:27` `dropOf`; `bagStore.ts:65` `readBag`; `photoMode.ts:36` `usePhotoOpen`; `arrival/hq/store.ts:87` `resetHqStore`; `actTiming.ts:12` `ActClip`; `combat/primitives.ts:507` `zoneHas`; `combat/sim.ts:82` `bossPhase`; `shopCounter.ts:26-34` `buyAtCounter` and its 2 tests (ShopOverlay does the same buy inline).
- `lib/game/causticTexture.ts` (18, no importer since the water rewrite) and its `public/assets/acnh/textures/water-caustic.png` (70 KB).
- `lib/combat/classes.ts:23` `ROLE_THREAT`; `lib/economy.ts:30-32` `fmtGems`; `components/portal/types.ts:8-26`, re-exports nobody imports (only `TIER_LABELS` and `getXpProgress` are used).
- Net and realtime: `lib/world/store.ts:9` `WorldError`; `realtime/src/rooms/IslandRoom.ts:712` `IslandRoomClass`; `lib/net/protocol.ts:290` `seqAfter` and `:321-325` `pushEv` (test-only); `lib/world/friendCode.ts:29` `isFriendCode` (test-only). `NAME_FALLBACK = "Islander"` three times (`protocol.ts:199`, `lib/world/service.ts:15`, `lib/world/friends.ts:19`): import the protocol one.
- Not here: `gui/flat` `Pill` and `railStep` (delete after `game/flat-ui` merges).
- Test: tsc, full vitest.

**S6. Test-only modules carried from September (~105).** `lib/game/npcSprites.ts` (18) and `lib/game/spritePicking.ts` (38), with their tests (22, 30). Nothing imports either since the recruitment village moved on (last touched 2026-09-17). Test: tsc, full vitest.

**S7. Hidden scenes preload about 5.0 MB on the village (~0 net).**
- `DefaultIslandWorld.tsx` imports OracleTemple, RuinsScene (:73-74), HomeIslandScene, HomeInterior (:171-172) and CafeInterior (:184) statically, so their module-scope preloads run on village load:
  - café (v2): `study/CafeInterior.tsx:41` `preloadCafe`, cafe-room.glb (1.84 MB) and cafe-kit.glb (0.33 MB);
  - Oracle temple (v2): `components/game/OracleInterior.tsx:39-40`, oracle.glb (0.48 MB) plus four pieces (0.11 MB);
  - home (v4): `home/HomeInterior.tsx:31`, 8 wall and floor PNGs (2.23 MB).
- Fix: `React.lazy` those five scenes (it also drops the combat JS from the village bundle), or move each preload into its component. About 10 lines changed.
- Test: the network tab on the village in a v1 build shows no cafe-room.glb, oracle.glb, wall-*.png or floor-*.png.

**S8. Applicant-island plants preload on the member village (1.17 MB, ~0 net).** `components/game/NatureModels.tsx:134-159` preloads `TREE_MODELS`, `BUSH_MODELS` and `FLOWER_MODELS`; with default models these render only on the applicant island (`components/recruit/ApplicantWorld.tsx:217-219`); the village and home pass the seasonal sets. Fix: export a `preloadDefaultNature()` that ApplicantWorld calls (a one-line touch to recruitment code; say so in the commit). Test: no `acnh/plants/tree-hardwood-a.glb` request on the village.

**S9. One combat-pack texture, and RainFX's own sun (~−10).** R10b: a shared `combatPackTexture()` in `lib/game/fx/combatPack.ts` used by the five loaders. `RainFX.tsx:43` loads its own copy of sun.png where `useTexture` already holds one (AmbienceFX, FamilyAura). Test: `renderer.info.memory.textures` on the village drops by one; the fire still burns.

**S10. Runtime-unreferenced assets, about 5.3 MB of deploy (0 lines).** No code, spec or art script fetches them (checked with `rg` over `web/` without `public/`, `art/`, `specs/`, `scripts/`):
- `public/assets/sky/layers/` denseOvercast, galaxy, ghibliNoise, highBorder, highNimbus, lowNimbus, borderNoise (2.43 MB). Only `extract-sky-textures.mjs` names them. `layers/manifest.json` is tracked despite the `*.json` ignore and nothing reads it; edit it with care.
- `public/assets/sky/sky_*.webp` (8) and `sky/moon.png` (0.42 MB): only the extract script names them.
- `public/assets/acnh/furniture/ruins-stonehenge.glb` (1.94 MB): only `specs/phase0-plan.md`.
- `public/assets/acnh/props/bridge-arch-log.glb` (0.48 MB): only `extract-acnh-all.sh`.
- Not here: anything an art build writes (D12).
- Test: `rg <basename> web --glob '!web/public/**'` is empty for each; vitest green.

### [LAUNCH-FIX]

Each is small; lines are lines changed, not removed.

| # | Risk | Change | ~Lines | Test |
|---|---|---|---|---|
| F1 | R2 | Dropped: the env vars were already set (correction above). | 0 | |
| F2 | R3 | `lib/net/chat.ts:122` also adds the uid to `muted`. | 1 | `receive()` of a blocked uid's line returns false. |
| F3 | R4 | `applySanction` updates `s.card` too (or `overlayCard` in `onFollow`); realtime deploy. | 1 | Mute, follow, chat: `refused: muted`. |
| F4 | R5 | Mute before closing the report. | 6 moved | A throwing `setMute` leaves the report open. |
| F5 | R6 | `stock` out of the generated `DO UPDATE SET`. | 1 | `changedRowsUpsert` output has no `stock = EXCLUDED`. |
| F6 | R7 | Dropped: the hub already links it (correction above). A test pins the link. | 0 | The hub links `/student/dashboard/admin/merch`. |
| F7 | R10a | `RemoteAvatars.tsx:100`: `hasAura` only when `DROPS.classes`. | 1 | A remote player with a family shows no aura in v1. |
| F8 | R10c | A 2-row fire pack for Campfire and CandleFire; `rows` on the particle material; rebuild with `build_pack.py`. | 25 | No combat-pack.webp on the village; the fire looks the same. |
| F9 | R11 | A creator-only hair uniform, disposed on unmount. | 15 | After the arrival the village hair atlas is 1536 wide. |
| F10 | R12 | Admin award takes an `IdemKey`. | 3 | Same key twice credits once. |
| F11 | R13 | `/api/npc/chat` returns 404 unless a flag is set. | 1 | Signed-in POST returns 404. |
| F12 | R14 | Add `"p"` and `"r"` to `FIXED_KEYS`. | 1 | Binding a menu action to P is refused. |

### [AFTER-LAUNCH]

**A1. The anti-cheat renaming layer (~45).** `realtime/src/rooms/sanity.ts:25-73` copies the protocol's `SANITY` values into a `SanityLimits` type and threads an `L` parameter through `checkPose`, `addStrike` and `decayStrikes`; no test or caller passes a custom `L`. Read `N.SANITY` directly; keep the two server-only credit constants. Test: `sanity.test.ts` unchanged.

**A2. HQInterior branches only the lab reaches (~20).** Both live callers pass `clubhouse` and `floorTexture` (DefaultIslandWorld.tsx:672, ApplicantWorld.tsx:300), so the `clubhouse=false` ternaries (HQInterior.tsx:106-171) and the `!floorTexture` strips (:126-131) render only in `/lab/interior:64`, with a prop mix that never shipped. After `game/hq-interior` merges (it deletes FounderDesk and the member Clubhouse wrapper), HQInterior is applicant-only and `branded`, `trophyCase`, `noticeBoard`, `light`, `talking` and the `hq-notice-board` prop lose their last caller. Test: the applicant HQ (`/student/apply/portal?preview=1`) looks the same.

**A3. Helpers copied since Sep 30 (~45).**
- `class Fallback`, three identical copies: StickerStage.tsx:18, KeychainStage.tsx:29, LanyardStage.tsx:101. `lightStudio` twice: TurnStage.tsx:79, LanyardStage.tsx:38. Export each from TurnStage.
- `errText`: ShopOverlay.tsx:35 equals EconomySheets.tsx:32. `lerpAngle`: boatTrip.ts:239 equals useTripBoat.ts:42, which already imports from boatTrip.
- Smoothstep is hand-written 9 times (ambientFauna.ts:20, arrival/sequence.ts:100, arrival/Arrival.tsx:33, arrival/ReflectionScene.tsx:172, grassField.ts:129, treeShake.ts:19, waves.ts:174, fx/particles.ts:211, boatTrip.ts:236). `THREE.MathUtils.smoothstep(x, a, b)` is the same formula, already installed.
- The prefers-reduced-motion one-liner six times (TalkBox:24, TopCluster:43, BagButton:15, CreatorStage:70, useWorldDialog:114, comfortSettings:12).
- FNV-1a by hand four more times (Sep 26 item 15 drift): `collections/treats.ts:21`, `residentRoutine.ts:95`, `halloween.ts:20`, `crafting/memoryStore.ts:30`. Snapshot their outputs before switching to `fnv1a`.
- The chat refusal texts exist twice (`realtime/src/rooms/chat.ts:36-55`, `web/lib/net/chat.ts:36-45`); one table in `protocol.ts` (needs a realtime deploy).
- ShopOverlay, Stage files and `gui/flat` wait for `game/flat-ui`.
- Test: vitest on the touched files; the shop detail stages render.

**A4. A route registry with one entry (~8).** `lib/game/arrival/routes/index.ts` holds `ROUTES = { village }`; ArrivalWorld's `world` prop (:101) is never passed (DefaultIslandWorld.tsx:548). Import `VILLAGE_ROUTE` directly. Test: vitest `arrival`.

**A5. LookMaterials sweeps the whole scene twice a second (0 lines).** `LookMaterials.tsx:125-131` runs a full `scene.traverse` every 0.5 s (every frame while loading), with a new `Set` and a one-element array per single-material mesh; every bone counts. Sweep only when the renderer's program or geometry count changes; reuse one Set. Test: a second `sweepScene` on an unchanged scene returns false; a perf trace.

**A6. Small per-frame allocations (0 lines).** Per character at full LOD: `resolveClip({...})` (Character.tsx:587), `restPose()` (`lib/game/character/face.ts:91`), a template string while emoting (:104). The prompt resolver (DefaultIslandWorld.tsx:458-514) builds 3-4 closures and 10-15 tuples and objects per frame. Scratch objects and module-level helpers. Test: a perf trace on the village.

**A7. Sep 26 leftovers (~70).** Item 2: `storeFailure` try/catch in 4 progression routes, the local `Result` types in oracle and traditions (~15). Item 5: the combat client's own `call<T>` and key (~25; fixes R18). Item 12: one `memoryWallet()` for the 6 memory stores (~25). Item 17: ShopEditor `TIERS`/`SLOTS` from the catalogue types, `FAMILY_COLOR` from `FAMILIES` (~5).

**A8. Sep 30 leftovers (~30).** 4.4 follow-camera plumbing (~6, still blocked by the remount reason); 6.8 the blast `color.set` per frame (0); 7.8 the seasonal edit page (~18); Bug 16b the double Transmuter banner (~5, have the SQL return `trait_unlocked`).

**A9. The pose `seq` field is never read (~10).** Senders write it (`sender.ts:218`, `botBrain.ts:602`); no receiver uses it. Removing it changes the wire format, so it needs a `PROTOCOL` bump and a realtime deploy.

**A10. The wallet shows raw slugs for Gem spends (0).** `walletSheet.ts:67` prints `p_ref`, which is the slug ("merch-tsi-lanyard"). Look the slug up in `ITEMS` for `spend_shop` and `spend_merch`.

**A11. SQL hardening (0 TS lines):** R16 and R17 in one new migration.

**A12. The UI themes review follow-ups (coordinator, 2026-10-22; main 2d359c38).**
- `styles/themes/dark.css` ships in every page (`styles/themes/index.ts:7` imports it unconditionally); load it in development only.
- The shadow `0 24px 80px rgb(var(--ui-shade) / 0.28)` is written 3 times (`styles/game-tokens.css:261` `--gui-shadow-lg`, `components/gui/flat/flat.module.css:15`, `components/gui/gui.module.css:257`); use the one token.
- `#4b7a68` is hard-coded at `styles/game-tokens.css:238` (`--gui-kit-primary-hover`); derive it from a token.
- An empty "Focus" header at `styles/game-tokens.css:90`.
- `DevUiTheme` is mounted twice (`app/dev/layout.tsx:8`, `components/game/DefaultIslandWorld.tsx:1206`).
- Test: the theme tests (`components/gui/variant.test.tsx`) pass; a production build's CSS has no dark theme rules.

**A13. Phase B leftovers.**
- S7's real fix: `React.lazy` the café, Oracle, home and ruins scenes in `DefaultIslandWorld.tsx` once `game/hq-interior` merges (it changes that file). That also drops the combat JS from the village bundle. Phase B only gated the café room's and the temple's preloads on their drops.
- ShopOverlay buys inline what `buyAtCounter` (`lib/game/shopCounter.ts`, tested) does; call it from the overlay.

**A14. HQ interior leftovers (from the `game/hq-interior` pre-merge review).**
- `lib/game/hqLayout.ts:467-516` `createHqWalker`'s constrain loop duplicates `lib/game/shopLayout.ts:330` `createShopWalker`; one shared stair walker, both rooms parameterised. Test: `hqLayout.test.ts` and `shopLayout.test.ts` unchanged.
- `components/game/hq/HqRoom.tsx:58,83` `useRoomModel` and `walkOn` copy `ShopRoom.tsx`, plus caster handling that `RoomShell`'s `prepareShell` already does. Share one hook and drop the caster pass. Test: the interior tests; the shop and HQ shots unchanged.
- `lib/game/hqLayout.ts:78-94` the leftover `HqOption` A/B parameter (`HQ`, `swimBox(o)`, `tankFish(o)`): only the phase 1 and 2 evidence scripts read `__hqLayout.option`. Fold it into the one layout and retire those scripts' reads. Test: `hqLayout.test.ts`, `hqAquarium.test.ts`.
- `components/gui/motion.ts:22` `useMarker` could be framer-motion's `layoutId`. Test: the tab and rail components' tests; a shot of the sliding marker.

### [DECISION]

| # | What | Where | ~Lines |
|---|---|---|---|
| D1 | Placeholder merch on sale (R1): retire the tote and sticker pack, or confirm they exist. | `lib/wallet/catalogue.ts:84-85`, `shopDisplay.ts:24-27`, `merchShelf.ts:30` | 10 |
| D2 | The unlinked legacy shop surfaces: the marketplace system (member page 340, `lib/portal/marketplace.ts` and its test 94, `POST /api/economy` ~175, admin page 316 and its hub card) duplicates `shop_items` merch plus `merch_reserve`, and retiring it closes R8. Also `economy/shop/page.tsx` (9, a copy of `/shop`), `economy/sell/page.tsx` (18) with `SellBody`/`SellSheet` (`EconomySheets.tsx:73-118, 262`; the "sell anywhere" flow the counter replaced). Two evidence scripts shoot these pages. | `app/student/dashboard/{marketplace,economy/shop,economy/sell}`, `app/student/dashboard/admin/marketplace`, `app/api/economy/route.ts` | 1,025 |
| D3 | Home items on sale with no home in v1 (R9). | `lib/wallet/service.ts:91-105`, `shopShelves.ts:20`, `shopDisplay.ts:19-21` | 0 |
| D4 | `web/scripts/author-elevation.mjs` (1,043) reads the deleted `RoadTiles.tsx` and crashes on start, but README.md:149 and :185 still document it. With it, `lib/game/coast.ts` (71) loses its last user. Delete both and the README rows, or repair the script. | `web/scripts/author-elevation.mjs`, `web/lib/game/coast.ts`, `README.md`, the `coast.ts` row in CODEMAP | 1,115 |
| D5 | `/lab/icon` (86) and `web/scripts/_render-icons.mjs` (66): the old fish-icon stage, replaced by `/lab/icons` and `render-icons.mjs`; the script imports Playwright from the old `~/Documents` path, so it can't run. README.md:121 lists the page. | `app/lab/icon/`, `scripts/_render-icons.mjs` | 152 |
| D6 | `WharfShackInterior.tsx`, lab-only since before Sep 30; its counter fires `"sheet:wharfsell"`, which nothing handles. It drags `keepers.ts:51-55`, the `"wharf"` KeeperRoom, `InteriorBackdrop.tsx:12, 18` and a `/lab/interior` room. Older specs planned a Wharf Shack. | `components/game/WharfShackInterior.tsx` and the listed lines | 100 |
| D7 | `chooseTool` (`heldStore.ts:52`) has had no caller since it was added; `chosen` is parsed and read, so "the tier you set" can never be set. Wire it in the bag, or remove it. | `lib/game/heldStore.ts:25, 52`, `toolWheel.ts:74` | 8 |
| D8 | NPC chat has no client (R13). If it isn't coming back, delete `lib/npc/chatClient.ts` and its test (100) and the member routes `/api/npc/chat`, `/api/npc/conversations`, `/api/npc/memories/wipe` (~280). Keep the admin moderation and spend routes while NPC personas stay editable. | `lib/npc/`, `app/api/npc/` | 380 |
| D9 | Phone presence is dormant: `netStore.ts:519` always sends `mobile: false` and `lib/net/phone.ts` was never built, so the server's phone grace, `FLAG.mobile`, `lod.phone` and the phone icons only run for bots. Keep for the phone work, or strip. | `web/lib/net/`, `realtime/src/rooms/` | 30 |
| D10 | `lib/game/combat/mobFamilies.ts` (65) and its test (26): Transmuter form scaffolding ("nothing here plays a form"). Combat is v3. | `lib/game/combat/mobFamilies.ts` | 90 |
| D11 | Visible textures bigger than the pixel finish needs: `fx/move-pack.webp` (1024x3584, 18.7 MiB on the GPU, every session; 64 px cells would be 4.7 MiB), `v7_face_atlas_2_512.png` (1024x1824, 9.5 MiB; half size 2.4 MiB), `colour_atlas.png` (2048x1024, 10.7 MiB; a 1024x512 world copy), `branding/shop-sign-v1.png` (1774x887, not a power of two, about 8 MiB; 512x256), `terrain/soil-albedo.png` (1024, the other terrain maps are 256). Asset rebuilds; David judges the look. | the files named | 0 |
| D12 | Assets an art build writes but nothing loads: `public/assets/buildings/` (hq, shop, house_1, oracle_temple as GLB and FBX, 2.95 MB, with `scripts/fbx_to_glb.py`, `web/scripts/fbx_to_glb.py`, `convert-fbx-to-glb.js`), `acnh/buildings/chalet-wall-{c,e}.glb` (1.03 MB, outputs of `art/buildings/build_buildings.py`), `characters/v6/base/v7_clips.glb` (1.70 MB; the catalog uses v8_clips, but `fit_check.py` docs name it). | the files named | 0 (5.7 MB) |
| D13 | "Remove and mute" can shorten a longer mute (R15). | `admin/moderation/route.ts:100-101` | 0 |
| D14 | Sep 30 5.10 / Bug 14: the seeded seasonal catches always count as limited, so a catch an admin removes from an event never bites. Halloween goes live with the launch. | `lib/progression/seasonal.ts:44`, `fishing.ts:156` | 0 |
| D15 | Portal pages with no link from the game, the sidebar or the companion: kanban (537), mentorship (573), portfolio (462), quests (242), journal (18), letters (18). Reachable by URL. Link them, or retire them (not counted below). | `app/student/dashboard/*` | (1,850) |
| D16 | Lab-only exports of the cream GUI kit: `Tooltip` (`gui/index.tsx:284`) and the `Panel` and `ToastHub` re-exports (:16, :18), used only by `/lab/gui`. No old cream piece can go while round 2 keeps the cream palette on every menu but the shop. | `components/gui/index.tsx` | 10 |

---

## Answers to the named leftovers

- **`lib/game/shopRead.ts`:** test-only, confirmed (S2).
- **Old member Clubhouse and FounderDesk:** live at HEAD. `hq/FounderDesk.tsx` (1 importer), `lib/game/clubhouse.ts` (5, ApplicantWorld included), HQInterior (3), `interiorLight.ts` (7) and every `arrival/hq/*` module are imported. The member `Clubhouse` wrapper (DefaultIslandWorld.tsx:659-679) is the live member HQ.
- **Option A's HQ code:** not on main. Its removal (015308ee, 626dfb81, 2aca913c) lives on `game/hq-interior`, which also deletes FounderDesk and the wrapper. After it merges: A2.
- **PENDING_MERCH:** gone everywhere (fce9f1f0).
- **Cream `gui` vs `gui/flat`:** the flat kit has one live importer (ShopOverlay), and David's round-2 call keeps the cream palette on every other menu, so no old piece is dead. Old-kit importers: Sheet 20, Tabs 19, ItemTile 4, List 12, Button 57, IconButton 19, Badge 42, Loading 68, Empty 47, ErrorNote 55. Only D16 and the unused flat `Pill`/`railStep` qualify.
- **The two shop pages:** `/student/dashboard/shop` is the live one (Sidebar.tsx:33); `/student/dashboard/economy/shop` renders the same `ShopView` with no link (D2). `/student/dashboard/marketplace` is a third, legacy one (D2, R8).
- **combat-pack.webp:** R10, S9, F7, F8.

## Checked, not flagged

- `lib/game/combat/balance.ts`, `combat/ranger/rig.ts`, `perf/budget.ts`, `perf/glbStats.ts`: test harnesses by design. `lib/game/character/skull.ts`: the synced head-fit data contract its test guards.
- The memory stores (`world`, `homes-sync`, `wallet`, `combat`, ...) and `lib/portal/testDb.ts`, `lib/seedMigrations.ts`: test doubles and seed guards behind real two-implementation interfaces.
- `lib/traditions` follows the repo's service and store pattern with a fake in its test.
- `signInternal`/`signRealtime` are pinned equal by `realtime/test/internal.test.ts:46`; `schemaFields` guards the schema against protocol drift.
- The two `seededRandom`s (Seagulls.tsx:32, weatherSystem.ts:296) are different generators; swapping would move the gulls.
- `/api/lab/world` and `/api/lab/world-map` are different files (the world editor and the painter), both dev-only.
- Every other `/dev` and `/lab` page is still used by an evidence script, a bake script, the README or code: `/dev/economy`, `/dev/progression`, `/lab/{avatar,look,gui,classes,interior,fishing,hairthumbs,furniture,item,tune,move,world,map,island}`.
- 757 in-scope exports used only inside their own file: drop the `export` while touching those files; 0 lines.
- Rarity colours in `fishing.ts:43-48` copy `--gui-rarity-*`, but `rarityPalette.test` keeps them equal.

## Apply first (ranked)

1. **F2 to F4** (moderation: client block, follow escape, report order): 3 one-to-six-line changes, all on paths the two-account test exercises.
2. **D1** (placeholder merch): David's one-line answer before Oct 31.
3. **F5, F6, F10** (stock reset, merch pickups link, award key): money paths, about 11 lines.
4. **F7, S9, F8** (combat pack off the village): about 22 MiB to 44 MiB of GPU memory.
5. **F9** (creator hair atlas): about 30 MiB of GPU memory for every new player.
6. **S7, S8** (hidden-scene and applicant preloads): about 6.2 MB less to download and decode on village load.
7. **S1** (legacy terrain and its script): −690, pure deletion.
8. **S2, S3** (dead shop read paths, ShopGreybox): −480.
9. **S5, S6** (dead exports, test-only modules): −365.
10. **F11, F12** (NPC chat closed, fixed keys): 2 lines.

## Total

| Tag | ~Lines removed | Also |
|---|---|---|
| [LAUNCH-SAFE] S1 to S10 | ~1,800 | about 6.2 MB less loaded on the village, 5.3 MB less deployed |
| [LAUNCH-FIX] F1 to F12 | ~0 net (about 60 lines changed) | 22 to 44 MiB (combat pack) and about 30 MiB (hair atlas) of GPU memory |
| [AFTER-LAUNCH] A1 to A11 | ~230 | |
| [DECISION] D1 to D16 | ~2,900 | 5.7 MB of assets (D12), and ~1,850 more if the unlinked portal pages go (D15) |
| **Total without decisions** | **~2,030** | |
| **Total with decisions** | **~4,900** (~6,800 with D15) | |

## Applied (Phase B, 2026-10-22, branch `game/ponytail`)

Main merged in twice (3e6ced4b flat-ui, 2d359c38 themes). Gates on the head: full tsc (web and realtime), the full vitest (web: 353 files, 3,362 tests; realtime: 10 files, 222 tests), eslint on every changed file, the SQL smoke (green, "placeholder merch off sale ok"). Evidence in `specs/evidence/ponytail/`. Net in `web/` and `realtime/` code: about −1,650 lines from the [LAUNCH-SAFE] deletions.

| Item | Commit | Lines | Note |
|---|---|---|---|
| R1 (David: "Take both off sale") | 1b3be9ef | +213 / −32 (mostly the generated migration and the smoke) | Both slugs in `RETIRED`; `20261022212455_catalogue_seed.sql` (soft deactivate), **not applied to prod**; the 9 merch slots show the three real items; the staff-pick tag gone; `033_smoke` turns the tote on only as its stock-1 fixture. |
| F1 | (none) | 0 | Dropped: the env vars were set (R2 corrected). |
| F2 | aceafa48 | +13 / −2 | Unblock unmutes too. |
| F3 | 60ffb838 | +23 / −3 | **Needs a realtime deploy (Fly `tethos-rt`).** |
| F4 | b2467e18 | +19 / −6 | |
| F5 | f35b48e0 | +12 / −1 | Plus the smoke log. gen-seeds up to date. |
| F6 | da384b8d | +5 / −5 | Dropped (R7 corrected): a test pins the existing link. |
| F7 | 8a3e4218 | +12 / −4 | `showsAura` takes the drop. |
| F8 | a3f24224 | +69 / −12 | `fire-pack.webp`, 13 KB; `build_pack.py fire`. |
| F9 | 9e911da8 | +143 / −25 | `lib/game/character/hairAtlas.ts`; the full copy goes 3 s after the last creator-sized face. |
| F10 | cb3c5bd5 | +35 / −9 | The hardening flow script sends a key too. |
| F11 | e05b4077 | +26 / −0 | `NPC_CHAT_ENABLED=true` opens it. |
| F12 | c6cfdbb2 | +7 / −4 | The ruins' ability swap keeps R. |
| S1 | ed979892 | +6 / −708 | |
| S2 | f331fd2e, a2af6ff1 | +4 / −491 | Also `fetchEmoteTypes` and the two bundled defaults. |
| S3 | 69cc7ef9 | +4 / −133 | `SHOP_PATHS` kept: it backs the walk test. |
| S5 | 7cb58eba | +10 / −226 | Kept: `buyAtCounter` (tested; see A13), `readBag` (its test reads it), `seqAfter`, `pushEv`, `isFriendCode` (test-only helpers in shared protocol code). `gui/flat` `Pill`/`railStep` are used since the flat-ui merge. |
| S6 | a3bfdd94 | −106 | The NPC sprite PNGs it named (`assets/characters/npc/*-1.png`) are now unreferenced; not deleted. |
| S7 | aeb43cb7 | +9 / −3 | Partial: the café room and the temple's pieces are warmed only once their drop opens. The home's wallpaper and flooring stay (the shop shows 6 of 8). Lazy-loading the scenes waits for `game/hq-interior` (A13). |
| S8 | 57e8115b | +7 / −4 | One call in ApplicantWorld (recruitment, approved). Not seen in a browser: the applicant island needs Supabase. |
| S9 | 9d10ca0a | +23 / −29 | |

**Expected savings (not measured by the perf lane's quiet window, which ran on main before these):**
- GPU on the v1 village: about 21 MiB (the campfire's combat pack becomes the fire pack), plus about 22 MiB more whenever a remote player with a family or kit is in view (F7), plus about 30 MiB for every new player after the creator (F9).
- Download on village load: about 3.5 MB less (cafe-room.glb 1.84 MB, the Oracle shell and pieces 0.59 MB, the default ACNH nature 1.17 MB); the combat pack's 331 KB becomes the fire pack's 13 KB.

**What the village asked for on load (by day), before and after:** `combat-pack.webp`, `cafe-room.glb`, `oracle.glb` and the ACNH default trees, bushes and flowers before; none of them after (they load on entering their scene, or on the applicant island), and `fire-pack.webp` instead. The café, the temple and the home still open (`s7-scenes-open.webp`), with no page errors.

**Skipped (other lanes' files):** `DefaultIslandWorld.tsx`, `lib/game/keepers.ts`, `lib/game/perf/budget.ts`, `lib/game/modelMaterials.ts` and the HQ files are on `game/hq-interior`, so the scene lazy-loading (S7's full fix) waits. Nothing approved needed a `game/flat-ui` file after it merged.
