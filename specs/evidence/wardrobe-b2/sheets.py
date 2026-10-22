"""Wardrobe batch 2 evidence sheets (WebP) from the engine shots (shoot.mjs), the shrink renders (render_shrink.py) and
David's preview sheets.

  python3 specs/evidence/wardrobe-b2/sheets.py <shots_dir> <hatcut_dir> [<before_shots_dir>]
(shots: shoot.mjs; hatcut: render_hatcut.py; before: an earlier shoot.mjs run, for the hair texture's before and after)
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
ART = os.path.join(ROOT, "art", "characters")
ICONS = os.path.join(ROOT, "web", "public", "assets", "icons")
SHOTS, HATCUT = sys.argv[1], sys.argv[2]
BEFORE = sys.argv[3] if len(sys.argv) > 3 else None
BG, INK = (239, 231, 214), (59, 47, 38)
FONT = ImageFont.load_default(size=22)
SMALL = ImageFont.load_default(size=17)
HAIRS = ["hair_goggle_ushanka", "hair_ribbon_bob", "hair_wavy_half_up", "hair_curly_pigtails", "hair_emo_layers", "hair_double_buns"]


def titled(img, text, font=FONT):
    pad = 40 if font is FONT else 30
    out = Image.new("RGB", (img.width, img.height + pad), BG)
    out.paste(img, (0, pad))
    ImageDraw.Draw(out).text((10, 8), text, fill=INK, font=font)
    return out


def stack(imgs, gap=12, horizontal=False):
    if horizontal:
        out = Image.new("RGB", (sum(i.width for i in imgs) + gap * (len(imgs) - 1), max(i.height for i in imgs)), BG)
        x = 0
        for i in imgs:
            out.paste(i, (x, 0))
            x += i.width + gap
        return out
    w = max(i.width for i in imgs)
    out = Image.new("RGB", (w, sum(i.height for i in imgs) + gap * (len(imgs) - 1)), BG)
    y = 0
    for i in imgs:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def fit(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def save(img, name, w=1600):
    fit(img, min(w, img.width)).save(os.path.join(HERE, name), "WEBP", quality=82, method=6)
    print("sheet", name)


def shot(name):
    return Image.open(os.path.join(SHOTS, name)).convert("RGB")


# 02: the six hairs, David's preview (front, back) beside the engine (front, 3/4, side, back)
prev = Image.open(os.path.join(ART, "hair", "source", "david-b2", "_preview-2.png")).convert("RGB")
rows = []
for k, hid in enumerate(HAIRS):
    sheet = shot(f"hairs-{1 + k // 3}.png")
    h = sheet.height / 3
    row = sheet.crop((0, round(h * (k % 3)), sheet.width, round(h * (k % 3 + 1))))
    col = prev.crop((k * 260, 0, k * 260 + 260, 520))
    col = col.resize((round(260 * row.height / 520), row.height), Image.LANCZOS)
    rows.append(titled(stack([col, row], horizontal=True), f"#{22 + k} {hid}: David's preview (front, back) | ours in the engine (front, 3/4, side, back)", SMALL))
save(titled(stack(rows), "Wardrobe batch 2: hairs #22-27 beside David's previews (engine, /lab/avatar, Full; row 314: #22 without its hat, #24 lower)"), "02-hairs.webp")

# 02b: the hair texture before and after (row 314: the source's strands kept, a soft gloss), the same sheet cells
if BEFORE:
    pairs = []
    for k in (1, 2):
        b, a = Image.open(os.path.join(BEFORE, f"hairs-{k}.png")).convert("RGB"), shot(f"hairs-{k}.png")
        h = a.height / 3
        for r in range(3):
            cb = b.crop((0, round(h * r), b.width, round(h * (r + 1))))
            ca = a.crop((0, round(h * r), a.width, round(h * (r + 1))))
            pairs.append(stack([titled(fit(cb, 800), "before: a flat shade map", SMALL), titled(fit(ca, 800), "after: the strands kept, a soft gloss", SMALL)], horizontal=True))
    save(titled(stack(pairs), "Hair texture before and after (row 314, David: \"the matte with subtle gloss they have\"), all 27 hairs; #22-27 shown"), "02b-hair-texture.webp", 1700)

# 03: the six whole faces on the head, then mixed with other parts; David's preview on top
fprev = Image.open(os.path.join(ART, "v7", "face", "source", "david-b2", "_previews", "batch2.png")).convert("RGB")
faces = shot("faces.png")
save(titled(stack([fit(fprev, faces.width), faces]), "Wardrobe batch 2: faces #20-25 (David's preview, then ours on the v10 head: front and 3/4; a mix row)"), "03-faces.webp")

# 04: every accessory worn (head and face over the ribbon bob, neck and front on the body)
save(titled(stack([shot("acc-head.png"), shot("acc-body.png")]),
            "Wardrobe batch 2: all 21 accessories worn (engine, row 314 fixes). Hats sit over the hair; the bear hood hides it."), "04-accessories-worn.webp")

save(titled(stack([titled(shot("hats-thin-hair.png"), "over the thinnest hairstyle (#20 360 waves): a little air", SMALL),
                    titled(shot("hats-thick-hair.png"), "over the thickest (#10 messy wolfcut): the hair through the hats", SMALL)]),
            "Hats over the hair are seated for David's median hairstyle (0.246 stud over the crown, 0.167 at the sides)"), "04b-hats-hair-extremes.webp")

# 05: the hat cut, before and after (Blender, the engine's rule): each covering hat over three hairstyles, whole | cut
report = json.load(open(os.path.join(HATCUT, "hatcut.json")))
rows = []
for hid in ("hair_ribbon_bob", "hair_messy_wolf", "hair_double_buns"):
    cells = []
    for r in [x for x in report if x["hair"] == hid]:
        tag = f"{hid.replace('hair_', '')}+{r['hat'].replace('acc_', '')}"
        w = Image.open(os.path.join(HATCUT, f"{tag}_whole_34.png")).convert("RGB")
        c = Image.open(os.path.join(HATCUT, f"{tag}_cut_34.png")).convert("RGB")
        changed = r["pixels_changed"]["34"]
        cells.append(titled(stack([w, c], horizontal=True, gap=2), f"{r['hat'].replace('acc_', '')}: -{r['cut']} tris, {changed} px", SMALL))
    rows.append(titled(stack(cells, horizontal=True, gap=10), f"{hid}: each hat, whole | cut (3/4)", SMALL))
worst = max(max(r["pixels_changed"].values()) for r in report)
save(titled(stack(rows), f"Hat cut (hidden_cut.py): {len(report)} hair and hat pairs, at most {worst} of 90,000 px change in any view (strand tips under a brim)"), "05-hatcut-before-after.webp", 1900)

# 06: the creator tabs: the closet (owned and locked; the colour wheel's hint) and the starting creator (free items only)
tabs = [(f, t) for f, t in [("closet-hair-1.png", "Closet: Hair (27 styles; #22 worn, without its hat)"),
                             ("closet-hair-2.png", "Closet: Hair, scrolled (the wheel locked: the shop's Hair colour wheel)"),
                             ("closet-eyes-1.png", "Closet: Eyes (the vampire face owned, the other priced faces locked)"),
                             ("closet-eyes-2.png", "Closet: Eyes, scrolled"),
                             ("closet-accessories-1.png", "Closet: Accessories (#22's ushanka and goggles worn: owning the hair grants it)"),
                             ("closet-accessories-2.png", "Closet: Accessories, scrolled"),
                             ("creator-eyes-1.png", "Starting creator: Eyes (the free faces #21 and #22 only)"),
                             ("creator-eyes-2.png", "Starting creator: Eyes, scrolled"),
                             ("creator-accessories-1.png", "Starting creator: Accessories (the free glasses #06 only)"),
                             ("creator-accessories-2.png", "Starting creator: Accessories, scrolled")]
        if os.path.exists(os.path.join(SHOTS, f))]
pairs = [stack([titled(fit(shot(a[0]), 900), a[1], SMALL) for a in tabs[k:k + 2]], horizontal=True) for k in range(0, len(tabs), 2)]
save(titled(stack(pairs), "Wardrobe batch 2 in the creator and the closet"), "06-creator-tabs.webp", 1800)

# 07: the new shop icons and creator tiles
keys = [p for p in sorted(os.listdir(ICONS)) if p.startswith(("acc_apple", "acc_band", "acc_bear", "acc_cow", "acc_crew", "acc_drawn", "acc_gold",
        "acc_green", "acc_half", "acc_monkey", "acc_paper", "acc_plaid", "acc_prop", "acc_red", "acc_round", "acc_square", "acc_thin", "acc_wheat",
        "acc_woven", "acc_ushanka", "face-", "colour-wheel")) or p[:-5] in HAIRS]
tiles = []
for k in keys:
    t = Image.new("RGB", (200, 230), BG)
    ic = Image.open(os.path.join(ICONS, k)).convert("RGBA").resize((180, 180), Image.LANCZOS)
    t.paste(ic, (10, 6), ic)
    ImageDraw.Draw(t).text((8, 196), k[:-5][:22], fill=INK, font=SMALL)
    tiles.append(t)
grid = [stack(tiles[k:k + 8], horizontal=True, gap=6) for k in range(0, len(tiles), 8)]
save(titled(stack(grid, gap=6), f"Shop icons and creator tiles: {len(tiles)} (21 accessories and #22's hat, 6 hairstyles, 4 whole faces, the colour wheel)"), "07-icons.webp")
