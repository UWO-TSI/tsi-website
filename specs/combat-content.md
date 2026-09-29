# Combat content spec (two sequential parts)

Decisions: rows 7, 8, 12, 17, 22, 24, 31, 32, 38, 49–53, C2, C3, 140, 179, 207, 208, 213, 228–231; rulings in `specs/combat-questions.md` (starter weapons, runes spark/binding, energy 100 +12/s, durability −10% on defeat, fees, 20 h mission cooldown). Art is done (`art/props-enemies/`, `specs/props-and-enemies-art-questions.md`). Load `ponytail`; one shared effect/ability system, never sixteen controllers.

## Part A: the ruins made whole
1. **Roster in the world:** outer wild area spawns shadow fox, thorn crab, mushroom beast, rune wisp; inner temple spawns animated book and the stone golem elite; elder thorn crab elite in the outer area's far corner; guardian statue in the boss chamber. Fixed levels per zone (row 230). Spawn tables data-driven.
2. **Telegraphs:** every enemy attack pulses its `telegraph` emissive parts during wind-up and shows the ground marker (existing); procedural part animation for bob, lunge, claw sweep, spit, slam using the named parts.
3. **Guardian statue boss:** three readable patterns (overhead slam with ring marker, sigil beam sweep, summon two rune wisps under 50% HP), a stagger window after the beam, and an enrage at 20%. It should be a wall for starter weapons and beatable by a level-10 build with tier-2+ weapons. Victory reward via the combat service (Epic/Legendary drop table, row 21).
4. **Ten missions** across the four templates (hunt, fetch, survive waves, escort) authored as data with rewards (XP, coins, materials), 20 h cooldown, visible on the mission board with difficulty.
5. **Weapons:** combat stats for the four crafted weapons (iron sword, yew longbow, brass revolver, rune staff) in the weapons table and data; fix grips per the art questions (staff/summon on the back `[0,0,-0.5]`, bow and staff rest poses).
6. Evidence prefix C2- under `specs/evidence/combat-content/` (each enemy telegraphing, the boss's three patterns, a mission of each template, crafted weapons in hand); tests for spawn tables, boss phase transitions, mission rewards idempotency.

## Part B: sixteen kits and the subclass choice (after A merges)
1. The shared ability system executes each subclass's signature and passive from data (the `web/lib/combat` kit table), with the four equipped ability slots (row 50), persistent summons/totems with caps, and incantation abilities using the rune prototype (row 52).
2. Level-10 subclass choice at the Oracle within the MBTI family (row 207), with the coin-fee respec (row 20); stat allocation UI with reset fee (row 38).
3. Balance pass: every subclass can clear a normal mission solo; green (Warden) slightly favoured (G2). Record a simple DPS/survivability table from a scripted test encounter.
4. Evidence C3- and tests per kit (effect applied, cooldown, caps).
