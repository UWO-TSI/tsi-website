# Economy: open questions for David


## 2026-09-24 (systems agent, economy deliverables 1–5)

1. **Gems stay where the real records are.** Coins now live in one new ledger (`wallet_ledger`, with `wallets.coins` as its balance). 024's `profiles.coins` is migrated in and then dropped. Gems keep `profiles.tethos_coins` plus `tc_transactions` (applied, live records, row 48); that table gains an idempotency key and merch/shop types, and every Gems write in the new code goes through the same `wallet_apply`. Existing Gems writers (bounty review `awardRewards`) still write those tables directly, so there is still only one Gems source. OK, or do you want Gems moved onto the new ledger too?
2. **Client coin minting retired.** 024's `earn_coins` (clients could credit up to 4,000 coins per call) is dropped, and `POST /api/coins` now returns 410. The island's local coin mirror still works offline, but it no longer reaches the server. Coins come only from study, selling, chapter rewards, the daily gift and in-person events.
3. **Chapter rewards.** *Assumed:* Settle in pays 100 coins and Reach the ruins gate pays 300, once, on completion (a skip pays nothing). Club-goal chapters pay nothing, since the club reward is the landmark. The amount is editable per chapter in the Main Quest editor.
4. **Amounts.** Daily gift 20 coins. In-person event check-in 50 coins, IRL events only. Specials: 3 a day at 20% off, rotating at Toronto midnight. At most 3 merch pickups open per member. All of these are rows in `economy_settings`.
5. **Sell prices.** Fish and sea creatures keep the old Wharf prices (common 8 to legendary 600). Bugs 6/16/50/150/500. Fruit 10/25/60/150/400. Shells, flowers and mushrooms 4/12/40/120/400. Rocks and ore 5/15/45/135/450. The editable table is `sell_prices`.
6. **Catalogue prices.** Row 127 anchors: basic rod 100, mid (cedar) rod 400, outfits 120–180. The legacy 024 gear keys are kept as catalogue items: cedar rod (was 350, now 400), glass rod 1200, lucky bobber 600. Furniture is 60–300, finishes 80–120. Merch: sticker pack 150 Gems, tote 600 Gems, plus 014's hoodie. These are placeholders for David's balance pass.
7. **Owning furniture vs placing it.** Furniture is bought into `member_inventory`, but homes layout validation doesn't yet check that you own what you place. Should placement require ownership (and count copies) before launch?
8. **Materials for rooms.** Still coins only (homes Q11). There is no materials inventory yet.
9. **`player_inventory` has two conflicting definitions** (005 references `avatar_items`, 020 references `shop_items`), so economy uses a new `member_inventory`. Which definition is live in prod? The old table should be retired once that's known.
10. **Daily gift and principle 3.** The daily login gift is an online-activity reward, which principle 3 ("never reward online activity") forbids. economy.md / row 200 asks for it, and I followed the newer ledger. Please confirm.

### Resolved 2026-09-24 (coordinator / David)
- Q1: Gems stay in `tethos_coins` / `tc_transactions`, with the idempotency key added in 033.
- Q10 / row 225: the daily gift is confirmed at 10 coins, doubled on Fridays (Toronto day). Updated in 033 (`daily_gift_claim`), `lib/wallet/catalogue.ts` (`dailyGiftAmount`), the seed and the tests.
- Q7: placement will eventually require owning the piece. For now all 40 starter catalogue pieces are free in every home, so homes validation stays ownership-free and the furniture shop items are extra copies.
- Q9: the applied set is 001–023. The main checkout's `lib/supabase/types.ts` `PlayerInventoryItem` (id, user_id, item_id, equipped, acquired_at, joined to `AvatarItem`) matches **005's** `player_inventory` → `avatar_items`; 020's `CREATE TABLE IF NOT EXISTS` was a no-op. `member_inventory` (033) stays separate. Retiring `player_inventory`/`avatar_items` is a later clean-up.
- Row 226: no daily study coin cap.
- Placeholder rewards and prices stand.
