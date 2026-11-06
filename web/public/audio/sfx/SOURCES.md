# Volleyball sound sources

Every `vb-*.ogg` here is self-made: synthesised from sines and noise by `art/audio/synth_volleyball.py` (2026-10-30, redone 2026-11-01 for round 3 so
every sound has its own character; game/volleyball), with nothing fetched or sampled. They are released as CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/),
like the other synthesised cues (`bite*.ogg`, `art/audio/synth_bite.py`). The older files in this folder are credited in `../CREDITS.md`.

To rebuild: `python3 art/audio/synth_volleyball.py <wav dir> [<preview dir>]`, then encode each with
`ffmpeg -y -i <wav> -c:a vorbis -strict -2 -ac 2 -q:a 3 web/public/audio/sfx/<name>.ogg`.

| File | What it is | Source | Author | Licence |
|---|---|---|---|---|
| `vb-bump.ogg` | forearm pass: a rubbery bwomp that wobbles, a springy pop rising off it, a soft skin slap | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-set.ogg` | fingertip set: two light taps with a muted pluck under each, no bwomp | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-serve.ogg` | serve: an open-palm smack and a rising whoosh as the ball leaves | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-flame.ogg` | a perfect serve or spike catching fire: a fwoosh, a rising rumble and crackle | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-dig.ogg` | a dig's low scoop with sand grit | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-block.ogg` | block: two palm slaps a beat apart, a low wooden knock, a dead thump and a short grunted "oof" | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-spike.ogg` | spike: a whip crack, a deep driven boom and the air ripping after the ball | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-perfect.ogg` | perfect timing: a gold chime and sparkle | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-good.ogg` | good timing: a clean tick | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-early.ogg` | early timing: a thin brush and a quick blip rising | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-late.ogg` | late timing: a dull scuff and a blip falling | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-sand.ogg` | the ball dropping into sand (out of play) | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-boom.ogg` | a point's impact: sub boom and sand explosion | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-net.ogg` | the net: a long uneven cord rattle with the top band twanging high | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-tape.ogg` | the top tape's low twang and a tick | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-takeoff.ogg`, `vb-touchdown.ogg` | a jump's push off and landing in sand | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-dive.ogg` | a dive: a whoosh into a long sand spray and the body's thud | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-charge.ogg` | the serve meter's tick (re-pitched as it fills) | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-max.ogg` | max power: a bright bell burst | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-toss.ogg` | the toss's rising whoosh | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-whiff.ogg` | a miss: a hollow swish and a little sad womp falling away | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-point.ogg` | your point: a bright brass sting, three notes up with a shing | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-point-them.ogg` | their point: two soft notes down | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-win.ogg` | the win (round 4): a short victory jingle, four soft notes up to a held C6 over a bell chord, a twinkle after | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-call.ogg` | "Mine!" (round 4): a plain alert, two soft chime notes up (E5, A5) | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-out.ogg` | out: a referee's pea whistle, one short blast and one long | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-heat.ogg`, `vb-fire.ogg` | the rally heating up (round 4: a simple three-note blip up, C5 E5 G5); the ball catching fire | synth_volleyball.py | game/volleyball (Tethos) | CC0 |

## Coins

| File | What it is | Source | Author | Licence |
|---|---|---|---|---|
| `coin.ogg` | a coin landing in the wallet: a bright two-partial clink, a metal tick, a glint (played once per coin of a sale, rising) | self-made, `art/audio/synth_coin.py` (2026-11-02), synthesised from sines and noise, nothing fetched | game/fishing-depth (Tethos) | CC0 1.0 |
