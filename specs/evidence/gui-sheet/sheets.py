"""GUI sheet evidence sheets: before | after pairs per surface, strips, and the kit comparison.

    python3 specs/evidence/gui-sheet/sheets.py <before_dir> <after_dir> <ref_crops_dir> <out_dir>

Every tile is checked before it is written: a blank or nearly uniform capture (a page that never rendered) is reported
and the sheet is not made, so no sheet ships with an empty tile.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BEFORE, AFTER, REF, OUT = (Path(a) for a in sys.argv[1:5])
OUT.mkdir(parents=True, exist_ok=True)
FONT = "web/public/fonts/nunito/Nunito-Variable.ttf"
INK, PAPER, PAGE = (58, 46, 34), (255, 251, 231), (247, 241, 218)


def font(size):
    try:
        f = ImageFont.truetype(FONT, size)
        f.set_variation_by_axes([800])
        return f
    except Exception:
        return ImageFont.load_default()


def blank(img: Image.Image) -> bool:
    """An empty tile: almost every pixel is the frame's dominant colour (a page that never drew, a black fade). A sparse
    page with a line of text on it is not empty."""
    g = img.convert("L").resize((480, 300))
    hist = g.histogram()
    mode = max(range(256), key=hist.__getitem__)
    near = sum(hist[max(0, mode - 12):min(256, mode + 13)])
    return 1 - near / (g.width * g.height) < 0.003


def fit(img, w, h):
    img = img.copy()
    img.thumbnail((w, h))
    return img


def labelled(img, text, w, h, tag=None):
    tile = Image.new("RGB", (w, h + 34), PAGE)
    im = fit(img.convert("RGB"), w, h)
    tile.paste(im, ((w - im.width) // 2, 34))
    d = ImageDraw.Draw(tile)
    d.text((8, 6), text, font=font(18), fill=INK)
    if tag:
        tw = d.textlength(tag, font=font(16))
        d.rounded_rectangle((w - tw - 26, 5, w - 6, 29), radius=12, fill=(255, 238, 160) if tag == "After" else (238, 233, 202))
        d.text((w - tw - 16, 7), tag, font=font(16), fill=INK)
    return tile


def pairs(names, title, file, w=760, h=475):
    rows, problems = [], []
    for name, caption in names:
        b, a = BEFORE / f"{name}.png", AFTER / f"{name}.png"
        if not a.exists():
            problems.append(f"missing after: {name}")
            continue
        ai = Image.open(a)
        if blank(ai):
            problems.append(f"blank after: {name}")
            continue
        bi = Image.open(b) if b.exists() else None
        if bi is not None and blank(bi):
            problems.append(f"blank before: {name}")
            bi = None
        # The caption spans the row (a long one never runs under a tag); each tile carries only its tag.
        row = Image.new("RGB", (w * 2 + 12, h + 34 + 30), PAGE)
        ImageDraw.Draw(row).text((8, 4), caption, font=font(18), fill=INK)
        if bi is not None:
            row.paste(labelled(bi, "", w, h, "Before"), (0, 30))
        row.paste(labelled(ai, "", w, h, "After"), (w + 12, 30))
        rows.append(row)
    if problems:
        print(f"{file}: " + "; ".join(problems))
    if not rows:
        return
    sheet = Image.new("RGB", (rows[0].width + 24, sum(r.height + 12 for r in rows) + 56), PAGE)
    ImageDraw.Draw(sheet).text((12, 12), title, font=font(26), fill=INK)
    y = 52
    for r in rows:
        sheet.paste(r, (12, y))
        y += r.height + 12
    sheet.save(OUT / file, quality=80)
    print("wrote", file, sheet.size)


def strip(prefix, title, file, timed=True, h=300):
    """`timed`: the frames' names are the ms after the key press they were aimed at. The 3D island captures too slowly
    for that to hold, so its strips are numbered frames instead (the sheet's own timing shows in the showroom's)."""
    frames = sorted(AFTER.glob(f"{prefix}-*.png"))
    frames = [f for f in frames if not blank(Image.open(f))]
    if not frames:
        print(f"{file}: no frames")
        return
    label = (lambda i, f: f"{int(f.stem.split('-')[-1].removesuffix('ms'))} ms") if timed else (lambda i, f: f"Frame {i + 1}")
    tiles = [labelled(Image.open(f), label(i, f), int(h * 1.6), h) for i, f in enumerate(frames)]
    sheet = Image.new("RGB", (sum(t.width + 8 for t in tiles) + 16, h + 34 + 60), PAGE)
    ImageDraw.Draw(sheet).text((12, 12), title, font=font(24), fill=INK)
    x = 12
    for t in tiles:
        sheet.paste(t, (x, 52))
        x += t.width + 8
    sheet.save(OUT / file, quality=80)
    print("wrote", file, sheet.size)


def comparison(items, file):
    """Our showroom sections (left) beside the kit crops they answer (right, stacked)."""
    rows = []
    for ours, kit, caption in items:
        o = AFTER / f"{ours}.png"
        if not o.exists() or blank(Image.open(o)):
            print(f"{file}: missing or blank {ours}")
            continue
        refs = [Image.open(REF / f"{k}.webp") for k in kit if (REF / f"{k}.webp").exists()]
        left = labelled(Image.open(o), f"Ours: {caption}", 980, 480)
        row = Image.new("RGB", (1500, left.height), PAGE)
        row.paste(left, (0, 0))
        y, slot = 0, (left.height - 34 * len(refs)) // max(1, len(refs))
        for r in refs:
            t = labelled(r, "The kit", 500, slot)
            row.paste(t, (1000, y))
            y += t.height
        rows.append(row)
    if not rows:
        return
    sheet = Image.new("RGB", (1524, sum(r.height + 12 for r in rows) + 56), PAGE)
    ImageDraw.Draw(sheet).text((12, 12), "Our GUI sheet beside David's Animal Crossing kit", font=font(26), fill=INK)
    y = 52
    for r in rows:
        sheet.paste(r, (12, y))
        y += r.height + 12
    sheet.save(OUT / file, quality=80)
    print("wrote", file, sheet.size)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    from evidence_list import COMPARISON, SHEETS, STRIPS  # noqa: E402  (beside this script)
    for title, file, names in SHEETS:
        pairs(names, title, file)
    for prefix, title, file, timed in STRIPS:
        strip(prefix, title, file, timed)
    comparison(COMPARISON, "00-kit-comparison.webp")
