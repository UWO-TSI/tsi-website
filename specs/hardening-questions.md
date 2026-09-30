# hardening: open questions for David

Each has the assumption the branch uses. None blocks.

1. **Fish ignore the season.** The reel's pool (`FISH` `when`: hour and weather, water type, rod) has never used the roster's months, while the journal and catch board show them ("Salmon · Sep–Nov" bites in May). The server roll mirrors the reel exactly. *Assumption:* keep it; honouring the months is one filter in `fishPoolFor` (`inSeason` on the roster entry) if you want the board and the water to agree.
2. **The cast shows the fish.** The server rolls at the cast because the reel fight depends on the species. A scripted client could abandon casts it doesn't like and cast again; casts are 4 s apart (at most ~900 an hour) and the per-species hourly caps still apply. An honest cycle is 8–15 s. *Assumption:* enough; counting abandoned rolls against the hour is the next step if it isn't.
3. **Cast power is the client's.** The timing meter's power (0–1) is sent with the cast, so a script can always claim a max cast (luck 1.3, as a perfect player gets). *Assumption:* fine; it doesn't pick the species.
4. **Rare-catch recipe drops** (row 199, crafting question 11) waited for server rolls. They're possible now (the land step knows the species); not built, it wasn't on this list. *Ask:* want them next?
5. **NPC spend and wiping another member's NPC memory were T1-only.** On the one gate they are T1/T2 (the admin NPC page is T1/T2 and its wipe button 403'd for T2). *Assumption:* T1/T2, as row 215's single gate.
6. **The audit log keeps an excerpt** (≤120 characters) of the removed note or chat, or the world name acted on, so the log reads without the item. Removed text survives there, T1/T2 only. *Assumption:* right for an audit log.
7. **A log write that fails after the action** answers 500 "Done, but the audit log didn't save it"; the action stands. *Assumption:* rare enough not to need one transaction across both.
8. **Chapter 4's "family trial" (fixed, found in the E2E).** Nothing ever set `family_trial_completed_at`, so chapter 4 could never finish (no member could get the gate letter or the 300 coins). Row 207 says there is no family trial: the level-10 moment is the subclass choice. The chapter now reads the subclass choice (the same thing that opens the ruins gate); the old flag still counts if an admin ever sets it. The step and chapter copy say "Reach level 10 and choose your subclass" (seed text only; an admin's edited copy is kept).
9. **Harvested nodes are marked per browser.** The server refuses a second harvest of a node in the same hour from any device, but another browser still shows the node until the hour turns and answers E with "You've already gathered here this hour." (E2E, W-01). *Assumption:* fine for v1; the world could ask the server for this hour's harvested nodes on load if it matters.
10. **Staging** was missing `20260926210000_combat_kits` (production has it). Applied it with this branch's migrations.

## Answered (David, 2026-09-30)

1. **Fish follow their listed months.** Done on `game/seasonal`: the server roll (and the island's local fallback reel) only draws fish whose roster months include the current Toronto month; species without a months list bite all year. A seasonal event's limited-time fish follow their event's window instead. Test: `lib/collections/rolls.test.ts` (salmon, Sep–Nov, never rolls in May; nothing out of season rolls in May or October).
