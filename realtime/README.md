# realtime: the multiplayer server

Colyseus 0.18 server for live presence on the member island. Plan and protocol:
`specs/multiplayer.md` (rows 296–299). The shared wire contract lives in
`web/lib/net/` and is imported here as `@net/*` (tsconfig `paths`, bundled by esbuild);
nothing in `web/` imports from this package.

Node 22 or newer (Docker and Fly run Node 24).

## Run locally

```sh
cd realtime
npm install                 # this package only; never install into web/
printf 'DEV_AUTH=1\n' > .env.development
npm run dev                 # tsx watch, http://localhost:2567
curl localhost:2567/health
```

Stop it with Ctrl-C when you're done; it counts against the Mac mini's dev-server budget.

Locally the server runs without Supabase: leave `SUPABASE_URL` unset and use
`DEV_AUTH=1`, which accepts `dev:<name>` tokens (letters, digits, `_` and `-`, up to
24 characters) and gives each name a synthetic card. Real Supabase tokens need
`SUPABASE_URL` and `SUPABASE_SECRET_KEY`, which point at production: don't set them on
a development machine.

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/index.ts` with `NODE_ENV=development` |
| `npm run build` | esbuild bundle to `dist/index.mjs` (npm packages stay external) |
| `npm start` | `node dist/index.mjs` |
| `npm test` | vitest, two workers |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

Validated at boot by `src/env.ts`; a bad value stops the server and names the
variable (never its value). Template: `.env.example`.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` on Fly |
| `PORT` | `2567` | |
| `SUPABASE_URL` | none | required in production |
| `SUPABASE_SECRET_KEY` | none | required in production; used only for the service-only reads and writes: `realtime_player_card`, `realtime_log_chat`, `realtime_sanctions_poll` and `world_blocks` |
| `ALLOWED_ORIGINS` | §1.4 list | comma-separated exact origins |
| `ALLOWED_ORIGIN_PATTERNS` | uwotsi Vercel previews | space-separated, anchored `^…$` regexes |
| `DEV_AUTH` | `0` | `1` accepts `dev:<name>` tokens; refused in production |
| `REALTIME_INTERNAL_SECRET` | none | 32+ characters, shared with the web app (Vercel, same name); signs `/internal/*`. Unset: those answer 503 and sanctions arrive only through the 60 s poll |

Outside production, `http://localhost:*`, `http://play.localhost:*` and
`http://127.0.0.1:*` are allowed origins as well.

## Auth and the player card (§2)

