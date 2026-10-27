# Lane: net-identity (other players show as "Islander" in the default look)

Worktree `.claude/worktrees/net-identity`, branch `game/net-identity`, cut from main at 5d848445. Agent type `uwotsi-lane`. **Launch blocker: first priority.**

David, 2026-10-26, after playing production from two computers: "currently multioplayer only shous player and not player custom name, and their skin with hair"

**What the coordinator found (prod, read-only):**
- `member_identity` has **0 rows** in production (329 profiles). So `realtime_player_card` (latest in `web/supabase/migrations/20261003190000_world_chat.sql`) returns `COALESCE(i.world_name, 'Islander')` for everyone. No world name has ever been saved in prod.
- 40 profiles have `avatar_config->'look'`, 3 updated in the last 6 hours (David's). So looks do save, yet remote players draw the default look and no hair.

**Suspects, check each:**
1. **The name never saves.** The arrival's creator (`components/game/arrival/ReflectionCreator.tsx` → `Arrival.tsx` `onSaveLook(l, name)` → `DefaultIslandWorld.tsx` `keepLook`) and `PlayerCharacterUI.tsx` POST `/api/identity/name`. Find why no row lands: never called, the route failing, RLS, or `askName` (`identity.display_name`) never passed in the new world.
2. **The card is read at join, before the creator.** The server reads the card once per join and caches it 60 s (`realtime/src/auth/card.ts`); `refresh` re-reads it at most every 10 s. After the creator saves a look or a name, the client must send `refresh`, and the room must re-apply the card to the player (`applyCard`, `IslandRoom.ts`) so others get the new `look` and `name`. Check it does, on both.
3. **The remote side.** `components/game/net/RemoteAvatar.tsx` `remoteLook(player.look)`: check `parseLook` keeps skin, hair and colours for a real saved look (take a real look's shape from the creator, not from prod data), and that hair loads for remote characters (`Character` with `remote`).

**Fix at the root,** with tests: a saved name and look reach the other client within a few seconds, without rejoining; a returning player's name and look show on join. If the server needs a change, keep the wire protocol compatible (old clients still join) and say so: the coordinator deploys realtime to Fly. If a migration is needed, write a new one (never edit an applied one) and stop for the coordinator.

**Verify** with two headless clients against a local realtime (`realtime/`, `npm run dev`) and the dev server (Supabase env blanked, dev cards); show a second client seeing the first one's name and look. Evidence in `specs/evidence/net-identity/`.

**Read first:** `CODEMAP.md` rows "Multiplayer client", "Realtime server", "Character"; `specs/multiplayer.md` §2.2 and §5.4; `web/lib/identity/`; `web/app/api/identity/name/route.ts`; `realtime/src/auth/card.ts`; `realtime/src/rooms/IslandRoom.ts` around `applyCard` and `refresh`.

**Gates:** web vitest with and without `NEXT_PUBLIC_GAME_WORLD=new`, realtime `npm test` and `typecheck`, tsc, eslint on changed files. Message "main" with the root cause as soon as you've found it, then again with the head SHA, gates and evidence, and stop.

## Status

**Done, gated, awaiting merge (2026-10-27).** Gates: web tsc clean; web vitest 3456 passed (village) and 3456 passed (`NEXT_PUBLIC_GAME_WORLD=new`); realtime typecheck clean, `npm test` 228 passed; eslint clean on changed files. Evidence `specs/evidence/net-identity/` (shoot.mjs, 01 to 05 PNGs): all 7 steps pass against a local realtime with production-like card caching (`realtime/scripts/cardHarness.ts`). No perf check (UI and data only). No Fly deploy and no migration needed: the server already handled `refresh`; the wire protocol is unchanged.

**Root causes (reported to main 2026-10-27):**
1. **Look:** the web client never sent the realtime `refresh`. The client joins before the arrival's creator, so the card at join has no look; a look saved later never reached anyone until a rejoin more than 60 s on (card cache). Server side was fine (onRefresh + applyCard). Also: a refresh within 10 s of the card's last read gets the cached card, and a second within 10 s is dropped by the limiter.
2. **Name:** the server path works in prod (service role; launch-check run 2 set names through the same POST at 23:37 UTC, rows later deleted by its cleanup). The client dropped every typed name: `useNameCheck` read the check's answer as `b.data.available`, but the route answers `{ ok, name: { name, available } }` (jsonResult's key), so it threw, the catch set "Couldn't check the name right now." (ok false), and `wanted` became null: the look saved without the name, silently. Also: an empty field saved look-only silently, and after the arrival nothing could set a name (the wardrobe had no field).

**Fix (client only: no Fly deploy, no migration; wire protocol unchanged):**
- `lib/net/netStore.ts`: `refreshCard()` (page store) / `RoomStore.refreshCard()`: one coalesced `refresh`, sent `CARD_REFRESH_MS` (11 s) after the join or the last refresh, re-sent after a reconnect, never while down.
- `lookStore.pushRemote` and `saveName` call `refreshCard()` after a successful save.
- `useNameCheck` reads `b.name.available` (the route's shape).
- Coordinator decisions (b) and (c): the wardrobe asks for the name too (WardrobeSheet: askName + saveName). The first creators (ReflectionCreator, CharacterCreator mode create) won't confirm with an empty or refused name: `useNameCheck(askName, required).missing()` shows "The island needs a name for you.", scrolls to the field and focuses it. "You" is now a reserved name (`lib/identity/names.ts`).
- Dev hook `window.__net.remotes()` also gives each remote's `look` (RemoteAvatars.tsx, dev only) for the evidence script `specs/evidence/net-identity/shoot.mjs` (harness: a local realtime with production-like card caching over a JSON file; the scratch copy is in the lane's report).
- ReflectionCreator lines touched (for the reflection-waves merge): 56 (`useNameCheck(askName, true)`), 126 (`if (yes || naming.missing()) return;`), 150 (`<Field id={naming.id} ...`).
- Tests: netStore.test.ts (card refresh, 2), CreatorFlat.test.tsx (name check against the route's shape, name required, refused name; 3), identity.test.ts (You), realtime island.test.ts (refresh reaches others; a later joiner gets the card).

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/net-identity /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.

## Next

1. Coordinator: merge; after the deploy, David's own account still has no world name: he sets one in the wardrobe (fitting room or closet), or the arrival asks a new account.
2. Production check (coordinator): two accounts; one changes look and name in the wardrobe; the other sees both within about 12 s without rejoining.

## Tools and gotchas

- Local two-client check: `cd realtime && CARDS=<file> PORT=2600 npx tsx scripts/cardHarness.ts` (background), dev server with `NEXT_PUBLIC_REALTIME_URL=ws://localhost:2600` and the Supabase env blanked, then `CARDS=<file> HOST=http://localhost:<port> node specs/evidence/net-identity/shoot.mjs specs/evidence/net-identity`. Restart the harness between runs: its card cache (60 s) carries names and looks over from the previous run.
- The harness must live under `realtime/` and import `@colyseus/tools` as ESM: loaded through createRequire it is a second copy of `@colyseus/core`, and every join fails with "room is already full".
- The plain first creator gates the join (the player joins once it closes); the wardrobe and the arrival happen while joined, so they are the refresh path.
- Dev cards (`dev:<name>`) skip the card source in `createCardLoader`; the harness clears `dev` so caching behaves as in production.
