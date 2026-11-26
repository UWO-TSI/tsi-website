"""The rod awakening's sounds (rods round 10, David 2026-11-06: "more flash and almost impact flash frames and make it
more juicy and exciting and more suspense ... a lighting related will strike it with thunder"), made here from sines
and noise, never fetched (ours, CC0, like synth_bite.py and synth_volleyball.py):

  aw-riser    the build-up under the glow and the pulse: a low drone and a band of air rising together, a tremolo
              quickening, swelling to a held breath, then cut dead (the hush; the file's length is the glow and the
              pulse, AWAKEN_MS in components/gui/flat/moments.tsx)
  aw-heart    one heartbeat (lub, dub) under each pulse beat, re-pitched up as they quicken
  aw-impact   the hit at the burst: a sub boom dropping, a sharp crack, a shimmer ringing out
  aw-thunder  a lightning strike: the crack right on it, then the rumble rolling away
  aw-wave     a wave: the swell rushing in, the crash, the hiss of its spray falling back

  python3 art/audio/synth_awaken.py <wav dir>
  then: for f in <wav dir>/aw-*.wav; do ffmpeg -y -i $f -c:a vorbis -strict -2 -ac 2 -q:a 3 web/public/audio/sfx/$(basename $f .wav).ogg; done
"""
import os, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
rng = np.random.default_rng(1106)
# The glow and the pulse (AWAKEN_MS): the riser's length, ending in the hush.
RISE = 1.3 + 2.8


def track(seconds):
    return np.arange(int(SR * seconds)) / SR


def env(t, at, attack, decay):
    s = t - at
    on = s >= 0
    s = np.where(on, s, 0)
    return np.minimum(1, s / max(attack, 1e-4)) * np.exp(-s / decay) * on


def band(x, lo, hi, order=2):
    return sosfilt(butter(order, [max(lo, 20), min(hi, SR / 2 - 100)], btype="band", fs=SR, output="sos"), x)


def low(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def high(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def noise(n):
    return rng.standard_normal(n)


def tone(t, f):
    """A sine whose frequency follows the array `f`."""
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def write(name, y, peak, tail=0.04):
    fade = np.minimum(1, (len(y) - np.arange(len(y))) / (SR * tail))
    y = high(y * fade, 30)
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    print("wrote", path, f"{len(y) / SR:.2f}s")


# The riser: a drone gliding up a fifth, air through a band climbing 300 Hz to 3 kHz, a tremolo quickening from 3 to
# 14 Hz, all swelling, cut in 15 ms at the end.
t = track(RISE)
u = t / RISE
drone = tone(t, 55 * 1.5 ** (u ** 1.5)) + 0.5 * tone(t, 110.5 * 1.5 ** (u ** 1.5)) + 0.25 * tone(t, 165 * 1.5 ** (u ** 1.5))
air = np.zeros_like(t)
n = noise(len(t))
for i in range(20):
    a, b = RISE * i / 20, RISE * (i + 1) / 20
    f = 300 * (3000 / 300) ** (i / 19)
    seg = (t >= a) & (t < b + 0.02)
    air += band(n, f / 1.4, f * 1.4) * np.clip(np.minimum((t - a) / 0.01, (b + 0.02 - t) / 0.02), 0, 1) * seg
trem = 0.65 + 0.35 * np.sin(2 * np.pi * np.cumsum(3 + 11 * u ** 2) / SR)
y = (0.8 * drone + 0.55 * air * u) * trem * (0.15 + 0.85 * u ** 1.8)
write("aw-riser", y, 0.8, tail=0.015)

# The heartbeat: a low thump and a softer one a quarter second after.
t = track(0.5)
thump = lambda at, g: g * tone(t, 48 + 40 * np.exp(-np.maximum(t - at, 0) / 0.03)) * env(t, at, 0.004, 0.07) * (t >= at)
write("aw-heart", thump(0, 1) + thump(0.2, 0.6) + 0.1 * low(noise(len(t)), 300) * env(t, 0, 0.002, 0.03), 0.85)

# The impact: a sub boom sliding down, a crack, a shimmer of high partials ringing out.
t = track(1.6)
boom = tone(t, 38 + 90 * np.exp(-t / 0.08)) * env(t, 0, 0.002, 0.45)
crack = band(noise(len(t)), 1500, 9000) * env(t, 0, 0.0005, 0.03)
shimmer = sum(np.sin(2 * np.pi * f * t) * env(t, 0.01, 0.003, d) for f, d in ((1318.5, 0.7), (1975.5, 0.55), (2637, 0.4), (3951, 0.3)))
write("aw-impact", 1.2 * boom + 0.6 * crack + 0.12 * shimmer, 0.95)

# Thunder: a white crack with a ripping tail right on the strike, then the rumble (low noise, lumpy, rolling away).
t = track(3.2)
rip = band(noise(len(t)), 800, 10000) * (env(t, 0, 0.0005, 0.02) + 0.5 * env(t, 0.03, 0.001, 0.06) + 0.35 * env(t, 0.09, 0.001, 0.08))
lumps = low(np.abs(noise(len(t))), 6)
rumble = low(noise(len(t)), 180, 4) * (0.4 + 3 * lumps / (lumps.max() + 1e-9)) * env(t, 0.04, 0.12, 1.1)
write("aw-thunder", 0.9 * rip + 1.4 * rumble + 0.5 * tone(t, 42 + 20 * np.exp(-t / 0.1)) * env(t, 0, 0.003, 0.5), 0.95)

# A wave: the swell rushing in (rising band) over the hush, the crash on the burst (HUSH s in), the hiss of spray falling back.
HUSH = 0.5
t = track(2.6)
n = noise(len(t))
rush = np.zeros_like(t)
for i in range(16):
    a, b = HUSH * i / 16, HUSH * (i + 1) / 16
    f = 250 * (1800 / 250) ** (i / 15)
    seg = (t >= a) & (t < b + 0.02)
    rush += band(n, f / 1.6, f * 1.6) * np.clip(np.minimum((t - a) / 0.01, (b + 0.02 - t) / 0.02), 0, 1) * seg
rush *= np.clip(t / HUSH, 0, 1) ** 2 * (t < HUSH + 0.05)
crash = (band(n, 120, 2500) * 1.2 + low(n, 160) * 2.0) * env(t, HUSH, 0.01, 0.35)
hiss = high(n, 3000) * env(t, HUSH + 0.05, 0.05, 0.9) * (0.6 + 0.4 * np.abs(low(noise(len(t)), 9)) * 4)
write("aw-wave", 0.7 * rush + crash + 0.35 * hiss, 0.9)
