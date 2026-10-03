# Classes v2, the Vanguard wave: questions for David (with the assumption taken)

Nothing here blocked the build. Each item says what the wave does now; a one-word answer changes it.

## The kits
1. **Juggernaut's role.** The sheet says "unstoppable bruiser". *Assumed:* tank (War Cry draws enemies, max HP is its stat), so it's tuned to 0.80–0.95× the median DPS.
2. **Which key unlocks later.** The sections don't say. *Assumed:* one key at mastery 3 per class, like the Illusionist: Shield Throw, Seismic Drop, Flying Knee, Execute. The rest from the start.
3. **The parry.** Hold the key to block (70% off frontal hits). Any press opens a 0.25 s parry window that outlives the release, so a tap parries. A frontal hit inside it (melee or a shot) is negated and answered with a counter-slash that holds the attacker 1 s. A missed parry still costs the key's 1 s cooldown. Bulwark: +20 energy and +30% armour for 3 s. *Assumed* those numbers.
4. **Unbreakable.** For 6 s nothing hurts you (from any side). The release adds twice what was stored to a base shockwave (power 5, 5 u) on every enemy in it. Hits taken during the 6 s still charge the meter. *Assumed:* "release it ×2" means each enemy in the wave takes 2× the stored damage.
5. **Titan.** 2.5× size, reach ×1.75, every swing throws a 4 u shockwave cone, +30% armour for the 10 s, steps shake the camera; the fissure at the end runs 9 u ahead. No extra HP. *Assumed.* Since the Arcane merge, every hit inside a sustained ult's window counts as the ult's and charges nothing (a shared rule). Titan's 10 s of swings alone are about 11% of a sanctum run, so its own hits are now light: the opening slam 1.1, each shockwave 0.35, the fissure 3.4 (were 3.2, 1.0 and 9.6). That keeps its share at 13.8% (target 8–15%) with the locked 2.5× for 10 s. Should a transformation's swings count as the ult's at all? If not, the old numbers come back.
6. **The Juggernaut's 2% of max HP per hit** goes in as power, through defence and armour. That makes it the boss killer (2.9 min at its scripted-fight damage rate against the guardian's flat armour; the band wants 4–6). Keep the 2% (your number) and accept it, or lower it?
7. **Martial Artist techniques.** "Right after a hit" = within 0.7 s of a chain press. Mid-chain they hit +40% (Elbow +50%, Flying Knee +30%), stack Rhythm and move the chain on; as openers they're plain. *Assumed.*
8. **The Elbow's cut** is a 3 s bleed made of three small hits on the same enemy, not a new status. The Ranger wave added a damage-over-time status; the coordinator can fold the cut into it at merge.
9. **Clinch Knees on elites and bosses.** The hold is 1.4 s (the whole technique) on normal enemies; the existing resistances cut it to 0.84 s on elites and 0.42 s on the boss. Should the clinch ignore resistances?
10. **The Assassin's back.** A backstab is from the 140° behind an enemy. Chasing enemies turn to face you at once, so the kit makes windows: a blink, Kunai Blink and the Vault hold the target 0.45–0.8 s ("it turns to find you"), Smoke sends enemies home with their backs turned, crabs turn slowly, and anything mid-attack is committed. The short holds aren't in the design. Keep them?
11. **The Vault** is a 0.8 u hop and +3 u/s carried along the dodge, with a front-flip clip, so you go over the enemy; where you land depends on the dash's travel (3–4 u), not a snap to its back. Want a guaranteed landing spot instead?
12. **Blinks** (Shadow Step, Kunai Blink) land only on ground within 1.2 u of your height, never in a cliff or up a wall; otherwise you stay put.
13. **Kunai Blink.** The kunai flies to the aim (up to 12 u) and sticks there, or in the first enemy it hits. 4 s to press again; the cooldown runs from the throw. *Assumed.*
14. **Execute on mini-bosses.** The elder thorn crab counts as a boss here (2.5× instead of a kill). *Assumed.*
15. **Death Lotus.** Everything within 9 u is cut at once (power 8 each), the world goes black-and-white ink through the 600 ms time stop, and the cuts show as ink slashes on every enemy. You don't actually travel between them. Should you end behind the last one?
16. **Smoke Bomb.** Enemies within 3.5 u lose you for 2.5 s; inside the 2.8 u ink (4 s) nothing targets you. Attacking from inside doesn't reveal you (the design doesn't say). You aren't drawn see-through inside it (the characters share one material); the ink smoke covers you. Want a fade?
17. **Stat directions** (mastery 1 → 20): Guardian armour 10% → 25%, Juggernaut max HP ×1.2 → ×1.35, Martial Artist attack speed ×1.0 → ×1.15, Assassin crit chance +10% → +25%. Trimmed so mastery 20 stays near the 1.2× power budget.

