"""Round 3's evidence sheets (specs/lanes/reflection-waves.md), from the PNGs shoot3.mjs writes into a before and an after dir.

  python3 specs/evidence/reflection-waves/sheets3.py <before_dir> <after_dir> <out_dir>
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

BEFORE, AFTER, OUT = sys.argv[1:4]
try:
    FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
except OSError:
    FONT = ImageFont.load_default()
BAR = 40   # the lab's nav bar, cropped off


def bench(path):
    """A lab/avatar sheet: the grid alone (nav bar and the empty page below cut)."""
    im = Image.open(path).convert("RGB")
    bg = im.getpixel((im.width - 2, im.height - 2))
    bottom = im.height
    while bottom > BAR + 10 and all(im.getpixel((x, bottom - 1)) == bg for x in range(0, im.width, 7)):
        bottom -= 1
    return im.crop((0, BAR + 8, im.width, min(im.height, bottom + 6)))


def titled(im, text):
    out = Image.new("RGB", (im.width, im.height + 36), (16, 14, 12))
    ImageDraw.Draw(out).text((10, 6), text, font=FONT, fill=(255, 246, 226))
    out.paste(im, (0, 36))
    return out


def stack(ims, horizontal=False):
    if horizontal:
        out = Image.new("RGB", (sum(i.width for i in ims) + 8 * (len(ims) - 1), max(i.height for i in ims)), (16, 14, 12))
        x = 0
        for i in ims: out.paste(i, (x, 0)); x += i.width + 8
    else:
        out = Image.new("RGB", (max(i.width for i in ims), sum(i.height for i in ims) + 8 * (len(ims) - 1)), (16, 14, 12))
        y = 0
        for i in ims: out.paste(i, (0, y)); y += i.height + 8
    return out


def save(im, name, width=None):
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name), "WEBP", quality=82)
    print(name, im.size)


both = lambda n: (os.path.join(BEFORE, n), os.path.join(AFTER, n))

# the water: at rest and with a wave at the face, before (the light lines) and after
water = [stack([titled(Image.open(b).convert("RGB"), f"before: {t}"), titled(Image.open(a).convert("RGB"), f"after: {t}")], True)
         for t, (b, a) in (("at rest", both("water-rest-0.png")), ("a wave at the face", both("water-mid.png")))]
save(stack(water), "13-water-no-lines.webp", 1800)

# hair colours: own, the free ones (0-5, 12 ginger), two dyes (10 pink, 11 blue) on skins 1, 6, 11; before and after
for style, label in (("bob_pigtail", "the default bob"), ("anime_spikes", "a mid-brown style"), ("swept_fringe", "the white style"), ("ribbon_bob", "a two-tone style")):
    b, a = both(f"hair-{style}.png")
    save(stack([titled(bench(b), f"before (lightness kept): {label}, own / 0-5 / 12 ginger / dyes 10, 11; skins 1, 6, 11"),
                titled(bench(a), f"after (the picked colour, lightness too): {label}")]), f"14-hair-{style}.webp", 1800)

# the under-hair: from below the fringe and from behind, own / blond / ginger
b, a = both("under-high.png")
lo_b, lo_a = both("under-low.png")
save(stack([titled(bench(lo_b), "before: under the fringe (own, blond 5, ginger 12)"), titled(bench(lo_a), "after"),
            titled(bench(b), "before: the under-hair between the strands, from behind"), titled(bench(a), "after: a darker shade of the colour")]),
     "15-under-hair.webp", 1500)

# the eyes: every eye style (29, one row each) on all 12 skins (0 lightest to 11 darkest), before and after, in three parts
ROWS = 29
eb, ea = (bench(p) for p in both("eyes-1.png"))
rh = eb.height / ROWS
for n, (r0, r1) in enumerate(((0, 10), (10, 20), (20, ROWS)), 1):
    part = lambda im: im.crop((0, round(r0 * rh), im.width, round(r1 * rh)))
    save(stack([titled(part(eb), f"before: eye styles {r0 + 1}-{r1} of {ROWS}, skins 0-11"),
                titled(part(ea), "after: a soft glow of lit skin around the eyes on the dark skins")], True), f"16-eyes-{n}.webp", 3400)
