# cleanup-and-game-security: open questions for David

Each item has the assumption the agent took so the work kept moving.

1. **Catch caps (20260926150900).** A catch is capped per species per hour by rarity (common 60, uncommon 30, rare 12, epic 6, legendary 3) and at 200 per member per hour. Assumption: no honest player reaches these; they only bound what a scripted client can mint. The real fix is a server-rolled catch (the server picks the fish), which is a bigger change. Tell us if the numbers should differ.
2. **Clamping old stock (20260926150900).** Stock written through 023's self-editable path is clamped to 99 per species when the migration runs, because 033 turns it into coins. Assumption: nobody legitimately holds more than 99 of one species. Before applying, `select count(*) from member_collections where count > 99` on prod shows how many rows it touches.
3. **Legacy Gem routes now need 033 (commit "Gems: legacy writers go through wallet_apply").** `/api/economy` (marketplace buy, avatar buy, T1/T2 award) and `awardRewards` (bounty, achievement, onboarding) call `wallet_apply`, so they only work once 033 and 20260926151100 are applied. Assumption: the game migrations go out in one window with this code, as planned. Bounty, achievement and onboarding rewards are now keyed per member (a re-approved bounty pays once).
4. **Two Gem shops.** `/student/dashboard/shop` (marketplace) and `/student/dashboard/economy/shop` both exist. Not retired: that is a product call.
5. **Study chat double auth (audit R8 / item 19)** is not fixed: `app/api/study/*` belongs to the study agent right now. Follow-up: use one context and read the mute through its db.
