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
| `SUPABASE_SECRET_KEY` | none | required in production; used only for `realtime_player_card` |
| `ALLOWED_ORIGINS` | §1.4 list | comma-separated exact origins |
| `ALLOWED_ORIGIN_PATTERNS` | uwotsi Vercel previews | space-separated, anchored `^…$` regexes |
| `DEV_AUTH` | `0` | `1` accepts `dev:<name>` tokens; refused in production |

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

## Deploy (Fly.io, Toronto)

App `tethos-rt` in `yyz`, served as `wss://tethos-rt.fly.dev` (§1.3: not a `.tethos.ca`
host, so the shared session cookie never reaches Fly). One `shared-cpu-1x` machine with
512 MB that never auto-stops. The Docker build context is the repo root, trimmed by the
root `.dockerignore` to `realtime/` and `web/lib/net/` (plus `web/lib/moderation/` from
M2). Fly builds remotely; no local Docker is needed.

Prerequisites: a Fly account with a card (row 297) and `fly auth login`; the
`20261003170000_realtime_card` migration applied to production (the server refuses
every real join without it).

```sh
# once
fly apps create tethos-rt
fly secrets set --app tethos-rt --stage \
  SUPABASE_URL=https://rtbkrngsdbptbjhfbcud.supabase.co \
  SUPABASE_SECRET_KEY="$(pbpaste)" \
  ALLOWED_ORIGINS="https://play.tethos.ca,https://www.tethos.ca,https://tethos.ca,https://uwotsi.com,https://www.uwotsi.com" \
  ALLOWED_ORIGIN_PATTERNS='^https://uwotsi[a-z0-9-]*-davids-projects-e31987e3\.vercel\.app$'

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
