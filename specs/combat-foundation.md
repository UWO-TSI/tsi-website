# Combat foundation spec (milestone 2: one encounter, four approaches, incantation prototype)

Owners: systems agent (XP/levels/stats, subclass data, durability, enemy/mission data model, combat rules), island agent (ruins zone, encounter, controls, feedback, incantation UI). Decisions: rows 4, 7, 8, 10, 11, 12, 16, 17, 22, 24, 31, 32, 38, 39, 49–53, C2, C3, 140, 179, 207, 208, 213, 228–231, and the proposed kits/incantation sections of the plan (proposals, not decisions). Ledger wins.

## Fixed decisions
| Topic | Decision | Row |
|---|---|---|
| Area | Overgrown temple ruins in the cliffs behind the ruins gate; wildlife outer, constructs inner, statue boss | 208, 228 |
| Gate | Opens per account after the Oracle result and the level-10 subclass choice | 179, 207 |
| Roster at launch | 5 enemy types, 2 elites, 1 boss, 10 missions (hunt, fetch, survive waves, escort) | 213, 231 |
| Levels | Fixed per zone; outer ruins outgrown; boss is a wall until geared | 230 |
| Defeat | Wake at the gate; durability loss only | 229 |
| Controls | WASD, mouse aim, click attack, Space dodge, four ability keys 1–4, remappable; dodge cancels casting | 49, 50, C3 |
| Incantations | Selected powerful spells: draw a guided rune; <50% fails, 95%+ enhanced; world runs at full speed, caster stands still; start a prototype with one easy and one hard rune | C2, 52, 53 |
| Builds | Any weapon, stat-scaled; four families, 16 subclasses with one signature + one passive; allocated stat points with coin resets | 31, 38, 17, 32 |
| XP | Club participation + grinding/missions; club events worth several sessions | 11, 23 |
| Safe zone | Village rejects hostile attacks; enemies reset at the boundary | 8, proposal |
| Weapons | Visible everywhere once equipped, hand sockets | 140 |
| Performance | 30 FPS minimum on integrated graphics | 39 |

## Deliverables
Systems: (1) `035_combat.sql` draft: member_progression (xp, level, stat points allocated, family, subclass, respec log), weapons/gear with durability, enemy_types, elite/boss definitions, missions (template, params, rewards), mission_progress, kill/xp ledger via idempotent functions; XP curve to level 10 and beyond with club-event XP hook; (2) `web/lib/combat/` rules: damage formula from stats and weapon tier, durability loss on hit/defeat, dodge i-frames window, aggro/reset rules, incantation scoring (path coverage, deviation, stroke order; anti-scribble), subclass signature/passive data for all 16 (numbers as placeholders), mission state machines for the four templates; routes `/api/combat/*` (progression, allocate stats, missions start/progress/complete, durability repair); tests for XP curve, allocation, durability, mission completion idempotency, incantation scoring against valid/partial/scribble traces.
Island: (3) ruins zone off the cliff gate: outer wild area + inner temple + boss chamber, from the dump's ruins/cliff pieces, with the gate check; (4) the encounter: player attack (melee swing, bow shot, staff bolt, summon a minion) driven by the equipped weapon, aiming, dodge with i-frames, hit flashes/knockback/damage numbers, enemy telegraphs, three wildlife enemies + one construct + the statue boss stub, safe-zone boundary behaviour; (5) incantation prototype: casting mode with a visible rune, start point and stroke direction, mouse/trackpad tracing, accuracy readout and effect scaling, one easy and one hard rune; (6) mission board at the gate with the four templates and one authored mission each; (7) screenshots/video prefix C- under `specs/evidence/combat/`; tests for hit detection, dodge windows, boundary reset.

## Out of scope
PvP, all 16 kits fully implemented (data only), chest rolls, Blender enemy models (use dump critters/props and placeholders), phone combat.

## Questions
`specs/combat-questions.md`.
