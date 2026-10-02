# Zone 1 mobs: questions for David (game/mobs-z1, 2026-10-02)

Each question has the assumption the build took; nothing here blocks.

1. **The elder thorn crab's spoils.** Every win (once per 20 h, like the guardian): 60 coins, 3 stone, 1 crystal, and an 8% chance at a crafted tier-2 weapon you don't own yet (iron sword, yew longbow or brass revolver). Those weapons are also craftable, so the drop skips a recipe for the lucky. *Assumed:* the weapon chance stays; the alternative is a recipe card or a crab cosmetic.
2. **The elder's XP and length.** It was a 300 HP elite that died in about 20 seconds. It is now a two-minute fight with starter weapons (1450 HP, 20 damage) and pays 450 XP (the guardian pays 1200 for 4–6 minutes). *Assumed:* 450.
3. **A pollen sprite that bursts on you gives no kill XP** (it spent itself); one you swat does (6 XP). A cloud of 13 swatted is 13 separate kill posts to `/api/combat/kill`; batching kills would cut that. *Assumed:* fine for now.
4. **The guardian's summoned rune wisps** are the same mob, so they now blink away when you close in and fire the new rune bolt (a little faster, 9 → 11 u/s). The temple and the guardian otherwise stay as they were. *Assumed:* keep; say if the boss's wisps should keep the old behaviour.
5. **The Pollen form's trait.** `enemy_types.trait` for the pollen sprite is left empty: learning forms belongs to the Arcane wave (the Transmuter hooks are `lib/game/combat/mobFamilies.ts`). The Crab is still taught by both crabs.
6. **Shell numbers.** A thorn crab's front (2.2 rad) lets 20% of a hit through and is never staggered by it; it turns at 2 rad/s, so circling at close range or dodging past it opens the flank. The elder's front lets 15% through, 50% once cracked; it turns at 1.4 rad/s. *Assumed:* these; tune after a playtest.
7. **The mushroom beast's model** was kept: it reads well next to the new ones (sheet: `specs/evidence/mobs-z1/08-models.webp`).
8. **Sound.** The new attacks use the existing cues (windup, hurt, hit); there are no new sounds for spores, pollen, rune bolts or the shockwave until the sound source is decided (polish README, waiting on David).
9. **The Gunslinger and the elder.** With its willow bow it beats the elder 70% of the time (4 deaths in 20); every other subclass is at 95–100%. The kits belong to the classes wave. *Assumed:* note only.
10. **The elder's leash is 24 u** (was 15), so its charges don't drag it home to heal; it still resets if you pull it further or reach the gate.
11. **The first pollen cloud is close to the gate** (it engages as you step out of the plaza on the east side). *Assumed:* fine for the outskirts; it can move deeper.
