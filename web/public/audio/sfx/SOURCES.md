# Volleyball sound sources

Every `vb-*.ogg` here is self-made: synthesised from sines and noise by `art/audio/synth_volleyball.py` (2026-10-30,
game/volleyball), with nothing fetched or sampled. They are released as CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/),
like the other synthesised cues (`bite*.ogg`, `art/audio/synth_bite.py`). The older files in this folder are credited in `../CREDITS.md`.

To rebuild: `python3 art/audio/synth_volleyball.py <wav dir> [<preview dir>]`, then encode each with
`ffmpeg -y -i <wav> -c:a vorbis -strict -2 -ac 2 -q:a 3 web/public/audio/sfx/<name>.ogg`.

| File | What it is | Source | Author | Licence |
|---|---|---|---|---|
| `vb-bump.ogg` | forearm pass: a broad slap over the ball's low bwomp | synth_volleyball.py | game/volleyball (Tethos) | CC0 |
| `vb-set.ogg` | fingertip set: two quick light pokes | synth_volleyball.py | game/volleyball | CC0 |
| `vb-serve.ogg` | open-palm serve smack | synth_volleyball.py | game/volleyball | CC0 |
| `vb-dig.ogg` | a dig's low scoop with sand grit | synth_volleyball.py | game/volleyball | CC0 |
| `vb-block.ogg` | a block's dense thump | synth_volleyball.py | game/volleyball | CC0 |
| `vb-spike.ogg` | the spike's crack, boom and air | synth_volleyball.py | game/volleyball | CC0 |
| `vb-perfect.ogg` | perfect timing: a gold chime and sparkle | synth_volleyball.py | game/volleyball | CC0 |
| `vb-good.ogg` | good timing: a clean tick | synth_volleyball.py | game/volleyball | CC0 |
| `vb-early.ogg` | early timing: a thin rising brush | synth_volleyball.py | game/volleyball | CC0 |
| `vb-late.ogg` | late timing: a dull falling scuff | synth_volleyball.py | game/volleyball | CC0 |
| `vb-sand.ogg` | the ball into sand (out of play) | synth_volleyball.py | game/volleyball | CC0 |
| `vb-boom.ogg` | a point's impact: sub boom and sand explosion | synth_volleyball.py | game/volleyball | CC0 |
| `vb-net.ogg` | the net's cords catching the ball | synth_volleyball.py | game/volleyball | CC0 |
| `vb-tape.ogg` | the top tape's twang | synth_volleyball.py | game/volleyball | CC0 |
| `vb-takeoff.ogg`, `vb-touchdown.ogg` | a jump's push off and landing in sand | synth_volleyball.py | game/volleyball | CC0 |
| `vb-dive.ogg`, `vb-slide.ogg` | a dive's and a slide dive's sand spray | synth_volleyball.py | game/volleyball | CC0 |
| `vb-charge.ogg` | the serve meter's tick (re-pitched as it fills) | synth_volleyball.py | game/volleyball | CC0 |
| `vb-max.ogg` | max power: a bright bell burst | synth_volleyball.py | game/volleyball | CC0 |
| `vb-toss.ogg`, `vb-whiff.ogg` | the toss's rising whoosh; a missed swing | synth_volleyball.py | game/volleyball | CC0 |
| `vb-point.ogg`, `vb-point-them.ogg` | your point's three notes up; theirs, two soft notes down | synth_volleyball.py | game/volleyball | CC0 |
| `vb-win.ogg` | the win's short fanfare | synth_volleyball.py | game/volleyball | CC0 |
| `vb-call.ogg` | "Mine!": a pop and a blip | synth_volleyball.py | game/volleyball | CC0 |
| `vb-out.ogg` | out: one soft whistle | synth_volleyball.py | game/volleyball | CC0 |
| `vb-heat.ogg`, `vb-fire.ogg` | the rally heating up; the ball catching fire | synth_volleyball.py | game/volleyball | CC0 |
