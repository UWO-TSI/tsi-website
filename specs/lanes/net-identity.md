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

(none yet)

## Rules

- **Headless only:** never open a window, tab, app or audio on David's screen; never `open`; never the Playwright MCP, the claude-in-chrome tools or the `blender` MCP tools. Blender only as `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P <script>`. Never port 3000.
- **Locks:** `LANE=game/net-identity /Users/DavidLiu/.claude/jobs/62203045/tmp/withlock.sh heavy|blender|devserver <cmd>` (`specs/lane-rules.md`).
- **The default village world stays unchanged** (the launch fallback). New-world changes sit behind `NEXT_PUBLIC_GAME_WORLD=new`; run vitest with and without it.
- **Git:** commit with the `[build]` prefix. Never push. Never bare `git stash`. Work only in this worktree. Never touch prod; ask the coordinator for any read-only prod query.
- **Text:** no em dashes; real names never show in game; never write the gem-to-money rate anywhere (the repo is public).
- **Art:** David supplies every reference; never fetch art, textures or music; no asset libraries or generators.
- **Code:** ponytail (`specs/lane-rules.md`): search first, smallest change at the root cause, delete what you replace.
