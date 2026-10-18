"""A stand-in keyswitch click (the TSI keycap keychain, specs/merch/tsi-keycap-keychain.md) until David records the
real one: a linear switch's bottom-out (a sharp tick, a plastic ring, a low thock) at 0 and its softer, higher return at
0.11 s, in step with the keycap's press (lib/game/keychainSwing.ts PRESS). One file: swap in the recording, same name.

  python3 art/audio/synth_keyswitch.py <wav> && ffmpeg -y -i <wav> -c:a vorbis -strict -2 -ac 2 -q:a 5 web/public/audio/sfx/keyswitch.ogg
"""
import sys, wave
import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/keyswitch.wav"
rng = np.random.default_rng(7)
n = int(SR * 0.26)
t = np.arange(n) / SR
y = np.zeros(n)


def hit(at, gain, ring_hz, ring_ms, thock_hz, thock_gain, tick_ms):
    s = (t - at)
    on = s >= 0
    s = np.where(on, s, 0)
    noise = rng.standard_normal(n)
    noise = noise - np.convolve(noise, np.ones(6) / 6, mode="same")          # high-passed: a dry tick
    tick = noise * np.exp(-s / (tick_ms / 1000)) * on
    ring = np.sin(2 * np.pi * ring_hz * s) * np.exp(-s / (ring_ms / 1000)) * on
    ring2 = np.sin(2 * np.pi * ring_hz * 1.53 * s) * np.exp(-s / (ring_ms / 1600)) * on * 0.35
    thock = np.sin(2 * np.pi * thock_hz * s) * np.exp(-s / 0.022) * on * thock_gain
    return gain * (0.55 * tick + 0.5 * ring + ring2 + thock)


y += hit(0.004, 1.0, 1850, 11, 260, 0.8, 1.6)       # the bottom-out
y += hit(0.114, 0.5, 3100, 7, 520, 0.25, 1.0)       # the return
fade = np.minimum(1, (n - np.arange(n)) / (SR * 0.02))
y *= fade
y = y / np.max(np.abs(y)) * 0.7
with wave.open(OUT, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print("wrote", OUT, f"{n / SR:.2f}s")
