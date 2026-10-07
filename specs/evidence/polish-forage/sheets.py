"""Tile the forage, crafting, museum and shop shots (shoot.mjs) into the WebP evidence sheets in this folder.

  python3 specs/evidence/polish-forage/sheets.py <before_dir> <after_dir> [<art_dir> <clips_dir>]

<art_dir>: build_forage.py's and build_interiors.py's review renders (sheet.png, trophy_case.png); <clips_dir>:
art/props-enemies/render_forage_clips.py's frames.

Each activity is a frame strip, before over after, at the same moments after the key press (the after row alone where
there was nothing before). A tile that is one flat colour (a blank canvas, a page that never drew) is reported, so a
broken sheet never goes out unnoticed.
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
BEFORE, AFTER = sys.argv[1], sys.argv[2]
ART, CLIPS = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else (None, None)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
font = lambda n: ImageFont.truetype(FONT, n)
INK, PAPER, MUTED = (59, 42, 20), (251, 243, 220), (120, 104, 80)
blank = []


def frames(folder, prefix):
    """The strip's PNGs in time order: <prefix>-<ms>ms.png."""
    if not os.path.isdir(folder):
        return []
    out = []
    for f in os.listdir(folder):
        m = re.fullmatch(re.escape(prefix) + r"-(\d+)ms\.png", f)
        if m:
            out.append((int(m.group(1)), os.path.join(folder, f)))
    return sorted(out)


def tile(path, crop, w):
    im = Image.open(path).convert("RGB")
    if crop:
        im = im.crop(crop)
    im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    st = ImageStat.Stat(im)
    if max(st.stddev) < 4:
        blank.append(path)
    return im


