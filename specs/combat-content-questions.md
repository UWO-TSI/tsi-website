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

## Coordinator rulings (2026-09-26)
All eleven Part A assumptions accepted as built; boss numbers are the starting balance, retune after the member playtest.

## 2026-09-26 (combat content agent, Part B)

Each item has the assumption the build uses today. None blocks. Kits: `web/lib/combat/kits.ts`; the one ability system: `web/lib/game/combat/abilities.ts`; table: `specs/evidence/combat-b/balance.md`.

1. **What a kit holds (rows 17, 50).** Each subclass offers five abilities: its signature, two of its own, and its family's two shared ones (Arcane: Blink, Starfall; Ranger: Tumble, Rain of Arrows; Vanguard: Leap Strike, Second Wind; Warden: Renew, Verdant Covenant). Four are equipped at the Oracle, saved on the account (`member_progression.loadout`, migration `20260926210000`). The default is signature, own two, and the family's second.
   *Assumption:* five to choose from is enough for launch; more per subclass later is data only.
2. **Which spells are drawn (rows 52, C2).** Four: Elemental Burst and Call Companions (easy spark rune), Starfall and Verdant Covenant (hard binding rune). Ranger and Vanguard draw nothing.
   - Drawing starts for 25% of the energy and pays the rest on release. A fizzle or a dodge pays only the start and waits 1.5 s instead of the cooldown (plan §defaults, C3).
   - The score scales damage 0.5 to 1.5. Shields and heals cap at 1.2 and holds at 1.
3. **Summon and totem caps (rows 43, 44, 50).**
   - Minions share one capacity: 2 + Spirit/5, plus 1 for Summoner and Necromancer. Wisps and foxes cost 1, the bulwark crab 2. When a new one passes the cap, the oldest leaves.
   - Totems: one per role (ember, mending, warding), three at most. Traps: two. The Illusionist's phantom: one.
   - Companions and totems persist until destroyed, until you leave the ruins, or until their ability leaves the loadout. Shades and bone wisps last 20 s.
   - Enemies go for a phantom or a bulwark crab near them, and a distracted enemy wanders home.
4. **Transmuter (rows 34, 37, 40–42).** Each learned trait is an ability to equip, so the four slots are the equipped-trait limit.
   - The first defeat of a species teaches its basic trait. The server does this in `combat_record_kill`, only for Transmuters, never on a replayed kill. The kill route answers `trait_unlocked`, and the ruins show a banner.
   - Defeats also train mastery: tiers 2 to 4 at 1, 10 and 30 defeats. Trait damage uses that tier instead of the weapon's (row 37).
   - Fox Stride is the starter. The elder crab trains Crab Shell, and the guardian teaches nothing.
   - *Not built:* rarer drops per species (row 40) and wing flight (row 42).
5. **The Guardian's shield.** The Buckler has no model and no way to be acquired, so every Guardian blocks at half, as the kit's missing-gear rule says. The Guardian is still 100% on both runs.
   *Proposal:* grant the Buckler with the Guardian choice once it's modelled.
   - Cloth wraps now work as a weapon (bare hands), so the Monk gets the full combo. Gunslingers without a revolver shoot at 70% until they craft one.
6. **Stats (row 38).** Allocation now sends the new totals, so a retry changes nothing and lowering a stat needs the paid reset. The Oracle's "Family preset" only raises stats.
7. **Subclass change (row 20).** A change costs 250 coins after a confirm. A retried key answers with its first result, even after a later change. Family abilities you had equipped stay equipped.
8. **Balance (G2).** A scripted average player (60% dodges, runes at ~80%, no kiting) clears "Hold the rune circle" 100% of the time with every subclass.
   - On "Sanctum watch", Warden is the most reliable family: lowest health averages 84%, against 63–71% for the rest, and it isn't the fastest.
   - Summoner is the quickest Warden. Elementalist and Gunslinger are the frailest on the hard run (lowest health 40–45%) but still clear it.
   *Assumption:* starting numbers; retune from the member playtest.
9. **Keys.** The four slots are 1–4 and the weapon swap moved to Q. The key store is now `tsi.combatKeys.v2`, so anyone who remapped the prototype runes starts from the defaults once.
