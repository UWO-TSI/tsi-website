"""Before-and-after review sheets for the village greenery (game/remodel-trees), one WebP per model:

  - the leaf (needle, petal) texture: the dump's, which ours recreates (David, 2026-10-17), beside ours;
  - the clean turntable (art/nature/evidence/turntable.mjs: one stage and light for old and new), front and 3/4, every
    season, and our far model;
  - the in-game shot at the same camera (art/trees/evidence/ingame.mjs), before and after, every season;
  - triangles, materials and textures, before and after (read from the GLBs).

  python3 art/trees/evidence/sheet.py <turntable-dir> <ingame-dir> <out-dir> [round wide tall cedar flowers]

The turntable dir holds plain/ (the dump's models as they are), summer/ and autumn/ (the dump's oaks with the game's
leaf tint for that season: LEAF=<hex>) and after/ (ours). The in-game dir holds before/ and after/.
"""
import io, json, os, struct, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
PUB = os.path.join(ROOT, "web", "public")
TEX = os.path.join(ROOT, "art", "trees", "textures")
TT, IG, OUT = sys.argv[1:4]
ONLY = set(sys.argv[4:])
T = 230
BEFORE = "f3ce4695"  # the commit the remodel started from
BG, INK, MUTED, RULE = (244, 239, 227), (52, 44, 36), (120, 108, 92), (214, 202, 178)
SEASONS = ("spring", "summer", "autumn", "winter")
LEAF = {"summer": "#9BC87E", "autumn": "#FF9A3C"}  # the seasonal palette's leaf tint (supabase seasonal seed)


def font(size, bold=False):
    for path in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


F_T, F_H, F_L = font(26, True), font(18, True), font(14)


def glb(url):
    path = os.path.join(PUB, url.lstrip("/"))
    if os.path.exists(path):
        return open(path, "rb").read()
    return subprocess.run(["git", "-C", ROOT, "show", f"{BEFORE}:web/public/{url.lstrip('/')}"], capture_output=True, check=True).stdout


def parse(b):
    jl = struct.unpack_from("<I", b, 12)[0]
    return json.loads(b[20:20 + jl]), 20 + jl + 8


def stats(url):
    g, _ = parse(glb(url))
    tris = prims = 0
    mats = set()
    shown = 0
    for m in g.get("meshes", []):
        for p in m["primitives"]:
            prims += 1
            mats.add(p.get("material"))
            acc = g["accessors"][p["indices"]] if "indices" in p else g["accessors"][p["attributes"]["POSITION"]]
            n = acc["count"] // 3
            tris += n
            if not g["materials"][p.get("material", 0)]["name"].startswith("mShadow"):
                shown += n
    return tris, shown, len(mats), len(g.get("images", []))


def texture_of(url, material):
    """A GLB's base colour image for `material` (a PIL image)."""
    b = glb(url)
    g, off = parse(b)
    for m in g["materials"]:
        if m["name"] != material:
            continue
        t = g["textures"][m["pbrMetallicRoughness"]["baseColorTexture"]["index"]]
        src = t.get("source", t.get("extensions", {}).get("EXT_texture_webp", {}).get("source"))
        v = g["bufferViews"][g["images"][src]["bufferView"]]
        return Image.open(io.BytesIO(b[off + v.get("byteOffset", 0):off + v.get("byteOffset", 0) + v["byteLength"]])).convert("RGBA")
    raise KeyError(material)


def on_bg(im, size=T, tint=None):
    im = im.convert("RGBA").resize((size, size), Image.LANCZOS)
    if tint:
        h = tint.lstrip("#")
        k = [min(255, int(int(h[i:i + 2], 16) * 1.6 * 0.9)) for i in (0, 2, 4)]
        r, g, b, a = im.split()
        lift = lambda ch, kk: ch.point(lambda v: int((0.065 + 0.9 * v / 255) * kk))
        im = Image.merge("RGBA", (lift(r, k[0]), lift(g, k[1]), lift(b, k[2]), a))
    out = Image.new("RGBA", (size, size), (170, 196, 222, 255))
    out.alpha_composite(im)
    return out.convert("RGB")


def slug(url):
    return url.replace("/assets/", "").replace(".glb", "").replace("/", "__")


