"""The island's ambient beds (sky-ambient rounds 3 and 4, specs/sky-ambient.md R3), made here from noise and sines, never
fetched or sampled. Each is a seamless loop (its tail crossfaded into its head), quiet (mono, encoded as two channels: the vorbis encoder takes no fewer):

  bed-dawn   the sea washing in and out, a light breeze, a few birds waking
  bed-day    the sea, a breeze that comes and goes, birds calling now and then
  bed-dusk   the sea, the breeze, the last birds, the first crickets
  bed-night  the sea, a breath of wind, crickets near and far, a tree cricket's trill
  bed-wind   the sea and a gusty wind with a whistle in the gusts
  bed-rain   a soft wash of rain, its low body on leaves and sand, a gentle patter, the sea under it
  bed-snow   a soft wind, everything muffled
  bed-fog    the sea, slow and muffled

  python3 art/audio/synth_ambience.py <out dir>   (writes the eight .wav there)
  for n in dawn day dusk night wind rain snow fog; do ffmpeg -y -i <out dir>/bed-$n.wav -c:a vorbis -strict -2 -ac 2 -q:a 2 web/public/audio/ambient/bed-$n.ogg; done
"""
import os, sys, wave
import numpy as np

SR = 32000
LOOP = 24.0
FADE = 2.0
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp"
N = int((LOOP + FADE) * SR)
t = np.arange(N) / SR


def noise(seed):
    return np.random.default_rng(seed).standard_normal(N)


def lowpass(x, cut):
    """One-pole low pass, run forward and back (no phase lag)."""
    a = np.exp(-2 * np.pi * cut / SR)
    from scipy.signal import lfilter
    y = lfilter([1 - a], [1, -a], x)
    return lfilter([1 - a], [1, -a], y[::-1])[::-1]


def band(x, lo, hi):
    return lowpass(x, hi) - lowpass(x, lo)


def norm(x, rms):
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * rms


def slow(seed, rate, depth):
    """A slow random swell around 1: a few sines at uneven rates (whole cycles over the loop, so it loops)."""
    rng = np.random.default_rng(seed)
    s = np.zeros(N)
    for k in range(3):
        cycles = max(1, round(rate * LOOP * (0.6 + 0.8 * rng.random())))
        s += np.sin(2 * np.pi * cycles * t / LOOP + rng.random() * 6.28) / (k + 1)
    return 1 + depth * s / 1.83


def sea(seed, gain, muffle=1.0):
    """Waves: a low rumble that swells as each wave comes in, and a hiss on its break, every 6 to 9 s."""
    rng = np.random.default_rng(seed)
    swell = np.zeros(N)
    at = 0.0
    while at < LOOP + FADE:
        dur = 6 + 3 * rng.random()
        s = (t - at) / dur
        on = (s >= 0) & (s < 1)
        swell += np.where(on, np.sin(np.pi * np.clip(s, 0, 1)) ** 2 * (0.6 + 0.4 * rng.random()), 0)
        at += dur * (0.75 + 0.2 * rng.random())
    rumble = lowpass(noise(seed + 1), 260 * muffle) * (0.35 + swell)
    hiss = band(noise(seed + 2), 600 * muffle, 3500 * muffle) * swell ** 2
    return gain * (norm(rumble, 1) + 0.45 * norm(hiss, 1))


def breeze(seed, gain, gusty=0.4, bright=1.0):
    """Wind: noise in a band whose centre and loudness drift with the gusts."""
    g = slow(seed, 0.12, gusty)
    low = band(noise(seed + 3), 120 * bright, 900 * bright) * g
    high = band(noise(seed + 4), 900 * bright, 2600 * bright) * np.clip(g - 0.7, 0, None) ** 1.5
    return gain * (norm(low, 1) + 0.6 * norm(high, 1) * (gusty > 0.5))


def whistle(seed, gain):
    """The gusts' whistle: a breathy tone that rises with them."""
    g = np.clip(slow(seed, 0.12, 0.8) - 1.0, 0, None)
    f = 520 + 260 * g
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * band(noise(seed + 5), 300, 1500) * 0.5
    return gain * norm(tone * g, 1)


def birds(seed, gain, count, high=1.0):
    """Short calls: two or three falling or rising chirps, here and there."""
    rng = np.random.default_rng(seed)
    out = np.zeros(N)
    for _ in range(count):
        at = rng.random() * (LOOP - 1.5)
        f0 = (2400 + 2200 * rng.random()) * high
        notes = rng.integers(2, 5)
        for k in range(notes):
            st = at + k * (0.11 + 0.06 * rng.random())
            d = 0.06 + 0.05 * rng.random()
            s = (t - st) / d
            on = (s >= 0) & (s < 1)
            f = f0 * (1 + (0.25 if rng.random() > 0.5 else -0.2) * np.clip(s, 0, 1))
            ph = 2 * np.pi * np.cumsum(np.where(on, f, 0)) / SR
            out += np.where(on, np.sin(ph) * np.sin(np.pi * np.clip(s, 0, 1)) ** 2, 0) * (0.5 + 0.5 * rng.random())
    return gain * norm(out, 1) if count else 0


