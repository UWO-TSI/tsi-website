# Progression: open questions for David

Append questions here (date, question, what you assumed meanwhile). The reviewer relays them.

## 2026-09-24 (systems agent, deliverables 1-5)

1. **Story goal order.** Should the museum goal take contributions while the cafe goal is still open, or only after it completes? *Assumed:* story goals run in order (`position`); a later one shows "Up next" and takes nothing until the earlier one completes. Seasonal goals run on their own windows.
2. **Points scale and caps.** *Assumed:* 1 coin = 1 pt, material 20, specimen 100, event QR check-in 500, completed bounty 750, admin-logged 1 per pt; target 15,000 (≈30 check-ins or 15,000 coins, row 181). Per-member caps per goal: 3,000 total, 1,500 of it from in-game deliveries. All admin-editable per goal.
3. **Admin-logged credit and caps.** *Assumed:* admin credits bypass the per-member cap (the admin sizes them deliberately). Deliveries, check-ins and bounties are capped.
4. **Level-10 family trial (row 179).** No trial exists yet. *Assumed:* `member_quest_prefs.family_trial_completed_at` is the flag, writable only by the service role (future trial route or an admin grant). Oracle quiz "done" = `profiles.class` is set.
5. **Chapter 1 donation.** *Assumed:* donating the first catch is a recorded placeholder (the fish is NOT removed from the member's collection), since the museum donation system is out of scope. Real specimen deliveries to the museum goal do consume the item.
6. **Skip rule.** Spec says "skippable in one click for senior members"; principle 7 says onboarding quests are opt-in for everyone. *Assumed:* chapter 1 is skippable by T1–T3 (admin-editable per chapter); anyone can hide the objective line (`hud_muted`). Club-goal chapters cannot be skipped (the region opens for everyone when the goal completes anyway).
7. **Materials vs specimens.** There are no building materials (wood/stone) yet. *Assumed:* specimens = `fish_`, `sea_`, `shore_`, `bug_` items; materials = everything else gathered (fruit, flowers). Rod/bobber/gear keys are never deliverable.
8. **Real-activity window for story goals.** *Assumed:* check-ins/bounties count from the goal's `window_start`, or its `created_at` when it has none. Attendance comes from `event_attendance.status = 'attended'` (the QR check-in writer does not exist yet), keyed by `events.start_time`.
9. **Completion letter audience.** *Assumed:* sent once to every `profiles.is_active = true` member at completion time; members who join later do not get it.
10. **Coin deliveries depend on 024.** Coin deliveries debit `profiles.coins` (024, unapplied). Until 024 and 029 are applied the API returns 503 and the sheets show a read-only preview.

### Resolved 2026-09-24 (coordinator)
- Q6 resolved: chapter 1 is skippable by every member (seed `skippable_max_tier = 5`, still admin-editable). Club-goal chapters are never skippable (enforced in `chapters.ts` and the draft validator, regardless of the flag). Assumptions 1–5 and 7–10 stand.

## 2026-09-24 (systems agent, homes persistence + collections/museum)

11. **Room price materials.** The server charges 500 coins per room (from `ROOM_PRICE` in lib/homes) and checks it against `profiles.coins`. The "10 wood, 5 stone" part isn't enforced because there is no materials inventory. *Assumed:* coins only until crafting materials exist.
12. **Catch sizes are client-reported.** The reel rolls the size in the browser; the server clamps it to the species range but can't prove it. *Assumed:* fine for a cosmetic record and the trophy case. A server-rolled size would need the catch itself to be server-side.
13. **Migration numbering.** Homes is `030_homes.sql` as instructed. Collections took `031_collections.sql`. Both are drafts and have not been applied.
14. **Months and weather are display data only.** The roster's seasons, and some weather windows, are used for journal clues and "out now". The fishing and critter spawners don't enforce them yet; hours match the game's own `when` gates, which a test checks. *Assumed:* the island agent (or whoever owns spawning) adopts the roster later.
15. **Roster-only species.** 7 bugs, 6 fruit, 3 mushrooms and 5 rocks/ore have no model or icon yet (`asset_ready = false`). They still get journal and museum slots. *Assumed:* that's fine; the unknown slots show a generic category silhouette.
16. **Which categories are donatable.** Fish and sea creatures go to the aquarium, bugs to the insect hall, and shells, flowers and mushrooms to the nature room. Fruit and rocks are not donatable. Shore crabs go to the aquarium. *Assumed.*
17. **Trophy case rules.** The case shows the biggest catch per species this week (weeks start Monday, Toronto time), ranked by rarity and then by how close the catch is to the species maximum. It has 6 cases, at most 2 per member. *Assumed;* all of these are constants in `lib/collections/logic.ts`.
18. **Old collectibles.** `acorn` and `petal` are existing collection keys but aren't in the launch roster. *Assumed:* they stay as collectibles without a journal page.
