# SFX style sheet (asset pipeline §2)

This is the one reference every ElevenLabs sound prompt starts with. It was written on 2026-11-19 from David's notes on SFX Library 1 and 2.

## The feel, in David's words

- "rounded so its easy on the ear"
- "softer and pleasing to the ear"
- "less harsh on the ear"
- "smoother more satisfying for the ear"
- "more bassy earthy feel"
- "lighter and more soft and rounder"
- Rewards go the other way: "should be more epic cuz its gems", "a lil more epic and sustained and longer and spaced out", "more poppy sound like a minecraft pop sound effect".

## For the sound model (paste verbatim at the start of every prompt)

Cozy island life-sim game sound effect, in the gentle, satisfying style of Animal Crossing and Stardew Valley. Soft, rounded and warm, easy on the ear: no harsh high frequencies, no clicks or crackle, no distortion, no realistic grit. Clean and close, a dry studio recording with a soft natural tail and no reverb wash. Pleasant and toy-like, with natural materials (wood, water, sand, leaves, glass, little bells). A single clear sound with no music and no voices.

## Categories

| Category | Character | Length | Loudness (loudest 400 ms) |
|---|---|---|---|
| UI | tiny, soft wooden or glassy, a gentle pitch | 0.03 to 0.3 s | -20 |
| Actions | physical, soft, natural, low-mid weight | 0.2 to 1.5 s | -18 |
| Rewards | bright but round, chimes and bells that ring out, the epic ones sustained and layered | 0.5 to 2.5 s | -16 |
| Footsteps | soft, bassy, rounded, four variants per surface | 0.15 to 0.3 s | -26 integrated as a walk |
| Ambience | light, distant, no static or hiss bed, seamless 24 to 30 s loops | 24 to 30 s | -26 integrated |

True peak is at most -3 dBFS everywhere.

## Processing every sound gets (the same chain, so they belong together)

1. Trim the silence: 2 ms kept and faded in, a 10 to 25 ms fade out.
2. High-pass at 60 Hz (one-shots) or 30 Hz (ambience).
3. A gentle high shelf, -3 dB above 8 kHz. Down to -6 dB on any sound whose spectral centroid is over 4 kHz, which is the harshness David hears.
4. Level to the category's loudness, with a lookahead limiter at -4.2 dBFS.
5. 48 kHz Ogg Vorbis. One-shots mono content at quality 5; ambience stereo at quality 4.
