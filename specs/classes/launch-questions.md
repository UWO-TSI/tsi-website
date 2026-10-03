# Classes v2, wave 5 (launch): questions for David (with the default taken)

Nothing here blocks the launch prep. Each item has options and a recommended default; the draft migration
(`web/supabase/drafts/classes_v2_launch.sql`) and the balance pass (`specs/evidence/classes/K5-balance.md`) follow
the defaults. A one-letter answer changes them. david-decisions.md items 10–14 cover the rest of the launch.

## The launch

**1. The launch letter.** Every member who has a subclass at launch gets it as a system letter (once; members below
level 10 meet the new paths at the Oracle when they get there). The draft:

> **Your path has grown**
>
> Every path has its own kit now: its own skills on your number keys, an ultimate on F that fills as you fight, and a
> signature weapon. Yours is waiting in your tool wheel, at the best tier you've earned so far. Your skills need it in
> hand.
>
> Mastery is new too. You start at mastery 1, and fighting in the ruins raises it to 20, opening new skills and looks
> along the way.
>
> Since the paths changed under you, you get one free change: press P and pick any path in your family. No reading,
> no coins, no wait, and it never expires.
>
> See you in the ruins.

A) As drafted. B) Named: "You're still a Necromancer, and your bone tome is waiting…" (the draft gains a name table for
the 16 subclasses and their weapons). C) Two lines: what changed and the free repick. D) Also send a short note to
members without a subclass ("New paths wait at level 10").
**Rec: A.** It says the three things a member has to act on (the weapon in hand, mastery, the free change) and nothing
else.

**2. Which class cosmetics go on sale at launch?** 40 are seeded and off sale. Nameplate frames draw nowhere yet, and the
Gem-priced weapon skins sold as animated are colour-only so far.
A) All 40. B) Every aura and the coin-priced weapon skins now; frames and the Gem skins once they show in game.
C) Coin items first, Gem items later. D) None at launch; a separate drop once members have played.
**Rec: B** (david-decisions #12). It's what the draft does: 33 of the 40 (all 16 auras and the 17 coin skins; the 3
frames and the 4 Gem skins wait). A is one line to change.

**3. Does a signature weapon ever wear or break?** As built, every landed basic hit costs 1 durability; a tier-1 weapon
has 90, and once it's at 0 every hit you land does half, abilities and ults included.
A) Keep per-hit wear. B) Wear only when you're defeated (−10%, row 229). C) Never: signature weapons don't wear;
common weapons keep their durability. D) Per-hit wear with about 10× the durability.
**Rec: C**, matching row 279's "tools never break": the signature weapon is your class's tool, and §1.5 already says it
never strands you. The numbers make it more than a feel call (K5-balance.md, measured with the wear off):
- Wear only touches the twelve kits whose basic is a plain swing or shot. The four Rangers' own shots and the
  Transmuter's forms never wear.
- Those twelve lose half their damage about a minute into the sanctum. With no wear their sanctum DPS rises 11–57%
  (the Martial Artist 57%, the Assassin 55%, the Illusionist 41%, the Druid 38%, the Guardian 35%), and their
  five-minute loop DPS 29–78%.
- The sanctum evens out: the fastest clear goes from 0.74× the median to 0.83×. The Martial Artist stops falling on
  the loop (19 of 20 → 0), and the Guardian kit stops falling to the guardian (12 of 12 → 2).
- The guardian gets faster: 3.1 → 2.5 minutes median. That pairs with item 8.
With B or C the band is re-measured (one command) and lightly retuned; C also needs the wear rule to skip signature
weapons and the repair screen to leave them out (a small build task).

## Balance the numbers can't settle

**4. The band's reference for roles.** Nine of the sixteen kits are damage, so the all-16 median always sits between the
two slowest damage kits, and the slower of them reads at or under 1.00× (the Marksman, 0.99×). Measured against the
median, the Marksman, the Illusionist, the Summoner and the Druid fall out of their role ranges, and buffing them moves
the median with them.
A) Roles against the all-16 mean; the ±25% band against the median. B) Everything against the median, as §3 says.
**Rec: A.** With it every role holds its range (the pinned test uses it).

