# combat-content: open questions for David

## 2026-09-26 (combat content agent, Part A)

Each item has the assumption the build uses today. None blocks.

1. **The guardian as a wall.** Stone skin is modelled as flat armor 9 after its 35% defense, with 1,800 HP.
   - At level 10 with all 27 points in the weapon's stat and hitting half the time, a starter weapon takes about 6.5 minutes (driftwood sword) to 11 minutes (oak staff).
   - An iron sword takes about 3 minutes, a rune staff about 2.7 and a brass revolver about 2.2. The boss test in `lib/game/combat/boss.test.ts` pins these bounds.
   - Runes and the stagger window (×1.5) shorten every fight.

   *Assumption:* tune these numbers after the playtest.
2. **Boss drop table (row 21).** Every win pays 150 coins, 2 crystals and 1 gold nugget.
   - Epic drops at 20%: one Guardian weapon per archetype (edge, sentinel bow, sigil staff, warden's grimoire, tier 4).
   - Legendary drops at 4%: the Heartstone staff (tier 5).
   - Gear only drops if you don't own it yet. The server rolls, and pays once per recorded boss kill and at most once every 20 hours, because kills are reported by the client.
   - The five weapons reuse the crafted models at a larger scale.

   *Assumption:* these rates are fine for now. The Epic and Legendary set needs its own models in a later art pass.
3. **Rune wisps live outside.** The spec puts them in the outer wild, but the systems roster had them in the inner temple.
   - They now spawn in the outer wild at level 5, with lower HP and damage.
   - "Put out the wisps" is an outer mission (4 wisps, 360 XP).
   - Levels are one per zone (row 230): outer 5, inner 10, boss 15, with elites 2 above.
4. **Respawn.** Wild enemies from the spawn table come back 40 to 120 seconds after dying, once you are 12 units away. The boss only comes back on your next visit. This lets the hunts (6 foxes, 5 crabs) finish with a small resident population. *Assumption:* OK.
5. **The guardian stays in its chamber.** Aggro is 9 and leash is 11. At the old aggro 14 and leash 42 it followed players into the temple. Leaving the chamber resets it to full health and phase 1.
6. **Starter grant (answers island Q12) and the gate on the server (Phase 1 finding).**
   - The server now checks the gate on every call that implies being in the ruins: mission start and progress, kills and the boss reward. The gate needs the Oracle family, level 10 and a subclass (rows 179, 207), and a closed gate returns `gate_closed` (403) from `web/lib/combat/service.ts`. Wear and repair stay open, since they only cost the member.
   - The subclass choice, which is what opens the gate, grants the bow, staff and tome. Everyone keeps the sword and wraps from the start. Members who already chose a subclass are backfilled.
   - The check lives in the service rather than SQL, because the routes are the only callers of the service-role functions.
7. **Mission rewards.**
   - Materials go into `member_collections`, the stock crafting spends, through `combat_give_materials`.
   - Boss coins use the wallet source `mission`, which avoids another rewrite of the ledger's CHECK constraint.
   - "Sanctum watch" has 4 waves instead of 5.
8. **Weapon stats split.** Damage comes from tier and scaling in the `weapons` table. Swing speed, range and projectile speed live in `lib/game/combat/data.ts`. *Assumption:* the island owns timing. If admins should edit those, it is a column add.
9. **The board shows all ten missions (answers island Q16).** They are grouped by zone and show difficulty stars, rewards and the cooldown. The inner missions aren't hidden, since the gate already requires level 10 and the zone levels speak for themselves.
10. **Revolver grip.** The brass revolver's barrel is modelled along +Z, while the other weapons point along +Y. It gets its own grips, solved from the v6 socket frames: level when firing (left hand, AttackBow), pointed at the ground ahead at rest, and barrel down on the back.
11. **Ground markers were drawn behind enemies.** The sector marker's yaw was off by π, so lunges and sweeps drew behind the attacker. Fixed in `Telegraphs`, and the screenshots show the markers in front.
