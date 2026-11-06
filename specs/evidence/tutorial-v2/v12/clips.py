"""Cut round 12's clips from the walk's videos: every beat in clips-*.json as an mp4 (H.264, cropped to its area, 30 fps)
and a poster frame (webp, from the beat's middle). Times are from the scene's start, as walk.mjs logs them.

    python3 specs/evidence/tutorial-v2/v12/clips.py <shots dir> <out dir> [id=name ...]
`id=name` renames a beat's files (u-open=t12-desktop-open); beats not named are skipped when any are named.
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
names = dict(a.split("=", 1) for a in sys.argv[3:])
out.mkdir(parents=True, exist_ok=True)
for f in sorted(src.glob("clips-*.json")):
    for c in json.loads(f.read_text()):
        if names and c["id"] not in names: continue
        name = names.get(c["id"], c["id"])
        if not c.get("path") or "to" not in c: print("skip", c["id"]); continue
        a, b = max(0, c["from"] - 0.3), c["to"]
        vf = ["fps=30"]
        if c.get("crop"):
            k = c["crop"]; vf.insert(0, f"crop={k['width']}:{k['height']}:{k['x']}:{k['y']}")
        vf.append("scale=trunc(iw/2)*2:trunc(ih/2)*2")
        mp4 = out / f"{name}.mp4"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{a:.2f}", "-to", f"{b:.2f}", "-i", c["path"], "-vf", ",".join(vf),
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-movflags", "+faststart", "-an", str(mp4)], check=True)
        png = out / f"{name}-poster.png"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{(b - a) * 0.75:.2f}", "-i", str(mp4), "-frames:v", "1", str(png)], check=True)
        Image.open(png).save(out / f"{name}-poster.webp", quality=84); png.unlink()
        print(name, f"{b - a:.1f}s", mp4.stat().st_size // 1024, "KB")
