"""The beach volleyball match's sounds (specs/minigames/beach-volleyball.md, David's approved effects plan 2026-10-30),
made here from sines and noise, never fetched (so they are ours, CC0, like synth_bite.py). A big inflatable beach ball
is a hollow vinyl skin: every hit is a skin slap over the air cavity's low "bwomp" and a little vinyl ping.

  python3 art/audio/synth_volleyball.py <wav dir> [<preview dir>]
     writes one .wav per sound into <wav dir> and, given a preview dir, the review previews (each effect and each
     contact's four timing grades, mixed as the game layers them) as .wav there
  then encode (mono Vorbis, small):
     for f in <wav dir>/vb-*.wav; do ffmpeg -y -i $f -c:a vorbis -strict -2 -ac 2 -q:a 3 web/public/audio/sfx/$(basename $f .wav).ogg; done

The game plays them through lib/game/volleyball/sfx.ts (which sound for which effect and grade, gains, pitch spread).
"""
import os, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
rng = np.random.default_rng(23)


def track(seconds):
    return np.arange(int(SR * seconds)) / SR


def env(t, at, attack, decay):
    s = t - at
    on = s >= 0
    s = np.where(on, s, 0)
    return np.minimum(1, s / max(attack, 1e-4)) * np.exp(-s / decay) * on


def band(x, lo, hi, order=2):
    lo = max(lo, 20); hi = min(hi, SR / 2 - 100)
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def low(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def high(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(n):
    return rng.standard_normal(n)


def glide(t, at, f0, f1, tau):
    """A sine whose pitch moves from f0 to f1 (exponentially, time constant tau) from `at`."""
    s = np.maximum(t - at, 0)
    f = f1 + (f0 - f1) * np.exp(-s / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (t >= at)


def ball(t, at, f, decay, slap, ping=0.25, slap_lo=1800, slap_hi=7000):
    """The beach ball struck: the cavity's bwomp (a falling low mode and its partner), the skin's slap, a vinyl ping."""
    y = glide(t, at, f * 1.35, f, 0.03) * env(t, at, 0.0015, decay)
    y += 0.35 * glide(t, at, f * 2.4, f * 2.25, 0.02) * env(t, at, 0.001, decay * 0.45)
    y += ping * np.sin(2 * np.pi * f * 5.3 * np.maximum(t - at, 0)) * env(t, at, 0.0008, 0.025)
    y += slap * band(noise(len(t)), slap_lo, slap_hi) * env(t, at, 0.0005, 0.012)
    return y


def sand(t, at, length, gain, lo=500, hi=4500, grains=180, decay=None):
    """Sand thrown: band-passed noise broken into grains (a spray, not a hiss)."""
    n = band(noise(len(t)), lo, hi)
    g = np.zeros(len(t))
    for _ in range(grains):
        w = at + rng.uniform(0, length) ** 1.6 / max(length, 1e-3) ** 0.6
        g += env(t, w, 0.001, rng.uniform(0.004, 0.018)) * rng.uniform(0.3, 1)
    g = low(g, 400)
    shape = env(t, at, 0.004, decay or length * 0.5)
    return gain * n * (0.35 + g / (np.max(g) + 1e-9)) * shape


def mallet(t, at, f, decay, gain, bright=0.3):
    """A soft marimba note: the fundamental and its 4th partial, which dies first."""
    s = np.maximum(t - at, 0)
    y = np.sin(2 * np.pi * f * s) * env(t, at, 0.002, decay)
    y += bright * np.sin(2 * np.pi * f * 3.93 * s) * env(t, at, 0.001, decay * 0.18)
    return gain * y


def bell(t, at, f, decay, gain):
    out = np.zeros_like(t)
    for mul, g, d in ((1, 1, 1), (2.0, 0.45, 0.6), (2.76, 0.3, 0.45), (5.4, 0.14, 0.25)):
        out += g * np.sin(2 * np.pi * f * mul * np.maximum(t - at, 0)) * env(t, at, 0.0015, decay * d)
    return gain * out


def sparkles(t, at, length, count, lo, hi, gain):
    out = np.zeros_like(t)
    for i in range(count):
        when = at + length * (i / count) + rng.uniform(0, length / count)
        f = rng.uniform(lo, hi) * (1 + 0.4 * i / count)
        out += np.sin(2 * np.pi * f * np.maximum(t - when, 0)) * env(t, when, 0.001, 0.04) * rng.uniform(0.5, 1)
    return gain * out


def sweep(t, at, length, f0, f1, q, gain):
    """Air moving: noise through a band whose centre moves from f0 to f1 (a whoosh), in short blocks."""
    y = np.zeros(len(t))
    n = noise(len(t))
    blocks = 24
    for i in range(blocks):
        a, b = at + length * i / blocks, at + length * (i + 1) / blocks
        f = f0 * (f1 / f0) ** (i / (blocks - 1))
        seg = (t >= a) & (t < b + 0.01)
        if seg.any():
            part = band(n, f / q, f * q)
            w = np.clip(np.minimum((t - a) / 0.004, (b + 0.01 - t) / 0.01), 0, 1)
            y += part * w * seg
    shape = np.sin(np.pi * np.clip((t - at) / length, 0, 1)) ** 1.5
    return gain * y * shape


def room(y, length, decay, wet):
    n = int(SR * length)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * decay))
    size = len(y) + n
    w = np.fft.irfft(np.fft.rfft(y, size) * np.fft.rfft(ir, size), size)[: len(y)]
    return y + wet * w / (np.max(np.abs(w)) + 1e-9) * np.max(np.abs(y))


SOUNDS = {}


def write(name, y, peak):
    fade = np.minimum(1, (len(y) - np.arange(len(y))) / (SR * 0.04))
    y = high(y * fade, 35)
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    SOUNDS[name] = y
    path = os.path.join(OUT, f"{name}.wav")
    save(path, y)
    print("wrote", path, f"{len(y) / SR:.2f}s peak {peak}")


def save(path, y):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())


