"""One mastering chain for every sound: trim, EQ, level to the category's loudness, encode.

  python3 art/audio/master.py <in> <out.ogg> <category>   master one file, print the result as JSON
"""
import json, os, re, subprocess, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfxlib import SR, CEILING, lufs, true_peak, limit, level, encode, measure

TARGET = {"ui": -20, "voice": -20, "actions": -18, "rewards": -16, "footsteps": -26, "ambience": -26}
INTEGRATED = {"footsteps": True, "ambience": True}
UI = {"click", "confirm", "keyswitch", "enter", "exit", "vb-call", "vb-good", "vb-early",
      "vb-late", "vb-heat", "vb-charge"}
REWARDS = {"coin", "coin-out", "gem", "sell", "upgrade", "stamp", "stamp-heavy", "quest-complete",
           "item-get", "level-up", "catch", "vb-win", "vb-point", "vb-perfect", "vb-max",
           "bite-legendary", "bite-divine"}


def category_of(path_or_id):
    p = str(path_or_id)
    parts = os.path.normpath(p).split(os.sep)
    if "ambient" in parts:
        return "ambience"
    sid = re.sub(r"\.(ogg|mp3|wav)$", "", os.path.basename(p), flags=re.I)
    sid = re.sub(r"-\d+$", "", sid)
    if sid.startswith("amb-") or sid.startswith("bed-"):
        return "ambience"
    if sid.startswith("footstep"):
        return "footsteps"
    if sid == "voice-blip" or sid in {"blip1", "blip2", "blip3", "blip4", "blip5"}:
        return "voice"
    if sid in UI:
        return "ui"
    if sid in REWARDS:
        return "rewards"
    return "actions"


def decode(path, ch):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", path, "-ac", str(ch), "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).astype(np.float64)
    return y.reshape(-1, ch) if ch > 1 else y


def trim(y):
    thr = 10 ** (-50 / 20)
    a = np.abs(y) if y.ndim == 1 else np.abs(y).max(1)
    idx = np.where(a >= thr)[0]
    if len(idx) == 0:
        return y
    pad = int(round(0.002 * SR))
    y = y[max(0, idx[0] - pad):min(len(y), idx[-1] + 1 + pad)].copy()
    n_in = min(int(round(0.002 * SR)), len(y))
    fade = np.linspace(0, 1, n_in)
    y[:n_in] *= fade if y.ndim == 1 else fade[:, None]
    n_out = min(int(round(0.015 * SR)), len(y))
    fade = np.linspace(1, 0, n_out)
    y[-n_out:] *= fade if y.ndim == 1 else fade[:, None]
    return y


def centroid(y):
    m = y if y.ndim == 1 else y.mean(1)
    spec = np.abs(np.fft.rfft(m))
    freqs = np.fft.rfftfreq(len(m), 1 / SR)
    return float((spec * freqs).sum() / (spec.sum() + 1e-12))


def eq(y, category, cen):
    # Light touch (David, SFX Audit 1: the first batch sounded dull): only a harsh sound gets its top softened.
    g = -3 if cen > 5000 else 0
    hp = 30 if category == "ambience" else 60
    ch = 2 if y.ndim == 2 else 1
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-f", "f32le", "-ar", str(SR), "-ac", str(ch),
                          "-i", "-", "-af", f"highpass=f={hp}" + ("" if category == "ambience" else ",afftdn=nr=15:nf=-55") + (f",treble=g={g}:f=8000" if g else ""), "-f", "f32le", "-"],
                         input=y.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).astype(np.float64)
    return y.reshape(-1, ch) if ch > 1 else y


def master(in_path, out_path, category):
    amb = category == "ambience"
    integrated = INTEGRATED.get(category, False)
    target = TARGET[category]
    y0 = decode(in_path, 2 if amb else 1)
    in_lufs = lufs(y0, integrated)
    y = y0 if amb else trim(y0)
    cen_before = centroid(y)
    y = eq(y, category, cen_before)
    cen_after = centroid(y)
    y = level(y, target, integrated)
    z = y
    for _ in range(3):
        encode(y, out_path, 4 if amb else 5)
        z = measure(out_path, amb)
        over = true_peak(z) - (CEILING - 0.1)
        if over <= 0:
            break
        y = limit(y, CEILING - 1.2 - over - 0.3)
    return {"in_lufs": round(float(in_lufs), 2), "out_lufs": round(float(lufs(z, integrated)), 2),
            "true_peak": round(float(true_peak(z)), 2), "centroid_before": round(cen_before, 1),
            "centroid_after": round(cen_after, 1), "seconds": round(len(z) / SR, 3)}


if __name__ == "__main__":
    src, dst, cat = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    print(json.dumps(master(src, dst, cat)))
