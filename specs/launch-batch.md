# Launch Batch — the one checklist for beta-day DB + smoke

> Written 2026-07-25 (loop wake 66). Everything here is DRAFTED and
> verified env-less; nothing is applied to prod. Run this list top to
> bottom at the launch window, after David's merge eyeball + merge.

## 1. Apply migrations (in order)

| # | File | What it does |
|---|------|--------------|
| 024 | `024_game_coins.sql` | coins wallet (column-revoked, `earn_coins` RPC), `fish_prices` (91-key seed), atomic `sell_catches`, `profiles.gear` + `gear_prices` + `buy_gear` |
| 025 | `025_seasonal_seed.sql` | seeds the 5 `seasonal_palettes` rows (admin-respecting upsert; activates `default` only on fresh DBs) |

Both are idempotent. 024 includes column-level REVOKEs — verify with a
non-admin key that direct `UPDATE profiles SET coins/gear` is rejected.

## 2. Post-apply smoke (authed session on prod)

- `GET /api/coins` → `{coins: 0}` (not null) for a fresh member.
- Sell flow: catch a fish → Wharf counter → sell → coins credit AND
  `member_collections.count` decrements (one transaction — check both).
- Over-sell guard: selling more than owned → 503/error, no partial write.
- Gear: buy Cedar Rod (350) → coins debit + `profiles.gear` gains
  `rod_cedar`; re-buy → rejected ("already owned"); buy with poor wallet →
  rejected, no debit.
- `GET /api/gear` → the owned list.
- Local-first reconciliation: a device with older local counts syncs
  without resurrecting sold fish (both sides decrement; merge is max).

## 3. Seasonal flip test

- Admin: `UPDATE seasonal_palettes SET active = FALSE WHERE active;`
  then `SET active = TRUE WHERE slug = 'autumn';`
- Within a minute (SWR revalidate) clients show: autumn sky/fog, golden
  meadow tint, leaf-fall particles, harvest shop deco.
- Flip back to `default` → shipped look, zero particles.

## 4. Standing rules (unchanged)

- TC (coins 🪙) never converts to Gems 💎 or CAD; no rate anywhere.
- Prod auto-deploys from main on push — merge when David can smoke
  tethos.ca right after.
- Migrations are append-only; next free slot after this batch: `026_*`.

## Open (not blockers)

- Window-based palette auto-activation (scheduler) — manual `active` flag
  is the launch mechanism; see specs/seasonal-palettes.md follow-ups.
- E4 follow-on: server-side sale is fire-and-forget from the client; a
  post-beta pass could reconcile local/server wallets on login.