## Balance (specs/evidence/classes/K-vanguard-balance.md)
18. **The band's median.** No other family's v2 kits are in this worktree, so the rows are measured against today's sixteen kits' median (26.8 normal DPS), the band every v2 kit is written against until wave 5 measures all sixteen. Wave 5 retunes data if the v2 median moves.
19. **Ult shares after the Arcane merge:** Guardian 12.9%, Juggernaut 13.8%, Martial Artist 9.1%, Assassin 11.3% (target 8–15%). The sustained-ult rule moved the Martial Artist's Eight Limbs into the band (it was 6.6%); no change needed there.
20. **The Assassin takes 69 a minute on the sanctum,** 3.00× today's lowest (23); the rule is 3×. Squishy melee by design; Smoke Bomb on a telegraph keeps it at the edge.
21. **The scripted guardian fight:** the melee bot dies in the guardian's smash before it falls (the demo kit does too), so the table also gives minutes at the fight's damage rate: Guardian 4.4, Martial Artist 3.5, Assassin 3.4, Juggernaut 2.9.

## Art and UI
22. **Icons** are hand-drawn SVG (no generation, per this wave's rule), on the cream disc with an ink outline. You approve the style on this family's set before the others follow it.
23. **Weapon skins, the mastery trim and shop frames:** the rows are seeded and equip works (wave 0), but nothing renders a weapon skin, the trim or a shop frame yet, and T5's runes glow without animating. Each needs a renderer change shared by all families.
24. **The kunai** has its model (kunai.glb) but a thrown kunai still flies as the generic streak with the ink and red trail. The Ranger wave added per-shot looks; the kunai can use them at merge.
25. **Passive icons** (Bulwark, Unstoppable, Rhythm, Backstab, Vault) sit before their names on the HUD's class line; the Path sheet doesn't show them yet.
26. **Sound:** nothing new; the re-pitched CC0 set as before.

## For the coordinator (shared files)
27. Both this wave and the Ranger wave add a projectile `bounce` (same meaning: that many more enemies); keep one at merge. Met and merged with the Arcane wave: `CLASS_KITS`, the `WEAPONS` spread, `combatSeedSql` skipping signature weapons, the sql-smoke `GAME` list, the verb-count line in `clips.test.ts`, `GRIP_OF`, the combat pack (Vanguard rows 25–27: inkSlash, lotusPetal, aegisShard, renamed because Arcane's petal and shard are different sprites; 28 of 32 rows used) and `build_clips.py` (both unique sections; every clip byte-identical to its source).
28. The wave-0 harness missed a fill completed by a basic attack (the meter was read after the frame's swings); fixed in `balance.ts` for everyone.
29. Four pairs of primitives do neighbouring jobs, both kept: Arcane's `counter` (a timed window that cuts and answers a hit) and the Guardian's `parry` buff (frontal hits only, negated, Bulwark after); `delay` and `after` (an `after` re-aims at the locked enemy and carries its own FX and tier); `stealth` and the Assassin's `veil` (a placed smoke you can't be seen in); `teleport` and `blink` (to an enemy's back, refused off your level). Wave 5 could fold each pair into one.
30. The harness bot answers about a third of the telegraphs it doesn't dodge with a timed skill (Arcane's REACT_SKILL); the Guardian's parry keeps its own rule (half parried late, the rest blocked as soon as seen), so its row doesn't move with that number.
31. `sql-smoke.sh` exits 0 when a smoke file raises: the Vanguard smoke's "locked" (its member ids collided with the Arcane smoke's, now its own) showed only as an ERROR line. Grep the log for `^ERROR` until the script stops on one.