def reverb(x, seed, secs=0.7, mix=0.3):
    """A soft room of air: the signal through a decaying, darkened noise tail (the beds sit back, not in the ear)."""
    from scipy.signal import fftconvolve
    n = int(secs * SR)
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-np.arange(n) / (SR * secs / 5))
    ir = lowpass(ir, 3500)
    wet = fftconvolve(x, ir)[:N]
    return (1 - mix) * x + mix * norm(wet, np.sqrt(np.mean(x ** 2)) + 1e-9)


def crickets(seed, gain, voices):
    """Field crickets on a summer night (round 4; David: "the night cricet chirps needs to be redone"): each a chirp of
    three or four soft pulses (about 16 ms each, eased in and out, the pitch dipping a touch), a couple of chirps a
    second at its own pace and a little uneven, singing in bouts, near and far; under them a faint tree cricket's
    trill; all of it in a soft tail of air."""
    rng = np.random.default_rng(seed)
    out = np.zeros(N)
    for v in range(voices):
        f = 4300 + 700 * rng.random()
        rate = 1.6 + 1.0 * rng.random()
        pulses = 3 + int(rng.random() > 0.5)
        near = 0.35 + 0.65 * rng.random()
        env = np.zeros(N)
        glide = np.zeros(N)
        bouts = slow(seed * 13 + v, 0.05, 1.2)
        at = rng.random() / rate
        while at < LOOP + FADE - 0.2:
            if bouts[int(at * SR)] > 0.75:
                for k in range(pulses):
                    st = int((at + k * 0.034) * SR)
                    d = int(0.016 * SR)
                    if st + d >= N:
                        break
                    w = np.sin(np.pi * np.arange(d) / d) ** 2
                    env[st:st + d] += w * (1 - 0.12 * k)
                    glide[st:st + d] = np.linspace(0, 1, d)
            at += (1 / rate) * (0.9 + 0.2 * rng.random())
        tone = np.sin(2 * np.pi * np.cumsum(f * (1 - 0.025 * glide)) / SR)
        out += tone * env * near ** 1.5
    trill = np.sin(2 * np.pi * 2750 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 42 * t)) ** 2 * np.clip(slow(seed + 7, 0.06, 0.9) - 0.6, 0, None)
    out = norm(out, 1) + 0.18 * norm(trill, 1)
    return gain * norm(reverb(lowpass(out, 7000), seed + 8, 0.8, 0.4), 1)


def rain(seed, gain):
    """Rain (round 4; David: "rain sound is too crispy and crackly ... more natural and more ambient and cozy"): a soft
    wash of falling rain (no hiss above the mids), the low body of it on leaves and sand, and a gentle patter of drops,
    each a little rounded burst with no hard edge, all in a soft tail of air."""
    rng = np.random.default_rng(seed)
    wash = (band(noise(seed + 6), 250, 2000) + 0.6 * lowpass(noise(seed + 9), 600)) * slow(seed, 0.07, 0.12)
    body = band(noise(seed + 10), 60, 380)
    patter = np.zeros(N)
    d = int(SR * 0.025)
    w = np.sin(np.pi * np.arange(d) / d) ** 3
    for at in rng.random(int(LOOP * 30)) * LOOP:
        i = int(at * SR)
        patter[i:i + d] += w[:min(d, N - i)] * rng.standard_normal(min(d, N - i)) * (0.2 + rng.random() ** 2)
    patter = band(patter, 500, 2400)
    x = norm(wash, 1) + 0.55 * norm(body, 1) + 0.35 * norm(patter, 1)
    return gain * norm(reverb(x, seed + 11, 0.9, 0.35), 1)


def loop(x):
    """The tail crossfaded into the head, so the last sample runs on into the first."""
    n, f = int(LOOP * SR), int(FADE * SR)
    head = x[:n].copy()
    w = np.linspace(0, 1, f)
    head[:f] = head[:f] * w + x[n:n + f] * (1 - w)
    return head


BEDS = {
    "dawn": lambda: sea(1, 1.0) + breeze(11, 0.35) + birds(21, 0.22, 9, 1.1),
    "day": lambda: sea(2, 1.0) + breeze(12, 0.45) + birds(22, 0.2, 7),
    "dusk": lambda: sea(3, 1.0) + breeze(13, 0.4) + birds(23, 0.14, 3, 0.9) + crickets(33, 0.05, 3),
    "night": lambda: sea(4, 0.9) + breeze(14, 0.25, 0.25) + crickets(34, 0.11, 6),
    "wind": lambda: sea(5, 0.8) + breeze(15, 1.3, 0.9, 1.2) + whistle(16, 0.18),
    "rain": lambda: sea(6, 0.45) + rain(26, 1.1),
    "snow": lambda: breeze(17, 0.7, 0.5, 0.6) + sea(7, 0.3, 0.5),
    "fog": lambda: sea(8, 1.0, 0.45) + breeze(18, 0.2, 0.2, 0.7),
}

os.makedirs(OUT, exist_ok=True)
for name, make in BEDS.items():
    x = loop(make())
    # Quiet: about -27 dBFS (the rain a little under: it is the widest), peaks held under -6.
    x = norm(x, 10 ** ((-28.5 if name == "rain" else -27) / 20))
    x = x / max(1.0, np.max(np.abs(x)) / 0.5)
    with wave.open(os.path.join(OUT, f"bed-{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print(name, f"{len(x) / SR:.1f}s")
