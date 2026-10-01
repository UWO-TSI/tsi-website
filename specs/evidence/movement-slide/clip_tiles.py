"""Tile clip_sheet.py's renders into one slow-motion strip per group: a row per clip and view (side, three-quarters),
each frame labelled with its time in the clip.   python3 specs/evidence/movement-slide/clip_tiles.py <render_dir>"""
import json, os, subprocess, sys

SRC = sys.argv[1]
OUT = os.path.dirname(os.path.abspath(__file__))
FONT = "/System/Library/Fonts/Monaco.ttf"
times = json.load(open(os.path.join(SRC, "times.json")))
GROUPS = {"clips-crouch": ["CrouchIdle", "CrouchWalk"], "clips-slide-entry": ["SlideIn", "SlideInDash"], "clips-slide": ["Slide"],
          "clips-slide-exits": ["SlideUp", "SlideJump", "SlideStand", "SlideBonk"]}
VIEW = {"side": "side", "34": "3/4"}
for group, clips in GROUPS.items():
    rows = []
    for clip in clips:
        for view in ("side", "34"):
            args = ["magick", "montage"]
            for i, t in enumerate(times[clip]):
                args += ["-label", f"{clip} {VIEW[view]}  {int(round(t * 1000))} ms", os.path.join(SRC, f"{clip}_{view}_{i}.png")]
            row = os.path.join(SRC, f"row_{clip}_{view}.png")
            args += ["-tile", "6x1", "-geometry", "210x182+2+2", "-background", "#0b0e14", "-fill", "#f1ffff", "-font", FONT, "-pointsize", "11", row]
            subprocess.run(args, check=True)
            rows.append(row)
    out = os.path.join(OUT, f"{group}.webp")
    subprocess.run(["magick", *rows, "-background", "#0b0e14", "-gravity", "west", "-append", "-quality", "78", out], check=True)
    print("wrote", out)