# ── Contacts: one body per kind ─────────────────────────────────────────────

t = track(0.4)
# Bump: forearms, a broad dull slap and a round bwomp.
write("vb-bump", room(ball(t, 0, 165, 0.11, 0.55, 0.15, 900, 4500), 0.18, 0.04, 0.12), 0.8)
# Set: fingertips, two quick light pokes (the hands give), higher.
write("vb-set", room(ball(t, 0, 230, 0.07, 0.35, 0.3, 2500, 8000) + 0.55 * ball(t, 0.018, 250, 0.05, 0.25, 0.2, 2500, 8000), 0.16, 0.04, 0.12), 0.7)
# Serve: an open palm, a smack.
write("vb-serve", room(ball(t, 0, 190, 0.12, 1.0, 0.25, 1500, 7000), 0.2, 0.05, 0.14), 0.85)
# Dig: a scoop off the sand, low, with grit.
write("vb-dig", room(ball(t, 0, 140, 0.1, 0.4, 0.1, 700, 3500) + sand(t, 0.005, 0.18, 0.35), 0.16, 0.04, 0.1), 0.75)
# Block: hands as a wall, a dense low thump with a slap.
t = track(0.5)
y = ball(t, 0, 120, 0.14, 0.8, 0.12, 900, 5000) + 0.6 * glide(t, 0, 90, 60, 0.05) * env(t, 0, 0.002, 0.12)
write("vb-block", room(y, 0.22, 0.06, 0.16), 0.9)
# Spike: a crack (a hard broadband slap), a boomy cavity and the air ripping after it.
t = track(0.6)
y = ball(t, 0, 150, 0.13, 1.6, 0.35, 1200, 9000) + 0.7 * glide(t, 0, 110, 55, 0.04) * env(t, 0, 0.001, 0.09)
y += 0.25 * high(noise(len(t)), 3000) * env(t, 0, 0.0002, 0.004)
y += sweep(t, 0.02, 0.32, 2400, 700, 1.6, 0.28)
write("vb-spike", room(y, 0.3, 0.08, 0.18), 0.95)

# ── Timing grade layers (on top of the body) ────────────────────────────────

