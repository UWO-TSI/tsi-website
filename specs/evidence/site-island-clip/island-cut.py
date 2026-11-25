import os, glob, sys, subprocess
src = sys.argv[1]; out = sys.argv[2]
# (start ms, end ms, speed) in the take
# Cuts for the 2026-11-14 take: re-pick them from a contact sheet for a new take.
SEGS = [(400, 4600, 1), (7600, 10400, 1), (10400, 13400, 3), (13400, 17600, 1.5), (17600, 20400, 1), (25300, 31600, 1)]
fs = sorted(glob.glob(f"{src}/frames/*.jpg"))
ts = [int(os.path.basename(f).split("_")[1][:-4]) for f in fs]
lines, total = ["ffconcat version 1.0"], 0.0
for a, b, s in SEGS:
    idx = [i for i, t in enumerate(ts) if a <= t < b]
    for j, i in enumerate(idx):
        nxt = ts[idx[j + 1]] if j + 1 < len(idx) else b
        d = max(0.001, (nxt - ts[i]) / 1000 / s)
        lines += [f"file '{os.path.abspath(fs[i])}'", f"duration {d:.4f}"]
        total += d
lines.append(f"file '{os.path.abspath(fs[idx[-1]])}'")
open("cut.ffconcat", "w").write("\n".join(lines) + "\n")
print("seconds", round(total, 2))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "cut.ffconcat",
  "-vf", "crop=1600:900:0:40,fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "29",
  "-g", "8", "-keyint_min", "8", "-sc_threshold", "0", "-movflags", "+faststart", "-an", out], check=True)
print("bytes", os.path.getsize(out))
