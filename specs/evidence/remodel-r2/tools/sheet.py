"""Remodel-r2 evidence sheets, in the round-1 sheets' manner: per item, labelled rows of clean turntable views (old, and
ours; turntable.mjs) and the game's own frame from one camera before and after (ingame.mjs), with each model's
triangles, materials and texture sizes read from its GLB.

  python3 specs/evidence/remodel-r2/tools/sheet.py <tt-dir> <ig-dir> <old-dir> <out-dir> [id,id,...]

<old-dir>: the round-1 and removed models extracted from git (turntable.mjs OLD_DIR).
"""
import io, json, os, struct, sys
from PIL import Image, ImageDraw, ImageFont

TT, IG, OLD, OUT = sys.argv[1:5]
ONLY = sys.argv[5].split(",") if len(sys.argv) > 5 else None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
PUB = os.path.join(ROOT, "web", "public")
FONT = os.path.join(PUB, "fonts", "nunito", "Nunito-Variable.ttf")
T, PAD, LABEL = 300, 12, 170
INK, SUB, BG = (52, 44, 36), (110, 98, 84), (244, 239, 227)


def font(size, bold=False):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([800 if bold else 500])
    except Exception:
        pass
    return f


def glb(path):
    """Triangles, materials, texture sizes and bytes of a GLB."""
    full = os.path.join(OLD, path[5:]) if path.startswith("/old/") else os.path.join(PUB, path.lstrip("/"))
    b = open(full, "rb").read()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    bin_ = b[20 + n + 8:]
    tris = 0
    for m in j["meshes"]:
        for p in m["primitives"]:
            a = j["accessors"][p["indices"]] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]
            tris += a["count"] // 3
    sizes = []
    for im in j.get("images", []):
        bv = j["bufferViews"][im["bufferView"]]
        data = bin_[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        try:
            w, h = Image.open(io.BytesIO(data)).size
            sizes.append(f"{w}" if w == h else f"{w}x{h}")
        except Exception:
            sizes.append("?")
    mats = len(j.get("materials", []))
    tex = f"tex {'/'.join(sorted(set(sizes), key=lambda s: int(s.split('x')[0])))} px" if sizes else "no texture"
    return f"{os.path.basename(path)}: {tris:,} tris, {mats} mat{'s' if mats != 1 else ''}, {tex}, {len(b) // 1024} KB"


def tile(path, size=T):
    if not os.path.exists(path):
        im = Image.new("RGB", (size, size), (220, 214, 200))
        ImageDraw.Draw(im).text((size // 2, size // 2), "missing", fill=SUB, anchor="mm", font=font(16))
        return im
    im = Image.open(path).convert("RGBA")
    ground = Image.new("RGBA", im.size, (*BG, 255))
    return Image.alpha_composite(ground, im).convert("RGB").resize((size, size), Image.LANCZOS)


def wrap(d, text, f, width):
    """Lines of `text` no wider than `width` in font f."""
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if d.textlength(trial, font=f) > width and line:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + ([line] if line else [])


def sheet(sid, title, subtitle, rows, cols=None):
    """rows: (label, sublabel, [(path, caption)], [stats lines]) or ("---", heading) for a section break."""
    cols = cols or max(len(r[2]) for r in rows if r[0] != "---")
    W = LABEL + cols * (T + PAD) + PAD
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    sub_lines = wrap(probe, subtitle, font(16), W - 2 * PAD)
    heads = {i: wrap(probe, r[1], font(19, True), W - 2 * PAD) for i, r in enumerate(rows) if r[0] == "---"}
    top = 64 + 20 * len(sub_lines) + 10
    H = top
    for i, r in enumerate(rows):
        H += 20 + 24 * len(heads[i]) if r[0] == "---" else T + 24 + 18 * len(r[3]) + PAD
    im = Image.new("RGB", (W, H + PAD), BG)
    d = ImageDraw.Draw(im)
    d.text((PAD, 14), title, fill=INK, font=font(30, True))
    for i, line in enumerate(sub_lines):
        d.text((PAD, 56 + 20 * i), line, fill=SUB, font=font(16))
    y = top
    for i, r in enumerate(rows):
        if r[0] == "---":
            d.line([(PAD, y + 8), (W - PAD, y + 8)], fill=(205, 194, 170), width=2)
            for j, line in enumerate(heads[i]):
                d.text((PAD, y + 16 + 24 * j), line, fill=INK, font=font(19, True))
            y += 20 + 24 * len(heads[i])
            continue
        label, sub, tiles, stats = r
        d.text((PAD, y + T // 2 - 24), label, fill=INK, font=font(22, True))
        if sub:
            for i, line in enumerate(sub.split("\n")):
                d.text((PAD, y + T // 2 + 4 + i * 18), line, fill=SUB, font=font(15))
        x = LABEL
        for path, cap in tiles:
            im.paste(tile(path), (x, y))
            if cap:
                tw = d.textlength(cap, font=font(14))
                d.rectangle([x, y + T - 22, x + tw + 12, y + T], fill=(250, 247, 238))
                d.text((x + 6, y + T - 20), cap, fill=INK, font=font(14))
            x += T + PAD
        for i, line in enumerate(stats):
            d.text((LABEL, y + T + 6 + i * 18), line, fill=SUB, font=font(15))
        y += T + 24 + 18 * len(stats) + PAD
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f"{sid}.webp")
    im.save(out, "WEBP", quality=86, method=6)
    print("sheet", out, im.size)


tt = lambda name: os.path.join(TT, f"{name}.png")
ig = lambda name: os.path.join(IG, f"{name}.png")
A, G = "/assets/acnh/", "/assets/game/"

BUSHES = [("azalea-spring", "azalea", "spring"), ("hydrangea-spring", "hydrangea", "spring"), ("hydrangea-summer", "hydrangea", "summer"),
          ("hibiscus-summer", "hibiscus", "summer"), ("holly-autumn", "holly", "autumn"), ("hydrangea-autumn", "hydrangea", "autumn"),
          ("holly-winter", "holly-snow", "winter")]


def bushes():
    rows = []
    for label, sub, st, view in (("Before", "the dump's, front", "old", "front"), ("Before", "from behind", "old", "back"),
                                 ("After", "closed, front", "new", "front"), ("After", "from the side", "new", "side"),
                                 ("After", "from behind", "new", "back"), ("After", "from above", "new", "top")):
        rows.append((label, sub, [(tt(f"bush-{k}.{st}.{view}"), f"{season} {src if st == 'old' else k.split('-')[0]}") for k, src, season in BUSHES], []))
    rows[0] = rows[0][:3] + ([glb(f"{A}plants/bush-{s}.glb") for s in ("azalea", "hydrangea", "hibiscus", "holly", "holly-snow")],)
    tris = lambda k: glb(f"{G}plants/bush-{k}.glb").split(", ")[0].replace(".glb:", "")
    rows[2] = rows[2][:3] + (["; ".join(tris(k) for k, _, _ in BUSHES[:4]), "; ".join(tris(k) for k, _, _ in BUSHES[4:]),
                              "each 1 material on the dump's own leaf texture (64 px; the snow holly's 64x128), its season tint in COLOR_0"],)
    rows.append(("---", "In game, the same camera before and after: the bush at (-5, -9) and the one at (6, -9.5), from the front and from behind"))
    for season in ("spring", "summer", "autumn", "winter"):
        tiles = []
        for shot in ("bush-a", "bush-a-back", "bush-b", "bush-b-back"):
            tiles += [(ig(f"{shot}.day-{season}.before"), f"before {shot[5:] or 'a'}"), (ig(f"{shot}.day-{season}.after"), f"after {shot[5:]}")]
        rows.append((season.title(), "", tiles, []))
    sheet("bushes", "Bushes: the old leafy bushes, closed all round, in season colours",
          "The dump's azalea, hydrangea, hibiscus, holly and snow holly with their own leaf texture: the back closed with the same cards turned round, "
          "a shaded ball of the same leaves inside, centred on their spot. Seasons are tints on the same leaves.", rows)


SHELLS = ["asari", "scallop", "turban", "whelk"]


def shells():
    rows = [
        ("Before", "the old shells", [(tt(f"shell-{k}.old.q"), k) for k in SHELLS], [glb(f"{A}props/shell-{k}.glb") for k in SHELLS]),
        ("Round 1", "the 3D shapes kept,\nno texture", [(tt(f"shell-{k}.r1.q"), k) for k in SHELLS], [glb(f"/old/shell-{k}.glb") for k in SHELLS]),
        ("After", "the same shapes,\npainted textures", [(tt(f"shell-{k}.new.q"), k) for k in SHELLS], [glb(f"{G}forage/shell-{k}.glb") for k in SHELLS]),
        ("After", "front", [(tt(f"shell-{k}.new.front"), k) for k in SHELLS], []),
        ("After", "from above", [(tt(f"shell-{k}.new.top"), k) for k in SHELLS], []),
        ("Before", "from above", [(tt(f"shell-{k}.old.top"), k) for k in SHELLS], []),
        ("Icons", "re-rendered", [(os.path.join(PUB, "assets", "icons", f"shell_{k}.webp"), k) for k in SHELLS], []),
        ("---", "In game, the same camera before (round 1) and after: two shell spots on the beach (each visit rolls the spot's species, so they differ)"),
        ("In game", "", [(ig("shell-a.day-autumn.before"), "before"), (ig("shell-a.day-autumn.after"), "after"), (ig("shell-b.day-autumn.before"), "before"), (ig("shell-b.day-autumn.after"), "after")], []),
    ]
    sheet("shells", "Beach shells: the new shapes, with textures after the old ones",
          "Painted here, after the old shells' patterns: the clam's tented zig-zags and bands, the scallop's growth bands over its ribs and its blue-eyed rim, "
          "the turban's maroon and olive mottle and pearly door, the whelk's spiral bands and speckle.", rows, cols=4)


def fence():
    rows = [
        ("Before", "the old country\nfence (two pieces)", [(tt("fence-straight.old.front"), "front"), (tt("fence-straight.old.q"), "three-quarter"), (ig("museum-door.day-autumn.before"), "museum door")],
         [glb(f"{A}props/fence-country-b.glb")]),
        ("After", "three posts joined", [(tt("fence-straight.new.front"), "front"), (tt("fence-straight.new.q"), "three-quarter"), (ig("museum-door.day-autumn.after"), "museum door")],
         [glb(f"{G}props/fence-post.glb"), glb(f"{G}props/fence-rail.glb")]),
        ("---", "Placed side by side, posts join: straight runs, corners, a tee, ends, and a post alone (posts on whole cells; rails only between neighbours)"),
        ("Joins", "turntable", [(tt("fence-shapes.new.q"), "three-quarter"), (tt("fence-shapes.new.top"), "from above"), (tt("fence-post.new.q"), "one post")], []),
        ("Joins", "in game, placed\nas map objects", [(ig("fence-run.day-autumn.draft"), "a run by the spawn"), (ig("fence-run-top.day-autumn.draft"), "from above")], []),
    ]
    sheet("museum-door-fence", "Fence: the old fence's look, joining like Minecraft fences",
          "Chunky round log posts with sawn tops and round log rails in the old country fence's warm wood, no snow. One post per cell; each joins the posts beside it.", rows, cols=3)


def table():
    rows = [
        ("Original", "the dump's reading\ntable (two, picnic)", [(tt("study-table-classic.old.front"), "front"), (tt("study-table-classic.old.q"), "three-quarter"), (tt("study-table-classic-pier.old.q"), "pier's (one)")],
         [glb(f"{A}furniture/reading-table.glb")]),
        ("Classic", "the second version,\nours", [(tt("study-table-classic.new.front"), "front"), (tt("study-table-classic.new.q"), "three-quarter"), (tt("study-table-classic-pier.new.q"), "pier's (one)")],
         [glb(f"{G}props/study-table-classic-long.glb"), glb(f"{G}props/study-table-classic.glb")]),
        ("Classic", "in game", [(ig("study-picnic.day-autumn.draft"), "plaza picnic table"), (ig("study-pier.day-autumn.draft"), "pier table")], []),
        ("Kept", "the first version\n(striped runner)", [(tt("study-table-classic.r1.q"), "picnic"), (tt("study-table-classic-pier.r1.q"), "pier's"), (ig("study-picnic.day-autumn.after"), "in game")],
         [glb(f"{G}props/study-table-long.glb"), glb(f"{G}props/study-table.glb")]),
    ]
    sheet("study-table", "Study table: a second version after the original",
          "Both stay: each outdoor table picks its look (picnic / picnic-classic, pier / pier-classic) in /lab/map and the world editor. Same seats, footprint and top (0.84).", rows, cols=3)


for sid, make in (("bushes", bushes), ("shells", shells), ("museum-door-fence", fence), ("study-table", table)):
    if not ONLY or sid in ONLY:
        make()
