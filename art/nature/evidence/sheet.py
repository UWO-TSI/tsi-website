"""Before-and-after review sheets for the nature remodels (game/remodel-nature), one WebP per asset:

  - the clean turntable (art/nature/evidence/turntable.mjs: the same stage and light for old and new), front and 3/4;
  - the in-game shot at the same camera (art/nature/evidence/ingame.mjs), before and after;
  - triangles, materials and textures, before and after (read from the GLBs).

  python3 art/nature/evidence/sheet.py <turntable-old-dir> <turntable-new-dir> <ingame-dir> <out-dir>

The in-game dir holds before/ and after/ (<target>.<season>.png). Writes <out-dir>/<asset id>.webp.
"""
import json, os, struct, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
PUB = os.path.join(ROOT, "web", "public")
TT_OLD, TT_NEW, IG, OUT = sys.argv[1:5]
T = 230  # tile
BEFORE = "216632dd"  # the commit the remodel started from
BG, INK, MUTED, RULE = (244, 239, 227), (52, 44, 36), (120, 108, 92), (214, 202, 178)


def font(size, bold=False):
    for path in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


F_T, F_H, F_L = font(26, True), font(18, True), font(14)


def stats(url):
    path = os.path.join(PUB, url.lstrip("/"))
    # A dump file this lane removed is read from before the remodel.
    b = open(path, "rb").read() if os.path.exists(path) else subprocess.run(["git", "-C", ROOT, "show", f"{BEFORE}:web/public/{url.lstrip('/')}"], capture_output=True, check=True).stdout
    jl = struct.unpack_from("<I", b, 12)[0]
    g = json.loads(b[20:20 + jl])
    tris = prims = 0
    mats = set()
    for m in g.get("meshes", []):
        for p in m["primitives"]:
            prims += 1
            mats.add(p.get("material"))
            acc = g["accessors"][p["indices"]] if "indices" in p else g["accessors"][p["attributes"]["POSITION"]]
            tris += acc["count"] // 3
    return tris, len(mats), len(g.get("images", []))


def slug(url):
    return url.replace("/assets/", "").replace(".glb", "").replace("/", "__")