**5. The Elementalist's ult fills in about 56 s** on the sanctum (target 60–90). Its `ult.charge` is already 0.8, the
floor of §1.2's 0.8–1.25 range. Its many area hits fill the meter; Attunement is only about 2 s of it, and trimming
its spells barely moves the fill.
A) Widen the range to 0.75–1.25 and set 0.75 (61 s). B) Keep 56 s. C) Cut its damage (it's also the top damage kit at
1.20× the mean).
**Rec: A.** It's one number, and the kit keeps its damage.

**6. The army ults.** Over a five-minute pack fight, the Necromancer's Army of the Dead adds about 24% of its damage and
the Summoner's Shadow Garden about 20% (band 8–15%). Counting only their own hits, they're 13–15%. The rest is what the
ult leaves on the field: thirty skeletons keep the pack busy and leave corpses for Raise Dead; every beast rises at once.
Halving the skeletons' hits and bursts still leaves 19%.
A) Keep them: the army is those kits' identity. B) Trim them toward 15% (fewer risen corpses, a shorter garden).
C) Count only an ult's own hits for these two.
**Rec: A** for launch, and watch it in the playtest.

**7. Damage taken and the tanks.** On the sanctum the spread is about 4× (target 3×): the clone and beast kits take
13–16 a minute (their decoys take the hits), the squishy melee about 62 (the Martial Artist and the Assassin; they also
fall on the five-minute loop). The tanks don't take the least: the Druid 20, the Guardian 33, the Juggernaut 36. A melee
tank stands in every attack a ranged kit never meets; what sets the tanks apart is that they mitigate (the Guardian
55%, the Juggernaut 46%) and outlast (the Druid's lowest health 97%).
A) Restate the rules: tanks mitigate the most and outlast; the 3× spread holds among kits of the same reach. B) Give
the squishy melee some sustain (a new mechanic each). C) Keep the rules and cut the melee kits' exposure with guard
(changes what they are).
**Rec: A.** The pinned test already holds the tanks to mitigation and lowest health, and the squishy melee to a 4.5×
guard, until you decide.

**8. The guardian's pace.** On the shared bot the v2 kits bring it down in about 3 minutes (target 4–6; 2.5 at mastery
20, target 3.5–5). Its flat armour (7) turns every hit under about power 0.6 into 1, so the kits built on many small
hits (summons, totems, zones, the Priest's burns) take 5–8 minutes while big hitters take 2. The content pass's formula
for plain swings still reads 4.3–5.8.

| Guardian | Mastery 1 (range) | Mastery 20 | Falls of 192 | Plain swings |
|---|---|---|---|---|
| A. As built: health 1700, armour 7 | 3.2 (1.9–7.8) | 2.5 | 47 | 4.3–5.8 |
| B. Armour 4, health 2800, its hits ×0.75 | 4.0 (2.3–7.9) | 3.3 | 44 | 4.7–6.3 |
| C. Armour 4, health 3000, its hits ×0.75 | 4.4 (2.5–10.0) | 3.6 | 56 | 5.1–6.7 |
| D. Health 2600, its hits ×0.75 (armour 7) | 5.1 (2.8–13.1) | 4.1 | 61 | 6.6–8.8 |

**Rec: C**: the only option with both masteries in their bands, and the lower armour narrows the gap between small and
big hitters. It's content, not a kit number: a seeded row (`enemy_types`) and `lib/combat/content.ts`, as its own
migration. If item 3 goes to C, re-measure first: without wear every kit is about 20% faster on the guardian.

**9. Melee falls in the guardian fight.** The Guardian, the Martial Artist and the Assassin fall in every option above,
even with the guardian's hits at 0.6×. The bot is the main cause: it doesn't get behind the guardian for the beam or
kill the rune wisps first, which a member would. The pace column is measured at the damage rate, so it doesn't depend
on the falls.
A) Leave it to your playtest. B) Teach the bot to flank the beam and clear the wisps, then re-measure.
**Rec: A.** Your run on a melee kit says more than another bot rule.
