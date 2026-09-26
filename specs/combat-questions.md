# Combat: open questions for David


## 2026-09-26 (systems agent, deliverables 1–2)

All numbers live in `web/lib/combat/*.ts` and `economy_settings`, and they're placeholders. Harness: `/dev/combat?view=progress|runes|kits|missions`.

1. **XP curve and pace.** The XP to the next level is 100·L + 25·L².
   - Level 10 (subclass and ruins gate) needs 11,625 XP. That's about 30 play sessions at ~400 XP each, or about 20 with two club events.
   - A club event check-in is worth +2,000 XP, about 5 sessions (row 23), paid by a trigger on `event_attendance`.
   - Levels cap at 50, with 3 stat points per level.

   OK?
2. **Principle 3 vs the ledger.** CLAUDE.md principle 3 says XP comes only from in-person events and admin grants. Rows 11 and 23 give XP for kills and missions too, and I followed the ledger. Confirm.
3. **Kill XP is capped at 6,000 per hour per member.** Combat runs in the browser, so the server can't verify a kill. The cap bounds forged kills. Missions pay once per completion with a 20-hour cooldown. Do you want server-checked encounters later, or is the cap enough for launch?
4. **Wear.**
   - Weapons lose 1 durability per landed hit and 10% of max on a defeat (row 229: no coin loss).
   - A broken weapon still works at half damage and is never deleted.
   - Repair costs tier × points (a tier-1 sword from 23/90 costs 67 coins).

   OK?
5. **Fees.**
   - Points are add-only.
   - A full stat reset costs 200 coins and keeps XP.
   - The first subclass choice is free; changing it costs 250 coins (same as an Oracle respec).

   OK?
6. **Starter gear and weapon supply.** Everyone gets a Driftwood sword (equipped) and Cloth hand wraps. Two questions:
   - Should the family pick the starter instead (staff for Arcane, bow for Ranger)?
   - The 11 weapons have no way to be acquired yet. Should they be sold in the 033 shop, or drop from missions (chests are out of scope)?
7. **Rune shapes.** I authored Spark (easy, 1 stroke, 4 s) and Sigil of Binding (hard, 3 strokes, 7 s). The island's stub uses "ember" and "tide-seal". `islandScore` scores any geometry, so either set works. Which do you want to ship?
8. **Scoring thresholds.**
   - Accuracy weights are 45% coverage, 35% closeness and 20% stroke order.
   - Ink beyond 1.6× the guide's length starts to cost points, and 2.4× scores zero (anti-scribble).
   - A slow wobble at half the tolerance still scores 95–97. Point-to-point jitter of ±0.045 reads as scribbling and fizzles.
   - Potency runs from ×0.5 at 50 to ×1 at 94, and ×1.5 at 95+.

   None of this is tuned on real mouse or trackpad traces yet. The island should log real traces during playtests.
9. **Kit edge cases.**
   - Necromancer starts with a Bone Wisp shade and Transmuter with a Fox Stride trait, so both work before their first kill.
   - Gunslinger without a revolver deals 70%, and Guardian without a shield blocks half as much.

   OK?
10. **Energy.** Signatures carry energy costs, and max energy is 100 + 3 per Arcana + 3 per Spirit point. There is no regeneration rule yet. Should the island own it, or should systems set a number?
11. **Missions.**
    - Cooldowns are 20 hours after completion.
    - Failed or abandoned missions restart immediately with no penalty.
    - A defeat drops a fetch item and fails survive and escort missions; hunt counts are kept.
    - Enemy levels are fixed per zone and don't scale (row 230).

    OK?

## Coordinator rulings (2026-09-26, David delegated routine calls, row 233)

- **Pace:** ~30 sessions to level 10 (~20 with two club events) is accepted as the starting curve; tune after the member playtest.
- **XP sources:** the ledger wins over CLAUDE.md principle 3 (rows 11, 23): kills and missions give XP. CLAUDE.md gets updated in Phase 0.
- **Kill XP cap 6,000/hour:** accepted. Client-trusted kills within the cap are acceptable for PvE v1; revisit with multiplayer (server-authoritative combat).
- **Durability:** defeat −10%, broken weapon = half damage: accepted.
- **Fees:** stat reset 200, subclass change 250: accepted.
- **Starter gear:** when the ruins gate opens, every player receives one starter weapon of each archetype (sword, bow, staff, summoning charm) so the any-weapon rule (31) is true from the first fight. Better weapons come from missions, crafting and shop tiers later.
- **Runes:** the systems agent's `spark` (easy) and `binding` (hard) are canonical; the island stub renames `ember`/`tide-seal` to those ids.
- **Scoring thresholds:** keep; tune from real mouse/trackpad traces during the playtest; log traces in dev.
- **Energy:** simple rule: 100 max, regenerates 12/s after 1 s without spending, no regen while tracing.
- **Missions:** 20-hour cooldown per mission accepted; defeat during a mission fails it (no penalty beyond durability, row 229).

## 2026-09-26 (island agent, deliverables 3–7)

12. **Starter weapons (ruling) need a grant.** The ruins give every player the four starters (Driftwood sword, Willow bow, Oak staff, Tome of small spirits). The server only seeds a sword and wraps (`memoryStore.ensure`), so `/api/combat/wear` returns `not_owned` for bow, staff and tome hits. Systems: grant the four starters when the gate opens?
13. **Kill events are client-trusted.** Kills post to `/api/combat/kill` about once a second, keyed per kill. Mission events are queued and sent to `/missions/progress` in the same batch. That's inside the accepted 6,000 XP/hour cap. OK for v1?
14. **Placeholder models.** These are dump stand-ins until Blender models exist:
    - Shadow fox: the dump scorpion.
    - Thorn crab: the gazami crab.
    - Mushroom beast: the tarantula.
    - Stone golem: a clay haniwa.
    - Guardian statue: the moss statue.
    - Weapons: the Japanese sword, the Japanese bow and the star wand.
    - Fetch item: the old lantern, shown as a stone lantern.

    Is any of these too off-tone to show members?
15. **Inner-zone enemies aren't placed.** Rune wisp, animated book and elder crab are in the systems roster, but only 3 wildlife types, 1 construct and the boss are placed, as asked. Place the rest now, or wait for the 10-mission pass?
16. **The board shows one mission per template.** It uses the outer-zone missions (fox hunt, lantern, rune circle, botanist). Should the six inner-zone missions stay hidden until the boss key/level gate?
17. **The rune circle ends up with "get back in the circle".** Leaving the circle doesn't fail the systems survive mission, so the island only nags. Should leaving the circle fail it?
18. **Traces aren't logged yet.** Stroke timing and points go to `islandScore`, but nothing stores them. Should the island POST traces to a dev-only log, or will systems add a route?
19. **Ability keys are saved per device.** Keys 1–4 remap in the settings sheet, stored in `tsi.combatKeys.v1`. The account `key_bindings` has no combat actions. Should systems add them?
