"""Tile the avatar v7 evidence (shots.mjs PNGs, Blender viewport captures, uv_dump.py) into the review sheets (Pillow).

  python3 specs/evidence/avatar-v7/sheets.py <shots_dir>
<shots_dir> holds shots.mjs's PNGs, blender/head-wire-{front,34}.png (live-session viewport captures) and
face_uv.json (uv_dump.py). Writes next to this script:
  01-styles.webp            the three styles in the engine: front and 3/4 close-ups (faces at 1024), full body, and
                            the real character creator's stage turned both ways
  02-vs-hair-3d-set.webp    each style (black hair) beside the hair-3d-set / bangs-sheet cells it follows
  03-vs-ref18.webp          reference 18's head beside the v7 bob at its measured view yaw (26 deg)
  04-expressions.webp       the six expressions
  05-blink-talk.webp        a blink (open, half, closed, half, open), the talk cells, and 12 frames of the face on its
                            own clock while talking (90 ms apart)
  06-village.webp           the game camera at village distance (pixel filter as shipped), one per style
  07-head-and-face.webp     the hand-modeled head's topology (Blender), its face UV layout over the default painted
                            face, and the face atlas
  08-world-512.webp         the world atlas (512 px per face canvas) beside the creator's 1024
  09-library.webp           the rest of the hair library on the v7 head: every bangs over the bob, every back under
                            the straight fringe (older shell styles and the new lock styles mix)
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

S = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
REF = os.path.join(ROOT, "specs", "references", "characters", "david")
BG = (250, 246, 238)
INK = (70, 55, 40)
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()


def load(name, box=None, h=None, d=S):
    im = Image.open(os.path.join(d, name) if not os.path.isabs(name) else name).convert("RGB")
    if box:
        im = im.crop(box)
    if h:
        im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    return im


def cells(name, n, h=None):
    """The n cells of a bench grid sheet (padding 8, gap 8 css px at 2x; square head cells)."""
    im = Image.open(os.path.join(S, name)).convert("RGB")
    w = (im.width - 32 - 16 * (n - 1)) / n
    out = [im.crop((round(16 + i * (w + 16)), 16, round(16 + i * (w + 16) + w), round(16 + w))) for i in range(n)]
    return [c.resize((round(c.width * h / c.height), h), Image.LANCZOS) for c in out] if h else out


def single(name, aspect=1.0, h=None):
    """The one 420 css px cell of a single-cell bench sheet."""
    im = Image.open(os.path.join(S, name)).convert("RGB").crop((16, 16, 856, 16 + round(840 * aspect)))
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS) if h else im


def grid(rows, labels, title, pad=12, head=34):
    w = max(sum(i.width for i in r) + pad * (len(r) - 1) for r in rows) + 2 * pad
    h = sum(max(i.height for i in r) + head for r in rows) + pad * (len(rows) + 1) + 40
    out = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(out)
    d.text((pad, 10), title, fill=INK, font=FONT)
    y = 40 + pad
    for r, lab in zip(rows, labels):
        d.text((pad, y + 4), lab, fill=INK, font=FONT)
        y += head
        x = pad
        for im in r:
            out.paste(im, (x, y))
            x += im.width + pad
        y += max(i.height for i in r) + pad
    return out


def save(im, name):
    im.save(os.path.join(HERE, name), "WEBP", quality=88, method=6)
    print("wrote", name, im.size)


STYLES = ["short", "bob", "long"]

# 01 styles
head = cells("bench-styles.png", 6, 420)
body = [single(f"bench-body-{s}.png", 4 / 3, 560) for s in STYLES]
creator = [load(f"creator-{s}-{v}.png", h=560) for s in STYLES for v in ("34", "front")]
save(grid([head[0:2] + [body[0]] + creator[0:2], head[2:4] + [body[1]] + creator[2:4], head[4:6] + [body[2]] + creator[4:6]],
          ["short (bangs_spiky + back_short_spiky): bench front, 3/4, body; creator stage turned left / right",
           "bob (bangs_straight + back_bob)", "long (bangs_curtain + back_long)"],
          "Avatar v7 milestone 1: sculpted-lock hair on the hand-modeled head, in the engine (runtime Character, creator lights)"),
     "01-styles.webp")

# 02 beside hair-3d-set
B = Image.open(os.path.join(REF, "LABELLED-hair-3d-set.png")).convert("RGB")
N = Image.open(os.path.join(REF, "LABELLED-bangs-sheet.png")).convert("RGB")


def bcell(code, h=420):
    r, c = (int(x) for x in code[1:].split("."))
    if code[0] == "B":
        cw, ch, im = B.width / 5, B.height / 7, B
    else:
        cw, ch, im = N.width / 5, N.height / 6, N
    cut = im.crop((round((c - 1) * cw), round((r - 1) * ch), round(c * cw), round(r * ch)))
    return cut.resize((round(cut.width * h / cut.height), h), Image.LANCZOS)


black = cells("bench-styles-black.png", 6, 420)
REFS = {"short": ["B6.2", "B1.3", "B3.4"], "bob": ["B2.1", "B6.4", "N4.2"], "long": ["B3.1", "B5.3", "N3.2"]}
save(grid([[bcell(c) for c in REFS[s]] + black[2 * i:2 * i + 2] for i, s in enumerate(STYLES)],
          [f"{s}: David's cells {', '.join(REFS[s])} | v7 in the engine, black hair (palette 0), front and 3/4" for s in STYLES],
          "Beside hair-3d-set and the bangs sheet (David's references)"), "02-vs-hair-3d-set.webp")

# 03 beside reference 18
ref18 = load(os.path.join(REF, "character-ref-18.png"), box=(170, 20, 600, 450), h=640)
v7 = single("bench-ref18-angle.png", 1.0, 640)
save(grid([[ref18, v7]], ["reference 18 (hooded) | v7 bob, hair 2, at reference 18's measured view yaw (26 deg)"],
          "Beside reference 18: head shape, face placement, eye size"), "03-vs-ref18.webp")

# 04 expressions
save(grid([cells("bench-expressions.png", 6, 420)], ["neutral | happy (E8.1, M2.1) | surprised (M6.1) | sad (half lid, M4.3) | angry (M2.2) | sleepy (E1.6, M3.1)"],
          "The six expressions (row 144): eye and mouth cells from David's picks, brows moved and tilted by the shader"),
     "04-expressions.webp")

# 05 blink + talk
live = [single(f"live-talk-{i:02d}.png", 1.0, 300) for i in range(12)]
save(grid([cells("bench-blink.png", 5, 420), cells("bench-talk.png", 5, 420), live[:6], live[6:]],
          ["blink: open, half, closed, half, open (0.04 + 0.07 + 0.04 s, every 2-6 s at random)",
           "talk cells: the look's mouth (M1.1), G5.2, M3.1, G5.1, G1.3 (about 9 a second, random order)",
           "the face on its own clock while talking: 12 frames, 90 ms apart", ""],
          "Blinking and talking without redrawing a canvas: the face shader switches atlas cells by uniform"), "05-blink-talk.webp")

# 06 village
vill = [load(f"village-{s}.png", box=(1040, 540, 1840, 1300), h=560) for s in STYLES]
full = load("village-bob.png", h=560)
save(grid([vill + [full]], ["short (hair 0) | bob (hair 2) | long (hair 6), crops round the player | the full bob frame"],
          "The game camera at village distance (untouched, pixel filter as shipped)"), "06-village.webp")

# 07 head topology, UV layout, atlas
wire = [load(os.path.join(S, "blender", f"head-wire-{v}.png"), box=(360, 60, 1040, 700), h=600) for v in ("front", "34")]
face = Image.open(os.path.join(ROOT, "art", "characters", "v7", "face", "v7_face_default.png")).convert("RGB").resize((600, 600), Image.LANCZOS)
d = ImageDraw.Draw(face)
for poly in json.load(open(os.path.join(S, "face_uv.json"))):
    pts = [(u * 600, w * 600) for u, w in poly]
    d.line(pts + [pts[0]], fill=(40, 90, 160), width=1)
atlas = Image.open(os.path.join(ROOT, "art", "characters", "v7", "face", "v7_face_atlas.png")).convert("RGBA")
check = Image.new("RGBA", atlas.size, (236, 228, 212, 255))
cd = ImageDraw.Draw(check)
for y in range(0, atlas.height, 32):
    for x in range(0, atlas.width, 32):
        if (x // 32 + y // 32) % 2:
            cd.rectangle((x, y, x + 31, y + 31), fill=(224, 214, 196, 255))
check.alpha_composite(atlas)
atl = check.convert("RGB")
atl = atl.resize((round(atl.width * 600 / atl.height), 600), Image.LANCZOS)
save(grid([wire + [face], [atl]],
          ["V7_Head in Blender (head.blend): 12-vertex loops round the eyes, 8 round the mouth, quads | face UVs over the default face",
           "the face atlas (v7_face_atlas.png, 1024 px per face canvas): one side of each eye with blink frames, brows, 76 mouths, extras"],
          "The hand-modeled head and the painted-face system"), "07-head-and-face.webp")

# 08 world atlas
save(grid([cells("bench-styles.png", 6, 360), cells("bench-styles-world512.png", 6, 360)],
          ["creator: face atlas at 1024 px per face canvas", "world: the 512 copy (what village characters load)"],
          "Face density: creator vs world atlas"), "08-world-512.webp")

# 09 the rest of the library on the v7 head
lib = [load(f"bench-library-{k}.png") for k in ("bangs", "backs")]
lib = [im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS) for im in lib]
save(grid([[lib[0]], [lib[1]]], ["every bangs style over back_bob", "every back style under bangs_straight"],
          "The existing library on the v7 head (fit_check: all 28 pieces pass; FLAGs listed in fit-v7.txt)"), "09-library.webp")
