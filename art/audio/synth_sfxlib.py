"""Our own candidates for the SFX library (specs/sfx-library.md), made here from sines and noise, nothing fetched or
sampled, so every one is CC0 like synth_bite.py and synth_coin.py.

Each SOUND returns a float array at 48 kHz: mono (n,) for a one-shot, stereo (n, 2) for an ambience bed (made a
little longer than its loop; the build crossfades the tail into the head). art/audio/sfxlib.py calls these by name,
levels them and encodes them. To hear one offline:  python3 art/audio/synth_sfxlib.py <out dir> [name ...]  (wavs).
"""
import os, sys, wave
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(11)

# ---- building blocks -------------------------------------------------------------------------------------------


def n_(d):
    return int(round(SR * d))


def tt(d):
    return np.arange(n_(d)) / SR


def ev(d, a=0.002, k=0.1):
    """Attack `a` then exponential decay `k` (s), `d` long."""
    t = tt(d)
    return np.minimum(1, t / max(a, 1e-5)) * np.exp(-np.maximum(t - a, 0) / k)


def mix(d, *parts):
    """Sum (at, array) parts into a buffer `d` long (mono or stereo by the first part)."""
    shape = (n_(d),) + parts[0][1].shape[1:]
    out = np.zeros(shape)
    for at, x in parts:
        i = n_(at)
        m = min(len(x), len(out) - i)
        if m > 0:  # each part fades over its last 3 ms, so a tone cut short never clicks
            x = x[:m].copy()
            fade_end(x, 0.003)
            out[i:i + m] += x
    return out


def add(*xs):
    """Sum arrays of different lengths, all from 0."""
    return mix(max(len(x) for x in xs) / SR, *[(0, x) for x in xs])


def flt(x, kind, f, order=2):
    return signal.sosfilt(signal.butter(order, f, kind, fs=SR, output="sos"), x, axis=0)


def noise(d, ch=1):
    x = rng.standard_normal((n_(d), ch) if ch > 1 else n_(d))
    return x


def band(d, lo, hi, a=0.002, k=0.05):
    return flt(noise(d), "bandpass", (lo, hi)) * ev(d, a, k)


def osc(f, d):
    """A sine whose frequency may glide: f is a number or an array as long as d."""
    f = np.broadcast_to(np.asarray(f, float), (n_(d),))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def glide(f0, f1, d, over=None):
    """Exponential glide f0 to f1 over `over` s, held after."""
    t = tt(d)
    p = np.minimum(t / (over or d), 1)
    return f0 * (f1 / f0) ** p


def partials(f, d, parts, a=0.001, k=0.3):
    """Struck tone: (ratio, gain, decay share) partials."""
    return sum(g * osc(f * r, d) * ev(d, a, k * dk) for r, g, dk in parts)


MARIMBA = ((1, 1, 1), (3.93, 0.3, 0.22), (9.2, 0.08, 0.08))
GLOCK = ((1, 1, 1), (2.76, 0.35, 0.45), (5.4, 0.16, 0.25), (8.93, 0.06, 0.14))
GLASS = ((1, 1, 1), (1.003, 0.6, 1), (2.32, 0.4, 0.6), (4.25, 0.18, 0.4), (6.63, 0.08, 0.25))
BELL = ((0.5, 0.2, 1.4), (1, 1, 1), (1.19, 0.35, 0.8), (1.56, 0.25, 0.6), (2, 0.45, 0.7), (2.51, 0.2, 0.5), (3.01, 0.12, 0.35))
METAL = ((1, 1, 1), (1.47, 0.7, 0.8), (2.09, 0.5, 0.6), (2.56, 0.35, 0.5), (3.43, 0.2, 0.35))


def mallet(f, d=0.5, k=0.3):
    """A soft marimba note with the mallet's tick."""
    return mix(d, (0, partials(f, d, MARIMBA, 0.0015, k)), (0, 0.12 * band(0.02, 1500, 9000, 0.0005, 0.003)))


def brass(f, d, a=0.04, k=0.6, bright=5.0, vib=5.0):
    """A soft brass or organ pad: harmonics rolling off by `bright`, a light vibrato, attack `a`, decay `k`."""
    t = tt(d)
    fv = f * (1 + 0.004 * np.sin(2 * np.pi * vib * t) * np.minimum(t / 0.3, 1))
    y = sum((1 / h) * np.exp(-h / bright) * osc(fv * h, d) for h in range(1, 13) if f * h < 12000)
    return y * ev(d, a, k)


def thump(f0, f1, d, k=0.04, over=0.04):
    return osc(glide(f0, f1, d, over), d) * ev(d, 0.002, k)


