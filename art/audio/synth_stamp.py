"""The collection's stamp landing hard (tasting-book r8, David: "comes down like a hard stamp"), made here from sines and
noise, never fetched: a heavy wooden thump, the block's knock, the paper's slap and the counter ringing under it.

  python3 art/audio/synth_stamp.py <out dir>   (writes stamp-heavy.wav there)
  ffmpeg -y -i <out dir>/stamp-heavy.wav -c:a vorbis -strict -2 -ac 2 -q:a 5 web/public/audio/sfx/stamp-heavy.ogg
"""
import os, sys, wave
import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
rng = np.random.default_rng(8)
t = np.arange(int(SR * 0.6)) / SR


def env(at, attack, decay):
    s = np.maximum(t - at, 0)
    return np.minimum(1, s / attack) * np.exp(-s / decay) * (t >= at)


def noise(lo, hi):
    """White noise kept between lo and hi Hz."""
    f = np.fft.rfftfreq(len(t), 1 / SR)
    n = np.fft.rfft(rng.standard_normal(len(t)))
    return np.fft.irfft(n * ((f > lo) & (f < hi)), len(t))


# The thump: a low body whose pitch falls as the block settles into the paper.
thump = np.sin(2 * np.pi * np.cumsum(52 + 90 * np.exp(-t / 0.025)) / SR) * env(0, 0.002, 0.11)
# The knock: the wooden block's hollow tone, short.
knock = (np.sin(2 * np.pi * 420 * t) + 0.5 * np.sin(2 * np.pi * 1130 * t)) * env(0, 0.001, 0.028)
# The slap: rubber on paper, a burst of mid noise.
slap = noise(700, 5200) * env(0, 0.0008, 0.012)
# The counter under the book rings a little, and the book's pages rustle as they jolt.
ring = np.sin(2 * np.pi * 180 * t) * env(0.004, 0.003, 0.07)
rustle = noise(2500, 9000) * env(0.03, 0.01, 0.05)

y = 1.0 * thump + 0.35 * knock / 1.5 + 0.9 * slap / np.max(np.abs(slap)) + 0.25 * ring + 0.12 * rustle / np.max(np.abs(rustle))
y *= np.minimum(1, (len(t) - np.arange(len(t))) / (SR * 0.05))
y = y / np.max(np.abs(y)) * 0.9
path = os.path.join(OUT, "stamp-heavy.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print("wrote", path)
