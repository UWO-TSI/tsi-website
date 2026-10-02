# The 16 classes: brief (rows 286–290)

David, 2026-10-02: "I want to begin developing each of the 16 classes, ask me questions until you understand everything and can just develop and 1 shot."

## Decisions
- **Scope:** combat depth, visual identity and mastery progression for every subclass. No class questline.
- **Roles:** soft co-op roles for future multiplayer (tank, healer, damage, support); every subclass can still solo.
- **MBTI:**
  - The Oracle suggests one subclass per MBTI type (16 types, 16 subclasses, each inside its family by temperament).
  - You choose at level 10, and you're locked in until you pay to redo the Oracle and repick (250 coins, 7-day wait).
  - The separate subclass-change fee goes away.
  - Existing members keep their subclass, start at mastery 1, and get one free repick at launch.
- **Kits:**
  - Fully unique: 8 abilities per subclass, no family sharing.
  - Equip 4 on 1–4 (Z X C V preset), plus one **ultimate** on F.
  - The ult has a charge meter that fills from dealing and taking damage (about 60–90 s of fighting) and is the strongest hit in the kit.
- **Weapons:** a signature weapon type is required per subclass, and the kit is built around it. Weapon tiers still upgrade.
- **Mastery:**
  - Levels 1–20 per subclass, earned in the ruins (kills, missions, the boss) on the subclass you're playing, and kept when you switch away.
  - 4 abilities at the start; the other 4 and ability upgrades unlock by 20.
- **Identity:**
  - A signature weapon look (its own model and carry pose).
  - A subtle subclass aura.
  - A class icon and title on the nameplate and profile.
  - No class outfits or class emotes.
- **Cosmetics:** weapon skins, aura colours and nameplate frames in the shop. Mostly coins, some Gems; never reveal the Gem ≈ CAD rate.
- **VFX:**
  - "I want flashy anime epic vfx, huge ult attacks that are the strongest do impact frames. also include camera shakes and animation."
  - Every ability gets anime-style effects, an animation and camera feel.
  - Ults get full anime impact frames: a freeze, a high-contrast flash frame, radial speed lines, heavy shake and hitstop.
  - A "reduce flashing" setting.
  - Characters stay matte (row 264); magic glows.
- **Process:** a design sheet for all 16, which David approves in one pass, then one build.

## Where it stands
See the survey summary in `specs/classes/design-sheet.md` §0 once written. Today: 4 families × 4 subclasses in `web/lib/combat/kits.ts`; 2 shared family abilities per kit; flat-shape VFX; shared attack clips; no subclass identity outside the ruins; the shield and totem can't be obtained.
