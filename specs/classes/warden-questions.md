# Classes v2, the Warden wave: questions for David (with the assumption taken)

Nothing here blocked the build. Each item says what the wave does now; a one-word answer changes it. Numbers are in
`specs/evidence/classes/K-warden-balance.md`.

## Summoner
1. **One glove.** The seal gloves are one model on the weapon socket, worn on the right hand; the left hand is bare in the signs. A matched pair needs a second weapon socket in the rig. *Assumed:* one glove is enough to read as "seal gloves". Want the pair?
2. **The shadow lash is ranged.** "A shadow lash from your hand" is built as a whip of shadow that snaps out to 7 u (a fast bolt, 0.6 s), so the Summoner fights from behind its beasts. As a 2.6 u melee lash the bot stood in every hit and the beasts barely mattered. Say if you want it close.
3. **Taming order and place.** The ritual circle sits in the outer wild's west, at (-11, -15.5), between the fox den and the elder crab's spot. It moved there from the canyon's edge, where its untamed forms rose up on the cliff. Step in and the next untamed beast's shadow rises after 1.2 s: owl, then toad, then serpent, then rabbits. Enemies near the ward wander off while it runs. *Assumed:* that fixed order (wolves known at the start). Want any order the player picks, or the circle somewhere quieter?
4. **"Beat it solo."** While a ritual runs, your beasts are sent back and every beast key locks. Other enemies within 9 u of the circle lose interest. Leaving the ward, falling or 150 s ends it, and you can start again. Its fall tames the beast on the server (`combat_tame_beast`, in order, once per key). It gives no XP and no drops.
5. **Only the toad taunts.** The toad draws enemies to itself and tongues in anything that rushes you every 3.5 s. Wolves, owl and serpent just fight.
6. **A killed beast** is back after 10 s. Shadow Bond: each fallen beast (up to 2) gives the others +30% damage until it returns.
7. **Escape Rabbits** pours out 48 rabbits as one instanced effect (up to 256 drawn). You're translucent with afterimages, +50% speed for 3 s, and enemies within 4.5 u lose you for 1.6 s. It doesn't count toward the beast cap.
8. **Shadow Garden's risen beasts are the ult's.** Their hits count as the ult's share and charge nothing. When it closes, the ones it raised go back, unless you called them since.
9. **Beast ranks.** With four beasts out at 20 the Summoner already deals twice its beasts' damage, so its beast ranks cut call energy by 25% instead of adding power, and summon power tops out at +10% at 20 (the other three's stat directions reach +25–30%). That keeps mastery 20 inside 1.2×.

## Shaman
10. **Totems.** One of each at a time, three at most, 24 s each. They link within 9 u, and the beams cut every 0.5 s. An enemy counts as enclosed inside the triangle of three, or within 1.2 u of a two-totem line. Overcharge adds 18% per enclosed enemy, up to ×2.4.
11. **Spirit Hop** is key 5, open at mastery 3, used mid-jump. It plants a spirit post under you (6 s, outside the cap, linking like a totem) and launches you off it with momentum.
12. **The Earthbind's area isn't drawn.** You see the totem and its quake ring every 5 s, but not the slowing area between quakes. *Assumed:* the quake teaches the reach. Want a faint ring on the ground?
13. **Spirit Awakening** plants any missing totem round your aim, then the thunderbird, salamander and bear rampage for 6 s. It ends in an Overcharge of every totem.
14. **Its ult on the sanctum run.** The bot fires an ult only on two or more enemies. The Shaman's meter fills (62 s) when only a golem is left, so the run shows 0% ult share (26% on the guardian). This hits other families too (Ranger's notes). *Assumed:* a harness matter for wave 5, not a kit change.

## Druid
15. **"Sustain" is the tank role.** Its DPS sits at 0.81× today's median. On the sanctum it takes 23 damage a minute against the others' 17–25, but its lowest health is 96%: it outlasts by healing, every heal a share of its max HP. §3 says "tanks take the least". *Assumed:* the Druid outlasts rather than mitigates. Want a guard on it instead?
16. **Thorn Wall** grows 5 u across your aim for 6 s. Enemies can't walk or shoot through it; your shots pass. Touching it cuts every 0.5 s and slows 40%, and anything it grows under is thrown clear to its side.
17. **Vine Swing** is held: a vine to your aim (10 u) swings you toward it, and letting go flies you on with momentum. It opens at mastery 3.
18. **World Tree** roots you for 7 s with a 40% damage cut, 6% of max HP a second, and a 6 u ring that drains enemies (60% of its damage back as health). It ends in a bloom that heals 20%. *Assumed:* "only a one-shot works" is that mix, not invulnerability.

## Priest
19. **Shapes score 60–150%.** Below 50% accuracy the spell fizzles: a quarter of the energy is spent and the key rests 1.5 s. Wave 0 capped heals and shields at 120%. *Assumed:* the Priest's drawn heals go to 150% like its damage, since the shape is the whole skill. A wave-0 test was changed for it.
20. **The line and the chevron** turn with the camera, so you draw them the way the beam or the dash goes on screen. The overlay shows them turned.
21. **Divine Descent** is drawn too: the winged sigil, 3 strokes, 7 s. A fizzle or a cancel keeps 75% of the meter. There's no co-op yet, so "allies fully healed, the downed revived" heals you to full; allies come with groups.
22. **Lightbolt** heals you 1.2% of max HP a hit on an enemy, and Blessed turns healing past full into a shield of up to 30%. On an ally it would heal them (no allies yet).

## Shared and harness
23. **Field effects are named `ground` and `barrier`.** The Arcane wave's `zone` and `wall` have other shapes, so both stand. The unused `pull` effect was dropped. Wave 5 could fold the two zones into one.
24. **Self-centred ults.** The bot now counts the two enemies round you for a self-centred ult (Shadow Garden, World Tree) and round the target for an aimed one. A drawn ult is never dodged out of. Both are harness changes in `balance.ts`.
25. **Weapon wear in the harness.** A tier-1 signature weapon has 90 durability, so the bot breaks it after about 90 landed hits, about a minute into the sanctum. Every hit after that does half, abilities and ults included. That's the live rule, and it shapes every family's sanctum numbers. Should signature weapons wear?
26. **The guardian's pace.** On the scripted fight the Summoner and the Shaman take about 2.5 minutes, the Druid 5.9 and the Priest 7.4. The guardian's armour (7) takes a flat bite off every hit, so small hits (bites, pulses, zone ticks, burns) land for 1. The formula measure is 5.3–5.8 minutes for all four weapons. *Assumed:* the scripted pace is wave 5's, with all sixteen on the same bot.
27. **Shop.** 5 weapon skins (one in Gems, 200) and 4 aura sets (one in Gems, 150) at shop positions 920–928, off sale until launch. No frames: nothing draws a nameplate frame yet.
28. **The sanctum's damage-taken spread.** The Warden family alone sits at 1.45×. Against today's sixteen it's 3.4×, because the Warden takes the least (G2) and today's Assassin takes 59 a minute. *Assumed:* that's wave 5's to settle.