def grains(d, rate, lo, hi, k=0.004, amp=None):
    """Random little noise grains (leaves, grit, crackle), `rate` per second, through a band."""
    y = np.zeros(n_(d))
    for _ in range(8):  # eight different grains, so no one grain's colour sets the whole sound's
        imp = np.zeros(n_(d))
        hits = rng.random(n_(d)) < rate / SR / 8
        imp[hits] = rng.uniform(0.3, 1, hits.sum())
        g = rng.standard_normal(n_(0.012)) * np.exp(-np.arange(n_(0.012)) / (SR * k * rng.uniform(0.6, 1.4)))
        y += signal.fftconvolve(imp, g)[:n_(d)]
    y = flt(y, "bandpass", (lo, hi))
    return y * (amp if amp is not None else 1)


def sweep(d, f0, f1, q=1.5, env=None, block=128):
    """Noise through a band-pass whose centre glides f0 to f1 (whooshes, drawers, waves)."""
    x = noise(d)
    fc = glide(f0, f1, d) if np.isscalar(f0) else f0
    out = np.zeros_like(x)
    zi = np.zeros((1, 2))
    for i in range(0, len(x), block):
        c = float(fc[min(i, len(fc) - 1)])
        bw = c / q
        sos = signal.butter(1, (max(c - bw / 2, 20), min(c + bw / 2, SR / 2 - 100)), "bandpass", fs=SR, output="sos")
        out[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return out * (env if env is not None else 1)


def reverb(x, rt=1.2, wet=0.3, seed=3):
    """A plain hall: two decaying-noise impulse responses (stereo out if the input is)."""
    r = np.random.default_rng(seed)
    t = tt(rt)
    ir = r.standard_normal((len(t), 2)) * np.exp(-6.9 * t / rt)[:, None]
    ir = flt(ir, "lowpass", 6000) * (1 / np.sqrt(SR * rt / 6.9))
    wetx = signal.fftconvolve(x, ir[:, 0]) if x.ndim == 1 else np.stack([signal.fftconvolve(x[:, c], ir[:, c]) for c in (0, 1)], 1)
    out = np.concatenate([x, np.zeros((len(t),) + x.shape[1:])])
    out[:len(wetx)] += wet * wetx
    return out


def fade_end(x, d=0.01):
    m = min(n_(d), len(x))
    x[-m:] *= np.linspace(1, 0, m)[:, None] if x.ndim > 1 else np.linspace(1, 0, m)


def note(name):
    """'C5' -> Hz."""
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    semis = names[name[0]] + (1 if "#" in name else 0) + 12 * (int(name[-1]) - 4)
    return 440 * 2 ** (semis / 12)


def pan(x, p):
    """Mono to stereo at p in -1..1 (equal power)."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def smooth_noise(d, rate, seed=None):
    """Slow random wobble in 0..1 changing about `rate` times a second."""
    r = np.random.default_rng(seed) if seed is not None else rng
    k = max(2, int(d * rate) + 3)
    pts = r.random(k)
    x = np.interp(np.linspace(0, k - 3, n_(d)), np.arange(k), pts)
    return flt(x, "lowpass", max(rate, 0.05), 1)


# ---- UI ---------------------------------------------------------------------------------------------------------


def ui_tap():
    return mix(0.06, (0, 0.7 * osc(2350, 0.06) * ev(0.06, 0.0005, 0.010)), (0, 0.35 * osc(1180, 0.06) * ev(0.06, 0.001, 0.016)),
               (0, 0.35 * band(0.02, 3000, 10000, 0.0003, 0.002)))


def ui_tap_wood():
    return mix(0.07, (0, partials(1050, 0.07, ((1, 1, 1), (2.7, 0.35, 0.5)), 0.0006, 0.025)), (0, 0.3 * band(0.02, 2000, 8000, 0.0003, 0.002)))


def ui_open():
    d = 0.14
    return mix(d, (0, osc(glide(360, 820, d, 0.07), d) * ev(d, 0.004, 0.04)), (0, 0.25 * band(0.06, 1500, 7000, 0.003, 0.02)))


def ui_close():
    d = 0.13
    return 0.8 * mix(d, (0, osc(glide(700, 330, d, 0.07), d) * ev(d, 0.004, 0.035)), (0, 0.2 * band(0.06, 1200, 5000, 0.003, 0.015)))


def ui_toggle():
    click = lambda f: partials(f, 0.04, ((1, 1, 1), (1.9, 0.4, 0.6)), 0.0004, 0.007) + 0.4 * band(0.04, 3000, 11000, 0.0002, 0.0015)
    return mix(0.1, (0, click(2900)), (0.038, 0.8 * click(2100)))


def ui_tab():
    d = 0.09
    return mix(d, (0, 0.6 * sweep(0.06, 2500, 7000, 2, ev(0.06, 0.01, 0.015))), (0.012, 0.6 * osc(1650, 0.05) * ev(0.05, 0.0008, 0.012)))


def ui_confirm():
    return mix(0.45, (0, mallet(note("G5"), 0.3, 0.12)), (0.075, mallet(note("D6"), 0.37, 0.18)))


def error():
    def bonk(f):
        d = 0.12
        fr = glide(f, f * 0.78, d, 0.06)
        return (osc(fr, d) + 0.35 * osc(fr * 2, d)) * ev(d, 0.004, 0.045)
    return flt(mix(0.25, (0, bonk(330)), (0.115, 0.9 * bonk(270))), "lowpass", 2500)


# ---- rewards ----------------------------------------------------------------------------------------------------


def coin_out():
    d = 0.1
    tick = band(d, 4000, 14000, 0.0003, 0.003)
    return mix(d, (0, partials(2637, d, ((1, 1, 1), (2.32, 0.4, 0.5), (4.1, 0.15, 0.3)), 0.0006, 0.035)), (0, 0.4 * tick))


def gem():
    d = 0.32
    body = partials(2793, d, ((1, 1, 1), (2.0, 0.18, 0.5), (3.0, 0.06, 0.3)), 0.001, 0.12)
    glints = [(0.025 * i, 0.3 * osc(f, 0.12) * ev(0.12, 0.0008, 0.03)) for i, f in enumerate((3729, 4699, 5588))]
    return mix(d, (0, body), *glints, (0, 0.2 * partials(5588, d, GLASS, 0.002, 0.08)))


def buy():
    d = 0.6
    clack = lambda: 0.5 * band(0.03, 900, 4500, 0.0005, 0.006)
    drawer = 0.6 * thump(170, 95, 0.12, 0.03) + 0.35 * band(0.12, 300, 2500, 0.002, 0.025)
    coins = [(0.09 + 0.022 * i, 0.15 * partials(2400 + 400 * i, 0.08, ((1, 1, 1), (2.32, 0.4, 0.5)), 0.0005, 0.02)) for i in range(3)]
    return mix(d, (0, clack()), (0.028, clack()), (0.05, clack()), (0.07, drawer), (0.085, 0.7 * partials(2350, 0.5, BELL, 0.001, 0.22)), *coins)


def sell():
    d = 0.45
    roll = grains(0.3, 45, 800, 3500, 0.002) * 0.6
    slide = sweep(0.3, 500, 1700, 2.5, ev(0.3, 0.12, 0.2))
    stop = 0.6 * thump(150, 85, 0.12, 0.035) + 0.3 * partials(380, 0.12, ((1, 1, 1), (2.6, 0.4, 0.5)), 0.001, 0.03)
    return mix(d, (0, 0.6 * slide + roll), (0.28, stop), (0.3, 0.15 * partials(2350, 0.15, BELL, 0.001, 0.05)))


def bag_thunk():
    d = 0.22
    return mix(d, (0, thump(125, 58, d, 0.05)), (0, 0.5 * flt(noise(d), "lowpass", 1100) * ev(d, 0.003, 0.035)),
               (0.012, 0.22 * partials(640, 0.08, ((1, 1, 1), (2.4, 0.4, 0.5)), 0.0006, 0.02)))


def upgrade():
    d = 1.25
    swish = sweep(0.1, 1500, 6500, 2, ev(0.1, 0.06, 0.03))
    shing = add(partials(2900, 0.7, METAL, 0.002, 0.25), 0.4 * band(0.3, 5000, 14000, 0.002, 0.06))
    notes = [(0.26 + 0.1 * i, 0.55 * partials(note(n), 0.8, GLOCK, 0.001, 0.25 if i < 3 else 0.5)) for i, n in enumerate(("C6", "E6", "G6", "C7"))]
    pad = [(0.56, 0.18 * brass(note(n), 0.7, 0.03, 0.3, 4)) for n in ("C5", "G5", "E5")]
    return mix(d, (0, 0.5 * swish), (0.06, 0.6 * shing), *notes, *pad)


def stamp():
    d = 0.2
    return mix(d, (0, thump(190, 85, d, 0.03, 0.02)), (0, 0.35 * partials(430, d, ((1, 1, 1), (2.3, 0.4, 0.5)), 0.0005, 0.018)),
               (0, 0.5 * band(0.02, 3000, 12000, 0.0002, 0.002)), (0.004, 0.3 * band(0.15, 1800, 7000, 0.004, 0.045)))


def task_complete():
    d = 1.0
    seq = [(0.11 * i, mallet(note(n), 0.8, 0.2 if i < 2 else 0.4)) for i, n in enumerate(("C5", "E5", "G5"))]
    return mix(d, *seq, (0.22, 0.25 * partials(note("G6"), 0.7, GLOCK, 0.001, 0.3)), (0.24, 0.12 * partials(note("C7"), 0.6, GLOCK, 0.001, 0.25)))


def quest_complete():
    d = 2.3
    line = (("G4", 0), ("C5", 0.12), ("E5", 0.24), ("G5", 0.36), ("E5", 0.52), ("G5", 0.64))
    lead = [(at, add(0.5 * brass(note(n), 0.2, 0.012, 0.1, 6), 0.4 * mallet(note(n), 0.3, 0.12))) for n, at in line]
    chord = [(0.82, 0.3 * brass(note(n), 1.45, 0.02, 0.7, 5)) for n in ("C5", "E5", "G5", "C6")]
    bells = [(0.82, 0.3 * partials(note("C7"), 1.4, GLOCK, 0.001, 0.5)), (0.95, 0.15 * partials(note("G7"), 1.2, GLOCK, 0.001, 0.4))]
    y = mix(d, *lead, *chord, *bells, (0.82, 0.4 * thump(110, 70, 0.4, 0.15, 0.1)))
    y = reverb(y, 1.0, 0.18)[:n_(d)]
    fade_end(y, 0.25)
    return y


def reward_fly():
    d = 0.38
    whoosh = sweep(d, 700, 5200, 2.2, ev(d, 0.12, 0.08))
    sp = [(0.13 + 0.04 * i, 0.18 * osc(f, 0.1) * ev(0.1, 0.0006, 0.025)) for i, f in enumerate(rng.uniform(5200, 8800, 5))]
    return mix(d, (0, 0.7 * whoosh), *sp)


def item_get():
    d = 0.16
    f = glide(480, 1150, d, 0.045)
    return mix(d, (0, (osc(f, d) + 0.18 * osc(2 * f, d)) * ev(d, 0.002, 0.045)), (0, 0.15 * band(0.01, 2000, 9000, 0.0003, 0.002)))


def level_up():
    d = 2.3
    arp = [(0.065 * i, add(0.45 * partials(note(n), 0.6, GLOCK, 0.001, 0.25), 0.35 * mallet(note(n), 0.4, 0.15)))
           for i, n in enumerate(("C5", "E5", "G5", "C6", "E6", "G6"))]
    chord = [(0.42, 0.22 * brass(note(n), 1.6, 0.03, 0.8, 5)) for n in ("C5", "E5", "G5", "C6", "E6")]
    sparkles = [(t, 0.12 * osc(f, 0.15) * ev(0.15, 0.0008, 0.05)) for t, f in zip(np.sort(rng.uniform(0.45, 1.9, 26)), rng.uniform(3500, 9000, 26))]
    y = mix(d, *arp, *chord, *sparkles, (0.42, 0.35 * partials(note("C7"), 1.6, GLOCK, 0.001, 0.6)))
    y = reverb(y, 1.2, 0.2)[:n_(d)]
    fade_end(y, 0.3)
    return y


def craft_done():
    d = 0.85
    clinks = [(0.05 * i, 0.3 * partials(f, 0.12, METAL, 0.0005, 0.05)) for i, f in enumerate((3200, 3900, 3500))]
    tada = [(0.22, add(mallet(note("G5"), 0.4, 0.12), 0.3 * partials(note("G6"), 0.3, GLOCK, 0.001, 0.15))),
            (0.36, mallet(note("C6"), 0.49, 0.3) + 0.35 * partials(note("C7"), 0.49, GLOCK, 0.001, 0.3))]
    return mix(d, *clinks, *tada)


def donate():
    d = 1.0
    y = mix(0.8, (0, 0.8 * partials(1760, 0.8, GLASS, 0.002, 0.35)), (0.06, 0.4 * partials(2637, 0.7, GLASS, 0.002, 0.3)))
    y = reverb(y, 1.6, 0.45)[:n_(d)]
    fade_end(y, 0.2)
    return y


def equip():
    d = 0.24
    return mix(d, (0, 0.5 * band(0.02, 3000, 11000, 0.0002, 0.002)), (0, 0.6 * partials(3400, 0.12, METAL, 0.0004, 0.035)),
               (0.035, 0.25 * partials(note("E7"), 0.2, GLOCK, 0.001, 0.08)))


# ---- actions ----------------------------------------------------------------------------------------------------


def land():
    d = 0.14
    return mix(d, (0, thump(115, 55, d, 0.04)), (0, 0.35 * grains(d, 1500, 900, 6000, 0.003) * ev(d, 0.002, 0.03)),
               (0, 0.3 * flt(noise(d), "lowpass", 700) * ev(d, 0.002, 0.03)))


def rustle():
    d = 0.55
    shake = mix(d, *[(at, g * ev(0.25, 0.03, 0.07)) for at, g in ((0, 1), (0.13, 0.8), (0.27, 0.6))])
    return (grains(d, 500, 1500, 9000, 0.003) + 0.15 * flt(noise(d), "bandpass", (2000, 7000))) * shake


def splash():
    d = 0.38
    plop = osc(glide(330, 1300, 0.06, 0.03), 0.06) * ev(0.06, 0.002, 0.018)
    tail = sweep(0.3, 2500, 1200, 1.2, ev(0.3, 0.006, 0.08))
    drops = [(t, 0.12 * osc(glide(f, f * 1.6, 0.04), 0.04) * ev(0.04, 0.001, 0.01)) for t, f in zip(rng.uniform(0.05, 0.28, 6), rng.uniform(1300, 3200, 6))]
    return mix(d, (0, plop), (0, 0.35 * thump(140, 75, 0.06, 0.02)), (0.008, 0.6 * tail), *drops)


def place():
    d = 0.16
    return mix(d, (0, partials(235, d, ((1, 1, 1), (2.6, 0.5, 0.45), (4.9, 0.25, 0.25)), 0.0005, 0.06)), (0, 0.6 * thump(110, 70, d, 0.03)),
               (0, 0.3 * band(0.015, 2000, 9000, 0.0002, 0.002)))


def sit():
    d = 0.2
    t = tt(0.12)
    f0 = 155 * (1 + 0.08 * np.sin(2 * np.pi * 23 * t))
    creak = flt(signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR) * (0.6 + 0.4 * rng.random(len(t))), "bandpass", (500, 2400)) * ev(0.12, 0.03, 0.04)
    return mix(d, (0, 0.8 * thump(95, 50, d, 0.05)), (0, 0.5 * flt(noise(d), "lowpass", 650) * ev(d, 0.004, 0.05)), (0.035, 0.2 * creak))


def forage():
    d = 0.35
    snap = 0.5 * band(0.02, 2000, 7000, 0.0002, 0.004) + 0.4 * partials(1300, 0.02, ((1, 1, 1),), 0.0002, 0.004)
    return mix(d, (0, snap), (0.01, 0.5 * rustle()[:n_(0.3)] * np.linspace(1, 0.2, n_(0.3))), (0.11, 0.5 * item_get()))


def dig():
    d = 0.4
    crunch = grains(0.3, 900, 300, 3500, 0.006) * ev(0.3, 0.01, 0.1)
    scrape = sweep(0.2, 4200, 2200, 3, ev(0.2, 0.01, 0.06))
    return mix(d, (0, 0.6 * thump(120, 60, 0.1, 0.04)), (0, crunch), (0.12, 0.25 * scrape), (0.2, 0.4 * grains(0.18, 300, 500, 3000, 0.004) * ev(0.18, 0.005, 0.06)))


def cast():
    d = 0.65
    env = np.sin(np.pi * np.minimum(tt(0.42) / 0.42, 1)) ** 2
    whoosh = sweep(0.42, np.concatenate([glide(300, 1600, n_(0.2) / SR), glide(1600, 600, n_(0.22) / SR)]), None, 1.8, env)
    zip_ = osc(glide(3800, 4800, 0.5), 0.5) * (0.5 + 0.5 * np.sin(2 * np.pi * 70 * tt(0.5))) * ev(0.5, 0.05, 0.15)
    return mix(d, (0, whoosh), (0.15, 0.06 * zip_), (0.15, 0.3 * grains(0.45, 60, 1500, 6000, 0.001) * ev(0.45, 0.01, 0.15)))


def reel():
    d = 0.65
    ts = np.cumsum(rng.uniform(0.031, 0.04, 18))
    click = lambda: partials(2600, 0.03, ((1, 1, 1), (0.65, 0.6, 1), (1.9, 0.3, 0.5)), 0.0002, 0.004)
    hum = 0.06 * flt(noise(d), "bandpass", (120, 400)) * np.minimum(1, (d - tt(d)) / 0.05)
    return mix(d, (0, hum), *[(t, rng.uniform(0.5, 0.9) * click()) for t in ts if t < d - 0.03])


def catch():
    d = 0.75
    burst = sweep(0.35, 1800, 3500, 1.0, ev(0.35, 0.004, 0.1))
    drops = [(t, 0.12 * osc(glide(f, f * 1.5, 0.04), 0.04) * ev(0.04, 0.001, 0.012)) for t, f in zip(rng.uniform(0.05, 0.4, 9), rng.uniform(1400, 3600, 9))]
    return mix(d, (0, 0.7 * burst), (0, 0.4 * thump(150, 80, 0.08, 0.03)), *drops,
               (0.16, 0.45 * partials(note("E6"), 0.3, GLOCK, 0.001, 0.12)), (0.27, 0.5 * partials(note("A6"), 0.48, GLOCK, 0.001, 0.25)))


def fish_escape():
    d = 0.5
    return mix(d, (0, 0.8 * splash()[:n_(0.25)]), (0.14, 0.5 * mallet(note("E5"), 0.16, 0.08)), (0.26, 0.5 * mallet(note("C5"), 0.24, 0.12)))


def jump():
    d = 0.26
    return mix(d, (0, 0.6 * sweep(0.22, 450, 1800, 1.8, ev(0.22, 0.05, 0.05))), (0, 0.25 * grains(0.12, 200, 300, 2000, 0.006) * ev(0.12, 0.002, 0.03)),
               (0, 0.3 * thump(90, 60, 0.06, 0.02)))


def step(surface, v):
    """One footstep on a surface, variation v (the build lays four in a row)."""
    d = 0.22
    g = 0.85 + 0.15 * rng.random()
    if surface == "grass":
        y = mix(d, (0, 0.6 * grains(0.16, 2500, 900, 7000, 0.003) * ev(0.16, 0.006, 0.045)), (0, 0.4 * thump(85, 55, 0.08, 0.025)))
    elif surface == "wood":
        f = 175 * (1 + 0.04 * v)
        y = mix(d, (0, partials(f, d, ((1, 1, 1), (2.3, 0.5, 0.5), (3.9, 0.25, 0.3)), 0.0008, 0.045)), (0.012, 0.25 * band(0.02, 2000, 7000, 0.0003, 0.003)))
    elif surface == "stone":
        y = mix(d, (0, 0.45 * band(0.05, 1500, 7000, 0.0003, 0.012)), (0, 0.4 * thump(110, 70, 0.06, 0.015)),
                (0.01, 0.3 * grains(0.06, 900, 2500, 9000, 0.002) * ev(0.06, 0.002, 0.015)))
    elif surface == "sand":
        y = mix(d, (0, 0.6 * grains(0.2, 3500, 500, 4500, 0.005) * ev(0.2, 0.015, 0.06)), (0, 0.25 * thump(75, 50, 0.08, 0.03)))
    else:  # shallow water
        y = mix(d, (0, 0.6 * sweep(0.2, 1400, 2600, 1.0, ev(0.2, 0.004, 0.06))),
                *[(t, 0.15 * osc(glide(f, f * 1.5, 0.04), 0.04) * ev(0.04, 0.001, 0.01)) for t, f in zip(rng.uniform(0.02, 0.15, 3), rng.uniform(900, 2500, 3))])
    return g * y


def footsteps(surface):
    return mix(1.75, *[(0.42 * i + rng.uniform(-0.015, 0.015) + 0.02, step(surface, i)) for i in range(4)])


def voice_blip():
    """A line of talk blips: a glottal buzz through two vowel formants, pitch wandering like a sentence."""
    vowels = ((800, 1200), (500, 1700), (350, 2300), (450, 900), (650, 1500))
    parts, at = [], 0.02
    for i in range(9):
        d = rng.uniform(0.055, 0.085)
        f0 = 260 * 2 ** (rng.choice([0, 2, 4, 7, -3]) / 12) * (0.92 if i == 8 else 1)
        pulse = signal.sawtooth(2 * np.pi * np.cumsum(glide(f0, f0 * 1.04, d)) / SR) * ev(d, 0.006, d * 0.5)
        f1, f2 = vowels[rng.integers(len(vowels))]
        parts.append((at, flt(pulse, "bandpass", (f1 * 0.7, f1 * 1.3)) + 0.5 * flt(pulse, "bandpass", (f2 * 0.8, f2 * 1.2))))
        at += d + rng.uniform(0.015, 0.035)
    return mix(at + 0.05, *parts)


def voice_kalimba():
    """A line of talk blips as soft plucked notes on a pentatonic scale."""
    scale = [note(n) for n in ("C5", "D5", "E5", "G5", "A5", "C6")]
    parts, at = [], 0.02
    for i in range(9):
        parts.append((at, partials(scale[rng.integers(len(scale))], 0.12, ((1, 1, 1), (3.0, 0.15, 0.3), (5.2, 0.05, 0.2)), 0.002, 0.03)))
        at += rng.uniform(0.075, 0.11)
    return mix(at + 0.12, *parts)


# ---- ambience (stereo; made LOOP + XF long) --------------------------------------------------------------------

LOOP, XF = 24.0, 2.0
D = LOOP + XF


def st(x, w=0.6):
    """A mono bed to stereo: the same bed and a decorrelated copy (all-pass by a short delay)."""
    y = np.roll(x, n_(0.013))
    return np.stack([x, (1 - w) * x + w * y], 1)


def pink(d, ch=2):
    x = noise(d, ch)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, x, axis=0) * 4


def amb_sea():
    t = tt(D)
    swell = 0.55 + 0.45 * (0.6 * np.sin(2 * np.pi * t / 8 + 0.5) + 0.4 * np.sin(2 * np.pi * t / 13)) ** 2
    lo = flt(pink(D), "lowpass", 500) * swell[:, None]
    hi = flt(pink(D), "bandpass", (600, 3000)) * (swell ** 2)[:, None] * 0.35
    return lo + hi


def amb_shore():
    t = tt(D)
    y = 0.25 * flt(pink(D), "lowpass", 400)
    at = 0.3
    while at < D:
        w = min(7.5, D - at)
        tw = tt(w)
        rise = np.minimum(tw / 1.4, 1) ** 2 * np.exp(-np.maximum(tw - 1.4, 0) / 0.5)
        roar = sweep(w, glide(300, 1800, w, 1.4), None, 0.8, rise)
        wash = np.exp(-np.maximum(tw - 1.5, 0) / 1.6) * (tw > 1.4) * np.minimum(np.maximum(tw - 1.4, 0) / 0.2, 1)
        fizz = (flt(noise(w), "highpass", 2500) * 0.25 + grains(w, 900, 3000, 12000, 0.002)) * wash
        p = rng.uniform(-0.4, 0.4)
        y[n_(at):n_(at) + len(tw)] += pan(0.9 * roar + 0.6 * fizz, p)
        at += rng.uniform(5.5, 7.5)
    return y


def amb_wind():
    g = 0.35 + 0.65 * smooth_noise(D, 0.25, 4) ** 1.5
    body = flt(pink(D), "bandpass", (180, 1400)) * g[:, None]
    whistle = np.stack([sweep(D, 600 + 500 * smooth_noise(D, 0.2, s), None, 12) for s in (5, 6)], 1) * (g ** 2)[:, None] * 0.25
    leaves = np.stack([grains(D, 120, 2000, 9000, 0.003) for _ in range(2)], 1) * (g ** 3)[:, None] * 0.3
    return body + whistle + leaves


def bird(kind, pitch=1.0):
    """One bird's phrase."""
    if kind == "trill":
        n = rng.integers(6, 12)
        parts = [(0.065 * i, osc(glide(3800 * pitch, 3300 * pitch, 0.045), 0.045) * ev(0.045, 0.004, 0.015)) for i in range(n)]
        return mix(0.07 * n + 0.05, *parts)
    if kind == "teeyoo":
        a = osc(glide(4200 * pitch, 4500 * pitch, 0.12), 0.12) * ev(0.12, 0.01, 0.05)
        b = osc(glide(4300 * pitch, 3000 * pitch, 0.22), 0.22) * ev(0.22, 0.01, 0.08)
        return mix(0.45, (0, a), (0.17, b))
    if kind == "warble":
        d = rng.uniform(0.5, 0.9)
        f = 3000 * pitch + 500 * np.sin(2 * np.pi * 28 * tt(d)) + 600 * smooth_noise(d, 8)
        return osc(f, d) * np.sin(np.pi * tt(d) / d) ** 0.5 * 0.6
    if kind == "coo":  # a dove, low and soft
        c = lambda d: osc(glide(560 * pitch, 470 * pitch, d), d) * np.sin(np.pi * tt(d) / d) ** 2
        return mix(1.4, (0, 0.6 * c(0.25)), (0.32, c(0.45)), (0.85, 0.7 * c(0.35)))
    d = 0.08  # chip
    return osc(glide(5200 * pitch, 3800 * pitch, d), d) * ev(d, 0.003, 0.025)


def birds_bed(density, kinds, base=0.08):
    y = st(base * flt(pink(D, 1), "bandpass", (200, 1500)), 0.7)
    for _ in range(int(D * density)):
        k = kinds[rng.integers(len(kinds))]
        x = bird(k, rng.uniform(0.85, 1.15)) * rng.uniform(0.15, 0.6)
        at = rng.uniform(0, D - len(x) / SR)
        y += mix(D, (at, pan(x, rng.uniform(-0.8, 0.8))))
    return reverb(y, 0.9, 0.35)[:n_(D)]


def amb_birds_dawn():
    return birds_bed(2.2, ("trill", "teeyoo", "warble", "chip", "trill", "warble"))


def amb_birds_day():
    return birds_bed(0.8, ("teeyoo", "chip", "coo", "warble"), 0.1)


def crickets(n=6, level=1.0, d=D):
    y = np.zeros((n_(d), 2))
    for i in range(n):
        f = rng.uniform(4300, 5300)
        rate = rng.uniform(1.6, 2.6)
        at = rng.uniform(0, 0.5)
        pulse = osc(f, 0.014) * np.sin(np.pi * tt(0.014) / 0.014)
        chirp = mix(0.12, *[(0.028 * k, pulse) for k in range(3)])
        x = mix(d, *[(a, chirp * rng.uniform(0.7, 1)) for a in np.arange(at, d - 0.2, 1 / rate)])
        y += pan(x, rng.uniform(-0.9, 0.9)) * rng.uniform(0.15, 0.4) * level
    return y


def amb_crickets():
    return crickets() + 0.06 * flt(pink(D), "lowpass", 600)


def amb_rain():
    patter = np.stack([grains(D, 2500, 1200, 12000, 0.0015) for _ in range(2)], 1) * 0.35
    hiss = flt(pink(D), "bandpass", (1500, 9000)) * 0.12
    low = flt(pink(D), "lowpass", 350) * 0.25
    drops = [(t, pan(0.12 * osc(glide(f, f * 0.7, 0.03), 0.03) * ev(0.03, 0.0005, 0.006), rng.uniform(-1, 1)))
             for t, f in zip(rng.uniform(0, D - 0.05, int(D * 12)), rng.uniform(2000, 5000, int(D * 12)))]
    return patter + hiss + low + mix(D, *drops)


def amb_river():
    babble = flt(pink(D), "bandpass", (250, 2500)) * (0.6 + 0.4 * np.stack([smooth_noise(D, 3, s) for s in (7, 8)], 1)) * 0.5
    bub = [(t, pan(0.1 * osc(glide(f, f * 1.8, 0.035), 0.035) * ev(0.035, 0.001, 0.012), rng.uniform(-0.8, 0.8)))
           for t, f in zip(rng.uniform(0, D - 0.05, int(D * 70)), rng.uniform(400, 1600, int(D * 70)))]
    return babble + mix(D, *bub)


def amb_fire():
    roar = flt(pink(D), "lowpass", 280) * (0.6 + 0.4 * smooth_noise(D, 1.5, 9))[:, None] * 0.8
    hiss = flt(pink(D), "highpass", 3000) * 0.04
    pops = []
    for t in rng.uniform(0, D - 0.1, int(D * 9)):
        for k in range(rng.integers(1, 4)):
            x = band(0.03, 1500, 9000, 0.0001, rng.uniform(0.001, 0.004)) * rng.uniform(0.2, 1)
            pops.append((t + 0.012 * k, pan(x, rng.uniform(-0.4, 0.4))))
    return roar + hiss + 0.6 * mix(D, *pops)


def amb_cave():
    t = tt(D)
    drone = flt(pink(D), "lowpass", 160) * 0.5 + 0.05 * np.stack([np.sin(2 * np.pi * 55 * t), np.sin(2 * np.pi * 55.3 * t)], 1)
    drips = [(at, pan(0.5 * osc(glide(f, f * 1.7, 0.05, 0.02), 0.05) * ev(0.05, 0.0008, 0.012), rng.uniform(-0.8, 0.8)))
             for at, f in zip(np.arange(0.6, D - 0.1, 1.6) + rng.uniform(-0.4, 0.4, len(np.arange(0.6, D - 0.1, 1.6))), rng.uniform(1100, 2600, 40))]
    wet = reverb(mix(D, *drips), 2.6, 0.7)[:n_(D)]
    return drone + wet


def amb_night():
    hoot = lambda: osc(glide(400, 360, 0.5), 0.5) * np.sin(np.pi * tt(0.5) / 0.5) ** 1.5
    owl = mix(1.6, (0, 0.6 * hoot()), (0.7, hoot()), (1.05, 0.8 * hoot()))
    y = crickets(5, 0.6) + 0.5 * amb_wind() * 0.4
    y = flt(y, "lowpass", 7000) + mix(D, (9.0, pan(0.12 * flt(owl, "lowpass", 1200), -0.5)))
    return reverb(y, 1.0, 0.2)[:n_(D)]


# ---- registry ---------------------------------------------------------------------------------------------------

SOUNDS = {
    "ui-tap": ui_tap, "ui-tap-wood": ui_tap_wood, "ui-open": ui_open, "ui-close": ui_close, "ui-toggle": ui_toggle, "ui-tab": ui_tab,
    "ui-confirm": ui_confirm, "error": error,
    "coin-out": coin_out, "gem": gem, "buy": buy, "sell": sell, "bag-thunk": bag_thunk, "upgrade": upgrade, "stamp": stamp,
    "task-complete": task_complete, "quest-complete": quest_complete, "reward-fly": reward_fly, "item-get": item_get,
    "level-up": level_up, "craft-done": craft_done, "donate": donate,
    "land": land, "rustle": rustle, "splash": splash, "place": place, "sit": sit, "forage": forage, "dig": dig, "cast": cast,
    "reel": reel, "catch": catch, "fish-escape": fish_escape, "equip": equip, "jump": jump, "voice-blip": voice_blip, "voice-kalimba": voice_kalimba,
    **{f"footstep-{s}": (lambda s=s: footsteps(s)) for s in ("grass", "wood", "stone", "sand", "water")},
    "amb-sea": amb_sea, "amb-shore": amb_shore, "amb-wind": amb_wind, "amb-birds-dawn": amb_birds_dawn, "amb-birds-day": amb_birds_day,
    "amb-crickets": amb_crickets, "amb-rain": amb_rain, "amb-river": amb_river, "amb-fire": amb_fire, "amb-cave": amb_cave,
    "amb-night": amb_night,
}


def make(name):
    """Fresh randomness per sound, so one sound never shifts another."""
    global rng
    rng = np.random.default_rng(sum(map(ord, name)) * 7919)
    y = SOUNDS[name]()
    return y / max(np.max(np.abs(y)), 1e-9) * 0.7


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name in sys.argv[2:] or SOUNDS:
        y = make(name)
        with wave.open(os.path.join(out, name + ".wav"), "wb") as w:
            w.setnchannels(1 if y.ndim == 1 else 2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((y * 32767).astype(np.int16).tobytes())
        print("wrote", name, f"{len(y) / SR:.2f}s")