def tile(path, label=None, size=T):
    im = Image.new("RGB", (size, size), BG)
    if path and os.path.exists(path):
        src = Image.open(path).convert("RGB")
        im.paste(src.resize((size, size), Image.LANCZOS))
    else:
        ImageDraw.Draw(im).text((10, size // 2 - 8), "not shown", fill=MUTED, font=F_L)
    if label:
        d = ImageDraw.Draw(im)
        w = d.textlength(label, font=F_L)
        d.rectangle([0, size - 22, w + 12, size], fill=(244, 239, 227))
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
        lw = 170 if label is not None else 0
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
        out.save(path, "WEBP", quality=88, method=6)
        print("SHEET", path, out.size, os.path.getsize(path))


def cost_line(old, new):
    o = [stats(u) for u in old]
    n = [stats(u) for u in new]
    fmt = lambda s: f"{min(x[0] for x in s)}-{max(x[0] for x in s)} tris, {max(x[1] for x in s)} material{'s' if max(x[1] for x in s) > 1 else ''}, {max(x[2] for x in s)} texture{'s' if max(x[2] for x in s) != 1 else ''}"
    return f"Before: {fmt(o)} each.   After: {fmt(n)} each (vertex colour, one primitive)."


def turntable_rows(sh, old, new, old_names, new_names, view_rows=(("front", "front"), ("q", "3/4"))):
    for v, vl in view_rows:
        sh.row([tile(os.path.join(TT_OLD, f"{slug(u)}.{v}.png"), n) for u, n in zip(old, old_names)], label=f"Before\n{vl}")
    for v, vl in view_rows:
        sh.row([tile(os.path.join(TT_NEW, f"{slug(u)}.{v}.png"), n) for u, n in zip(new, new_names)], label=f"After\n{vl}")


def ingame_pair(sh, target, season="autumn", note=None, size=440):
    b = tile(os.path.join(IG, "before", f"{target}.{season}.png"), "before", size)
    a = tile(os.path.join(IG, "after", f"{target}.{season}.png"), "after", size)
    sh.row([b, a], label="In game\nsame camera" + (f"\n{note}" if note else ""))


os.makedirs(OUT, exist_ok=True)
SEASONS = ("spring", "summer", "autumn", "winter")

# ---------------------------------------------------------------- bushes
OLD_BUSH = {"spring": ["bush-azalea", "bush-azalea"], "summer": ["bush-hydrangea", "bush-hibiscus"], "autumn": ["bush-holly", "bush-hydrangea"], "winter": ["bush-holly-snow", "bush-holly-snow"]}
old = [f"/assets/acnh/plants/{OLD_BUSH[s][i]}.glb" for s in SEASONS for i in (0, 1)]
new = [f"/assets/game/plants/bush-{sh}-{s}.glb" for s in SEASONS for sh in ("a", "b")]
far = [u.replace(".glb", ".lod1.glb") for u in new]
names = [f"{s} {sh}" for s in SEASONS for sh in ("a", "b")]
sh = Sheet(16 + 170 + 8 * (T + 6) + 16)
sh.text("Bushes: closed rounded volume, four seasons (ours) vs the dump's one-sided leaf shells", F_T)
sh.text(cost_line(old, new) + f"  Far LOD: {min(stats(u)[0] for u in far)}-{max(stats(u)[0] for u in far)} tris.", F_L, colour=MUTED)
sh.text("Each column is the model a bush with that seed draws in that season (shape a: round dome, b: low wide mound; the dump repeated one model).", F_L, colour=MUTED)
turntable_rows(sh, old, new, [f"{s} {OLD_BUSH[s][i].replace('bush-', '')}" for s in SEASONS for i in (0, 1)], names)
sh.row([tile(os.path.join(TT_NEW, f"{slug(u)}.q.png"), n + " far") for u, n in zip(far, names)], label="After\nfar LOD 3/4")
sh.rule()
sh.text("In game, same camera: the bush at (-5, -9) (shape a) and the one at (6, -9.5) (shape b), from the front and from behind", F_H)
for s in SEASONS:
    tiles = []
    for t in ("bush-a", "bush-a-back", "bush-b", "bush-b-back"):
        tiles += [tile(os.path.join(IG, "before", f"{t}.{s}.png"), "before"), tile(os.path.join(IG, "after", f"{t}.{s}.png"), f"after {t.replace('bush-', '')}")]
    sh.row(tiles, label=s.capitalize())
sh.save(os.path.join(OUT, "bushes.webp"))

if "bushes-only" in sys.argv:
    sys.exit(0)

# ---------------------------------------------------------------- rocks
old = [f"/assets/acnh/props/rock-{k}.glb" for k in "abcde"]
new = [f"/assets/game/rocks/stone-{k}.glb" for k in "abcde"]
sh = Sheet(16 + 170 + 5 * (T + 6) + 16 + 200)
sh.text("ACNH boulders (rock-a to rock-e): our worn stones, sized to the same footprints", F_T)
sh.text(cost_line(old, new), F_L, colour=MUTED)
turntable_rows(sh, old, new, [f"rock-{k}" for k in "abcde"], [f"stone-{k}" for k in "abcde"])
sh.rule()
ingame_pair(sh, "rocks", note="the pair at (-18.5, -7.5)")
sh.save(os.path.join(OUT, "acnh-boulders.webp"))

# ---------------------------------------------------------------- mushrooms
old = ["/assets/nature/mushroom_red.glb", "/assets/nature/mushroom_tan.glb", "/assets/nature/mushroom_red.glb"]
new = [f"/assets/game/forage/mushroom-{k}.glb" for k in ("round", "flat", "skinny")]
sh = Sheet(16 + 170 + 3 * (T + 6) + 16 + 400)
sh.text("Forage mushrooms: rounded clusters, one per species, in place of the Kenney cones", F_T)
sh.text(cost_line(old[:2], new) + "  Shown at 0.5 before, at true size now.", F_L, colour=MUTED)
sh.text("Before, a node showed red or tan by its position, whatever the species; now each species shows its own (the bag item's colours).", F_L, colour=MUTED)
turntable_rows(sh, old, new, ["red (any)", "tan (any)", "red (any)"], ["round", "flat", "skinny"])
sh.rule()
ingame_pair(sh, "mushrooms", note="a woods node by a tree;\nthe species is rolled\neach visit")
sh.save(os.path.join(OUT, "forage-mushrooms.webp"))

# ---------------------------------------------------------------- shells
keys = ("asari", "scallop", "turban", "whelk")
old = [f"/assets/acnh/props/shell-{k}.glb" for k in keys]
new = [f"/assets/game/forage/shell-{k}.glb" for k in keys]
sh = Sheet(16 + 170 + 4 * (T + 6) + 16 + 200)
sh.text("Beach shells: our own clam, scallop, turban and whelk", F_T)
sh.text(cost_line(old, new), F_L, colour=MUTED)
turntable_rows(sh, old, new, list(keys), list(keys))
sh.rule()
ingame_pair(sh, "shells", note="a shell spot; the node\nrolls its species each\nvisit, so they differ")
sh.save(os.path.join(OUT, "shells.webp"))

# ---------------------------------------------------------------- crabs
keys = ("gazami", "hermit")
old = [f"/assets/acnh/props/crab-{k}.glb" for k in keys]
new = [f"/assets/game/shore/crab-{k}.glb" for k in keys]
sh = Sheet(16 + 170 + 2 * (T + 6) + 16 + 500)
sh.text("Beach crabs: our gazami and hermit crab, same frame, size and behaviour", F_T)
sh.text(cost_line(old, new), F_L, colour=MUTED)
turntable_rows(sh, old, new, list(keys), list(keys))
sh.rule()
ingame_pair(sh, "crabs", note="an ambient crab on the\nbeach (it sidles, scuttles\nand digs in as before)")
sh.save(os.path.join(OUT, "crabs.webp"))
