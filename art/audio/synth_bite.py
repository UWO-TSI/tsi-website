"""The fish bite's sound, one per hook tier (specs/launch/v1-gameplay.md, "Fish tiers and fights"), made here from
sines and noise, never fetched. Each is louder and richer than the last:

  bite            a bubble's plunk under the bobber, a small splash and a bright pluck (the "!" pops)
  bite-legendary  a deeper plunk, a bigger splash, a golden bell arpeggio and sparkles
  bite-divine     a sub boom, a heavy splash, a choir-like chord swelling under a bell cluster and a rising shimmer

  python3 art/audio/synth_bite.py <out dir>   (writes the three .wav there)
  for n in bite bite-legendary bite-divine; do ffmpeg -y -i <out dir>/$n.wav -c:a vorbis -strict -2 -ac 2 -q:a 5 web/public/audio/sfx/$n.ogg; done
"""
import os, sys, wave
import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
rng = np.random.default_rng(11)


def env(t, at, attack, decay):
    s = t - at
    on = s >= 0
    s = np.where(on, s, 0)
    a = np.minimum(1, s / max(attack, 1e-4))
    return a * np.exp(-s / decay) * on


def bubble(t, at, f0, f1, sweep, decay, gain):
    """A water plunk: a sine whose pitch jumps up as the bubble closes."""
    s = np.maximum(t - at, 0)
    f = f0 + (f1 - f0) * (1 - np.exp(-s / sweep))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return gain * np.sin(phase) * env(t, at, 0.002, decay)


def splash(t, at, decay, gain, smooth):
    """Water noise: low-passed (a moving average) so it hisses less as it gets heavier."""
    n = rng.standard_normal(len(t))
    k = np.ones(smooth) / smooth
    n = np.convolve(n, k, mode="same")
    n = n - np.convolve(n, np.ones(smooth * 6) / (smooth * 6), mode="same")
    n /= np.max(np.abs(n)) + 1e-9
    return gain * n * env(t, at, 0.004, decay)


def bell(t, at, f, decay, gain):
    """A struck bell: a few inharmonic partials, the high ones dying first."""
    out = np.zeros_like(t)
    for mul, g, d in ((1, 1, 1), (2.0, 0.45, 0.6), (2.76, 0.32, 0.45), (5.4, 0.16, 0.25)):
        out += g * np.sin(2 * np.pi * f * mul * np.maximum(t - at, 0)) * env(t, at, 0.0015, decay * d)
    return gain * out


def pad(t, at, freqs, attack, decay, gain, harmonics=6):
    """A soft choir-like chord: detuned stacks of a few harmonics each, swelling in and fading."""
    out = np.zeros_like(t)
    s = np.maximum(t - at, 0)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * s)
    for f in freqs:
        for det in (-0.006, 0, 0.007):
            for h in range(1, harmonics + 1):
                out += np.sin(2 * np.pi * f * (1 + det) * h * s * vib + h) / (h * h)
    a = np.minimum(1, s / attack) * (t >= at)
    return gain * out / len(freqs) * a * np.exp(-np.maximum(s - attack, 0) / decay)


def sparkles(t, at, length, count, lo, hi, gain):
    out = np.zeros_like(t)
    for i in range(count):
        when = at + length * (i / count) + rng.uniform(0, length / count)
        f = rng.uniform(lo, hi) * (1 + 0.5 * i / count)
        out += np.sin(2 * np.pi * f * np.maximum(t - when, 0)) * env(t, when, 0.001, 0.05) * rng.uniform(0.5, 1)
    return gain * out


def room(y, length, decay, wet):
    """A small reverb: the dry signal plus its convolution with decaying noise."""
    n = int(SR * length)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * decay))
    size = len(y) + n
    w = np.fft.irfft(np.fft.rfft(y, size) * np.fft.rfft(ir, size), size)[: len(y)]
    return y + wet * w / (np.max(np.abs(w)) + 1e-9) * np.max(np.abs(y))


def write(name, y, peak):
    fade = np.minimum(1, (len(y) - np.arange(len(y))) / (SR * 0.05))
    y = y * fade
    y = y / np.max(np.abs(y)) * peak
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype(np.int16).tobytes())
    print("wrote", path, f"{len(y) / SR:.2f}s peak {peak}")


def track(seconds):
    return np.arange(int(SR * seconds)) / SR


# Common: plunk, splash, pluck (E6 with its fifth).
t = track(0.55)
y = bubble(t, 0, 320, 980, 0.03, 0.07, 0.9) + splash(t, 0.004, 0.06, 0.35, 3)
y += bell(t, 0.03, 1318.5, 0.22, 0.5) + bell(t, 0.03, 1975.5, 0.12, 0.18)
write("bite", room(y, 0.25, 0.05, 0.25), 0.55)

# Legendary: deeper plunk, a bigger splash, a golden arpeggio up A major and sparkles.
t = track(1.5)
y = bubble(t, 0, 190, 720, 0.04, 0.12, 1.0) + splash(t, 0.004, 0.16, 0.55, 4)
for i, f in enumerate((880, 1108.7, 1318.5, 1760)):
    y += bell(t, 0.05 + 0.065 * i, f, 0.55, 0.42)
y += sparkles(t, 0.22, 0.9, 22, 2600, 5200, 0.12)
write("bite-legendary", room(y, 0.8, 0.18, 0.4), 0.75)

# Divine: a sub boom and a heavy splash, a choir chord (D major) swelling under a bell cluster, a rising shimmer.
t = track(2.6)
s = t
boom = np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-s / 0.12)) / SR) * env(t, 0, 0.003, 0.5)
y = 1.0 * boom + bubble(t, 0.01, 140, 560, 0.05, 0.16, 0.8) + splash(t, 0.004, 0.32, 0.7, 6)
y += pad(t, 0.06, (293.7, 440, 587.3, 740), 0.32, 0.9, 0.55)
for i, f in enumerate((1174.7, 1480, 1760, 2349.3)):
    y += bell(t, 0.12 + 0.05 * i, f, 0.9, 0.34)
y += sparkles(t, 0.3, 1.6, 40, 2200, 4000, 0.14)
write("bite-divine", room(y, 1.4, 0.35, 0.55), 0.95)
