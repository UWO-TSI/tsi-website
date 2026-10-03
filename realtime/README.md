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
