"""The beach volleyball match's sounds (specs/minigames/beach-volleyball.md, David's approved effects plan 2026-10-30),
made here from sines and noise, never fetched (so they are ours, CC0, like synth_bite.py). Round 3 (David: "all the
sound effects sound the same"): each contact and moment has its own character, not one thud re-pitched: the bump a
rubbery bwomp, the set a fingertip double tap, the serve a smack and whoosh, the block a double slap and knock with a
grunt, the spike a whip crack and boom; a whistle for out, brass for a point. Round 4: the call a plain two-note
alert, the heat a simple three-note blip, the win a short jingle (their old versions' draws are burned, so the rest
come out the same).

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


def room(y, length, decay, wet, r=None):
    n = int(SR * length)
    ir = (r or rng).standard_normal(n) * np.exp(-np.arange(n) / (SR * decay))
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


def phase_of(f):
    return 2 * np.pi * np.cumsum(f) / SR


def pluck(t, at, f, keep=0.993, cut=2400):
    """A taut string or band plucked (Karplus-Strong): a twang that rings and dulls."""
    period = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, period)
    y = np.zeros(len(t))
    start = int(at * SR)
    for i in range(start, len(t)):
        j = (i - start) % period
        y[i] = buf[j]
        buf[j] = keep * 0.5 * (buf[j] + buf[(j + 1) % period])
    return low(y, cut, 4)


def voice(t, at, f0, formants, length, gain=1.0):
    """A synthesised vowel: a buzzy pulse train (pitch f0, an array over t or a number) through formant bands.
    `formants` is a list of (start Hz, end Hz, gain); the bands glide from start to end over `length`."""
    f = np.full(len(t), float(f0)) if np.isscalar(f0) else f0
    ph = phase_of(f) % (2 * np.pi)
    src = (ph / np.pi - 1) * (t >= at)
    src += 0.15 * noise(len(t))
    out = np.zeros(len(t))
    blocks = 16
    for lo_f, hi_f, g in formants:
        for i in range(blocks):
            a, b = at + length * i / blocks, at + length * (i + 1) / blocks
            fc = lo_f + (hi_f - lo_f) * (i / (blocks - 1))
            seg = (t >= a) & (t < b + 0.008)
            if seg.any():
                w = np.clip(np.minimum((t - a) / 0.004, (b + 0.008 - t) / 0.008), 0, 1)
                out += g * band(src, fc * 0.85, fc * 1.15) * w * seg
    return gain * out


def brass(t, at, f, dur, gain, bright=2600):
    """A soft synth brass note: three detuned saws, a quick swell, a filter that opens on the attack."""
    s = np.maximum(t - at, 0)
    y = np.zeros(len(t))
    for d in (0.997, 1.0, 1.004):
        ph = (f * d * s) % 1
        y += 2 * ph - 1
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * s) * np.clip((s - 0.15) / 0.2, 0, 1)
    y = np.interp(np.arange(len(t)) * 1.0, np.arange(len(t)) * vib, y)
    shape = np.clip(s / 0.015, 0, 1) * np.clip((at + dur - t) / 0.08 + 1, 0, 1) * (t >= at)
    shape *= 0.75 + 0.25 * np.exp(-s / 0.08)
    return gain * low(y * shape, bright, 2)


def hiss(t, at, lo, decay, gain, attack=0.0004):
    return gain * high(noise(len(t)), lo) * env(t, at, attack, decay)


def burn(*draws):
    """Draw what a retired sound drew from the shared noise stream (round 3's win, call and heat: ("n", count) normals,
    ("u", count) uniforms), so every sound made after it stays the same, bit for bit."""
    for kind, n in draws:
        rng.standard_normal(n) if kind == "n" else rng.uniform(size=n)


# Round 4's sounds draw their room from their own stream.
calm = np.random.default_rng(4)


def soft(t, at, f, decay, gain, attack=0.004):
    """A soft game tone: a triangle-ish note (odd partials falling fast), gently attacked, no edge."""
    s = np.maximum(t - at, 0)
    y = sum(np.sin(2 * np.pi * f * k * s) / (k * k) * (-1) ** (k // 2) for k in (1, 3, 5))
    return gain * y * env(t, at, attack, decay)


# ── Contacts: one body per kind, each its own character ─────────────────────

# Bump: forearms, juicy. A rubbery "bwomp" (the pitch drops and wobbles like a squeezed toy), a springy pop rising off
# it, a soft slap of skin and a little sub.
t = track(0.5)
s = t
wob = 1 + 0.09 * np.sin(2 * np.pi * 21 * s) * np.exp(-s / 0.09)
f = (105 + 200 * np.exp(-s / 0.035)) * wob
y = np.sin(phase_of(f)) * env(t, 0, 0.002, 0.17) + 0.45 * np.sin(phase_of(f * 2.02)) * env(t, 0, 0.002, 0.06)
y += 0.4 * glide(t, 0.014, 480, 1020, 0.022) * env(t, 0.014, 0.001, 0.055)
y += 0.45 * band(noise(len(t)), 600, 3200) * env(t, 0, 0.0006, 0.01)
y += 0.6 * glide(t, 0, 85, 48, 0.04) * env(t, 0, 0.002, 0.07)
write("vb-bump", room(np.tanh(1.7 * y), 0.18, 0.04, 0.1), 0.85)

# Set: fingertips, light. Two soft taps 45 ms apart (the hands catch and push), a muted fingertip pluck under each,
# no bwomp at all.
t = track(0.35)
y = np.zeros(len(t))
for at, g in ((0, 1.0), (0.045, 0.8)):
    y += g * band(noise(len(t)), 1800, 6500) * env(t, at, 0.0004, 0.004)
    y += g * 0.6 * glide(t, at, 760, 620, 0.01) * env(t, at, 0.001, 0.028)
    y += g * 0.25 * np.sin(2 * np.pi * 1240 * np.maximum(t - at, 0)) * env(t, at, 0.0008, 0.014)
write("vb-set", room(y, 0.14, 0.035, 0.12), 0.62)

# Serve: an open palm smacks the ball (a sharp skin crack and the ball's pop) and it leaves on a rising whoosh.
t = track(0.6)
y = 0.8 * band(noise(len(t)), 2000, 9000) * env(t, 0, 0.0004, 0.006) + 0.5 * band(noise(len(t)), 900, 3000) * env(t, 0, 0.0005, 0.02)
y += 0.7 * glide(t, 0, 260, 175, 0.02) * env(t, 0, 0.0015, 0.07)
y += sweep(t, 0.03, 0.42, 450, 2800, 1.5, 0.55)
write("vb-serve", room(np.tanh(1.4 * y), 0.2, 0.05, 0.12), 0.85)

# Dig: a scoop off the sand, low, with grit.
t = track(0.4)
write("vb-dig", room(ball(t, 0, 140, 0.1, 0.4, 0.1, 700, 3500) + sand(t, 0.005, 0.18, 0.35), 0.16, 0.04, 0.1), 0.75)

# Block: a wall. Two hard palm slaps a beat apart (both hands), a low wooden knock, the ball's thump stopped dead and a
# short grunted "oof" under it.
t = track(0.55)
y = 0.8 * band(noise(len(t)), 1200, 6000) * env(t, 0, 0.0004, 0.008) + 0.65 * band(noise(len(t)), 1200, 6000) * env(t, 0.02, 0.0004, 0.009)
for fm, g, d in ((185, 1.0, 0.09), (452, 0.5, 0.045), (790, 0.3, 0.025)):
    y += 1.2 * g * np.sin(2 * np.pi * fm * np.maximum(t, 0)) * env(t, 0, 0.0008, d)
y += 1.1 * glide(t, 0, 105, 52, 0.035) * env(t, 0, 0.002, 0.1)
oof = voice(t, 0.025, 128 - 30 * np.clip(t / 0.15, 0, 1), [(380, 330, 1.0), (850, 700, 0.5), (2300, 2200, 0.15)], 0.15)
y += 0.55 * oof * env(t, 0.025, 0.02, 0.07) / (np.max(np.abs(oof)) + 1e-9)
write("vb-block", room(np.tanh(2.0 * y), 0.2, 0.05, 0.12), 0.95)

# Spike: you feel it. A whip crack (a hard transient and a fast falling chirp), a deep punchy boom driven into the
# limiter, and the air ripping after the ball.
t = track(0.8)
y = hiss(t, 0, 2500, 0.003, 1.4, 0.0001) + 0.8 * glide(t, 0, 5200, 450, 0.004) * env(t, 0, 0.0001, 0.014)
y += 1.6 * glide(t, 0, 125, 40, 0.05) * env(t, 0, 0.001, 0.24)
y += ball(t, 0, 150, 0.09, 0.9, 0.3, 1200, 9000)
y += sweep(t, 0.015, 0.3, 3600, 520, 1.5, 0.55) + 0.25 * sweep(t, 0.015, 0.22, 7000, 2000, 1.3, 1)
write("vb-spike", room(np.tanh(2.4 * y), 0.3, 0.07, 0.15), 0.98)

# A perfect serve or spike: the ball catches fire as it leaves, a fwoosh with a rising rumble and crackle.
t = track(0.9)
roar = low(noise(len(t)), 900) * env(t, 0, 0.06, 0.32)
y = roar + 0.6 * glide(t, 0, 55, 140, 0.25) * env(t, 0, 0.05, 0.3) + sweep(t, 0, 0.55, 280, 2200, 1.6, 0.6)
for _ in range(26):
    w = rng.uniform(0.05, 0.75)
    y += 0.3 * band(noise(len(t)), 1800, 6000) * env(t, w, 0.0002, 0.004)
write("vb-flame", room(np.tanh(1.3 * y), 0.3, 0.08, 0.12), 0.7)

# ── Timing grade layers (on top of the body) ────────────────────────────────

# Perfect: gold, a bright chime (E6 and B6) with sparkle.
t = track(0.7)
y = bell(t, 0.008, 1318.5, 0.32, 0.55) + bell(t, 0.03, 1975.5, 0.26, 0.4) + sparkles(t, 0.03, 0.3, 12, 3000, 5500, 0.12)
write("vb-perfect", room(y, 0.4, 0.12, 0.3), 0.6)
# Good: a clean short tick, nothing more.
t = track(0.15)
write("vb-good", mallet(t, 0.004, 1567.98, 0.05, 1, 0.5), 0.35)
# Early: a thin brush that rises (the hands got there first): a quick "bwip" up.
t = track(0.3)
y = low(sweep(t, 0, 0.18, 600, 1600, 1.4, 1), 2200) + 0.5 * glide(t, 0, 330, 520, 0.05) * env(t, 0, 0.004, 0.06)
write("vb-early", y, 0.32)
# Late: a muffled scuff that falls (the ball got there first): a dull "bwop" down.
y = low(noise(len(t)), 900) * env(t, 0, 0.003, 0.05) + 0.7 * glide(t, 0, 220, 95, 0.05) * env(t, 0, 0.002, 0.1)
write("vb-late", y, 0.34)

# ── The sand, the net ───────────────────────────────────────────────────────

# The ball landing out of play: a soft dull drop into sand.
t = track(0.45)
y = ball(t, 0, 120, 0.07, 0.2, 0.05, 400, 2500) + sand(t, 0.003, 0.25, 0.7, 400, 4000, 90)
write("vb-sand", room(y, 0.2, 0.05, 0.12), 0.7)
# A point's impact: a sub boom, the ball's thud and a sand explosion falling back.
t = track(1.3)
y = 1.5 * glide(t, 0, 95, 38, 0.09) * env(t, 0, 0.002, 0.28) + ball(t, 0, 115, 0.09, 0.5, 0.05, 600, 3000)
y += sand(t, 0.006, 0.55, 1.0, 350, 5000, 360, 0.3) + 0.5 * sand(t, 0.35, 0.8, 0.5, 900, 6000, 220, 0.35)
write("vb-boom", room(y, 0.5, 0.14, 0.2), 0.95)
# The net: the ball in the mesh, a long cord rustle (rattling, uneven), and the top band twanging high above it.
t = track(0.8)
rattle = 0.5 + 0.5 * np.sin(2 * np.pi * (31 + 9 * np.exp(-t / 0.2)) * t) ** 2
y = band(noise(len(t)), 1100, 6000) * rattle * env(t, 0, 0.004, 0.2)
y += 0.5 * glide(t, 0, 140, 85, 0.05) * env(t, 0, 0.003, 0.08)
y += 0.7 * pluck(t, 0.01, 392, 0.995, 3200) * env(t, 0.01, 0.001, 0.35)
write("vb-net", room(y, 0.25, 0.06, 0.15), 0.62)
# The tape: a taut band's low twang and a tick (the ball rolls over).
t = track(0.5)
y = pluck(t, 0, 196) * env(t, 0, 0.001, 0.2) + 0.12 * band(noise(len(t)), 2000, 5000) * env(t, 0, 0.0004, 0.005)
write("vb-tape", y, 0.5)

# ── Bodies on sand ──────────────────────────────────────────────────────────

t = track(0.3)
write("vb-takeoff", sand(t, 0, 0.12, 1, 300, 3500, 70, 0.07) + 0.4 * glide(t, 0, 120, 80, 0.03) * env(t, 0, 0.002, 0.04), 0.42)
t = track(0.35)
write("vb-touchdown", sand(t, 0.002, 0.16, 1, 250, 3000, 90, 0.08) + 0.7 * glide(t, 0, 100, 60, 0.03) * env(t, 0, 0.002, 0.06), 0.5)
# The dive: a body thrown along the sand, a long spray with a whoosh into it and the thud of landing.
t = track(0.9)
y = sand(t, 0.06, 0.6, 1, 300, 5000, 380, 0.3) + 0.35 * sweep(t, 0, 0.25, 700, 1900, 1.5, 1)
y += 0.7 * glide(t, 0.06, 110, 55, 0.04) * env(t, 0.06, 0.003, 0.09)
write("vb-dive", room(y, 0.22, 0.05, 0.1), 0.66)

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
# A whiff: a hollow swish through empty air, then a little sad "womp" falling away.
t = track(0.55)
y = sweep(t, 0, 0.2, 1900, 520, 1.25, 1)
s = np.maximum(t - 0.12, 0)
f = (115 + 170 * np.exp(-s / 0.09)) * (1 + 0.03 * np.sin(2 * np.pi * 9 * s))
womp = np.sin(phase_of(f)) + 0.4 * np.sin(phase_of(f * 2))
y += 0.55 * low(womp, 900) * env(t, 0.12, 0.015, 0.16)
write("vb-whiff", y, 0.45)

# ── Moments ─────────────────────────────────────────────────────────────────

# Your point: a bright brassy sting, three notes up (C5, G5, C6) with a shing on the top.
t = track(1.1)
y = brass(t, 0, 523.25, 0.09, 0.6) + brass(t, 0.075, 783.99, 0.09, 0.6) + brass(t, 0.15, 1046.5, 0.5, 0.75, 4200)
y += brass(t, 0.15, 1318.5, 0.5, 0.35, 4200) + hiss(t, 0.15, 6000, 0.22, 0.12, 0.002) + bell(t, 0.15, 2093, 0.4, 0.2)
write("vb-point", room(y, 0.5, 0.15, 0.3), 0.62)
# Their point: two soft notes down (E5, C5), quieter.
t = track(0.8)
y = mallet(t, 0, 659.25, 0.2, 0.6, 0.15) + mallet(t, 0.12, 523.25, 0.32, 0.6, 0.15)
write("vb-point-them", room(y, 0.4, 0.12, 0.25), 0.4)
# The win (round 4, David: "redo sfx"): a bright little victory jingle, not a fanfare. Four quick notes up (G4 C5 E5
# G5) on soft tones doubled by a marimba, landing on a held C6 over a C major chord of bells, a soft low thump under
# the landing and a short twinkle running up after it. Warm, about 1.6 s, nothing above the bells.
burn(("n", len(track(2.3))), ("u", 108), ("n", SR))
t = track(1.7)
y = np.zeros(len(t))
for i, f in enumerate((392.0, 523.25, 659.25, 783.99)):
    y += soft(t, 0.1 * i, f, 0.12, 0.55) + mallet(t, 0.1 * i, f, 0.16, 0.35, 0.15)
y += soft(t, 0.42, 1046.5, 0.7, 0.6, 0.006) + mallet(t, 0.42, 1046.5, 0.5, 0.3, 0.15)
for f, g in ((523.25, 0.35), (659.25, 0.3), (783.99, 0.3)):
    y += bell(t, 0.42, f, 0.9, g)
y += 0.6 * glide(t, 0.42, 130, 65, 0.05) * env(t, 0.42, 0.002, 0.16)
for i, f in enumerate((1567.98, 2093.0, 2637.0)):
    y += 0.12 * bell(t, 0.62 + 0.06 * i, f, 0.18, 1)
write("vb-win", room(low(y, 5000), 0.8, 0.25, 0.25, calm), 0.62)
# "Mine!" (round 4, David: "just do a alert sound effect"): a plain alert, two soft chime notes up (E5 then A5),
# short and round, no voice.
burn(("n", len(track(0.4))), ("n", len(track(0.4))), ("n", int(SR * 0.15)))
t = track(0.42)
y = soft(t, 0, 659.25, 0.1, 0.8) + 0.3 * bell(t, 0, 659.25, 0.1, 1) + soft(t, 0.1, 880.0, 0.18, 0.9) + 0.3 * bell(t, 0.1, 880.0, 0.16, 1)
write("vb-call", room(low(y, 4500), 0.2, 0.05, 0.12, calm), 0.5)
# Out: a referee's pea whistle, clear and sharp: a short blast and a long one ("fweet-fweeeet"), the pea rattling it.
t = track(0.75)
s = t
trill = np.sin(2 * np.pi * 34 * s)
f = 2850 * (1 + 0.035 * trill)
tone = np.sin(phase_of(f)) + 0.3 * np.sin(phase_of(2 * f)) + 0.1 * np.sin(phase_of(3 * f))
am = 0.65 + 0.35 * trill
shape = np.clip(np.minimum(s / 0.012, (0.15 - s) / 0.02), 0, 1) + np.clip(np.minimum((s - 0.21) / 0.012, (0.62 - s) / 0.05), 0, 1)
y = (tone * am + 0.18 * band(noise(len(t)), 2200, 7000)) * shape
write("vb-out", room(low(y, 9000), 0.2, 0.05, 0.12), 0.5)

# ── The rally's heat ────────────────────────────────────────────────────────

# The rally heating up (round 4, David: "simple sfx fitting for game"): a quick three-note blip up (C5 E5 G5) on soft
# tones, like a level-up tick; sfx.ts plays it every few touches, higher each time.
burn(("n", len(track(0.8))), ("n", int(SR * 0.4)))
t = track(0.36)
y = sum(soft(t, 0.05 * i, f, 0.07 + 0.04 * i, 0.7) for i, f in enumerate((523.25, 659.25, 783.99)))
write("vb-heat", room(low(y, 4500), 0.2, 0.05, 0.1, calm), 0.3)
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

    def rate(y, r):
        """A rate change as the game plays it (a resample)."""
        idx = np.arange(0, len(y) - 1, r)
        return np.interp(idx, np.arange(len(y)), y)

    def mix(parts):
        """(name, at s, gain, rate) parts laid on one track."""
        tracks = [(rate(SOUNDS[p[0]], p[3] if len(p) > 3 else 1), p[1], p[2]) for p in parts]
        n = max(int(at * SR) + len(s) for s, at, g in tracks)
        y = np.zeros(n)
        for s, at, g in tracks:
            i = int(at * SR)
            y[i:i + len(s)] += g * s
        return y

    # A contact is its body at the grade's level and rate, with the grade's layer (sfx.ts BODY and GRADE).
    GRADE = {"perfect": (1.0, 1.0, "vb-perfect", 0.75), "good": (0.88, 1.0, "vb-good", 0.6), "early": (0.6, 1.07, "vb-early", 0.85), "late": (0.6, 0.9, "vb-late", 0.85)}

    def contact(body, grade, gain=1.0, r=1.0, extra=()):
        g, gr, layer, lg = GRADE[grade]
        return [(body, 0, gain * g, r * gr), (layer, 0, lg), *extra]

    previews = {
        "bump": contact("vb-bump", "good"), "set": contact("vb-set", "good"), "jumpset": contact("vb-set", "good", 1.0, 1.12),
        "dig": contact("vb-dig", "good"), "block": contact("vb-block", "good"), "spike": contact("vb-spike", "good"),
        "spike-perfect": contact("vb-spike", "perfect", extra=[("vb-flame", 0.03, 0.6)]),
        "serve": contact("vb-serve", "good"), "serve-perfect": contact("vb-serve", "perfect", extra=[("vb-flame", 0.03, 0.6)]),
        "grade-perfect": contact("vb-bump", "perfect"), "grade-good": contact("vb-bump", "good"),
        "grade-early": contact("vb-bump", "early"), "grade-late": contact("vb-bump", "late"),
        "net": [("vb-net", 0, 0.9)], "tape": [("vb-tape", 0, 0.9)], "out": [("vb-sand", 0, 0.7), ("vb-out", 0.18, 0.8)],
        "lands": [("vb-boom", 0, 0.9)], "point": [("vb-point", 0, 0.9)], "point-theirs": [("vb-point-them", 0, 0.9)],
        "win": [("vb-win", 0, 0.9)], "call": [("vb-call", 0, 0.9)], "whiff": [("vb-whiff", 0, 0.9)],
        "jump": [("vb-takeoff", 0, 0.9)], "touchdown": [("vb-touchdown", 0, 0.9)], "dive": [("vb-dive", 0, 0.9), ("vb-dig", 0.12, 0.7), ("vb-good", 0.12, 0.5)],
        "toss": [("vb-toss", 0, 0.9)], "max": [("vb-max", 0, 0.9)], "flame": [("vb-flame", 0, 0.9)],
        "charge": [("vb-charge", 0.1 * i, 0.35 + 0.35 * i / 9, 0.8 + i / 9) for i in range(10)],
        "heat": [("vb-heat", 0, 0.8, 0.9), ("vb-heat", 0.6, 0.85, 1.02), ("vb-heat", 1.2, 0.9, 1.14)], "fire": [("vb-fire", 0, 0.9)],
    }
    for name, parts in previews.items():
        y = mix(parts)
        save(os.path.join(PREVIEW, f"{name}.wav"), y / max(1, np.max(np.abs(y))) * 0.95)
    print("previews in", PREVIEW)
