# Art direction from the Oct 17 reviews (David) — row 314

## The rule
- **Style:** "simpler slightly smoother animal crossing style asset that is a little more cartoony."
- **Textures:** subtle, not strong; low-contrast detail and soft lines; nothing dark or squiggly.
- **Keep the old where ours isn't clearly better.**
  - Where the old (ACNH dump) version has more charm ("soul"), keep it or tweak it lightly, rather than replacing it.
  - Note: David was told on 2026-10-15 that shipping dump assets publicly carries a takedown risk. Keeping these is his call.
- **Performance first:** "with the pixel effect it's not noticeable to begin with, so might as well keep it easy to run." Don't add texture cost the pixel finish hides.

## Decisions by item
**Approved:**
- ground: grass, sand (brighter), soil path, water ripple and glint;
- trees: cedar and snow cedar, the eight flowers;
- wardrobe batch 2: the faces;
- quick wins: log bench, monument sign;
- the shop layout, now going two floors (merch upstairs).

**Ground:**
- The bridge and boardwalk planks keep the old texture.
- Plaza stone, the stone road and cliff go back to the old: "too dark and the lines are too dark... I like the old subtle version... I don't like how squiggly the line is."
- Winter keeps the old textures: "keep the old texture for a lot of them because with the pixel effect it's not noticeable."

**Broadleaf trees:** "the trunk shape needs to be wider and the mapping of the leaves should be similar, I really like the dump version of the trees, so make it as close to it as you can, the new ones don't have the same vibe." This applies to the round, wide and tall trees.

**Wardrobe batch 2:**
- **Hairs:**
  - #24 sits lower.
  - Improve the hair texture to keep the source's matte look with subtle gloss and its strand detail ("ours looks like one 3D model").
  - #22's hat becomes a separate accessory.
- **Accessories:**
  - #01 bigger, covering the hair.
  - #02 rotated so the leaf faces the camera.
  - #04 properly on the head.
  - #07 smaller and lower.
  - #10 slightly more centred.
  - #11's mapping is off, so put it on the eye.
  - #14, #19: lower.
  - #18 bigger and higher; it blends with the hair.
  - #20 shows some hair under it.
  - #24 has hair poking out.
  - **Delete #12 and #13** (duplicates of #10 and #07).
- **Hats blended with hair:** #01, #04, #18, #21, #22, #23, #24.
- **Shrunk items:** unshrink.
- **Why the accessories sit where they do (round 3, David asked):** their positions are estimates. Each one is seat-fitted onto the head and hair by `art/characters/accessories/import_roblox.py` (rule `fit`, `provisional: true`), because the real Roblox attachment values (each accessory's attachment Position and Orientation in Studio) aren't available to us. David's tweaks are `override` offsets and scales on top of the estimate. When David sends the Studio values, they go into `art/characters/accessories/roblox_attachments.json` (`position`, `orientation`, `provisional: false`), and the build script places every item the way Roblox does. The hairs work the same way (`art/characters/hair/roblox_attachments.json`, `import_hair.py`).

**Reflection creator:**
- the boat angled slightly downward, more natural;
- the reflection shows the body over the side more realistically, with hands holding the edge;
- the water keeps light textures, fish swim under it, and small natural waves move;
- every selection sends a small wave that carries the change.

**Quick wins:**
- **Bridge:** simpler, like the Animal Crossing one, with bigger wood stumps; simple and cartoony.
- **HQ board:** keep the old metal board, which fits the interior, with less texture. David will supply designs for the paper stickies, so ask him.
- **Parasol:** "keep the old lounge chair and the slightly tilted umbrella with its gloss; just tweak the old dump slightly so there are colours instead of only orange".
- **Plaza boards:** "I like the old bulletin board, no cork, just plain, more notes on it, the subtle lighter texture and build of the old board."
- **Tree fruit:** "old fruits are way better, it has soul... they aren't just balls". Match that, or keep the old.
