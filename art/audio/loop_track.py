"""Make a music track loop (game/sushi-bar; the sushi bar's Suno tracks, web/public/assets/audio/music/README.md).

  python3 art/audio/loop_track.py <source> <out.mp3> <bpm> [--lufs -14.5]

Reads the source (never changes it), finds its beats near `bpm` (librosa) and its bar lines (the beat phase whose
beats hit hardest), and keeps whole bars from the first bar line to the last one still at full level with a bar after
it (no outro); the bar after the cut is crossfaded (equal power, one beat) into the start, so as the track wraps it
runs on with no seam, and both ends go to silence over 3 ms (no click where the player jumps back). Then one gain to
`--lufs` integrated (the game's other music measures -13.3 and -14.9), a limiter at -1 dB (it lands about 0.4 under),
128 kbps MP3 at 48 kHz, no tags. Prints the loop's bars and its start and end.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import librosa
import soundfile as sf

SR = 48000


def ffmpeg(*args):
    return subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-y", *args], capture_output=True, text=True, check=True)


def main(src, out, bpm, lufs=-14.5):
    tmp = tempfile.mkdtemp()
    raw = os.path.join(tmp, "raw.wav")
    ffmpeg("-i", src, "-ar", str(SR), "-ac", "2", "-c:a", "pcm_f32le", raw)
    y, _ = sf.read(raw, dtype="float32")
    mono = librosa.resample(y.mean(axis=1), orig_sr=SR, target_sr=22050)
    env = librosa.onset.onset_strength(y=mono, sr=22050)
    tempo, beats = librosa.beat.beat_track(onset_envelope=env, sr=22050, start_bpm=bpm, tightness=400)
    times = librosa.frames_to_time(beats, sr=22050)
    strength = env[beats]
    phase = max(range(4), key=lambda k: strength[k::4].mean())
    bars = times[phase::4]
    beat = 60.0 / float(tempo)
    # Each bar's level; the loop ends on the last bar line with a full bar after it.
    level = np.array([np.sqrt(np.mean(y[int(a * SR):int(b * SR)] ** 2)) for a, b in zip(bars, bars[1:])])
    full = level >= 0.7 * np.median(level)
    first = int(np.argmax(full))
    last = max(i for i in range(len(full)) if full[i] and i > first)
    start, end = bars[first], bars[last]
    s, e, x = int(round(start * SR)), int(round(end * SR)), int(round(beat * SR))
    loop = y[s:e].copy()
    t = np.linspace(0.0, np.pi / 2, x, dtype=np.float32)[:, None]
    loop[:x] = loop[:x] * np.sin(t) + y[e:e + x] * np.cos(t)
    # 3 ms to silence at both ends: the MP3's edge frames and the audio element's own wrap are never sample-exact.
    edge = np.linspace(0.0, 1.0, int(0.003 * SR), dtype=np.float32)[:, None]
    loop[:len(edge)] *= edge
    loop[-len(edge):] *= edge[::-1]
    looped = os.path.join(tmp, "loop.wav")
    sf.write(looped, loop, SR, subtype="FLOAT")
    meas = ffmpeg("-i", looped, "-af", "loudnorm=print_format=json", "-f", "null", "-").stderr
    measured = float(json.loads(meas[meas.rindex("{"):meas.rindex("}") + 1])["input_i"])
    gain = lufs - measured
    ffmpeg("-i", looped, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.891:attack=1:release=50:level=false:latency=true", "-ar", str(SR),
           "-c:a", "libmp3lame", "-b:a", "128k", "-map_metadata", "-1", out)
    print(json.dumps({"tempo": round(float(tempo), 2), "bars": last - first, "start": round(float(start), 3), "end": round(float(end), 3),
                      "length": round(float(end - start), 3), "gain_db": round(gain, 2)}))


if __name__ == "__main__":
    a = sys.argv[1:]
    lufs = float(a[a.index("--lufs") + 1]) if "--lufs" in a else -14.5
    main(a[0], a[1], float(a[2]), lufs)