- **Token.** The client sets `client.auth.token` to its Supabase access token. The
  server verifies it locally with `jose` against
  `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256 only; issuer
  `<SUPABASE_URL>/auth/v1`, audience `authenticated`, `role` `authenticated`, not
  anonymous). No JWT secret is configured anywhere; an unknown `kid` refetches the set.
- **Origins.** Checked on the matchmaking POST (CORS echoes only allowed origins and
  never allows credentials), on the WebSocket handshake (`beforeUpgrade`, 403) and on
  every join. A request with no `Origin` header is not a browser and goes on to the
  token check. Because credentials are never allowed, the browser client must create
  the SDK with `client.http.options.credentials = "omit"` (the SDK defaults to
  `"include"`, which CORS would then block).
- **Card.** `realtime_player_card(uuid)` (service-only RPC) gives the world name (never
  the Google name), badge, tier, look, family, level, subclass, mastery, aura, frame,
  the classes v2 flag, mute/removal and the account's age. Cached 60 s per user,
  3 s timeout, re-read on `refresh` at most once per 10 s. Dev tokens get a synthetic
  card and never touch a database.
- Everything is injectable: `createApp({ env, verify, loadCard, origins })`. The tests
  use a local `jose.generateKeyPair` JWKS and in-memory cards.

## The island room (§3, §4)

One `island` room per shard; `joinOrCreate` fills the fullest open shard, which locks
at 30 players and unlocks under 26 (hard cap 40). Every number below comes from the
contract (`web/lib/net/protocol.ts`).

- **Join.** `static onAuth` (the matchmake POST, before any seat exists) checks the page
  (HTTP 403) and the token (HTTP 401), then the join options and the card. Their
  refusals travel as closes from `onJoin`: 4101 no profile, 4102 removed, 4106 old
  version or malformed options, 4107 card RPC slow or down. Deciding them before the
  seat matters: `UniqueSessionPlugin` (one session per verified `sub`) runs before the
  room's `onJoin` and skips a join the room will refuse, so a stale tab can't evict
  the good one. The older tab of the same user gets 4104.
- **State.** `players` (view-filtered), `roster` (whole shard: uid, name, badge, area,
  flags), `epoch`, `shard`. Tier never leaves the server.
- **Views.** Same area, not private (ruins, home, house: hidden and blind), and in the
  village within 50 u (kept to 60). Rebuilt every 500 ms and at once on a join or a door.
- **Poses.** `p` is decoded with the contract's codec, checked by `src/rooms/sanity.ts`,
  then its integers go straight into the schema; its events go to the clients whose
  view holds the player. A flagged teleport bumps `tp`. A violation isn't applied or
  relayed and strikes; 10 strikes closes with 4103 in production (logged only in
  development).
- **Drops.** 20 s reconnection grace (120 s for phones) with the `away` flag; a new
  session of the same user ends a pending grace.
- **Restart.** Before a shutdown each room sends `sys {kind: "restart"}` and closes
  with 4010.

## World chat, blocks and sanctions (§6, M2)

- **Chat.** `chat {text}` up; the server cleans the text (`web/lib/moderation/chatText.ts`),
  checks it (`src/rooms/chat.ts`, numbers from the contract's `CHAT`) and sends
  `line {id, sid, uid, name, area, text, t}` to everyone in the shard, the sender
  included, except players in a block with the sender. A refused line gets
  `sys {kind: "refused", reason, text}`: muted, fast, slow (public accounts under a
  day: 2 a minute), repeat (same text within 30 s), long, empty, filtered (the shared
  word filter, `web/lib/moderation/profanity.ts`), url (accounts under a week). Only
  sent lines count against the limits. More than 3 raw chat messages at once are
  dropped unanswered; Colyseus' 60 a second still disconnects a flood.
- **Log.** Every sent line queues for `realtime_log_chat` (member id, world name,
  area, shard, room, text), written in one batch every 2 s (`src/chatLog.ts`). A
  failed write stays queued and retries with backoff up to 30 s; the queue holds at
  most 5000 lines and drops the oldest beyond that, so the rooms never wait on the
  database. Shutdown writes what's left.
- **Blocks.** Read at join, both directions, with the card (`world_blocks`); if they
  can't be read the join is refused as busy (4107). Lines and emotes stop between
  the pair either way (movement still shows: the world is shared).
- **Sanctions.** `member_identity.muted_until` refuses chat; `removed_until` closes
  the player with 4102 and refuses their rejoin. The web app's moderation routes tell
  the server at once (below); every 60 s `realtime_sanctions_poll` re-reads the
  connected players as the safety net. The latest word on a player outranks their
  cached card for two minutes, so a removed player can't rejoin on an old card.

### Internal endpoints

`POST /internal/sanction {member_id, muted_until?, removed_until?}` and
`POST /internal/block {blocker_id, blocked_id, blocked}`, called by
`web/lib/server/realtimeNotify.ts`. Signed with `REALTIME_INTERNAL_SECRET`:
`x-rt-time` (ms, within 30 s), `x-rt-nonce` (16–64 of `[A-Za-z0-9_-]`, single use) and
`x-rt-signature` = hex HMAC-SHA256 of `` `${time}.${nonce}.${body}` ``, compared in
constant time. Refusals: 401 (malformed, stale, bad signature), 409 (replay), 400
(body), 411/413 (length), 503 (no secret). Answers `{ok: true, sessions}`.

## Bots and the soak (§5.9, §7)

`scripts/bots.ts` runs real `@colyseus/sdk` clients with `dev:bot-NN` tokens against a
server with `DEV_AUTH=1`. Each drives the real movement sim on flat ground (walk,
sprint, dash, hop, slide, emote, idle) and sends what the client's sender sends.

```sh
npm run dev                                                   # one terminal
npm run bots -- --n 24 --area village --near 4,-6             # another; Ctrl-C leaves cleanly
# flags: --url ws://localhost:2567 --radius 12 --seconds 0 --prefix bot --quiet
```

`test/soak.ts` is run by hand, never in `npm test`. It boots the server in-process (port
2567 by default) and the bots in a child process, cuts 10 random sockets every
`--kill-every` seconds (each must be back within 25 s, player kept), and prints
event-loop p99, heap growth, messages in per second, bytes out per client per second,
strikes and a final state-against-last-pose check as JSON lines:

```sh
NODE_OPTIONS=--expose-gc npm run soak -- --bots 40 --minutes 30 --kill-every 300
```

On the shared Mac mini, take the heavy lock first (see the team notes).

## Deploy (Fly.io, Toronto)

App `tethos-rt` in `yyz`, served as `wss://tethos-rt.fly.dev` (§1.3: not a `.tethos.ca`
host, so the shared session cookie never reaches Fly). One `shared-cpu-1x` machine with
512 MB that never auto-stops. The Docker build context is the repo root, trimmed by the
root `.dockerignore` to `realtime/`, `web/lib/net/` and `web/lib/moderation/` (the chat
filter, bundled in). Fly builds remotely; no local Docker is needed.

