# Oracle and identity spec (MBTI quiz, family, display names, member badge, settings)

Owners: systems agent (data/routes/quiz engine), island agent (temple interior, ceremony, nameplates, settings sheet). Decisions: rows 16, 19, 20, 205, 206, 207, 222, 223, 220, 221, 215. Ledger wins.

## Fixed decisions
| Topic | Decision | Row |
|---|---|---|
| Quiz | Full MBTI-style quiz (60+ items, authored Tethos wording) taken in-world at the Oracle temple; result maps NT/SJ/SP/NF → Arcane/Ranger/Vanguard/Warden | 205, 19 |
| Family | Given by the MBTI result; no trial; level-10 = subclass choice within the family; coin-fee respec at the Oracle | 207, 16, 20 |
| Reveal | Temple ceremony: coloured light, family sigil, keeper line, cosmetic aura unlocked | 206 |
| Names | Chosen display name in the world (unique, filtered); real name on the profile only | 222 |
| Members | TSI members get a subtle nameplate glow or blue dot; public accounts do not | 223 |
| Settings | Text size and high-contrast options; keyboard remap covers menus | 220 |
| Moderation | Profanity filter + report; T1–T2 mute/remove | 221 |

## Deliverables
Systems: (1) `034_identity.sql` draft: display_name (unique, case-insensitive, filtered, change limit), member badge derived from tier/membership, quiz_responses, quiz_result (type, family, taken_at), family_aura unlock, respec log with coin fee via wallet_apply; (2) quiz engine `web/lib/oracle/`: item bank (authored, non-copyright wording, 4 dichotomies, 15+ items each), scoring, family mapping, retake rules; routes `/api/oracle/*` (start, answer batch, result, respec); `/api/identity/*` (display name check/set); tests for scoring edge cases, uniqueness and filter. (3) Settings store additions: text size, high contrast, key remap for menus, persisted per account.
Island: (4) Oracle temple interior from the dump's interior pieces; quiz UI as an in-world sheet with the keeper reacting every ~10 items; ceremony (light colour by family, sigil sprite, keeper line, aura particle on the player); (5) nameplates show display name + member glow/dot; (6) settings sheet exposing text size, contrast, key remap; (7) screenshots prefix O- under `specs/evidence/oracle/`.

## Out of scope
Subclass kits, combat, level system, phone quiz.

## Questions
`specs/oracle-questions.md`.
