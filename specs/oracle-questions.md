# Oracle/identity: open questions for David


## 2026-09-24 (systems agent, deliverables 1–3)

1. **Answer scale.** 64 original agree/disagree statements (16 per dichotomy, half keyed each way) on a 5-point scale, plus 16 forced-choice tie-breakers that are served only when a dichotomy sums to exactly 0. If those also tie, the single strongest answer decides; failing that, I/N/F/P is used and the result is marked low-clarity. *Assumed.* All wording is authored for Tethos, not adapted from any published instrument. Please read the bank before launch (`web/lib/oracle/items.ts`).
2. **Respec terms (row 20).** The first reading is free. Each later reading costs 250 coins and waits 7 days after the last result. An open reading always resumes; there's no free reroll. You're charged even if the result is the same family. Earlier auras stay unlocked. *Assumed;* the numbers are placeholders.
3. **`profiles.class` now holds the family** (Arcane/Ranger/Vanguard/Warden) so chapter 4's "Oracle done" check keeps working. The legacy 12-question `/api/oracle/quiz` and `/api/oracle/result` (old 9-class map) are untouched. Should they be retired once the island's new quiz sheet ships?
4. **Name rules.**
   - 3–16 characters: letters (any script), digits, and single spaces, dashes, dots, apostrophes or underscores between them.
   - Unique by a normalised key, so case, separators and digit look-alikes (0→o, 1→i, 3→e…) all collapse to one name.
   - Reserved words (admin, tsi, oracle, keeper…) are refused.
   - The first name is free; after that, one change per 30 days.
   - A T1/T2 reset gives the placeholder "Islander xxxxxx" and skips the limit.
   - The filter also catches profanity hidden inside joined-up names (e.g. "sh1thead"), at the cost of the occasional false positive (the "Scunthorpe" problem).

   OK?
5. **Membership flag.** There was no way to tell TSI members from public accounts, so 034 adds `profiles.membership` ('member' | 'public', default 'member' so existing profiles keep the badge). The public sign-up path needs to set 'public'. The badge is 'member' when membership = member and the account is active; alumni keep it. Which path creates public accounts?
6. **Mute (row 221).** A T1/T2 mute lasts 7 days and blocks letters/notes and table chat, checked in those routes. There is no admin UI yet, only `POST /api/identity/moderate`. Reports land in `identity_reports`. Should they also appear in the content activity log?
7. **Menu key remap.** Covers journal, bag, map, wallet, mailbox, next/previous tab and confirm. Escape always closes a sheet. WASD, the arrow keys, Space, Tab and Shift belong to the game's own remap (row 49) and can't be used for menu actions.

## 2026-09-24 (island agent, deliverables 4–7)

8. **The collection bag moves from B to I.** The island now reads menu keys from the account settings, and `DEFAULT_KEYS.openBag` is "i", so the bag no longer opens on B. Should the default be "b" to match what players already know? (Systems owns `lib/identity/settings.ts`.) The wallet key has no island sheet yet, and Confirm is left to the focused button.
9. **Sigils are placeholder art.** The four family sigils are drawn in code: a ring plus a star, compass needle, spark or leaf. Do you have sigil art, or should I generate a set?
10. **The aura is shown everywhere, all the time.** Once you have a family, a few motes in the family colour follow you on the island and inside buildings. Should there be a toggle to turn it off? Senior members may want one (design principle 7).
11. **Only the island's own sheets scale with text size.** That includes the minimap, prompts, controls, wardrobe, and the Oracle, settings and museum sheets. The progression and collection sheets have their own styles and stay at 100%. Should I extend it to them?
12. **The legacy temple quiz.** GameWorld's OracleInterior still opens the old 12-question sheet. The island uses the new reading. Retire the old one along with the routes (see question 3)?

### Resolved 2026-09-26 (coordinator)
- Q2: respec terms stand (250 coins, 7-day cooldown, charged even if the family is unchanged).
- Q5: public vs member is set in the profile-creation path. 034 replaces `handle_new_user()` (003's trigger, same name). A sign-in is a member when its email is in the new T1/T2-managed `member_email_whitelist` or it signed up with an active invite code; otherwise it's `public`. Existing profiles are grandfathered as members. Members can't change their own `membership`, `class` or `subclass` (column-level revoke). Smoke-tested in `034_smoke.sql`.
- Q3: the legacy quizzes are retired. `/api/oracle/quiz` and `/api/oracle/result` are deleted, and `/student/dashboard/oracle` (also the OverlaySheet target) now runs the 64-item reading on `/api/oracle/*` (`components/oracle/OracleReading.tsx`). 034 migrates old `profiles.class` values from both legacy vocabularies (the 9-class API map and the dashboard's Warrior/Mage/Healer/Rogue) by subclass → type → family, and unlocks that aura. Class names alone are ambiguous (ORACLE = INTP or INFJ, COMMANDER = ENTJ or ENFJ), so rows with no known subclass are cleared and get a free new reading. Migrated members may also take the full reading once for free, since the old 12/16-question result wasn't a full reading. Smoke-tested in `034_legacy_smoke.sql`.
- Q6: name reports now appear in the admin Content Activity Log (`NameReportsPanel`), with Reset name / Mute 7d / Dismiss. Any action closes that member's open reports.
- Q1: David will read the bank before launch.
- Default journal/collection key is **B** (`lib/identity/settings.ts`), matching the island.
