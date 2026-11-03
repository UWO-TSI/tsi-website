"""The coin's sound as it lands in the wallet (fishing-depth round 6, David: "do coin animation ... sound effect"), made
here from sines and noise, never fetched (CC0, like synth_bite.py):

  coin   a small bright clink: two struck partials a fifth and a bit apart, a metal tick under them, a glint on top

The game plays it once per coin that lands, a little higher each time (components/gui/flat/moments.tsx flyCoins).

  python3 art/audio/synth_coin.py <out dir>   (writes coin.wav there)
  ffmpeg -y -i <out dir>/coin.wav -c:a vorbis -strict -2 -ac 2 -q:a 4 web/public/audio/sfx/coin.ogg
"""
import os, sys, wave
import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
rng = np.random.default_rng(23)


def env(t, at, attack, decay):
    s = np.maximum(t - at, 0)
    return np.minimum(1, s / max(attack, 1e-4)) * np.exp(-s / decay) * (t >= at)


def strike(t, at, f, decay, gain):
    """A struck coin: a few inharmonic partials, the high ones dying first."""
    out = np.zeros_like(t)
    for mul, g, d in ((1, 1, 1), (2.32, 0.5, 0.55), (4.1, 0.22, 0.3), (6.8, 0.1, 0.18)):
        out += g * np.sin(2 * np.pi * f * mul * np.maximum(t - at, 0)) * env(t, at, 0.0008, decay * d)
    return gain * out


t = np.arange(int(SR * 0.42)) / SR
tick = rng.standard_normal(len(t))
tick -= np.convolve(tick, np.ones(8) / 8, mode="same")
y = strike(t, 0, 2093, 0.16, 0.8) + strike(t, 0.018, 3136, 0.12, 0.45) + 0.25 * tick * env(t, 0, 0.0005, 0.008)
y += 0.12 * np.sin(2 * np.pi * 6272 * np.maximum(t - 0.03, 0)) * env(t, 0.03, 0.001, 0.05)
y *= np.minimum(1, (len(t) - np.arange(len(t))) / (SR * 0.04))
y = y / np.max(np.abs(y)) * 0.7
path = os.path.join(OUT, "coin.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print("wrote", path)
