# Classes v2, the Arcane wave: questions for David (with the assumption taken)

Nothing here blocked the build. Each item says what the wave does now; a one-word answer changes it. Numbers are in
`specs/evidence/classes/K-arcane-balance.md`.

## Elementalist
1. **The staff's click is free.** "Every Elementalist attack costs mana", but mana only comes back after 1 s without spending, so a click that cost mana would stop the regen for as long as you fight. *Assumed:* every spell costs mana (no cooldowns), the staff's bolt doesn't.
2. **Air Step and the glider.** Space let go within 0.18 s in the air is the Air Step (on the release); held, it's the glider. The glider is off in the ruins for everyone today (the glider spec: "never in an encounter"). *Assumed:* an air-jump class that owns the glider can glide in the ruins; nobody else can. Say if every class should, or none.
3. **The Cataclysm mash.** 12 notes, three shown at a time (14 at mastery 10, 16 at 18). A wrong key cracks the note and moves on. Power = 50% + the share of notes hit, up to 150%. It releases early when every note is played. The storm's area follows your aim while it charges, so you can steer it onto the pack.
4. **"Launches the survivors."** Enemies have no height in the sim, so the shockwave is a big knockback with a 1 s hold, then the cyclone pulls them in and the slam lands.
5. **Combo unlock order.** The sheet gives 3, 5, 7 and 9 but not which combo is which. *Assumed:* the table's order: Molten Pillars 3, Spring Grove 5, Riptide 7, Rampart 9.
6. **Riptide held.** Both keys held 0.3 s cast the pull-yourself version.
7. **Rampart.** Built 2–6 u along your aim, ramped up from your side to 1.5 u on the far side, 8 s, two at most. It stops shots both ways (yours too) and enemies walk round it.

## Illusionist
8. **Who's Real?** "30% of enemy attacks go after a clone" is built as each enemy spending 30% of its time on a clone (it makes a fresh call every 2.5 s). An enemy chasing a dashing clone may never land an attack, so a call per attack kept lured enemies lured for good (the Illusionist took 4 damage a minute that way).
9. **Clones using skills.** At mastery 10, a clone calls a fresh double when one is missing (skill 1; the cap holds). At 20, two clones trade places now and then (skill 2), and a clone sends back the first shot that reaches it every 4 s (skill 3). Is that the reading you meant?
10. **Mirror Ward and melee.** Shots only (anti-mage and anti-ranger), as written. Melee hits still land.
11. **Trick Card's mark** follows the card in flight and stays where it ended for the 3 s recast window.

## Necromancer
12. **Command.** The first tap sends every minion at the enemy nearest your aim. The second calls them back to guard within 5 u of you. When the target dies, they go back to free play.
13. **Corpses** can be raised for 20 s, or 40 s after a Grave Tithe kill. For a Necromancer, a faint green glyph marks each one. Corpse Explosion chains through corpses within 3.5 u, three links (mastery 5 adds 25% reach).
14. **Army of the Dead.** Every corpse within 8 u of your aim rises (up to 12), plus 30 skeletons in a line across your aim. They march for 3 s and all burst at the finisher. They sit outside the summon cap.

## Transmuter
15. **Pollen's "briefly untargetable"** is 0.6 s unseen (enemies lose you), not i-frames. §1.1 allows one i-frame ability per pool, with a cooldown of 8 s or more.
16. **Forms last** until you shift again. Entering the ruins or a defeat puts you back in your own body.
17. **Trait tier.** Rows 37 and 41 say trait mastery matters more than weapon quality, so a form's moves and click hit at its trait's tier: 2 at the first defeat, 3 at 10, 4 at 30. The Chimera uses the best of them, and the charm's tier counts only for your own fists.
18. **The Chimera's "no cooldowns".** The forms' moves are free and skip the form cooldown, but fire at most once every 0.5 s. With no limit at all, a held key fired every frame. Its body is the stone golem at 1.5×, with the other four forms fused on: the fox on its shoulders, the crab's shell on its back, the wisp ring at its chest, pollen wings.
19. **Role.** "Form-shifting bruiser" is mapped to the damage role (1.10× today's normal-DPS median; it takes the most on the sanctum of the four). The Golem form carries a 0.4 guard.
20. **Fox Pounce** is listed among the class movement skills, but there's no separate one. The Fox form's Lunge (and the Pollen swarm) are the Transmuter's movement.

## Balance (data only)
21. **The scripted guardian fight** (the bot against the guardian): the Elementalist dies in 5 of 6 (3.4 min when it lives); the Transmuter dies in 4 of 6 (about 2 min when it lives); the Illusionist kills in 3.8–4 min in 4 of 6 and runs out the clock in the other two; the Necromancer takes 3.8 min. Wave 0's dev kit never brings it down. The formula measure puts the four signature weapons at 4.3–5.8 min. *Assumed:* leave the guardian to wave 5's all-16 pass. Options: a softer scripted fight, or measuring with tier-2 signature weapons.
22. **Mastery 20 is ×1.30 over mastery 1** (the medians; §3 asks for at most 1.2). The locked clone counts (4 clones, 18 s, clones using skills) and the 0.75 s form cooldown make the Illusionist and the Transmuter gain the most. *Assumed:* keep the locked numbers; the test holds it under 1.35.
23. **Ult share on the sanctum run** is 0–7% (target 8–15%). The sanctum's last stretch is often one golem, and the bot fires only with two enemies in reach, so the Elementalist's and the Transmuter's ults rarely land before the end. The weight of each cast is in range: the Cataclysm puts about 11 power × the mash (0.5–1.5) on its centre, the Joker 8 on each trapped enemy, the Army about 6–10 on each enemy in the pack.
24. **Ult charge.** All four sit at 0.8, the floor of the 0.8–1.25 range. The area kits still fill in 57–73 s on the sanctum.

## Art and identity
25. **Icons are hand-drawn SVG,** not Higgsfield. The sheet planned Higgsfield icons, with you approving the style on the first family's set. Treat this set as the style proposal (`K-arcane-icons.webp`).
26. **Shop weapon skins.** The material sets exist (`arcaneSeed.ts`) and the mastery trim renders on the weapon. A bought skin can't render yet: the progression view carries the equipped item's id, not its skin key. *Assumed:* the GUI pass or wave 5 adds that lookup.
27. **Iron and gold trims read matte.** The look classes treat only M_Blade/Brass/Steel/Iron/Drum as metal, so M_Trim gets the matte class.

## For the coordinator (merging)
28. **The combat atlas.** The other waves also append rows named flame, petal and shard. Merged as-is, the atlas would pass 32 rows and repeat keys. Keep one painter per name (the recipes refer to them by name) or start a second atlas.
29. **Shared files the merge touches:** kits.ts (the Effect union, units, passives, the pollen trait), abilities.ts (`default:` dispatches to primitives.ts), classRuntime.ts, input.ts, encounter.ts, actions.ts, runtime.ts, balance.ts (the v2 bot), RuinsScene and CombatHud, data.ts (WEAPON_LOOK), clips.ts (`gripFor`), build_pack.py rows, build_clips.py uniques, sql-smoke.sh. classes_v2_smoke.sql now reads the real signature rows when a family has seeded them, and two older smoke counts are scoped to today's rows (combat_content, combat_kits).
30. **Signature weapons stay out of the generated combat seed.** `combatSeedSql` skips weapons with a subclass, so each family's own migration carries its weapons and the seed test holds.
