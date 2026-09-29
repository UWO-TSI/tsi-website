# Economy spec (wallet, shop, selling, merch corner, coin sources)

Owner: systems agent. Decisions: rows 11, 14, 15, 18, 21, 30, 46, 47, 76, 82, 91, 94, 115, 126, 127, 186, 187, 200, 215. Ledger wins. Never reveal any TC/CAD conversion in strings.

## Fixed decisions

| Topic | Decision | Row |
|---|---|---|
| Currencies | Play coins (in-game only) and Gems (club contributions/admin grants only; buy in-game items and real merch). No real-money purchase of either. | 11, 14, 76 |
| Coin sources | Study (1/min +10/block), selling fish/bugs/shells/fruit, chapter and resident quest rewards, small daily login gift, in-person event attendance (QR), combat missions later | 126, 200 |
| Price anchors | Room ~500 coins + materials; basic rod ~100, mid rod ~400, outfit ~150 | 127 |
| Shop stock | Rods/net/shovel basic and mid tiers; outfits, hair recolours, accessories; furniture and wallpaper; daily rotating specials; TSI merch corner in Gems | 186, 94 |
| Selling | Surplus catches/finds sell at the shop; prices by rarity | 91 |
| Merch | Redemption reserves stock and Gems; campus pickup; admin confirms or cancels/refunds; retry-safe | 47 |
| Trading | None; no transfers between accounts | 46 |
| Chests/rolls | Coins buy rolls capped at Rare; Gems buy better chests with visible odds, pity counter, duplicate compensation (later phase, data model only now) | 15, 18, 30 |
| Admin | T1–T2 edit catalogue, prices, specials, merch stock | 215, 33 |
| Legacy | `profiles.coins` from unapplied 024; prototype balances reset at launch, real records kept | 48 |

## Deliverables (systems agent)

1. Migration draft `20260926150600_economy.sql`: wallets (coins, gems) with a ledger table (source, amount, ref, idempotency key), shop_items (category, tier, price_coins/price_gems, rotation flag, stock, active window), member_inventory (item, qty, equipped), sell_prices by rarity, merch_items and merch_reservations (status reserved/fulfilled/cancelled, admin actor), daily_login_claims, event_attendance credit hook. Service-role functions: credit, debit, buy, sell, reserve_merch, fulfil/cancel; all idempotent and capped where relevant. Reconcile with 024's `profiles.coins` (migrate or view, not two sources of truth).
2. Routes `/api/economy/*`: wallet, shop (catalogue with today's specials), buy, sell, inventory, equip, daily-gift claim, merch list/reserve, admin merch fulfil/cancel, admin catalogue CRUD via the existing content editors with versioning.
3. Wire existing coin writers to the ledger: study settlement, progression rewards, homes buy-room (replace its direct coin check), collections selling. Single wallet path.
4. UI sheets: Shop (tabs: tools, outfits, furniture, specials, merch), Sell, Inventory, Wallet in the dashboard overlay pattern; admin merch fulfilment page.
5. Tests: idempotent credit/debit, insufficient funds, stock reservation race, daily gift once per day (Toronto), specials rotation determinism, sell price by rarity. Screenshots under `specs/evidence/economy/`. Smoke through the local Postgres script after 029–032.

## Out of scope

Chest rolls UI, Gems earning rules beyond admin grants and event contributions (already in progression), Blender merch art.

## Questions

`specs/economy-questions.md`.