Prerequisites: a Fly account with a card (row 297) and `fly auth login`; the
`20261003170000_realtime_card` and `20261003190000_world_chat` migrations applied to
production (without the first every real join is refused; without the second every
join is refused as busy, since blocks can't be read).

```sh
# once
fly apps create tethos-rt
fly secrets set --app tethos-rt --stage \
  SUPABASE_URL=https://rtbkrngsdbptbjhfbcud.supabase.co \
  SUPABASE_SECRET_KEY="$(pbpaste)" \
  ALLOWED_ORIGINS="https://play.tethos.ca,https://www.tethos.ca,https://tethos.ca,https://uwotsi.com,https://www.uwotsi.com" \
  ALLOWED_ORIGIN_PATTERNS='^https://uwotsi[a-z0-9-]*-davids-projects-e31987e3\.vercel\.app$'
# M2: the secret the web app signs sanctions and blocks with (the same value goes on Vercel)
fly secrets set --app tethos-rt --stage REALTIME_INTERNAL_SECRET="$(pbpaste)"

# every deploy, from the repo root
fly deploy . --config realtime/fly.toml --dockerfile realtime/Dockerfile --remote-only

# check
curl https://tethos-rt.fly.dev/health      # {"ok":true,"uptime":…,"rooms":…,"clients":…}
fly logs --app tethos-rt
```

- `SUPABASE_SECRET_KEY` is a dedicated secret key named `realtime` (or the service role
  key). Copy it to the clipboard first: `"$(pbpaste)"` keeps the value out of shell
  history. `--stage` stores the secrets without restarting anything (there is no
  machine before the first deploy).
- `NODE_ENV=production` and `PORT=2567` come from `fly.toml`. Production refuses
  `DEV_AUTH` and won't boot without the two Supabase secrets.
- A deploy restarts the one process: each room broadcasts `sys:restart`, closes with
  4010 and clients rejoin after a random 0–3 s. Deploy at quiet hours.
- The web side reads `NEXT_PUBLIC_REALTIME_URL=wss://tethos-rt.fly.dev` (Preview first,
  with `NEXT_PUBLIC_MEMBER_WORLD=open`, §8 M1 step 6).