# Perfect: gold, a bright chime (E6 and B6) with sparkle.
t = track(0.7)
y = bell(t, 0.008, 1318.5, 0.32, 0.55) + bell(t, 0.03, 1975.5, 0.26, 0.4) + sparkles(t, 0.03, 0.3, 12, 3000, 5500, 0.12)
write("vb-perfect", room(y, 0.4, 0.12, 0.3), 0.6)
# Good: a clean short tick, nothing more.
t = track(0.15)
write("vb-good", mallet(t, 0.004, 1567.98, 0.05, 1, 0.5), 0.35)
# Early: a thin, dull brush that rises (the hands got there first): desaturated, soft.
t = track(0.3)
y = low(sweep(t, 0, 0.18, 600, 1600, 1.4, 1), 2200) + 0.4 * glide(t, 0, 330, 420, 0.06) * env(t, 0, 0.004, 0.06)
write("vb-early", y, 0.32)
# Late: a muffled scuff that falls (the ball got there first): dull, soft.
y = low(noise(len(t)), 900) * env(t, 0, 0.003, 0.05) + 0.7 * glide(t, 0, 200, 110, 0.05) * env(t, 0, 0.002, 0.09)
write("vb-late", y, 0.34)

# ── The sand, the net ───────────────────────────────────────────────────────

# The ball landing in play: a soft thud into sand.
t = track(0.45)
y = ball(t, 0, 120, 0.07, 0.2, 0.05, 400, 2500) + sand(t, 0.003, 0.25, 0.7, 400, 4000, 90)
write("vb-sand", room(y, 0.2, 0.05, 0.12), 0.7)
# A point's impact: a sub boom, the ball's thud and a sand explosion falling back.
t = track(1.3)
y = 1.5 * glide(t, 0, 95, 38, 0.09) * env(t, 0, 0.002, 0.28) + ball(t, 0, 115, 0.09, 0.5, 0.05, 600, 3000)
y += sand(t, 0.006, 0.55, 1.0, 350, 5000, 360, 0.3) + 0.5 * sand(t, 0.35, 0.8, 0.5, 900, 6000, 220, 0.35)
write("vb-boom", room(y, 0.5, 0.14, 0.2), 0.95)
# The net: cords catching the ball, a rattle and a soft swallowed thud.
t = track(0.55)
y = band(noise(len(t)), 900, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 34 * t) ** 2) * env(t, 0, 0.004, 0.14)
y += 0.6 * glide(t, 0, 140, 90, 0.05) * env(t, 0, 0.003, 0.08)
write("vb-net", room(y, 0.25, 0.06, 0.15), 0.6)
# The tape: a taut band's twang (plucked, Karplus-Strong) and a tick.
t = track(0.5)
period = int(SR / 196)
buf = rng.uniform(-1, 1, period)
y = np.zeros(len(t))
for i in range(len(t)):
    y[i] = buf[i % period]
    buf[i % period] = 0.993 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
y = low(y, 2400, 4) * env(t, 0, 0.001, 0.2) + 0.12 * band(noise(len(t)), 2000, 5000) * env(t, 0, 0.0004, 0.005)
write("vb-tape", y, 0.5)

# ── Bodies on sand ──────────────────────────────────────────────────────────

t = track(0.3)
write("vb-takeoff", sand(t, 0, 0.12, 1, 300, 3500, 70, 0.07) + 0.4 * glide(t, 0, 120, 80, 0.03) * env(t, 0, 0.002, 0.04), 0.42)
t = track(0.35)
write("vb-touchdown", sand(t, 0.002, 0.16, 1, 250, 3000, 90, 0.08) + 0.7 * glide(t, 0, 100, 60, 0.03) * env(t, 0, 0.002, 0.06), 0.5)
t = track(0.7)
write("vb-dive", room(sand(t, 0.01, 0.45, 1, 400, 5000, 260, 0.22) + 0.6 * glide(t, 0.02, 110, 60, 0.04) * env(t, 0.02, 0.003, 0.08), 0.2, 0.05, 0.1), 0.62)
t = track(1.0)
y = sand(t, 0.0, 0.75, 1, 300, 4500, 420, 0.4) + 0.4 * sweep(t, 0, 0.6, 1800, 600, 1.5, 1)
write("vb-slide", room(y, 0.25, 0.06, 0.12), 0.66)

# ── The serve ───────────────────────────────────────────────────────────────

