> Status 2026-10-03: M1 in progress. David's calls: rows 296–299 (presence + chat first, Fly.io Toronto, free-text chat for everyone with filter/mute/block/report, phone players as resting avatars). Coordinator defaults for the plan's open points are in `specs/multiplayer-questions.md`. The protocol contract (`web/lib/net/protocol.ts`) changes only through the coordinator once it lands.

# Multiplayer (rows 296–299)

All paths are under the repo root `/Users/DavidLiu/Developer/uwotsi/.claude/worktrees/restart-art-cohesion` (`feat/game-default-island` == `main`, HEAD `dd3b4bee`).

## 0. What I checked today (2026-10-03)

**Decisions.** Rows 296–299 say:
- The first release is live presence plus text chat in the village, café and interiors. Everyone sees each other walk, run, slide, glide, emote and sit, with nameplates and class auras.
- Co-op ruins and home visits come in later milestones. PvP stays later.
- Hosting is Fly.io in Toronto, about $5 a month. David creates the account and adds the card.
- Members and public accounts both type free text, with a filter, mute, block and report, and the chat is logged for admins.
- Phone players appear as their avatar resting on a bench or café seat with a phone icon, and can emote and chat from the companion.

**Versions, from the npm registry today:**

| Package | Version |
|---|---|
| `colyseus` | 0.18.9 |
| `@colyseus/core` | 0.18.18 |
| `@colyseus/schema` | 5.0.35 |
| `@colyseus/sdk` | 0.18.4 (this is now the client; `colyseus.js` is frozen at 0.16.22, don't use it) |
| `@colyseus/testing` | 0.18.6 |
| `@colyseus/ws-transport` | 0.18.4 |
| `@colyseus/tools` | 0.18.7 |

- All of them require Node 22 or newer.
- 0.18 adds several things this plan uses:
  - `messages = { x: validate(zodSchema, fn) }`, which takes zod 4 through Standard Schema;
  - separate `onDrop`, `onReconnect` and `onLeave` hooks;
  - `UniqueSessionPlugin({ max: 1, onDuplicate: "replace" })`;
  - `maxMessagesPerSecond`;
  - `StateView` with view-tagged collections;
  - a `beforeUpgrade` hook and an `AuthContext` that carries the headers;
  - `matchMaker.controller.getCorsHeaders`, which can be overridden;
  - SDK auto-reconnect and `client.auth.token`.

**Auth.**
- The project's JWKS at `https://rtbkrngsdbptbjhfbcud.supabase.co/auth/v1/.well-known/jwks.json` publishes one ES256 key (kid `68398507-…`), so asymmetric signing keys are on.
- The existing server code never verifies a JWT itself. Every route calls `supabase.auth.getUser()` through the cookie client (`web/lib/server/memberContext.ts:23`).
- `@supabase/supabase-js` 2.103 in `web/` already has `auth.getClaims(jwt)`.

**Play subdomain (another session's branch).** `feat/play-subdomain` moves the game to `https://play.tethos.ca` and shares the session cookie `sb-tethos-auth` across `.tethos.ca` (`web/lib/supabase/cookie.ts` on that branch).

**Repo gotcha.** `.gitignore` has blanket `*.json` and `.env*` rules. `git check-ignore` confirms `realtime/package.json` and `realtime/tsconfig.json` would be ignored. This lost the island map once.

**Existing groundwork to reuse:**
- the world clock already exposes `setWorldClockOffset` (`web/lib/game/worldClock.ts:33`);
- the class design sheet already specifies event-driven, seeded effects for remote players;
- the fishing branch is already writing a "remote angler" `CharacterMotion.fishing`;
- `useStepDust` already serves avatars the player doesn't drive.

---

## 1. Architecture

### 1.1 Server package

New top-level package at `realtime/`.

**Dependencies:**
- `@colyseus/core` `~0.18.18`
- `@colyseus/ws-transport` `~0.18.4`
- `@colyseus/tools` `~0.18.7`
- `@colyseus/schema` `^5.0.35`
- `colyseus` `~0.18.9`, only for `colyseus/plugins/unique-session`
- `jose` (JWKS)
- `@supabase/supabase-js` 2.103 (RPC calls)
- `zod` 4
- optional: `@colyseus/monitor`

**Dev dependencies:** `@colyseus/testing` `~0.18.6`, `@colyseus/sdk` `~0.18.4`, `vitest`, `tsx`, `esbuild`, `typescript`.

**Node:** 24 LTS in Docker (`node:24-slim`); `engines.node >=22`. Pin `~0.18.x`, because Colyseus minor versions break APIs.

**Files:**
- `src/index.ts`: `listen(app, PORT)`.
- `src/app.config.ts`: rooms, `/health`, CORS override, monitor.
- `src/env.ts`: zod-validated environment.
- `src/auth/verify.ts`, `src/auth/card.ts`.
- `src/rooms/state.ts`: schema 5's decorator-free `schema({...})` builder, so no decorator config is needed.
- `src/rooms/IslandRoom.ts`, `src/rooms/sanity.ts`, `src/rooms/limits.ts`, `src/rooms/views.ts`.
- `test/*.test.ts`, `test/soak.ts`, `scripts/bots.ts`.
- `Dockerfile`, `fly.toml`, `README.md`, `.env.example`.

**Shared contract.** It lives in `web/lib/net/` as pure TypeScript with no npm imports. `realtime` imports it through tsconfig `paths` (`"@net/*": ["../web/lib/net/*"]`) and esbuild bundles it.
- Never the reverse: Next/Turbopack must not import outside `web/`, because that would need `next.config.ts`, which another session owns.
- `web/lib/net/` must not import `@colyseus/schema`. Otherwise two copies resolve (`web/node_modules` and `realtime/node_modules`) and schema `instanceof` breaks on the server.
- The client reads state through reflection and types it with the plain interfaces in `protocol.ts`. A realtime test asserts that the schema field list equals `NET_PLAYER_FIELDS`.

**`.gitignore`** (first commit): `!realtime/package.json`, `!realtime/package-lock.json`, `!realtime/tsconfig.json`, `!realtime/.env.example`, `!realtime/fixtures/**/*.json`.

### 1.2 Local development

- **Ports.** Realtime runs on 2567 (`PORT`). Next stays on 3000/3001 (3102 for evidence scripts).
- **Server.** `realtime`: `npm run dev` = `tsx watch src/index.ts`. `@colyseus/tools` loads `.env.development`.
- **Web.** Leave `npm run dev` unchanged so the six other agents see no difference. Add `"dev:mp": "concurrently -k -n next,rt \"next dev\" \"npm --prefix ../realtime run dev\""` and devDependency `concurrently`.
- **Switch.** Multiplayer is off unless `NEXT_PUBLIC_REALTIME_URL` is set (`ws://localhost:2567` in the developer's `web/.env.local`).
- **Dev auth.** `DEV_AUTH=1` (refused when `NODE_ENV=production`) accepts `dev:<name>` tokens. With it:
  - `/student/dashboard?mp=dev&as=Alice` in one tab and `as=Bob` in another gives two users without Google;
  - the bot script uses the same tokens.
- **Rendering without a server.** `?bots=24` drives remote avatars through a loopback source, so rendering and LOD work needs no server at all.
- **Mac mini budget.** The realtime dev server is about 100 MB and counts inside the existing "one dev server" slot, so run it only in the multiplayer agent's turn.

### 1.3 Production on Fly.io (default)

- **App and address.** App `tethos-rt`, `primary_region = "yyz"`, served as `wss://tethos-rt.fly.dev`.
  - Don't use `rt.tethos.ca`. The `.tethos.ca` session cookie (access and refresh token) would be sent to Fly on every matchmake request and WebSocket upgrade.
  - We never read cookies (auth is an explicit bearer token), so a non-`tethos.ca` host keeps them off the wire entirely.
- **`fly.toml`:**
  - `[http_service]`: `internal_port = 2567`, `force_https = true`, `auto_stop_machines = "off"`, `min_machines_running = 1`, concurrency `connections` with soft 300 and hard 400;
  - a health check on `GET /health` every 15 s;
  - `kill_signal = "SIGTERM"`, `kill_timeout = "15s"`;
  - `[[vm]] shared-cpu-1x`, 512 MB.
- **Docker.** A multi-stage `realtime/Dockerfile`:
  - the build stage copies `realtime/`, `web/lib/net/` and, from M2, `web/lib/moderation/`, runs `npm ci` and the esbuild bundle to `dist/index.mjs`;
  - the runtime stage is `npm ci --omit=dev` plus `dist`, run as `USER node`.
  - Add a root `.dockerignore` (`*`, then `!realtime/**`, `!web/lib/net/**`, `!web/lib/moderation/**`, `realtime/node_modules`).
  - Deploy from the repo root: `fly deploy . --config realtime/fly.toml --dockerfile realtime/Dockerfile`.
- **Cost.** About $3.3 a month for the machine plus about $0.02/GB North American egress. At 40 concurrent users × about 8 KB/s down that is about 1 GB per busy hour, so roughly $4–5 a month all in, which matches row 297.
- **Deploys.** A deploy restarts the single process. `onBeforeShutdown` broadcasts a `sys:restart` and disconnects with 4010; clients rejoin after a random 0–3 s. Deploy at quiet hours.
- **Alternatives:**
  - Colyseus Cloud: zero-ops, git deploys and monitoring, about $15+ a month according to `specs/asset-stack.md` (re-check at signup), with no Toronto-specific region.
  - Self-hosting: a DigitalOcean TOR1 droplet ($6, 1 GB) with Caddy TLS on a non-`.tethos.ca` host and systemd. Cheapest, but patching and monitoring are ours.
  - Scaling out later: `@colyseus/redis-presence` and `redis-driver` plus Fly `fly-replay`. Not needed below several hundred concurrent users.

### 1.4 Client URL, CORS and origins

**Client URL.**
- `NEXT_PUBLIC_REALTIME_URL` is inlined at build time, so changing it needs a redeploy.
- Production and Preview: `wss://tethos-rt.fly.dev`; local: `.env.local`.
- Unset means multiplayer is off.
- Previews need `NEXT_PUBLIC_MEMBER_WORLD=open` for Preview to test (`web/lib/recruitment-access.ts:10`).

**Origins.**
- `ALLOWED_ORIGINS`: `https://play.tethos.ca`, `https://www.tethos.ca`, `https://tethos.ca`, `https://uwotsi.com`, `https://www.uwotsi.com`.
- `ALLOWED_ORIGIN_PATTERNS`: `^https://uwotsi[a-z0-9-]*-davids-projects-e31987e3\.vercel\.app$`.
- In dev: any `http://localhost:*`, `http://play.localhost:*` or `http://127.0.0.1:*`.

**How they are enforced.**
- `matchMaker.controller.getCorsHeaders` echoes only allowed origins, with `Allow-Headers: authorization, content-type` and `Allow-Credentials: false`.
- `beforeUpgrade` rejects disallowed `Origin`.
- `@colyseus/sdk` fetches matchmake with `credentials: "include"` by default. The client sets `client.http.options.credentials = "omit"` right after `new Client(...)`, since the server never allows credentials.
- The WebSocket transport gets `maxPayload: 4096`.
- There is no CSP today (no `connect-src` in `next.config.ts` or middleware). If one is added later it must include the realtime origin.

---

## 2. Auth and identity

**2.1 Join flow.**
1. **Get the token.** The client calls `createClient().auth.getSession()` from `web/lib/supabase/client.ts` (read only; another session owns that file), refreshing if the token expires within 60 s.
2. **Join.** It sets `client.auth.token = access_token` and calls `joinOrCreate("island", { v: PROTOCOL, area, mobile, showClass })`.
3. **Verify on the server.** `static onAuth(token, options, ctx)`:
   - checks the origin;
   - runs `jose.jwtVerify(token, createRemoteJWKSet(<SUPABASE_URL>/auth/v1/.well-known/jwks.json), { issuer: "<SUPABASE_URL>/auth/v1", audience: "authenticated", algorithms: ["ES256"] })`;
   - requires `role === "authenticated"` and `is_anonymous !== true`;
   - requires `options.v === PROTOCOL`, otherwise closes with 4006.
   - `jose` refetches the JWKS on an unknown kid, so key rotation is handled. No JWT secret goes on Fly.
   - `getClaims()` is the one-line equivalent, but `jose` makes the tests able to inject a local JWKS.
4. **Revocation.** Local verification does not see a sign-out until the token expires (1 h at most). Bans therefore come from the database card at join plus the poll in M2.

**2.2 What the server loads.**
- One new service-only RPC, `public.realtime_player_card(p_member uuid) returns jsonb`: `SECURITY DEFINER`, `search_path = public`, `REVOKE ALL FROM public, anon, authenticated`, `GRANT EXECUTE TO service_role`.
- Fields:
  - `member_identity.world_name`; null becomes "Islander". Never `profiles.display_name`, which is the real Google name (row 222);
  - `badge`: `member` when `membership = 'member' AND is_active`;
  - `tier`;
  - `avatar_config->'look'`, capped at 2 KB;
  - `family`;
  - `member_progression.level` and `.subclass`;
  - `member_subclass_mastery.mastery` and `cosmetics->>'aura'`, `->>'frame'`;
  - `classes_v2_on()`;
  - `muted_until`, `removed_until` (the column arrives in M2; M1 returns null);
  - `profiles.created_at`.
- The server calls it once per join, caches it 60 s per user, and re-reads on a `refresh` message (at most once per 10 s) after a wardrobe, name or class change.
- If the card times out after 3 s, the join is refused and the client retries.
- The server sends keys and numbers only. Clients derive the icon, title and aura ramp with the existing tables (`classKit()`, `masteryCosmetics()`), so no business logic is duplicated on the server.
- Secret: a dedicated Supabase secret key named `realtime` (or the service role key), kept in Fly secrets as `SUPABASE_SECRET_KEY`.
- Smoke test: `web/supabase/tests/realtime_card_smoke.sql` checks that anon and authenticated are denied, the fields come back, and the real name never appears.

**2.3 Bans and mutes.**
- **M1:** refuse a join when `removed_until > now()` (4002).
- **M2:**
  - `muted_until` blocks world chat (the same field already blocks letters and table chat, `web/lib/identity/mute.ts`);
  - `removed_until` kicks the player and refuses rejoin;
  - changes from the admin routes reach the server immediately through `POST /internal/sanction` (HMAC shared secret);
  - a 60 s poll of `member_identity` for connected users is the safety net.

**2.4 Public (T5) and members.**
- Both join, with identical features (rows 75 and 298). Members get the blue dot (row 223).
- Tier is never sent to clients. The server uses it only for T1/T2 moderation actions.
- No guest play (row 224): signed out means solo, no connection.
- One session per user: `UniqueSessionPlugin({ max: 1, onDuplicate: "replace" })`, with the user id set from the verified `sub`. The older tab gets 4004 ("You're on the island in another window. Play here?").

---

## 3. Rooms

**Recommendation: one `island` room per shard, covering the village, café, HQ, museum and Oracle, with an `area` field and per-client `StateView` filtering.** Not separate interior rooms.
- **Instant doors.** Walking through a door is an `area` message, not a WebSocket rejoin plus a fresh full state under the 320 ms door fade.
- **Friends stay together.** A shard keeps its identity inside and out.
- **One of everything.** One roster, one chat channel and one connection per client.
- **Per-area counts** for NPC scaling come from one state.
- **Bandwidth stays per area**, because views only include same-area players.

| Room | Instances | Caps | Who | Lifecycle |
|---|---|---|---|---|
| `island` | Shards; `joinOrCreate` with `sortBy({clients:-1})` fills the fullest open shard | Soft cap 30: `lock()` at 30, `unlock()` below 26 (matchmaking only). Hard cap `maxClients` 40, so joinById, friends and phones still fit | Everyone, phones included | Auto-dispose when empty; `metadata.shard` is the smallest free number |
| Areas within `island` | `village`, `cafe`, `hq`, `museum`, `oracle` are public; `ruins`, `home`, `house` are private (hidden, see nobody, still in the roster: "In the ruins", "On their island") | n/a | n/a | n/a |
| `ruins` (M3) | One per party, private | 4 | Party members only | Leader creates it; members join by id; 30 s reconnection; host migration |
| `home` (M4) | One per host (`filterBy(["host"])`) | 8 | Host plus guests with a grant | Only the host can create it; disposes 60 s after the host leaves |
| Solo ruins and home (M1–M3) | No room: you set a private area on `island` | n/a | n/a | n/a |

**Study tables: leave the 30 s HTTP heartbeat as the authority.**
- Sessions, the 5-minute grace and coin settlement are database-backed and must survive realtime outages. The companion polls them too.
- Fold only the display: the `Player` schema carries `study` (none, seated, focus, break) and `studyEnds`, so remote overhead timers are instant.
- `StudySeats` stops drawing a `MateFigure` body for members who are already in your room (dedupe by user id).

**Lifecycle and reconnection.**
- **Client connects** after the world is ready, the creator is finished and the user is signed in.
- **Scene changes** send `s {area}`. On a private area the server removes you from every view.
- **Drop:** `onDrop` gives `allowReconnection(client, 20)`, or 120 s for phones (iOS suspends sockets). The player is flagged `away` and their nameplate dims.
- **Reconnect:** `onReconnect` clears `away`.
- **Leave:** `onLeave` removes the player and frees their seat.
- **Where refusals come from** (Colyseus 0.18): static `onAuth` runs in the matchmake HTTP POST, so its refusals arrive as HTTP **401** (token: refresh and retry once, like 4001) or **403** (origin). Refusals in `onJoin` arrive as 41xx codes (4101, 4102, 4106, 4107). Our codes stay out of 4000–4003, which Colyseus 0.18 sends itself; 4010 is Colyseus' MAY_TRY_RECONNECT, which the SDK auto-reconnects on. The contract's `joinRefusal(code)` maps both.
- **Client close codes:**

| Code | Meaning | Client does |
|---|---|---|
| 4101 | Auth failed / no profile | Refresh token, retry once |
| 4102 | Removed | Message, stay offline |
| 4103 | Kicked for movement | Log it, stay offline |
| 4104 | Replaced by a newer tab | "Play here" button |
| 4106 | Old version | "Reload to see others" |
| 4107 | Busy (player card timed out or database down) | Rejoin with backoff 2/4/8/16/30 s |
| 4000–4003 | Sent by Colyseus itself (consented, shutdown, error incl. message flood, failed reconnect) | Rejoin with backoff, except 4000 after our own `leave()` |
| 4010 | Server restart | Rejoin after jitter |
| Abnormal | Dropped connection | SDK auto-reconnect inside the grace window, then rejoin with backoff 2/4/8/16/30 s |

- **`pagehide`** calls `room.leave()`.
- **Hidden tabs** keep their connection (studying in another tab, row 169). The sender simply stops, so the player stands idle.
- **AFK:** flagged after 5 minutes without input, never kicked in M1.

---

## 4. State schema and protocol

**4.1 Server state** (`realtime/src/rooms/state.ts`; client types in `web/lib/net/protocol.ts`).

```
Player (in players: { map: Player, view: true }), keyed by sessionId
  sid uint16            short per-room id used by events
  uid string
  // card (rare)
  name string, badge uint8, look string(≤2KB), level uint8, family uint8,
  kit string, mastery uint8, aura string, frame uint8
  // presence (rare)
  area uint8 (AREAS index), flags uint8 (away 1, afk 2, mobile 4, showClass 8, typing 16, armed 32)
  held string ("rod:<key>" | "net:…" | "pin:…" | "glider" | "weapon:<key>" | "")
  weapon string (back weapon key when armed), pose string (seat/fish-hold clip or "")
  study uint8, studyEnds uint32 (ms since epoch)
  // motion (client-authoritative, server-validated; ~10 Hz)
  t uint32 (sender sample time, ms since room epoch)
  x,y,z int16 (cm)   vx,vy,vz int16 (cm/s, clamp ±40 u/s)   yaw uint16 (2π/65536)
  move uint8 (MOVE_CLIPS: 0 none, Air, Fall, Glide, Skid, Slide, CrouchWalk, CrouchIdle; append-only)
  air uint8, leaf uint8 (0..1.3 → 0..255), lift int16 (mm, seats)
IslandState: epoch float64 (server Date.now() at create), shard uint8,
  players (view), roster: { map: RosterEntry {uid,name,badge,area,flags} }  // whole shard, presence list
```

Notes:
- `int16` centimetres covers ±327 u, which holds the 64×64-cell grid, the interiors and the islets.
- `pose`, `held` and clip names are strings. They only go over the wire when they change, and a clip id table would need an append-only list that the fishing and classes branches keep extending.

**4.2 Messages.**

Client to server:
- `p` pose packet, a msgpack array, about 40 bytes:
  `[seq, t, x, y, z, vx, vy, vz, yaw, move, air, leaf, lift, flags, ev?]`
  - `ev` is a flat list of up to 4 entries `[kind, value, dtMs]`;
  - `kind` is one of: clip one-shot, upper-body one-shot, afterimage, stop, or movement juice (`jump`, `hop`, `long`, `dashjump`, `land`(with drop), `dash`, `slide`, `dashslide`, `landslide`, `slidejump`, `stand`, `glide`, `furl`, `mantle`, `roll`, `skid`, `bonk`, `splash`, `respawn`);
  - flag `teleport` (bit 7 of the packet flags) means snap, don't interpolate.
- `s` slow state: `area`, `held`, `weapon`, `pose`, `study`, `studyEnds`, `showClass`, `afk`.
- `ping [clientMs]`.
- `refresh`.
- M2: `chat`, `report`, `block`, `mod`.

Server to client:
- state patches;
- `e [sid, t, kind, value]` events, sent only to clients whose view holds that player;
- `pong [clientMs, serverMs]`;
- `sys {kind, text}`.

**4.3 Rates.**
- **Pose packets:**
  - 10 Hz on the ground while moving;
  - 15 Hz while `move` is set (air, glide, slide, dash);
  - immediately on any event (coalesced, at least 30 ms apart);
  - one packet on stopping, then nothing while still.
- **Server:** `patchRate = 50` ms (20 Hz forwarding). Schema already sends only the changed fields, and quantized `int16` fields are the delta compression.
- **Bandwidth:** about 30 bytes per moving player per patch, so about 10 KB/s per client with 30 players moving.

**4.4 Interest management.**
- Views are rebuilt at 2 Hz: same area, not private, and in the village within 50 u (removed beyond 60 u, for the future bigger island).
- Private areas see nobody.
- On the client there is a second, render-side cap (5.5).

**4.5 Server sanity checks** (pure functions in `realtime/src/rooms/sanity.ts`, derived from `MOVE_TUNING` in `web/lib/game/movement/sim.ts`: walk 7.4, sprint 12, dash 18, momentum ceiling 18 plus 10 × slope downhill, max fall 18):
- **Rejected outright:** values that aren't finite, enums out of range, positions outside the area's bounds (village |x|,|z| ≤ 40, y −3..25; interiors |x|,|z| ≤ 20).
- **Time between samples** must be 20–2000 ms, otherwise the baseline resets.
- **Speed:**
  - horizontal at most 32 u/s instantly and 26 u/s averaged over a 1 s window;
  - rising at most 15 u/s straight up, or up to 0.9 × the horizontal speed on a climb (`CLIMB_RATIO`; ramps are 0.75, and an honest dash up a ramp reads 12.2 u/s), falling at most 22 u/s.
- **Teleports.** More than 6 u within 0.3 s needs the teleport flag. Flags are limited to 1 per 2 s and 15 per minute; doors, seats and splash respawns all set it.
- **On a violation:**
  - the sample is not applied or relayed (others see you stop);
  - a strike is recorded, decaying 1 per 10 s;
  - 10 strikes means kick 4003 and a log line;
  - in dev, log only.
- The client stays authoritative over its own avatar. These checks only protect what others see.

**4.6 Rate limits.**

| What | Limit | Excess |
|---|---|---|
| `p` | 20/s, burst 30 | dropped |
| `s` | 5/s | dropped |
| Area change | 3/s, 30/min | dropped + strike |
| Events | 8/s; emotes 1/s, 20/min | dropped |
| `refresh` | 1 per 10 s | dropped |
| `ping` | 2/s | dropped |
| Everything | Colyseus `maxMessagesPerSecond = 60` | disconnect |

**4.7 World clock.**
- The server's `Date.now()` (NTP-synced on Fly) is the authority.
- At join the client sends 5 pings 200 ms apart, then one every 15 s.
- Offset = `serverMs − (clientSend + rtt/2)`, taking the median of the 5 lowest-RTT samples out of the last 16.
- It then calls `setWorldClockOffset(offset)` (`web/lib/game/worldClock.ts:33`) when the change is over 100 ms, unless a dev `?at=` preview is active. That preview writes the same offset and resets it to 0 on unmount (`web/lib/game/useIslandConditions.ts:46-52`).
- The same offset stamps pose packets: `t = Date.now() + offset − state.epoch`.
- The result: residents, sun, weather and the café patrons' schedule line up between players (it matters when someone talks to a resident in front of you), and samples land on a shared timeline.

---

## 5. Client

**5.1 Network store** (`web/lib/net/netStore.ts`).
- A module singleton that survives Strict Mode and Fast Refresh, with a reference-counted connect and a delayed leave.
- States: `off`, `connecting`, `joined`, `reconnecting`, `offline(retryAt)`, `kicked(reason)`.
- `@colyseus/sdk` is lazy-imported on the first connect.
- `setArea(area)` sends `s` (no rejoin).
- `Callbacks.get(room)`: `onAdd`, `onRemove` and `onChange` on `players` feed a remote registry, with no React involved.
- React reads `useNetStatus()` and `useRoster()` through `useSyncExternalStore`, so components re-render only on join, leave or area changes.
- Dev `?netsim=lat:120,jit:60,loss:0.03` delays incoming samples.

**5.2 Local avatar tap: two one-line edits, nothing per frame in React.**
- `web/lib/net/localAvatar.ts` exports `useLocalAvatarTap(motion, held?)`. Its effect:
  1. registers the motion ref as the local avatar (passive: it costs nothing where no `NetWorld` is mounted, e.g. the applicant island);
  2. installs accessor properties for `play`, `upper`, `ghost` and `stop` on `motion.current`, which journal every one-shot into a 16-slot ring.
- Why accessors: the fishing branch moves `Character`'s `useFrame` to priority −1. A sampler that read `motion.play` before `Character` consumed it would be order-fragile. The setter catches the clip whoever writes it: `PlayerAvatar` events, `useWorldClips`' `Object.assign`, combat.
- Edits:
  - `web/components/game/PlayerAvatar.tsx` after line 137: `useLocalAvatarTap(motion, held);`
  - `web/components/game/interiorShared.tsx` after line 94 (`InteriorPlayer`, the second local controller for the HQ, museum, Oracle and house): `useLocalAvatarTap(motion);`
- **The sender** (`NetSender` in `NetWorld`, a `useFrame` at default priority) reads:
  - the `player` ref (x, y, z), with velocity by finite difference (exponentially smoothed; this works for `InteriorPlayer`, which has no sim);
  - `motion.yaw`, `lift`, `pose`, `move`, `air`, `leaf`, `scrub` and `poseRate` (the last two arrive with the fishing branch);
  - the drained journal.
- It writes into a preallocated `number[]` and calls `room.send("p", arr)` only on send ticks. msgpack allocates only on those 10–15 Hz sends, never per frame. There are no React state writes.
- A position jump over 2.5 u in one frame, or a new tap registration (scene remounts and respawns), sets the teleport flag. The respawn, splash-respawn and seat-snap events set it themselves too: a 1–2 u respawn inside 30–100 ms would otherwise read as 15–60 u/s.
- `held` comes from the tap; `weapon`/`armed` from `combat.rt.player`; `study` from `getWorldStudy()`; `showClass` from `hudPrefs`. These are sent through `s` on change.

**5.3 Interpolation buffer** (`web/lib/net/interp.ts`, pure and unit-tested).
- Per remote, an 8-sample ring in a `Float64Array`, keyed by the sender's `t`.
- Rendered at `serverNow − delay`, with `delay = clamp(1.5 × observed interval + 2 × jitter, 120, 300)` ms, about 200 ms by default.
- Position uses cubic Hermite with the sent velocities, so 10 Hz still draws smooth jump arcs. Yaw uses the shortest arc.
- Discrete fields (`move`, `pose`, `air`, `leaf`, `lift`) step at their sample's time.
- Events wait in a 16-slot queue and fire when render time passes their `t`, in step with the position.
- If the buffer underruns, extrapolate with velocity for up to 250 ms, then hold. Snap when the error exceeds 3 u or the teleport flag is set.
- `sample(renderT, out)` writes into a caller-owned object.

**5.4 `RemoteAvatar`** (`web/components/game/net/RemoteAvatar.tsx`), using the same rig and clips.
- `<group>` → `<Suspense fallback={null}><Character look motion walkSpeed={7.4} weapon held leaf /></Suspense>`.
- It never mounts `PlayerAvatar` and never calls `useWorldClips`, which listen to global window events (see section 10).
- **Driver loop.** One `useFrame(-3)` in `NetWorld` drives all remotes, as `NPC.tsx` does. Per remote it:
  - samples the buffer;
  - places the anchor at `groundY = min(y, floor)`, using the scene's `top` and `wet` (village from `villageIsland(village())`, interiors flat);
  - sets `motion.lift` to the seat lift when `pose` is a seat clip, otherwise `y − groundY`;
  - sets `motion.speed` to the horizontal velocity, or 0 while `move` is set;
  - sets `motion.yaw`, `move`, `air` and `leaf`;
  - fires queued one-shots (`motion.play`, `upper` and `ghost` for dash afterimages).
- Clip names are applied only if `CLIP_BY_NAME` or `VERB_BY_NAME` has them. An unknown one-shot would stick as Idle in `Puppet.update`.
- **Look and items:**
  - `look` is `parseLook(JSON.parse(look))`;
  - `held` maps through `heldView` (export it from `PlayerAvatar.tsx:703`, a one-word edit, or copy it into `lib/net`);
  - the back weapon is a `WeaponView` with `inHand: false`, built from `WEAPONS[key]`.
- Seated remotes (phones) play emotes as `motion.upper` so they don't float.

**5.5 Performance budget.**
- Measured baseline (`specs/character-in-engine-questions.md` item 11, M4 at High): +12 characters gave 77–82 FPS and about +2 draws each; +24 gave 54–86 FPS. That is not integrated-GPU evidence.

| Tier | High | Light | What it gets |
|---|---|---|---|
| Full | nearest 12 | 8 | ≤ 20 u and in the frustum: mixer every frame, face animation, held items, aura, step dust, sun shadow caster, nameplate |
| Reduced | next 12 (24 drawn) | next 8 (16 drawn) | 20–40 u or over the full cap: mixer at 15 Hz, no aura or dust, `userData.sunCaster = "off"`, nameplate only within 22 u |
| Hidden | the rest | the rest | `group.visible = false` and `motionRef.current = null` (no mixer), still interpolated so they reappear in the right place |

- **Mixer throttling without editing `Character`.** `Character`'s `useFrame` returns early when `motion.current` is null (`Character.tsx:615-618`). On the update frame the driver sets `m.rate = accumulated / min(delta, 0.1)`. So 15 Hz and fully skipped updates need no edit to `Character.tsx`, which the fishing and avatar-v8 branches are both changing.
- **Shadows.** `SunShadows` walks the scene each frame and takes `userData.sunCaster` before `castShadow` (`SunShadows.tsx:107`). So shadows turn off through `userData`, set only when the tier changes. Hidden objects are skipped.
- **Tier assignment** happens every 250 ms, sorted by distance, with 2 u of hysteresis. Phone resters count as Reduced.
- **Nameplates.**
  - One pooled DOM overlay (`Nameplates.tsx`) with 12 elements, positioned by the driver with `translate3d`, and written only when an element moves more than 0.5 px.
  - Not a drei `<Html>` per remote: each one is its own React root with per-frame projection work.
  - Projection needs an allocation-free copy of `calculateCurvedHtmlPosition`, which allocates an array per call (`web/lib/game/worldProjection.ts:12-16`) and must keep the curved-world bend.
  - The plate copies the paper look from `PlayerAvatar.tsx:653-678` into `net.module.css` (unify later, section 9).
  - Real players' plates always show within 22 u, unlike residents (shown only when close) and patrons (none), so real people are distinguishable from NPCs (rows 2, 72, 271).
- **Targets to measure with bots:**
  - at most 0.12 ms CPU per Full remote on the reference laptop, and at most 3 ms total for 24 drawn;
  - at most +3 draws per drawn remote on Light and +5 on High;
  - at least 30 FPS on Light with 24 remotes on an integrated-GPU laptop (row 39), and at least 50 FPS on the M4 at High.
- The whole scene, with remotes, residents and patrons, aims for about 30 animated characters at once. NPC scaling (5.8) supplies the headroom.

**5.6 Effects on each avatar** (row 238 and look-development §7.1: action effects are events attached to the avatar that acted).

| Effect | Remote |
|---|---|
| Footstep dust and prints | `useStepDust(motion, group, island)`: 0.6 amount, silent, village and café only. `InteriorPlayer` scenes never tick the shared pool, which only `PlayerAvatar.tsx:526` ticks |
| Jump takeoff, landing by drop, dash burst and streaks, slide spray, glide open and furl, splash, mantle | From the event at the interpolated position through `web/lib/game/movement/juice.ts` with 0.7 amount, Full tier only |
| Dash afterimage | `motion.ghost` |
| Leaf glider | `leaf` prop plus `motion.leaf` |
| Held tool, weapon on the back | Replicated keys |
| Aura | `FamilyAura` or `SubclassAura` with the remote's position ref, Full tier, at most 8 |
| Bobber and line | After the fishing branch merges: replicate `FishingState` (already seeded and `local`-flagged) |
| Chat bubble and talking mouth (M2) | `motion.talk = seconds` (already supported by `Character`) |
| Sounds, FOV kick, camera dip and shake, flashes, slow motion | Never for remotes. In M3 a remote ult within 20 u gets 50% speed lines and 30% shake only (design sheet) |

**5.7 Presence list.**
- `PresenceList.tsx`, opened from a small HUD button in `NetHud` (no `TopCluster` edit). Key `O` in M2, through a new `openPeople` binding.
- It groups the shard roster by area (Village, Café, HQ, Museum, Oracle, In the ruins, On their island; phones get a phone icon). Each row shows name, member dot and level.
- M1 is read-only. Actions come later: mute, block and report in M2; invite to party in M3; visit in M4.

**5.8 NPC scaling (principle 2).** The headcount comes from room state, so every client in a shard agrees.
- **Café:** `patronTarget(max(seated members, players in the café))` in `web/components/game/study/CafePatrons.tsx:68`. Also switch `Date.now()` to `worldNow()` at :73, and let patrons yield to remote positions at :75.
- **Village:** service residents (7 posts) always stay. Flavour villagers drop from 12 total to 10 at 6 or more other players, 8 at 10 or more, and 7 at 15 or more. They walk home through their routine's home stop rather than popping out (`Residents` in `web/components/game/NPC.tsx` reads `useAreaHeadcount("village")`).
- **Offline or alone:** everyone shows.

**5.9 Bots (dev).**
- `web/lib/net/botBrain.ts`, pure, drives the real `stepMove` from `web/lib/game/movement/sim.ts` on `villageIsland(village())`. Bots wander between landmark points; run, hop, dash, slide and glide; emote; and sit on benches.
- It feeds two sources:
  1. `?bots=N` loopback (`web/lib/net/loopback.ts`): no server, the same registry interface, with netsim jitter. Rendering and LOD work and evidence need no server.
  2. `realtime/scripts/bots.ts`: real `@colyseus/sdk` clients with `dev:bot-NN` tokens (`npm --prefix realtime run bots -- --n 24 --area village --near 4,-6`). Loads the server too.

---

## 6. Social and safety (M2)

**Chat.**
- Island chat per shard. Each line carries the sender's area. Bubbles appear only for players in view. The log panel holds the last 50 lines of the session.
- Hidden by default during your own focus block, like table chat (row 77).
- Table chat stays its own HTTP channel.

**Filter.**
- Reuse `web/lib/moderation/profanity.ts`. It is a 20-word, whole-word list that "f*ck" or leetspeak gets past.
- Add normalization (leet map, collapsed repeats, stripped separators) for every user: names, letters, table chat and world chat.
- Refuse the line with a notice, matching study chat's "Please keep … friendly"; don't mask it.
- URLs are plain text, never links. Refuse URLs from accounts younger than 7 days.

**Limits:** 200 characters; 6 lines a minute and 60 an hour (study chat's numbers); at least 1.5 s apart; no repeat of the same text within 30 s; `muted_until` refuses with a notice. Optional slow mode for public accounts younger than 24 h (see the questions).

**Log.**
- Table `world_chat_messages` (id, shard, room_id, area, member_id, body ≤ 200, created_at, hidden, reported, reported_by, reported_reason, reported_at).
- Inserts batch every 2 s from the realtime server through `realtime_log_chat(jsonb)`, service only.
- Kept 30 days, or 90 days after a report resolves. A daily prune job keeps writes small (pg_cron write volume contributed to the 2026-09-18 outage).
- The chat UI says "Chat is logged for moderation."

**Mute, block, report.**
- **Mute:** session-only, on the client.
- **Block:** persistent `world_blocks` (row-level security: owner can select, insert and delete). The server stops delivering chat lines and emote events between the pair in both directions, and party and visit invites in M3–M4. Avatars still show, since the world is shared.
- **Report:** from a chat line or a roster name. Writes `world_reports` with the last 20 lines of shard chat as context, at most 5 an hour.
- Reports join the existing queue: extend `/api/admin/moderation` and the page at `web/app/student/dashboard/admin/moderation/page.tsx` with a "World chat" source. `moderation_log`'s CHECK constraints gain `item_kind 'world_chat'` and `action 'remove_world'/'restore_world'` (new migration; never edit `20260929100100`).
- **T1/T2 in the world:** "Mute 7 d" (`MUTE_DAYS`) and "Remove N d" from the roster. They go through RPC `realtime_sanction`, write `moderation_log`, and take effect at once.

**Emotes:** unchanged (content `emote_types`, then `EMOTE_CLIPS`). Relayed as clip one-shots at 1/s and 20/min. Phones send them from the companion.

**Public accounts** see and can do everything members can (rows 75 and 298): be seen, emote, chat, block, report. They get no blue dot. Club tools stay gated. Nobody ever receives a real name.

---

## 7. Tests

**`web/lib/net/protocol.test.ts`:**
- quantization round trips and bounds;
- `decodePose` rejects NaN and Infinity, out-of-range enums, oversized `ev` and wrong types;
- `MOVE_CLIPS` and `AREAS` are snapshot-locked (append-only).

**`web/lib/net/interp.test.ts`:**
- Hermite midpoint and apex accuracy against a jump arc from `stepMove`;
- yaw across the 0/2π seam;
- the underrun extrapolation cap;
- teleport snap;
- events fire in order and on time;
- `sample()` reuses its output object.

**`web/lib/net/localAvatar.test.ts`:** the journal catches `play` through direct assignment, `Object.assign` and a later null clear, once each.

**`realtime/test/auth.test.ts`** (local ES256 key and JWKS via `jose.generateKeyPair`, verifier and card loader injected through `createApp({ verify, loadCard })`):
- missing token, bad signature, expired, wrong issuer or audience, and anonymous are refused;
- `removed_until` gives 4002, a version mismatch 4006, a dev token in production is refused, and a bad origin is refused.

**`realtime/test/island.test.ts`** (`@colyseus/testing` `boot()`, `createRoom`, `connectTo`):
- two clients in the same area see each other; different areas don't; an area change moves views; a private area is hidden;
- pose relay arrives dequantized;
- a speed violation isn't relayed, and 10 strikes gives 4003;
- rate limits drop excess;
- an emote reaches the same area only;
- a second tab replaces the first (4004);
- reconnecting within 20 s keeps the player, after that they're removed;
- the shard locks at 30 and unlocks below 26;
- the schema field list equals `NET_PLAYER_FIELDS`.

**`realtime/test/sanity.test.ts`:** fixtures generated by `stepMove`: a dash chain, a downhill slide at the momentum ceiling, a glide off a 1.5 u cliff, the fall cap.

**SQL smoke tests** in `web/supabase/tests/`: `realtime_card_smoke.sql` (M1); `world_chat_smoke.sql` covering blocks row-level security, reports, prune and constraints (M2).

**Soak** (`realtime/test/soak.ts`, run by hand, not in the default suite):
- 40 SDK bots for 30 minutes across 2 shards; every 5 minutes 10 random sockets are killed and must reconnect within 25 s with their player kept;
- record event-loop delay at p99 (target under 20 ms), heap growth (under 10%), messages per second, bytes per client per second, strikes (0 for honest bots), and a final check that state matches each bot's last pose within 1 cm;
- run locally, then once against a temporary `tethos-rt-staging` Fly app;
- client side: `/student/dashboard` with 24 bots nearby for 10 minutes at Light and High, recording FPS median and 5th percentile, draws and JS heap.

---

## 8. Milestones

Every milestone has its spec in `specs/multiplayer.md` (sections M1–M4) and questions in `specs/multiplayer-questions.md`. Work happens in worktrees under `.claude/worktrees/mp-*`, one branch per agent, merged by the coordinator.

### M1: presence in the village and interiors, with local runs, bots, and a deploy

**Commits in order:**
1. `[review]` `specs/multiplayer.md` from this plan. Also update `CLAUDE.md` lines 11 and 43, the `STATE.md` focus section, and the multiplayer section of `specs/development-roadmap.md`.
2. `[build]` net protocol: `web/lib/net/protocol.ts` and its test (types, enums, quantization, packet codec, limits, close codes, `NET_PLAYER_FIELDS`). This freezes the contract; later changes go through the coordinator only.
3. In parallel (A, B and C below).
4. Integration by the coordinator, in order:
   - `web/package.json`: add `@colyseus/sdk`, the `dev:mp` script and `concurrently`;
   - the two tap lines;
   - `DefaultIslandWorld`;
   - `StudySeats` dedupe;
   - bench slots;
   - café patron count;
   - NPC thinning, after polish-reach merges.
5. Bots and soak, plus evidence in `specs/evidence/multiplayer/M1-*`: two-client sheets of walk, run, slide, glide, emote and sit; interiors; 24-bot LOD; the FPS table; jitter frames; reconnection.
6. Deploy:
   - David creates the Fly account and card (row 297);
   - `fly apps create tethos-rt`;
   - `fly secrets set` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ALLOWED_ORIGINS`, `ALLOWED_ORIGIN_PATTERNS`);
   - the migration, then `fly deploy`;
   - Vercel Preview env (`NEXT_PUBLIC_REALTIME_URL`, plus `NEXT_PUBLIC_MEMBER_WORLD=open` on Preview);
   - a smoke test with two real accounts, then Production.

**Parallel agents (no shared files):**
- **A (server)** owns `realtime/**`, the migration `web/supabase/migrations/<ts after the latest on main>_realtime_card.sql` with its smoke test, the root `.dockerignore` and the `.gitignore` lines. Order: scaffold and `/health`; auth and card (tests); `IslandRoom` (state, areas and views, pose relay, sanity, limits, events, ping, shards, reconnection, unique session); Dockerfile and `fly.toml`. Test-driven, no browser.
- **B (client core)** owns `web/lib/net/{interp,netStore,localAvatar,sender,loopback,botBrain}.ts` and their tests. No browser needed.
- **C (rendering)** owns `web/components/game/net/**`: `NetWorld`, `RemoteAvatar`, `Nameplates`, `PresenceList`, `NetHud`, LOD and `net.module.css`. It builds against `?bots=N` loopback and is the only M1 agent that needs the browser.

**Edits to shared files** (by the coordinator, after the files' current owners merge):
- `web/components/game/DefaultIslandWorld.tsx`, three insertions:
  - after line 518: `const area: Area = site === "ruins" ? "ruins" : site === "home" ? (inside === "house" ? "house" : "home") : inside ?? "village";`
  - inside the Canvas after `{children}` (line 964): `<NetWorld area={area} player={player} ready={ready && !fading} />`
  - before `<LoadingStatus/>` (line 1081): `<NetHud area={area} />`
- `web/components/game/PlayerAvatar.tsx:137`, `web/components/game/interiorShared.tsx:94`: one line each.
- `web/components/game/study/StudySeats.tsx:187`: pass `body={!inRoom(m.member_id)}` to `MateFigure`, which skips `<Character>` but keeps the overhead timer.
- `web/lib/game/defaultIsland.ts:170-176`: `benchSeat` gets 2 slots at ±0.42 u along the bench, plus a `taken(slotKey)` predicate fed by room seat claims (`s {seat}`). `DefaultIslandWorld.tsx:323` passes it.
- `CafePatrons.tsx:68/73/75` and `NPC.tsx` `Residents`: the headcount work in 5.8.

**Acceptance:**
- the 10-point checklist: two browsers see each other walk, run, slide, glide, jump, dash, sit and emote with leaf, tools, weapon, nameplate and aura; interiors isolate; ruins and home are private;
- smooth under `?netsim=lat:120,jit:60,loss:0.03`;
- the 24-bot FPS targets;
- every auth refusal works;
- clock alignment under 100 ms;
- no double seat-mates;
- NPCs thin and refill;
- graceful solo play when the server is down.

### M2: chat, social safety and phone presence

**Commits in order:**
1. Migration `…_world_chat.sql`:
   - `world_chat_messages`, `world_blocks`, `world_reports`;
   - `member_identity.removed_until`;
   - `moderation_log` CHECK changes;
   - RPCs `realtime_log_chat`, `realtime_sanction`, `realtime_sanctions_poll(uuid[])`;
   - the prune job;
   - the smoke test.
2. Server:
   - `realtime/src/rooms/chat.ts`: filter (imports `web/lib/moderation/profanity.ts`), limits, repeats, mute, block filtering, batched log;
   - `src/internal.ts`: HMAC `/internal/sanction`;
   - the 60 s poll;
   - `src/rooms/seats.ts`: bench slots, rest spots, the rule that a 3D sitter evicts a resting phone;
   - tests.
3. Profanity normalization in `web/lib/moderation/profanity.ts` and its tests.
4. Client:
   - `web/lib/net/chat.ts`;
   - `web/components/game/net/{ChatBox,ChatLog}.tsx` (Enter opens it as a world dialog, so `worldKeysBlocked` and `isGameControlTarget` already hold the walk);
   - bubbles in `Nameplates` plus `motion.talk`;
   - roster actions;
   - the `openPeople` key in `web/lib/identity/settings.ts`.
5. Next routes:
   - `web/app/api/world/report/route.ts`;
   - `/api/world/blocks`;
   - `/api/identity/moderate` gains `remove`/`restore` and notifies the realtime server (server-only env `REALTIME_INTERNAL_URL`, `REALTIME_INTERNAL_SECRET`);
   - the admin moderation route and page get the World chat section.
6. Phone presence (row 299):
   - `web/lib/net/phone.ts`: join with `{mobile: true}` and a 120 s grace;
   - pick a rest spot from shared data: the study seat if studying, else bench slots from `objectsOf("bench")`; the server arbitrates by key only;
   - `web/components/companion/IslandCard.tsx`: who's here, 4 emote buttons, the chat box. Mounted inside `web/components/companion/StudyTab.tsx`, so the companion page that the other session owns isn't touched;
   - the 3D side renders resting remotes with a phone icon.

**Parallel agents:** D (server and database), E (chat UI), F (phone; owns `components/companion/**` and `realtime/src/rooms/seats.ts`), G (admin route and page; check with the session that owns `app/student/*` first). The profanity change is a single commit by D.

**Acceptance:**
- chat between a member and a public account works, filtered and rate-limited;
- mute, block and report end to end, with the report visible to T1/T2 and the action logged;
- a T1/T2 mute or removal takes effect in under 2 s;
- a phone user rests on a bench with the icon, emotes and chats, and gives up the seat to a 3D sitter.

### M3: co-op ruins

**Prerequisite:** the classes launch (`game/classes-launch`) has merged.

**Authority model:**
- **The server owns the outcomes:**
  - enemy HP, deaths, participation, XP, drops, mission credit and the boss reward;
  - a per-room ledger of damage claims, each capped by the attacker's card (level, stats, the kit's maximum power × crit × 1.25, plus a damage-per-second token bucket);
  - credits go out through a new idempotent RPC `combat_party_kill(run, enemy, members)` that respects the hourly kill cap. Today kills are client-reported (`web/app/api/combat/kill/route.ts:7-13`).
- **The host client owns motion:** the party leader runs the existing `stepCombat` for enemy movement, AI and telegraphs and publishes snapshots at 15 Hz. Non-hosts interpolate them. If the host drops, the server picks the next host, which seeds from the last snapshot; HP is already on the server.
- **Each client owns its own survival:** it resolves enemy strikes against its own position from the snapshot's attack id and t0 (favouring the defender for PvE), and reports `hurt` for party frames.
- **`allies`** (`web/lib/combat/classes.ts:73`, a no-op solo today): the caster's client finds party members within the radius and sends `support {targets, heal, shield, buff}`. The server re-checks the radius plus 1.5 u against known positions and forwards it; the targets apply it.
- **Status effects** travel with the hit claim through the server to the host's sim.
- **Revisit later:** a full server-side sim once combat is stable. The design sheet's event and seed rules already allow it.

**Files:**
- `realtime/src/rooms/{RuinsRoom,party}.ts`, `realtime/src/combat/{ledger,caps}.ts`;
- `web/lib/game/combat/party.ts`;
- minimal refactors to `encounter.ts:31` (extra targets), `abilities.ts:655` (`enemyTarget` over party members, the `allies` hook), `actions.ts` (hit-claim emission) and `runtime.ts:224` (`rt.party`);
- `web/components/game/combat/RuinsScene.tsx` (host and non-host modes), `CombatHud.tsx` (party frames), `web/components/game/net/RemoteCombatant.tsx` (weapon in hand, verbs from `VERBS_URL`, remote ult presentation);
- a migration for party kill credits.

**Commits:** refactor first, with `balance.test.ts` and `balanceV2.test.ts` unchanged so solo behaviour stays identical; then the party system; then the ruins room; then client modes; then evidence.

**Parallel agents:** G (party, in the island room), H (ruins room and ledger), I (combat refactor, then client). I starts only after classes-launch merges.

### M4: home-island visits

**Database:**
- `member_home_visit_settings` (who may visit);
- `home_visit_grants` (host, guest, `can_harvest`, `can_edit`, `expires_at`), per row 71;
- service RPC `home_layout_for_guest(host, guest)`. `member_homes` row-level security is owner-only today (`20260926150300_homes.sql:46-50`).

**Server:** `realtime/src/rooms/HomeRoom.ts`. `onAuth` checks the grant; the host must be present; layout edits are broadcast live (`layout {revision}`, guests refetch).

**Web:**
- `web/app/api/homes/visit/route.ts`;
- a guest mode in `web/lib/homes/useHomeLayout.ts`, `HomeIslandScene.tsx` and `HomeInterior.tsx` (a read-only layout prop; decorating only with `can_edit`; harvesting only with `can_harvest` through a server route that takes from the host's nodes);
- invites from the roster arrive as a notice and a letter (row 95 mailbox). "Take the boat to Alex's island" is added at the wharf; coordinate with the arrival agent, who owns the boat trip.

**Parallel agents:** J (server and database), K (client).

---

## 9. Conflicts with the agents running now

Branch diffs against HEAD, checked today:

| Agent / branch | Touches | Multiplayer mitigation |
|---|---|---|
| Fishing (`game/polish-fishing`) | `Character.tsx` (`useFrame` to −1, `FishingRig`), `useWorldClips.ts`, `clips.ts` (`scrub`, `poseRate`, `fishing`), `FishingBobber`, `PeacefulLayer`, catalog | No edits to `Character`, `clips` or `useWorldClips` (LOD uses the `motion.current = null` and `rate` trick; one-shots use the journal). Replicate `FishingState` as a follow-up after it merges |
| Arrival and wharf (`game/polish-arrival`) | `DefaultIslandWorld`, the boat trip | Three one-line insertions at block ends, rebased after it merges. The M4 wharf "visit" prompt is coordinated with this agent |
| Forage (`game/polish-forage`) | `VillageLife`, `DefaultIslandWorld` (+3), `Workshop`, `RewardCard` | No overlap beyond the three lines |
| Reachability (`game/polish-reach`) | `NPC.tsx` (+127), `PlayerAvatar` (+16: `tsi:face`), `DefaultIslandWorld` (+90), `EmoteMenu` | The tap line sits at :137, a different hunk from reach's :154 and :257. NPC thinning waits for this merge |
| Portal bugs | Merged (`de06ccf6`) | None |
| Classes launch (`game/classes-launch`) | `lib/game/combat/{abilities,actions,balance,runtime}.ts` | M3 starts after it merges. M1–M2 don't touch combat |
| Play subdomain (other session) | `lib/supabase/{client,server,cookie,middleware}.ts`, `next.config.ts`, `app/student/*` | Read only. Origins include `play.tethos.ca`; the Fly host stays off `.tethos.ca`; companion changes stay in `components/companion/**` |
| Avatar v8 (paused) | `Character.tsx`, `rig.ts`, `look.ts` | Uses `Character` as-is |

Later: once fishing and reach merge, have `PlayerAvatar` use the shared `Nameplate` look.

---

## 10. Code that assumes a single player (file:line)

- **`useWorldClips` listens to global window events**: `web/components/game/character/useWorldClips.ts:21-37` (`tsi:emote`, `tsi:fish-cast`, `tsi:peaceful-act` …). Every avatar that mounts it plays the local player's clips. Remotes must never use it, and therefore must never mount `PlayerAvatar` or `InteriorPlayer`.
- **`PlayerAvatar` is wired to the local user**, `web/components/game/PlayerAvatar.tsx`:
  - `:138` `useMyLook()` (your look);
  - `:162` `useClassTag()`/`useShowClass()` (your class tag);
  - `:227-247` `tsi:sit` is global;
  - `:526` the shared particle pool is ticked only here;
  - `:703` `heldView` is module-private;
  - `:716-729` `PlayerCharacter` reads the `combat.rt.player` singleton for the weapon and `armed`.
- **Second local controller with the same assumptions**: `web/components/game/interiorShared.tsx:81-190` (`InteriorPlayer`; `:95` `useMyLook`, `:102` `useWorldClips`, `:105-113` `tsi:sit`). It needs the tap too, and it never ticks the particle pool.
- **Characters update and cast shadows even when off-screen**: `web/components/game/character/Character.tsx:146-149` (every character is a dynamic sun caster) and `:615-621` (the mixer updates every frame; culling only skips the draw).
- **Residents only react to you**: `web/components/game/NPC.tsx:139-150` and `:325`. Residents notice, face, sidestep and block only the local `player.current`. Acceptable as viewer-local behaviour, but remotes walk through residents.
- **Café patrons**: `web/components/game/study/CafePatrons.tsx`:
  - `:68` counts only database-seated members;
  - `:73` uses `Date.now()` rather than `worldNow()` (row 271 says the shared world clock);
  - `:75` yields only to the local player.
- **One seat per bench**: `web/lib/game/defaultIsland.ts:170-176`. `benchSeat` returns one seat at the bench centre, so two sitters overlap. The village map has only 2 benches.
- **Seat-mates would be drawn twice**: `web/components/game/study/StudySeats.tsx:76-77` ("no multiplayer yet") and `:187`. Polled seat-mates would draw on top of their live avatars.
- **Study shows real names**: `web/lib/study/supabaseStore.ts:72-77`. Seat-mate and table-chat names come from `profiles.display_name`, the real Google name, while row 222 says world names in the world. This is a privacy bug today and multiplayer must not copy it.
- **Auras are mounted once, for you**: `web/components/game/DefaultIslandWorld.tsx:956-957`. Also, in that file:
  - `:182` `benchSpot` is a module singleton (fine, it's local);
  - `:519` `useHomeLayout()` loads only your own home.
- **Aura dimming reads your combat state**: `web/components/game/oracle/SubclassAura.tsx:47` dims by the local `inCombat(combat.rt)`.
- **"Show class" lives on the device**: `web/lib/game/hudPrefs.ts:43`. The setting must be sent to the server; its own comment anticipates this.
- **Dev clock preview resets the offset**: `web/lib/game/useIslandConditions.ts:46-52` writes and resets the shared clock offset for `?at=`.
- **Combat runtime has exactly one player**:
  - `web/lib/game/combat/runtime.ts:224` (one `combat.rt` with one `player`);
  - `web/lib/game/combat/encounter.ts:31` (`stepCombat(rt, me, …)`);
  - `web/lib/game/combat/abilities.ts:655` (`enemyTarget` with one player).
- **Kills are client-reported**: `web/app/api/combat/kill/route.ts:7-13`.
- **Homes are owner-only**: `web/supabase/migrations/20260926150300_homes.sql:46-50`.
- **Nameplate projection allocates**: `web/lib/game/worldProjection.ts:12-16` returns a new array per call.
- **No phone presence exists yet**: `web/lib/game/mobilePresence.ts` is only a bounded-fetch helper, despite its name.

---

## 11. Risks and questions for David

1. **Hosting.** Settled by row 297. The one action is David's Fly signup and card. Expect about $4–5 a month on one shared-cpu-1x 512 MB machine in yyz; bandwidth is pennies. A deploy is a 2–5 s blip for everyone.
2. **Chat for public accounts.** Free text is settled by row 298. Still open:
   - (a) slow mode (2 lines a minute) for public accounts younger than 24 hours?
   - (b) refuse URLs from accounts younger than 7 days?
   - (c) chat log retention of 30 days, with a visible "logged" note?
   - (d) who answers reports and how quickly. T1/T2 today means David and the chapter presidents.
3. **Room caps.** Soft 30 and hard 40 per shard, with a second shard after that. Render caps are 12 Full and 24 drawn on High, 8 and 16 on Light. Confirm. Is joining a friend's shard needed in M1, or can it wait for M3 parties?
4. **Phone rest spots.** Today's map has only 2 benches. David paints the island (row 247), so how many more benches or rest spots should he place? Should a bench seat 2?
5. **Residents thinning.** Flavour villagers go home as players arrive (12 → 7 at 15 or more others); service posts always stay. Confirm.
6. **Hostname.** `tethos-rt.fly.dev`, recommended because it keeps the shared `.tethos.ca` session cookie away from Fly, or `rt.tethos.ca`?
7. **Production testing.** The member world is closed in production. Testing needs a Preview with `NEXT_PUBLIC_MEMBER_WORLD=open` set for Preview.
8. **Free Supabase plan.** It runs on a nano instance that has already paused once and hung once. Multiplayer adds about one RPC per join plus small chat batches; the Pro upgrade is pre-approved.
9. **M3 authority.** Server-owned outcomes with host-owned enemy motion means a cheating host only spoils their own party. Acceptable, or wait for a full server-side sim?
10. **AFK policy.** Players are never kicked for AFK, so people studying in another tab stay. Confirm.
11. **User ids.** They are visible to other clients. They already are for study seat-mates.

### Critical files for implementation
- web/components/game/DefaultIslandWorld.tsx
- web/components/game/PlayerAvatar.tsx
- web/components/game/character/Character.tsx
- web/components/game/interiorShared.tsx
- web/lib/game/worldClock.ts