def tile(path, label=None, size=T):
    im = Image.new("RGB", (size, size), BG)
    if isinstance(path, Image.Image):
        im.paste(path.resize((size, size), Image.LANCZOS))
    elif path and os.path.exists(path):
        im.paste(Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS))
    else:
        ImageDraw.Draw(im).text((10, size // 2 - 8), "not shown", fill=MUTED, font=F_L)
    if label:
        d = ImageDraw.Draw(im)
        w = d.textlength(label, font=F_L)
        d.rectangle([0, size - 22, w + 12, size], fill=BG)
        d.text((6, size - 20), label, fill=INK, font=F_L)
    return im


class Sheet:
    def __init__(self, width):
        self.w, self.parts = width, []

    def text(self, s, f=F_H, pad=10, colour=INK):
        h = f.size + pad * 2
        im = Image.new("RGB", (self.w, h), BG)
        ImageDraw.Draw(im).text((16, pad), s, fill=colour, font=f)
        self.parts.append(im)

    def row(self, tiles, gap=6, label=None):
        h = max(t.height for t in tiles)
        lw = 170
        im = Image.new("RGB", (self.w, h + gap), BG)
        if label:
            d = ImageDraw.Draw(im)
            for i, line in enumerate(label.split("\n")):
                d.text((14, h // 2 - 18 + i * 18), line, fill=INK, font=F_H if i == 0 else F_L)
        x = 16 + lw
        for t in tiles:
            im.paste(t, (x, 0))
            x += t.width + gap
        self.parts.append(im)

    def rule(self):
        im = Image.new("RGB", (self.w, 14), BG)
        ImageDraw.Draw(im).line([(16, 7), (self.w - 16, 7)], fill=RULE, width=2)
        self.parts.append(im)

    def save(self, path):
        h = sum(p.height for p in self.parts) + 16
        out = Image.new("RGB", (self.w, h), BG)
        y = 8
        for p in self.parts:
            out.paste(p, (0, y))
            y += p.height
        out.save(path, "WEBP", quality=86, method=6)
        print("SHEET", path, out.size, os.path.getsize(path))


def tt(group, url, view):
    return os.path.join(TT, group, f"{slug(url)}.{view}.png")


def fmt(urls):
    s = [stats(u) for u in urls]
    lo, hi = min(x[1] for x in s), max(x[1] for x in s)
    return f"{lo}-{hi} drawn tris (+{min(x[0] - x[1] for x in s)}-{max(x[0] - x[1] for x in s)} shadow-only), {max(x[2] for x in s)} materials, {max(x[3] for x in s)} textures"


def ingame_rows(sh, target, seasons=SEASONS, size=330):
    tiles = []
    for s in seasons:
        tiles += [tile(os.path.join(IG, "before", f"{target}.{s}.png"), f"before {s}", size), tile(os.path.join(IG, "after", f"{target}.{s}.png"), f"after {s}", size)]
    for i in range(0, len(tiles), 4):
        sh.row(tiles[i:i + 4], label="In game\nsame camera" if i == 0 else None)


os.makedirs(OUT, exist_ok=True)
A, G = "/assets/acnh/plants/", "/assets/game/plants/"
# What each slot drew before (SEASON_TREES at the start: slot 0 a/a, slot 1 b/b, slot 2 a/b in summer/autumn).
OLD_SLOT = {
    "round": {"spring": "tree-blossom", "summer": "tree-hardwood-a", "autumn": "tree-hardwood-a", "winter": "tree-hardwood-snow"},
    "wide": {"spring": "tree-blossom", "summer": "tree-hardwood-b", "autumn": "tree-hardwood-b", "winter": "tree-hardwood-snow"},
    "tall": {"spring": "tree-blossom", "summer": "tree-hardwood-a", "autumn": "tree-hardwood-b", "winter": "tree-hardwood-snow"},
}
DRESS = {"spring": "blossom", "summer": "summer", "autumn": "autumn", "winter": "winter"}

for shape in ("round", "wide", "tall"):
    if ONLY and shape not in ONLY:
        continue
    old = [A + OLD_SLOT[shape][s] + ".glb" for s in SEASONS]
    new = [G + f"tree-{shape}-{DRESS[s]}.glb" for s in SEASONS]
    far = [u.replace(".glb", ".lod1.glb") for u in new]
    group = lambda s, u: LEAF.get(s, "plain") if "hardwood-a" in u or "hardwood-b" in u else "plain"
    sh = Sheet(16 + 170 + 8 * (T + 6) + 16)
    sh.text(f"Broadleaf tree, {shape}: leaf cards over closed clumps on one trunk, four seasons (ours) vs the dump's oak and cherry", F_T)
    sh.text(f"Before: {fmt(old)}.   After, near: {fmt(new)}.   Far (past 24 u): {fmt(far)}.", F_L, colour=MUTED)
    sh.text("Leaf texture: the dump's (left of each pair, as the game tints it) and ours, painted afresh from it (art/trees/paint_textures.py): one three-lobed clump a card.", F_L, colour=MUTED)
    oak = texture_of(A + "tree-hardwood-a.glb", "mTreeOakLeaf")
    sh.row([on_bg(oak, tint=LEAF["summer"]), on_bg(Image.open(os.path.join(TEX, "leaves-summer.png"))),
            on_bg(oak, tint=LEAF["autumn"]), on_bg(Image.open(os.path.join(TEX, "leaves-autumn.png"))),
            on_bg(texture_of(A + "tree-blossom.glb", "mTreeOakSakuraBloom")), on_bg(Image.open(os.path.join(TEX, "leaves-blossom.png"))),
            on_bg(texture_of(A + "tree-hardwood-snow.glb", "mTreeOakLeafSnow")), on_bg(Image.open(os.path.join(TEX, "leaves-winter.png")))],
           label="Texture\ndump | ours\nsummer, autumn,\nblossom, winter")
    for v, vl in (("front", "front"), ("q", "3/4")):
        sh.row([tile(tt(group(s, u), u, v), f"{s} {u.split('/')[-1][5:-4]}") for s, u in zip(SEASONS, old)]
               + [tile(tt("after", u, v), f"{s} ours") for s, u in zip(SEASONS, new)], label=f"Before | after\n{vl}")
    sh.row([tile(tt("after", u, "q"), f"{s} far") for s, u in zip(SEASONS, far)], label="After\nfar LOD 3/4")
    sh.rule()
    sh.text(f"In game, the same camera before and after: the {shape} tree's spot ({'-6, -12' if shape == 'round' else '17, -7' if shape == 'wide' else '14, -12'}), every season", F_H)
    ingame_rows(sh, f"tree-{shape}")
    if shape == "round":
        sh.rule()
        sh.text("In game, the game's own camera: the west of the village (round, cedar) and the east (wide, tall, cedar)", F_H)
        ingame_rows(sh, "village-west")
        ingame_rows(sh, "village-east")
    sh.save(os.path.join(OUT, f"tree-{shape}.webp"))

if not ONLY or "cedar" in ONLY:
    old = [A + "tree-cedar.glb", A + "tree-cedar-snow.glb"]
    new = [G + "conifer-cedar.glb", G + "conifer-cedar-snow.glb"]
    far = [u.replace(".glb", ".lod1.glb") for u in new]
    sh = Sheet(16 + 170 + 6 * (T + 6) + 16 + 2 * (T + 6))
    sh.text("Cedar: tiers of fringe cards over closed cones (ours) vs the dump's cedar and snow cedar", F_T)
    sh.text(f"Before: {fmt(old)}.   After, near: {fmt(new)}.   Far (past 24 u): {fmt(far)}.", F_L, colour=MUTED)
    sh.text("Needle texture: the dump's snow cedar fringe (studied) and ours, painted afresh: a strip hanging in rounded fingers, plain and frosted.", F_L, colour=MUTED)
    sh.row([on_bg(texture_of(A + "tree-cedar-snow.glb", "mPltTreeCedarLeafSnow")), on_bg(Image.open(os.path.join(TEX, "needles.png"))),
            on_bg(Image.open(os.path.join(TEX, "needles-snow.png")))], label="Texture\ndump | ours,\nplain and snow")
    for v, vl in (("front", "front"), ("q", "3/4")):
        sh.row([tile(tt("plain", u, v), u.split("/")[-1][:-4]) for u in old] + [tile(tt("after", u, v), u.split("/")[-1][:-4]) for u in new]
               + [tile(tt("after", u, "q"), "far " + u.split("/")[-1][:-9]) for u in far] if v == "q" else
               [tile(tt("plain", u, v), u.split("/")[-1][:-4]) for u in old] + [tile(tt("after", u, v), u.split("/")[-1][:-4]) for u in new],
               label=f"Before | after\n{vl}" + ("\n(then far 3/4)" if v == "q" else ""))
    sh.rule()
    sh.text("In game, the same camera before and after: the cedar at (6, -14), every season (snowed on in winter)", F_H)
    ingame_rows(sh, "cedar")
    sh.save(os.path.join(OUT, "cedar.webp"))