# The charge: a little wooden tick, re-pitched up the meter as it fills (sfx.ts plays it every ~0.1 s).
t = track(0.12)
write("vb-charge", mallet(t, 0, 880, 0.04, 1, 0.6), 0.3)
# Max power: a bright burst (a fifth's chord on bells) with a sparkle and a lift.
t = track(1.0)
y = bell(t, 0, 1046.5, 0.45, 0.5) + bell(t, 0.02, 1568, 0.4, 0.45) + bell(t, 0.04, 2093, 0.35, 0.35)
y += sparkles(t, 0.02, 0.55, 26, 2800, 6000, 0.14) + 0.4 * sweep(t, 0, 0.35, 500, 3500, 1.5, 1)
write("vb-max", room(y, 0.6, 0.18, 0.35), 0.62)
# The toss: a soft rising whoosh.
t = track(0.45)
write("vb-toss", sweep(t, 0, 0.38, 380, 1500, 1.5, 1), 0.28)
# A whiff: a quick swish of air, falling.
t = track(0.25)
write("vb-whiff", sweep(t, 0, 0.18, 2200, 700, 1.6, 1), 0.3)

# ── Moments ─────────────────────────────────────────────────────────────────

# Your point: three mallet notes up (G5, C6, E6) and a bell on the top.
t = track(1.0)
y = mallet(t, 0, 783.99, 0.22, 0.7) + mallet(t, 0.08, 1046.5, 0.22, 0.7) + mallet(t, 0.16, 1318.5, 0.4, 0.8) + bell(t, 0.16, 2637, 0.3, 0.12)
write("vb-point", room(y, 0.5, 0.15, 0.3), 0.6)
# Their point: two soft notes down (E5, C5), quieter.
t = track(0.8)
y = mallet(t, 0, 659.25, 0.2, 0.6, 0.15) + mallet(t, 0.12, 523.25, 0.32, 0.6, 0.15)
write("vb-point-them", room(y, 0.4, 0.12, 0.25), 0.4)
# The win: a cozy fanfare, an arpeggio up (C major) to a held chord with bells and a sparkle, ~2 s.
t = track(2.4)
y = np.zeros(len(t))
for i, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
    y += mallet(t, 0.11 * i, f, 0.3, 0.6)
for f in (523.25, 659.25, 783.99, 1046.5, 1318.5):
    y += mallet(t, 0.5, f, 0.9, 0.35, 0.2) + mallet(t, 0.5, f * 1.003, 0.9, 0.2, 0)
y += bell(t, 0.5, 2093, 0.8, 0.25) + bell(t, 0.62, 2637, 0.7, 0.2) + sparkles(t, 0.5, 1.2, 36, 2600, 5500, 0.08)
write("vb-win", room(y, 1.0, 0.3, 0.4), 0.7)
# "Mine!": a bubble pop and a bright blip.
t = track(0.25)
y = glide(t, 0, 420, 1250, 0.02) * env(t, 0, 0.001, 0.035) + mallet(t, 0.03, 1760, 0.06, 0.5, 0.2)
write("vb-call", y, 0.42)
# Out: a soft referee's whistle, one short blast.
t = track(0.5)
s = np.maximum(t, 0)
f = 2650 * (1 + 0.012 * np.sin(2 * np.pi * 28 * s))
tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR)
shape = np.clip(np.minimum(s / 0.02, (0.34 - s) / 0.06), 0, 1)
y = (tone * 0.8 + 0.25 * band(noise(len(t)), 2000, 6000)) * shape
write("vb-out", room(low(y, 5000), 0.25, 0.06, 0.15), 0.3)

# ── The rally's heat ────────────────────────────────────────────────────────

# A rising shimmer as the rally grows (sfx.ts plays it every few touches, higher each time).
t = track(0.8)
y = sum(np.sin(2 * np.pi * f * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)) for f in (659.25, 987.77, 1318.5)) / 3
y = y * np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 2 + 0.3 * sweep(t, 0, 0.75, 800, 3000, 1.4, 1)
write("vb-heat", room(y, 0.4, 0.12, 0.3), 0.26)
# The ball catches fire: a whoosh igniting, with crackle.
t = track(0.9)
y = low(noise(len(t)), 1200) * np.sin(np.pi * np.clip(t / 0.8, 0, 1)) ** 0.7 * 0.7
for _ in range(30):
    w = rng.uniform(0.1, 0.8)
    y += 0.25 * band(noise(len(t)), 1800, 5000) * env(t, w, 0.0003, 0.004)
