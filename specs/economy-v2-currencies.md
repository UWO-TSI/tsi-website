# Economy v2 — Two Currencies + XP (David direction, 2026-07-25)

> David's ruling on the fish-economy flag: invert the tiers — TC becomes the
> in-game soft currency, and a premium money-like currency ("gems or some
> sort") takes the money-equivalent role. Design delegated to me ("you
> think for me"). This spec IS that design.

## The three-value system

| | 💎 **Gems** | 🪙 **TC (Tethos Coins)** | ⭐ **XP** |
|---|---|---|---|
| **Meaning** | money-equivalent value | in-game soft currency | IRL presence |
| **Earned by** | bounties, paid projects, admin grants — monetary-value work ONLY | selling fish/catches at the Wharf Shack; future gameplay loops (never passive: no login streaks, no idle drip) | IRL event QR check-in + special admin grants ONLY |
| **Spends on** | real-value shop items (CAD dual pricing stays), premium cosmetics | rods, tackle, fishing accessories, game cosmetics, future room furniture | nothing — XP is level/status |
| **Secrecy** | NEVER reveal Gem ≈ CAD rate (inherits the old TC rule) | rates public and tunable | — |

**Principle #3 rewrite (needs David's CLAUDE.md pass — reviewer-owned):**
"XP rewards IRL. GEMS reward money-equivalent work (bounties, paid
projects) — never online activity. TC is the in-game play currency:
earned by active gameplay (selling catches), spent on in-game gear and
cosmetics; it never converts to Gems or CAD, and passive/streak earning
stays banned."

## Code + schema mapping (the dangerous part, handled)

The LIVE DB's `tc_balance` / `pay_tc` columns hold the money-tier today.
Renaming live columns mid-beta-prep is risk without payoff, so:

- **Display rename only, v1:** everything currently rendered as "TC"
  (StatsHUD coin count, bounty payouts, shop prices, admin tools) renders
  as **Gems 💎**. The DB keeps `tc_*` column names; a single
  `lib/economy.ts` constants module owns the display names + the loud
  mapping comment (`tc_* columns == GEMS`). True column rename = a quiet
  post-beta migration, David-scheduled.
- **New wallet for the soft tier:** migration `023_game_coins.sql` — a
  `coins` integer on profiles (or a small wallet table) + RLS; code name
  `coins`, display name **TC 🪙**. Local-first fallback like collections
  so env-less/dev keeps working.
- Guardrail: no code path may convert coins→gems or coins→CAD. Ever.

## Fish pricing (launch tuning, Wharf Shack buys)

Per-rarity base × size factor (size/sizeMax, 0.75–1.25):
common 8 · uncommon 20 · rare 60 · epic 180 · legendary 600 · sea king 2500.
Rain-day catches carry no bonus (luck already boosted the roll). Prices are
public; tune on the /lab/fishing bench (sim gains an earnings column).

## Implementation stages (join the loop queue after geo S1-S2)

- **E1** `lib/economy.ts` + display rename TC→Gems everywhere (UI copy only).
- **E2** coins wallet: migration 023 draft + `/api/coins` + local-first lib.
- **E3** Wharf Shack sell flow (needs geo S3's store shell): sell sheet,
  per-rarity pricing, sell-all button, coin tick-up (reuse useTickUp).
- **E4** Shack gear catalog: rods/accessories priced in coins (cosmetic +
  minor QoL like cast-meter forgiveness — never pay-to-win beyond cozy).
- CLAUDE.md principle rewrite: David's pass (reviewer-owned file).