def sheet(name, title, rows, crop=(240, 130, 1040, 630), w=360):
    """rows: [(label, [(caption, path), ...])]."""
    rows = [(l, [(c, tile(p, crop, w)) for c, p in fs if os.path.exists(p)]) for l, fs in rows]
    rows = [(l, fs) for l, fs in rows if fs]
    if not rows:
        print("skip", name, "(no frames)")
        return
    th = max(im.height for _, fs in rows for _, im in fs)
    cols = max(len(fs) for _, fs in rows)
    lw, cap, pad, head = 110, 26, 10, 54
    W = max(lw + cols * (w + pad) + pad, 24 + 12 * len(title))
    H = head + len(rows) * (th + cap + pad) + pad
    out = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(out)
    d.text((pad + 4, 14), title, fill=INK, font=font(24))
    for r, (label, fs) in enumerate(rows):
        y = head + r * (th + cap + pad)
        d.text((pad + 4, y + th // 2 - 12), label, fill=INK, font=font(22))
        for c, (caption, im) in enumerate(fs):
            x = lw + c * (w + pad)
            out.paste(im, (x, y))
            d.text((x + 4, y + th + 3), caption, fill=MUTED, font=font(17))
    dst = os.path.join(HERE, f"{name}.webp")
    out.save(dst, "WEBP", quality=82, method=6)
    print("wrote", dst, out.size, f"{os.path.getsize(dst) // 1024} KB")


def strip(prefix, folder):
    return [(f"{ms} ms", p) for ms, p in frames(folder, prefix)]


def ba(name, title, prefix, crop=(240, 130, 1040, 630), w=360, after_prefix=None):
    sheet(name, title, [("Before", strip(prefix, BEFORE)), ("After", strip(after_prefix or prefix, AFTER))], crop, w)


def singles(name, title, pairs, crop=None, w=480):
    """pairs: [(caption, before file or None, after file or None)] side by side, before over after."""
    rows = [("Before", [(c, os.path.join(BEFORE, b)) for c, b, _ in pairs if b and os.path.exists(os.path.join(BEFORE, b))]),
            ("After", [(c, os.path.join(AFTER, a)) for c, _, a in pairs if a and os.path.exists(os.path.join(AFTER, a))])]
    sheet(name, title, rows, crop, w)


# ── The activities, frame by frame ──────────────────────────────────────────────────────────────────────────────
ba("01-tree-shake", "Shaking a fruit tree: E, frames after the press", "shake-1")
ba("02-tree-pickup", "Picking up what fell: E, frames after the press", "shake-2-pickup")
ba("03-branch", "Shaking a cedar for a branch, then picking it up", "branch-1")
ba("04-branch-pickup", "Picking up the branch", "branch-2-pickup")
ba("05-rock", "Striking a rock with the shovel (click)", "rock")
ba("06-flower", "Picking a flower (E)", "flower")
ba("07-shell", "Picking up a shell (E)", "shell")
ba("08-dig", "Digging up a clam with the shovel (click)", "dig")
singles("09-dig-hole-fills", "The dug hole 20 s later (it fills back in over 90 s)", [("20 s after", "dig-later-20s.png", "dig-later-20s.png")], crop=(240, 130, 1040, 630), w=640)
ba("10-bug", "Netting a bug (click)", "bug")
ba("11-craft", "Crafting the floor lamp at the bench", "craft-2", crop=(160, 60, 1120, 660), w=360)
ba("12-bottle", "Opening today's message bottle (E)", "bottle")
ba("13-glider-unlock", "Crafting the leaf glider: its unlock card", "glider-1", crop=(160, 60, 1120, 660))
sheet("14-glide-guide", "The guided first glide: the card, the marked ledge and ring, a try", [
    ("After", [("card", os.path.join(AFTER, "guide-0-card.png")), ("marked", os.path.join(AFTER, "guide-1-marked.png"))] +
     [(f"try {ms} ms", p) for ms, p in frames(AFTER, "guide-2-try")])], crop=(0, 0, 1280, 800), w=420)
ba("15-museum-donation", "Donating at the museum: the curator, the specimen into its case", "museum-2", crop=(0, 0, 1280, 800), w=420)
singles("16-trophy-case", "The HQ trophy display", [("the case", "trophy-0-case.png", "trophy-0-case.png"), ("E: the list", "trophy-1-sheet.png", "trophy-1-sheet.png")], w=560)
singles("17-shop-door", "The shop from the plaza, and E there", [("the front", "shop-0-front.png", "shop-0-front.png"), ("after E", "shop-1-after-e.png", "shop-1-after-e.png"),
                                                                ("the lab's room", "shop-2-lab-interior.png", None)], w=560)
sheet("18-shop-counter", "The shop's counter: inside, Buy, Sell, the till counting a sale and a purchase", [
    ("Counter", [("inside", os.path.join(AFTER, "shop-2-inside.png")), ("E: Buy", os.path.join(AFTER, "shop-3-counter-buy.png")), ("Sell", os.path.join(AFTER, "shop-4-sell.png"))]),
    ("Sold", [(f"{ms} ms", p) for ms, p in frames(AFTER, "shop-5-sold")]),
    ("Bought", [(f"{ms} ms", p) for ms, p in frames(AFTER, "shop-6-bought")])], crop=(0, 0, 1280, 800), w=420)
singles("19-puddles", "Rain on the puddles, and walking through one", [("rain", "puddle-0-rain.png", "puddle-0-rain.png")] +
        [(f"step {i}", f"puddle-1-walk-{i}.png", f"puddle-1-walk-{i}.png") for i in range(0, 8, 2)], crop=(240, 130, 1040, 630), w=400)
singles("20-fireflies", "Fireflies at night (one instanced swarm)", [(f"{i * 0.7:.1f} s", f"fireflies-{i}.png", f"fireflies-{i}.png") for i in range(3)], w=520)

# ── The reward card, one of each kind ───────────────────────────────────────────────────────────────────────────
cards = [(k, os.path.join(AFTER, f"card-{k}.png")) for k in ("bug", "bug-rare", "forage", "dig", "craft", "glider", "bottle")]
cards = [(k, p) for k, p in cards if os.path.exists(p)]
if cards:
    ims = [(k, Image.open(p).convert("RGB")) for k, p in cards]
    pad, cap = 18, 30
    W = sum(im.width for _, im in ims) + pad * (len(ims) + 1)
    H = max(im.height for _, im in ims) + cap + pad * 2 + 40
    out = Image.new("RGB", (W, H), (214, 205, 182))
    d = ImageDraw.Draw(out)
    d.text((pad, 10), "The reward card, one of each kind (tsi:peaceful-got bug, forage, dig; tsi:crafted; tsi:recipe-learned)", fill=INK, font=font(22))
    x = pad
    for k, im in ims:
        out.paste(im, (x, 40 + pad))
        d.text((x, 40 + pad + im.height + 6), k, fill=INK, font=font(20))
        if max(ImageStat.Stat(im).stddev) < 4:
            blank.append(k)
        x += im.width + pad
    dst = os.path.join(HERE, "00-reward-cards.webp")
    out.save(dst, "WEBP", quality=88, method=6)
    print("wrote", dst, out.size, f"{os.path.getsize(dst) // 1024} KB")
    ctx = os.path.join(AFTER, "card-0-in-view.png")
    if os.path.exists(ctx):
        Image.open(ctx).convert("RGB").resize((960, 600), Image.LANCZOS).save(os.path.join(HERE, "00-reward-card-in-view.webp"), "WEBP", quality=82, method=6)

# ── The art and the clips made for this pass (Blender, headless) ──────────────────────────────────────────────────
if ART and os.path.exists(os.path.join(ART, "sheet.png")):
    a = Image.open(os.path.join(ART, "sheet.png")).convert("RGB")
    t = Image.open(os.path.join(ART, "trophy_case.png")).convert("RGB") if os.path.exists(os.path.join(ART, "trophy_case.png")) else None
    if t:
        t = t.resize((round(t.width * a.height * 1.6 / t.height), round(a.height * 1.6)), Image.LANCZOS)
    W = max(a.width, t.width if t else 0) + 40
    H = 60 + a.height + 40 + (t.height + 40 if t else 0)
    out = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(out)
    d.text((20, 14), "Made in Blender for this pass, matte: the outcrops (stone 370, clay 376, iron 448, gold 466, crystal 388, bare 326 triangles), the hammer (220)", fill=INK, font=font(20))
    out.paste(a, (20, 50))
    if t:
        d.text((20, 60 + a.height + 6), "The HQ trophy case (1,472 triangles; its plates 14): walnut and glass, three shelves, the sign over it", fill=INK, font=font(20))
        out.paste(t, (20, 60 + a.height + 36))
    dst = os.path.join(HERE, "21-art.webp")
    out.save(dst, "WEBP", quality=86, method=6)
    print("wrote", dst, out.size, f"{os.path.getsize(dst) // 1024} KB")
if CLIPS and os.path.isdir(CLIPS):
    rows = []
    for name in ("Pickup", "Shake", "Strike", "Craft", "Dig"):
        fs = sorted(f for f in os.listdir(CLIPS) if re.fullmatch(rf"{name}_a_\d+\.png", f))
        rows.append((name, [(f"key {i}", os.path.join(CLIPS, f)) for i, f in enumerate(fs)]))
    sheet("22-clips", "The act clips (build_clips.py): Pickup, Shake, Strike and Craft new, Dig beside them; key phases, the tool in hand", rows, crop=None, w=180)

print("BLANK TILES:", blank if blank else "none")
