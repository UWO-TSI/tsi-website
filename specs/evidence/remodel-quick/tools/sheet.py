"""Remodel-quick evidence sheets (from remodel-props' tool): per asset, the old model over the new one, each as clean turntable views (front and
three-quarter, one camera for both) and the game's own frame from the same camera (turntable-pair.mjs, ingame-pair.mjs),
with triangles, materials and texture sizes; and an overview of every asset.

  python3 specs/evidence/remodel-quick/tools/sheet.py <tt-dir> <ig-dir> <stats.json> <out-dir> [id,id,...]

stats.json: glb-stats.mjs rows for the old files (paths under /old/) and the new (under /assets/).
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

TT, IG, STATS, OUT = sys.argv[1:5]
ONLY = sys.argv[5].split(",") if len(sys.argv) > 5 else None
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "..", "..", "..", "web", "public", "fonts", "nunito", "Nunito-Variable.ttf")


def font(size, bold=False):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([800 if bold else 500])
    except Exception:
        pass
    return f


# id: label, old files, new files, in-game shots (day first)
F = ["apple", "peach", "pear", "orange", "cherry", "coconut"]
NF = ["apple", "peach", "fruit_pear", "fruit_orange", "fruit_cherry", "fruit_coconut"]
ASSETS = {
    "monument-sign": ("Monument sign", ["acnh/furniture/monument-sign.glb"], ["game/props/monument-sign.glb"], ["monument-sign"]),
    "plaza-boards": ("Plaza notice and catch boards", ["acnh/props/bulletin-board.glb"], ["game/props/notice-board.glb", "game/props/catch-board.glb"], ["plaza-boards"]),
    "log-bench": ("Log bench", ["acnh/props/bench-wood.glb"], ["game/props/log-bench.glb"], ["log-bench"]),
    "bridge": ("Wooden bridge", ["acnh/props/bridge-wooden.glb"], ["game/props/bridge-plank.glb"], ["bridge", "genesis-stage"]),
    "hq-board": ("HQ notice board", ["acnh/furniture/bulletinboard.glb"], ["game/props/hq-notice-board.glb"], ["hq-board"]),
    "parasol": ("Beach parasol and deck chairs", ["acnh/props/beach-parasol.glb"], ["game/props/beach-parasol.glb"], ["parasol"]),
    "trolley": ("Shop trolley", ["acnh/furniture/shopping-cart.glb"], ["game/props/shop-cart.glb"], ["trolley"]),
    "tree-fruit": ("Tree fruit", [f"acnh/fruit/{f}.glb" for f in F], [f"game/items/{f}.glb" for f in NF], ["tree-fruit"]),
}
stats = {r["file"]: r for r in json.load(open(STATS))}


def describe(files, old):
    if len(files) > 3:                      # a set (the fruit): one line for all of them
        rows = [stats.get(("/old/" if old else "/assets/") + f) for f in files]
        rows = [r for r in rows if r]
        if not rows:
            return ["no stats"]
        tris = [r["tris"] for r in rows]
        tex = sorted({f"{t['w']}" for r in rows for t in r["textures"] if t.get("w")}, key=int)
        mats = sorted({len(r["materials"]) for r in rows})
        return [f"{len(rows)} models: {min(tris):,}-{max(tris):,} tris each ({sum(tris):,} in all), {'/'.join(map(str, mats))} mats each, "
                + (f"tex {'/'.join(tex)} px" if tex else "no texture (vertex colour)") + f", {sum(r['bytes'] for r in rows) // 1024} KB"]
    parts = []
    for f in files:
        r = stats.get(("/old/" if old else "/assets/") + f)
        if not r:
            parts.append(f"{os.path.basename(f)}: no stats")
            continue
        tex = sorted({f"{t['w']}" for t in r["textures"] if t.get("w")}, key=int)
        parts.append(f"{os.path.basename(f)}: {r['tris']:,} tris, {len(r['materials'])} mat{'s' if len(r['materials']) != 1 else ''}, "
                     + (f"tex {'/'.join(tex)} px" if tex else "no texture") + f", {r['bytes'] // 1024} KB")
    return parts


T = 340          # tile
PAD = 14
INK, SUB, BG, PANEL = (52, 44, 36), (110, 98, 84), (244, 239, 227), (255, 251, 242)


def tile(path):
    if not os.path.exists(path):
        im = Image.new("RGB", (T, T), (220, 214, 200))
        ImageDraw.Draw(im).text((T // 2, T // 2), "missing", fill=SUB, anchor="mm", font=font(16))
        return im
    return Image.open(path).convert("RGB").resize((T, T), Image.LANCZOS)


def sheet(aid):
    label, old_files, new_files, shots = ASSETS[aid]
    cols = 2 + len(shots)
    W = PAD + cols * (T + PAD) + 150
    H = 70 + 2 * (T + 64) + PAD
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((PAD, 18), label, fill=INK, font=font(30, True))
    d.text((PAD + 8 + d.textlength(label, font=font(30, True)) + 12, 30), "before (ACNH dump / old) and after (ours): front, three-quarter, in game at the same camera",
           fill=SUB, font=font(16))
    for row, (name, files, old) in enumerate((("Before", old_files, True), ("After", new_files, False))):
        y = 70 + row * (T + 64)
        d.text((PAD, y + T // 2 - 14), name, fill=INK, font=font(24, True))
        x = 150
        frames = [os.path.join(TT, f"{aid}.{'old' if old else 'new'}.front.png"), os.path.join(TT, f"{aid}.{'old' if old else 'new'}.q.png")]
        frames += [os.path.join(IG, f"{s}.{'before' if old else 'after'}.png") for s in shots]
        for f in frames:
            im.paste(tile(f), (x, y))
            x += T + PAD
        for i, line in enumerate(describe(files, old)):
            d.text((150, y + T + 8 + i * 18), line, fill=SUB, font=font(15))
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"{aid}.webp")
    im.save(out, "WEBP", quality=88, method=6)
    print("sheet", out, im.size)
    return out


def overview(ids):
    """Every asset: old three-quarter over new three-quarter, with its in-game after shot."""
    S = 220
    W = PAD + len(ids) * (S + PAD)
    H = 60 + 3 * (S + PAD) + 30
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((PAD, 14), "Quick-win remodels: before (top), after (middle), after in game (bottom)", fill=INK, font=font(26, True))
    for i, aid in enumerate(ids):
        x = PAD + i * (S + PAD)
        d.text((x, 46), ASSETS[aid][0], fill=INK, font=font(15, True))
        for j, f in enumerate([os.path.join(TT, f"{aid}.old.q.png"), os.path.join(TT, f"{aid}.new.q.png"), os.path.join(IG, f"{ASSETS[aid][3][0]}.after.png")]):
            t = tile(f).resize((S, S), Image.LANCZOS)
            im.paste(t, (x, 68 + j * (S + PAD)))
    out = os.path.join(OUT, "overview.webp")
    im.save(out, "WEBP", quality=86, method=6)
    print("overview", out, im.size)


ids = ONLY or list(ASSETS)
for a in ids:
    if a != "overview":
        sheet(a)
if ONLY is None or "overview" in (ONLY or []):
    overview([a for a in ASSETS])
