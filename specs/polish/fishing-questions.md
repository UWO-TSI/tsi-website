# Fishing polish: questions for David

From the fishing pass (`specs/polish/fishing.md`, branch `game/polish-fishing`). Each question has a recommended default; the build already runs on that default unless it says otherwise. Evidence is in `specs/evidence/polish-fishing/`.

## Your open calls (rows 136, 151, 195; `specs/david-decisions.md` #6–#8)

**1. Keep the fishing line?** Built behind a flag, on by default: Settings › You on the island › Fishing line. The bobber hangs from the rod's tip through the wind-up, the line pays out in flight, hangs slack and sways with the wind as it floats, goes tight and hums through the bite and the reel, and twangs slack when a fish gets away. It's drawn on the angler's own rod, about a pixel wide at any distance (it survives the pixel finish). Evidence: `03-line-on-off.webp`.
- A) Keep it, on for everyone; remove the toggle. B) Keep the toggle, on by default. C) Off by default. D) Remove it.
- **Rec: A.** The rod is already in the hand (row 279), and a rod with no line is the odd one out. The toggle was only there for this decision.

**2. Hold the catch up?** Built behind a flag, on by default: Settings › You on the island › Hold up my catch. You turn to the camera and hold the fish up in both hands at the chin while its card is up, then cheer as it's tucked into the bag. With it off, the fish turns over your head instead. Evidence: `04-holdup-on-off.webp`.
- A) Keep it, on for everyone; remove the toggle. B) Keep the toggle, on by default. C) Over the head for everyone.
- **Rec: A.** It's the cozy catch beat (Animal Crossing's). Arms this short can't reach over the head, so the chin is the highest hold that reads.

**3. Fish shadows in the water?** Not built (the brief said to ask).
- A) No shadows; the leaping fish are the only sign of life. B) A shadow only near the bobber, as the bite's warning. C) Ambient shadows everywhere.
- **Rec: A.** Row 195 wants no marked spots, and visible shadows would mark them. B is the only version that would add to the cast without marking spots, if you want one.

**4. How loud is the catch reveal?** Built: the cream card for every catch (A), as the brief said. The decisions list recommends B.
- A) The cream card for every catch: first catches develop from a silhouette, with soft paper confetti from rare up. No rays, no blur. (Built.) B) The same card, plus a bigger moment for rare and up: more confetti and a soft glow round the card, still no rays or takeover. C) The old gacha takeover for first catches.
- **Rec: A, with B's glow as a later option.** The fish is now shown in your hands, and a takeover would hide it again. Rarer catches already wait longer, stay longer and throw more confetti. Before and after: `06-reveal-before-after.webp`; every rarity: `05-reveal-per-rarity.webp`.

## Sounds (no sound source picked yet, `specs/polish/README.md` waiting #1)

**5. The missing sounds.** I wired only what exists and removed every dialogue blip and door sound from fishing. Silence stands in where nothing fits.

| Moment | Plays now | Wanted |
|---|---|---|
| Cast (the swing) | nothing; the gold-tip max cast plays the meter's `confirm` | a rod whoosh, longer for a harder cast |
| The line paying out | nothing | a reel's line zip |
| The bobber landing | nothing (was the `blip2` dialogue blip) | a plop, sized by the throw |
| A nibble | nothing (was `blip1`) | a soft tick or plip |
| The bite | `confirm`, as the "!"'s alert (the one cue a bite has) | a splash; the "!" could keep a light pop |
| The hook (the yank) | nothing (was `click`) | a line zip, tight |
| Reeling | the bar knocking the track's end: a soft `click` | a reel ratchet loop that speeds up while held |
| The fish getting away | nothing (was the `exit` door) | a line snap, or a slack twang and a small splash |
| The catch out of the water | nothing | a big splash |
| The catch card | `confirm` as it develops | a catch jingle per rarity: six short stings from common to Sea King |
| The bobber reeled home | nothing | a short reel spin |

- **Rec:** CC0 packs first (free, now), generated ones later for the jingles if they don't fit. Normalise them to the set (`web/public/audio/sfx/MANIFEST.md`). Then swap the bite's `confirm` for the splash.
- **Also seen:** the Bag button's fly-in lands with `blip1`, a dialogue blip (`components/game/BagButton.tsx`, the backpack's). A fish now goes into the bag as its card closes, so that blip plays at the end of every catch. **Rec:** the same "pickup pop" the audit lists, in the sound pass.

## Smaller calls

**6. The applicant island.** It still runs the old fishing (parked; its files are off limits to this pass). It now has the new float and the painted water, and its over-head fish stays up for as long as the card does. It has no rod in hand, so no line and no hold-up. **Rec:** leave it until the island application is revived.

**7. The Golden Arowana model stands on a trophy plinth** (`web/public/assets/acnh/fish/golden-arowana.glb`), so the plinth shows up in your hands and over your head. **Rec:** re-export the fish without its stand (art).

**8. Sea King is vacant** (no fish yet). Its badge is the one holographic rarity, and it's only been seen on the lab bench. **Rec:** keep it ready for your marquee fish.

**9. Casting on the member island is click or tap, never E** (E stays as interact; specs/game-ui.md). The meter, the hook hint and the reel's help now name the device that started the cast: "Hold the click", "Keep holding", or "Hold E" on the applicant island. **Rec:** keep it.

**10. How big a catch looks.** Its length comes from its size in cm: about 0.6 units for a 10 cm dace, 0.8 for a 40 cm bass, and up to 1.1 for the giants (the character is 1.36 tall). **Rec:** keep it. Real scale would make the giants three times your height.

**11. Other players' lines (for multiplayer).** The line toggle only changes how this device draws every angler's line. Hold up my catch travels with the cast, so everyone sees the same hold-up. **Rec:** keep it that way.
