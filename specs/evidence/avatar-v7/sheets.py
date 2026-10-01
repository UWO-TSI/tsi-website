"""Tile the avatar v7 evidence (shots.mjs PNGs, Blender viewport captures, uv_dump.py) into the review sheets (Pillow).

  python3 specs/evidence/avatar-v7/sheets.py <shots_dir> [<before_dir>]
<shots_dir> holds shots.mjs's PNGs, blender/head-wire-{front,34}.png (live-session viewport captures) and
face_uv.json (uv_dump.py); <before_dir> holds the milestone-1 bench shots for 09-before-after. Writes next to this script:
  01-styles.webp            the three styles in the engine: front and 3/4 close-ups (faces at 1024), full body, and
                            the real character creator's stage turned both ways
  02-vs-hair-3d-set.webp    each style (black hair) beside the hair-3d-set / bangs-sheet cells it follows
  03-vs-ref18.webp          reference 18's head beside the v7 bob at its measured view yaw (26 deg)
  04-expressions.webp       the six expressions, and the talk cells beside the resting mouth
  05-blink-talk.webp        a blink (open, half, closed, half, open), the talk cells, and 12 frames of the face on its
                            own clock while talking (90 ms apart)
  06-village.webp           the game camera at village distance (pixel filter as shipped): the three styles, a sunhat
                            and a high pony
  07-head-and-face.webp     the hand-modeled head's topology (Blender), its face UV layout over the default painted
                            face, and the face atlas
  08-world-512.webp         the world atlas (512 px per face canvas) beside the creator's 1024
  09-before-after.webp      David's three tweaks on the milestone styles: fuller hair, the glossy sheen band, bigger
                            talk mouths (milestone 1 left, now right)
  10-library-bangs.webp     every bangs over three backs (bob, long, short spiky), 3/4 view
  11-library-backs.webp     every back under two bangs (straight, curtain), side view
  12-hats.webp              hats on the fuller hair, front and back (lock tucks under the brim)
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

S = sys.argv[1]
BEFORE = sys.argv[2] if len(sys.argv) > 2 else None
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


def cells(name, n, h=None, d=S, crop=None):
    """The n cells of a bench grid sheet (padding 8, gap 8 css px at 2x; square head cells); crop: a sub-box of each
    cell in cell fractions (x0, y0, x1, y1)."""
    im = Image.open(os.path.join(d, name)).convert("RGB")
    w = (im.width - 32 - 16 * (n - 1)) / n
    out = [im.crop((round(16 + i * (w + 16)), 16, round(16 + i * (w + 16) + w), round(16 + w))) for i in range(n)]
    if crop:
        out = [c.crop(tuple(round(f * c.width) for f in crop)) for c in out]
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
          "Avatar v7: fuller sculpted-lock hair with the glossy sheen on the hand-modeled head, in the engine (runtime Character, creator lights)"),
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

# 04 expressions, with the talk cells
save(grid([cells("bench-expressions.png", 6, 420), cells("bench-talk.png", 5, 420)],
          ["neutral | happy (E8.1, M2.1) | surprised (M6.1) | sad (half lid, M4.3) | angry (M2.2) | sleepy (E1.6, M3.1)",
           "talking: the resting mouth (M1.1, stays small) and the four bigger talk cells T1-T4 (open oval, oval with teeth, open smile, half open)"],
          "The six expressions (row 144) and the bigger talk mouths: eye and mouth cells from David's picks, brows moved and tilted by the shader"),
     "04-expressions.webp")

# 05 blink + talk
live = [single(f"live-talk-{i:02d}.png", 1.0, 300) for i in range(12)]
save(grid([cells("bench-blink.png", 5, 420), cells("bench-talk.png", 5, 420), live[:6], live[6:]],
          ["blink: open, half, closed, half, open (0.04 + 0.07 + 0.04 s, every 2-6 s at random)",
           "talk cells: the look's mouth (M1.1), T1, T2, T3, T4 (about 9 a second, random order)",
           "the face on its own clock while talking: 12 frames, 90 ms apart", ""],
          "Blinking and talking without redrawing a canvas: the face shader switches atlas cells by uniform"), "05-blink-talk.webp")

# 06 village
VILL = ["short", "bob", "long", "sunhat", "pony"]
vill = [load(f"village-{s}.png", box=(1040, 540, 1840, 1300), h=520) for s in VILL]
full = load("village-bob.png", h=700)
save(grid([vill, [full]], ["short (hair 0) | bob (hair 2) | long (hair 6) | curtain + long + sunhat (hair 4) | swept_l + high pony (hair 8), crops round the player",
                           "the full bob frame"],
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
           "the face atlas (v7_face_atlas.png, 1024 px per face canvas): one side of each eye with blink frames, brows, 76 mouths, 4 talk cells, extras"],
          "The hand-modeled head and the painted-face system"), "07-head-and-face.webp")

# 08 world atlas
save(grid([cells("bench-styles.png", 6, 360), cells("bench-styles-world512.png", 6, 360)],
          ["creator: face atlas at 1024 px per face canvas", "world: the 512 copy (what village characters load)"],
          "Face density: creator vs world atlas"), "08-world-512.webp")

# 09 before / after the tweaks (milestone 1 shots in BEFORE)
if BEFORE:
    pre, now = cells("bench-styles.png", 6, 420, d=BEFORE), cells("bench-styles.png", 6, 420)
    top = (0.12, 0.02, 0.88, 0.62)            # the hair, for the sheen
    pre_t, now_t = cells("bench-styles.png", 6, 420, d=BEFORE, crop=top), cells("bench-styles.png", 6, 420, crop=top)
    mouth = (0.25, 0.45, 0.75, 0.95)
    pre_m, now_m = cells("bench-talk.png", 5, 300, d=BEFORE, crop=mouth), cells("bench-talk.png", 5, 300, crop=mouth)
    save(grid([pre[2 * i:2 * i + 2] + now[2 * i:2 * i + 2] for i in range(3)] + [[pre_t[2], now_t[2], pre_t[5], now_t[5]], pre_m, now_m],
              [f"{s}: milestone 1 (front, 3/4) | now: fuller, deeper grooves between locks, glossy band" for s in STYLES] +
              ["sheen close-up: bob front then | now | long 3/4 then | now (the band follows the key light along each lock)",
               "talk cells, milestone 1: M1.1 (rest), G5.2, M3.1, G5.1, G1.3",
               "talk cells now: M1.1 (rest, unchanged), T1, T2, T3, T4 (drawn taller: the mouth sits where the face turns under)"],
              "David's tweaks (\"Fuller, like the sheet\", \"Stronger glossy band\", \"Bigger talk shapes\"): milestone 1 beside now, same bench"),
         "09-before-after.webp")


def wide(name, width=1800):
    im = load(name)
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


# 10, 11 the whole library as locks
BACKS3 = ["back_bob", "back_long", "back_short_spiky"]
save(grid([[wide(f"bench-library-bangs-{b}.png")] for b in BACKS3], [f"every bangs over {b}" for b in BACKS3],
          "The 16 bangs, rebuilt as sculpted locks (catalogue ids unchanged), over three backs"), "10-library-bangs.webp")
BANGS2 = ["bangs_straight", "bangs_curtain"]
save(grid([[wide(f"bench-library-backs-{b}.png")] for b in BANGS2], [f"every back under {b} (side view)" for b in BANGS2],
          "The 12 backs, rebuilt as sculpted locks over a matte under-cap (catalogue ids unchanged)"), "11-library-backs.webp")

# 12 hats
hats = cells("bench-hats.png", 8, 420)
save(grid([hats[0:4], hats[4:8]], ["sunhat front, back | cap front, back", "beanie front, back | straw hat front, back"],
          "Hats refit on the fuller hair (bob): the brim sits on the hair, the back hair tucks under as short locks"),
     "12-hats.webp")