y += 0.4 * sweep(t, 0, 0.5, 300, 1600, 1.5, 1)
write("vb-fire", low(y, 5500), 0.45)

# ── Previews for the review: each effect as sfx.ts layers it ────────────────

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)

    def mix(parts, length=None):
        n = max(int(at * SR) + len(SOUNDS[name]) for name, at, g in parts)
        y = np.zeros(n)
        for name, at, g in parts:
            s = SOUNDS[name]
            i = int(at * SR)
            y[i:i + len(s)] += g * s
        return y

    # Early and late play the body softer and duller (sfx.ts: a lower gain and a slower or faster rate); a rate here is
    # a resample.
    def rate(y, r):
        idx = np.arange(0, len(y) - 1, r)
        return np.interp(idx, np.arange(len(y)), y)

    GRADE = {"perfect": (1.0, 1.0, "vb-perfect", 0.9), "good": (0.9, 1.0, "vb-good", 0.7), "early": (0.6, 1.07, "vb-early", 0.9), "late": (0.6, 0.9, "vb-late", 0.9)}
    for kind in ("bump", "set", "serve", "dig", "block", "spike"):
        for grade, (g, r, layer, lg) in GRADE.items():
            body = rate(SOUNDS[f"vb-{kind}"], r) * g
            lay = SOUNDS[layer] * lg
            n = max(len(body), len(lay))
            y = np.zeros(n); y[:len(body)] += body; y[:len(lay)] += lay
            save(os.path.join(PREVIEW, f"contact-{kind}-{grade}.wav"), y * 0.9)
    singles = {
        "sand-impact-point": [("vb-boom", 0, 1.0)], "ball-lands": [("vb-sand", 0, 0.9)], "net-ripple": [("vb-net", 0, 0.9)], "tape": [("vb-tape", 0, 0.9)],
        "jump": [("vb-takeoff", 0, 0.9), ("vb-touchdown", 0.95, 0.9)], "dive-saved": [("vb-dive", 0, 0.9), ("vb-dig", 0.08, 0.8), ("vb-good", 0.09, 0.6)],
        "slide-dive": [("vb-slide", 0, 0.9), ("vb-dig", 0.18, 0.8)],
        "serve-charge-max": [*((("vb-charge", 0.1 * i, 0.9)) for i in range(10)), ("vb-max", 1.0, 0.9), ("vb-toss", 1.15, 0.9), ("vb-serve", 1.9, 0.9), ("vb-perfect", 1.9, 0.9)],
        "whiff": [("vb-whiff", 0, 0.9)], "point-yours": [("vb-boom", 0, 0.8), ("vb-point", 0.15, 0.8)], "point-theirs": [("vb-boom", 0, 0.6), ("vb-point-them", 0.15, 0.8)],
        "win": [("vb-win", 0, 0.9)], "mine-call": [("vb-call", 0, 0.9)], "out": [("vb-sand", 0, 0.7), ("vb-out", 0.2, 0.9)],
        "rally-heat": [("vb-heat", 0, 0.8), ("vb-heat", 0.9, 0.9), ("vb-fire", 1.8, 0.9)],
        "block": [("vb-block", 0, 0.9), ("vb-perfect", 0, 0.7), ("vb-boom", 0.35, 0.6)],
    }
    # The charge ticks rise through the meter in the preview as in the game.
    for name, parts in singles.items():
        if name == "serve-charge-max":
            ticks = [rate(SOUNDS["vb-charge"], 0.8 + i * 0.1) for i in range(10)]
            y = mix([p for p in parts if p[0] != "vb-charge"])
            for i, tk in enumerate(ticks):
                j = int(0.1 * i * SR); y[j:j + len(tk)] += 0.9 * tk[: len(y) - j]
        else:
            y = mix(parts)
        save(os.path.join(PREVIEW, f"{name}.wav"), y / max(1, np.max(np.abs(y))) * 0.95)
    print("previews in", PREVIEW)
