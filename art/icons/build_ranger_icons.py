"""The Ranger family's icons (classes v2, design sheet §1.9 and the art list): hand-drawn SVG in the class-icon style.

  python3 art/icons/build_ranger_icons.py

Writes web/public/assets/game/classes/<name>.svg: the four class emblems, each kit's ability, ult and passive icons,
the shop cosmetics' icons (cosmetics/<slug>.svg) and the Fletching nameplate frame (../frames/ranger-fletching.svg),
plus specs/evidence/classes/K-ranger-icons.webp, every icon at 64 and 24 px. The look: a cream disc with an ink
outline (the wave-0 demo emblem), a ring in the family's blue, the motif in the subclass's colour with ink strokes,
readable at 24 px. Drawn here as plain paths; no downloads, no generated art.
"""
import math, os, subprocess, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "classes")
SHEET = os.path.join(ROOT, "specs", "evidence", "classes", "K-ranger-icons.webp")
CREAM, INK, RANGER = "#f6efdc", "#1d1a24", "#8fd0ff"
COL = {"marksman": "#62d8f0", "sniper": "#a9c8ff", "hunter": "#5fd1b0", "gunslinger": "#5a8dff"}
DARK = {"marksman": "#0d4a5c", "sniper": "#26305e", "hunter": "#123f3a", "gunslinger": "#1a2470"}
GOLD, FIRE, PALE = "#ffd27a", "#ff8a3d", "#fff6e0"


def disc(body, ring=RANGER, emblem=False):
    """The emblem frame: cream disc, ink edge, the family ring (an emblem's is wider), then the motif."""
    w = 5 if emblem else 3.5
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>'
            f'<circle cx="32" cy="32" r="{24.5 if emblem else 25}" fill="none" stroke="{ring}" stroke-width="{w}"/>{body}</svg>')


def path(d, fill="none", stroke=INK, sw=2.5, extra=""):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'


def circle(cx, cy, r, fill="none", stroke=INK, sw=2.5):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def arrow(x0, y0, x1, y1, col, head=6, fletch=True, sw=3):
    """An arrow from (x0, y0) to its head at (x1, y1): shaft, a filled head, fletching at the tail."""
    a = math.atan2(y1 - y0, x1 - x0)
    c, s = math.cos(a), math.sin(a)
    hx, hy = x1 - c * head, y1 - s * head
    h = (f"M{x1:.1f} {y1:.1f} L{hx - s * head * 0.6:.1f} {hy + c * head * 0.6:.1f} L{hx + s * head * 0.6:.1f} {hy - c * head * 0.6:.1f} Z")
    out = path(f"M{x0:.1f} {y0:.1f} L{hx:.1f} {hy:.1f}", sw=sw) + path(h, fill=col, sw=2)
    if fletch:
        for k in (0, 4):
            fx, fy = x0 + c * k, y0 + s * k
            out += path(f"M{fx:.1f} {fy:.1f} l{(-c - s) * 4:.1f} {(-s + c) * 4:.1f} M{fx:.1f} {fy:.1f} l{(-c + s) * 4:.1f} {(-s - c) * 4:.1f}", stroke=col, sw=2.4)
    return out


def bullet(x, y, ang, col, L=13, w=6):
    """A round: a capsule with a pointed nose toward `ang` (degrees), centred at x, y."""
    return (f'<g transform="translate({x} {y}) rotate({ang})">' + path(f"M{-L / 2} {-w / 2} L{L / 2 - w * 0.7} {-w / 2} Q{L / 2} 0 {L / 2 - w * 0.7} {w / 2} L{-L / 2} {w / 2} Z", fill=col, sw=2)
            + path(f"M{-L / 2 + 3} {-w / 2} L{-L / 2 + 3} {w / 2}", sw=1.6) + "</g>")


def cylinder(cx, cy, r, fills, sw=2.5):
    """A revolver cylinder from the front: a hexagon-rounded drum with six chambers (fills, clockwise from the top)."""
    out = circle(cx, cy, r, fill="#c9d2dc", sw=sw)
    for i, f in enumerate(fills):
        a = -math.pi / 2 + i * math.pi / 3
        out += circle(round(cx + math.cos(a) * r * 0.58, 1), round(cy + math.sin(a) * r * 0.58, 1), r * 0.24, fill=f, sw=1.8)
    return out + circle(cx, cy, r * 0.13, fill=INK, sw=0)


def star(cx, cy, r, col, n=8, inner=0.45):
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        pts.append(f"{cx + math.cos(a) * rr:.1f} {cy + math.sin(a) * rr:.1f}")
    return path("M" + " L".join(pts) + " Z", fill=col, sw=2)


def flame(cx, cy, s, col=FIRE):
    return path(f"M{cx} {cy + s} C{cx - s * 0.9} {cy + s * 0.6} {cx - s * 0.5} {cy - s * 0.2} {cx} {cy - s} C{cx + s * 0.1} {cy - s * 0.3} {cx + s * 0.9} {cy} {cx + s * 0.5} {cy + s * 0.5} Z", fill=col, sw=2)


def paw(cx, cy, s, col):
    out = f'<ellipse cx="{cx}" cy="{cy + s * 0.35}" rx="{s * 0.55}" ry="{s * 0.45}" fill="{col}" stroke="{INK}" stroke-width="2"/>'
    for dx, dy in ((-0.62, -0.25), (-0.22, -0.62), (0.22, -0.62), (0.62, -0.25)):
        out += f'<ellipse cx="{cx + dx * s:.1f}" cy="{cy + dy * s:.1f}" rx="{s * 0.2:.1f}" ry="{s * 0.26:.1f}" fill="{col}" stroke="{INK}" stroke-width="1.8"/>'
    return out


def chain(x0, y0, x1, y1, n, col):
    out = ""
    for i in range(n):
        t = (i + 0.5) / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
        out += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="4" ry="{2.6 if i % 2 else 1.4}" transform="rotate({ang:.0f} {x:.1f} {y:.1f})" fill="none" stroke="{col}" stroke-width="2.2"/>'
    return out


def bow(cx, cy, col, s=1.0):
    """A recurve bow standing up, its belly toward the right, with the string."""
    return (path(f"M{cx - 4 * s} {cy - 20 * s} C{cx + 2 * s} {cy - 18 * s} {cx + 10 * s} {cy - 10 * s} {cx + 9 * s} {cy} C{cx + 10 * s} {cy + 10 * s} {cx + 2 * s} {cy + 18 * s} {cx - 4 * s} {cy + 20 * s}", stroke=INK, sw=6)
            + path(f"M{cx - 4 * s} {cy - 20 * s} C{cx + 2 * s} {cy - 18 * s} {cx + 10 * s} {cy - 10 * s} {cx + 9 * s} {cy} C{cx + 10 * s} {cy + 10 * s} {cx + 2 * s} {cy + 18 * s} {cx - 4 * s} {cy + 20 * s}", stroke=col, sw=3)
            + path(f"M{cx - 4 * s} {cy - 20 * s} L{cx - 4 * s} {cy + 20 * s}", sw=1.4))


def reticle(cx, cy, r, col, sw=2.5):
    return (circle(cx, cy, r, sw=sw) + path(f"M{cx} {cy - r - 5} L{cx} {cy - r * 0.35} M{cx} {cy + r + 5} L{cx} {cy + r * 0.35} M{cx - r - 5} {cy} L{cx - r * 0.35} {cy} M{cx + r + 5} {cy} L{cx + r * 0.35} {cy}", sw=sw)
            + circle(cx, cy, 2.6, fill=col, sw=1.6))


def harpoon(x0, y0, x1, y1, col):
    a = math.atan2(y1 - y0, x1 - x0)
    c, s = math.cos(a), math.sin(a)
    bx, by = x1 - c * 9, y1 - s * 9
    head = f"M{x1:.1f} {y1:.1f} L{bx - s * 5:.1f} {by + c * 5:.1f} L{bx + c * 2:.1f} {by + s * 2:.1f} L{bx + s * 5:.1f} {by - c * 5:.1f} Z"
    barb = f"M{bx - c * 4:.1f} {by - s * 4:.1f} l{-c * 5 - s * 4:.1f} {-s * 5 + c * 4:.1f} M{bx - c * 4:.1f} {by - s * 4:.1f} l{-c * 5 + s * 4:.1f} {-s * 5 - c * 4:.1f}"
    return path(f"M{x0:.1f} {y0:.1f} L{bx:.1f} {by:.1f}", sw=3.4) + path(head, fill=col, sw=2) + path(barb, stroke=INK, sw=2.2)


def revolver(cx, cy, col, s=1.0):
    """A revolver in profile, barrel to the right."""
    return (path(f"M{cx - 14 * s} {cy - 6 * s} L{cx + 16 * s} {cy - 6 * s} L{cx + 16 * s} {cy - 1 * s} L{cx - 2 * s} {cy - 1 * s} L{cx - 2 * s} {cy + 2 * s} "
                 f"L{cx - 6 * s} {cy + 4 * s} L{cx - 9 * s} {cy + 15 * s} L{cx - 16 * s} {cy + 14 * s} L{cx - 13 * s} {cy + 2 * s} Z", fill=col, sw=2.2)
            + circle(cx - 6 * s, cy - 3.5 * s, 4.5 * s, fill="#c9d2dc", sw=2) + path(f"M{cx - 14 * s} {cy - 6 * s} l-3 -3", sw=2.2))


def rifle(cx, cy, col, s=1.0):
    return (path(f"M{cx - 24 * s} {cy + 2 * s} L{cx - 12 * s} {cy - 3 * s} L{cx + 24 * s} {cy - 3 * s} L{cx + 24 * s} {cy} L{cx - 6 * s} {cy} L{cx - 9 * s} {cy + 7 * s} L{cx - 22 * s} {cy + 8 * s} Z", fill=col, sw=2.2)
            + path(f"M{cx - 6 * s} {cy - 9 * s} L{cx + 8 * s} {cy - 9 * s}", stroke=INK, sw=4.5) + path(f"M{cx - 6 * s} {cy - 9 * s} L{cx + 8 * s} {cy - 9 * s}", stroke="#c9d2dc", sw=2.2))


def crossbow(cx, cy, col, s=1.0):
    return (path(f"M{cx - 20 * s} {cy + 6 * s} L{cx + 14 * s} {cy - 2 * s}", sw=5) + path(f"M{cx - 20 * s} {cy + 6 * s} L{cx + 14 * s} {cy - 2 * s}", stroke=col, sw=2.6)
            + path(f"M{cx + 4 * s} {cy - 16 * s} Q{cx + 12 * s} {cy - 2 * s} {cx + 6 * s} {cy + 12 * s}", sw=3.5) + path(f"M{cx + 4 * s} {cy - 16 * s} L{cx - 4 * s} {cy - 1 * s} L{cx + 6 * s} {cy + 12 * s}", sw=1.3))


def icons():
    m, sn, h, g = COL["marksman"], COL["sniper"], COL["hunter"], COL["gunslinger"]
    out = {}
    # ── the class emblems ──
    out["marksman"] = disc(bow(27, 32, m) + arrow(14, 32, 50, 32, m, head=8), emblem=True)
    out["sniper"] = disc(reticle(32, 32, 13, sn, sw=3), emblem=True)
    out["hunter"] = disc(harpoon(15, 49, 49, 15, h) + chain(15, 49, 30, 46, 3, INK), emblem=True)
    out["gunslinger"] = disc(cylinder(32, 32, 15, [g] * 6), emblem=True)
    # ── Marksman ──
    out["marksman-homing"] = disc(path("M14 44 C18 20 40 14 46 26", sw=3) + arrow(40, 21, 49, 33, m, fletch=False) + circle(47, 44, 5, fill=m, sw=2))
    out["marksman-flame"] = disc(arrow(13, 45, 44, 22, m) + flame(46, 19, 8))
    out["marksman-swift"] = disc(arrow(16, 32, 52, 32, m) + path("M10 24 L26 24 M14 40 L28 40 M18 17 L30 17", stroke=m, sw=3))
    out["marksman-backhop"] = disc(path("M44 42 C42 20 24 16 18 26", sw=3) + path("M14 20 L18 27 L25 23", sw=3) + arrow(30, 46, 52, 40, m, head=5, fletch=False))
    out["marksman-ult"] = disc("".join(arrow(16 + i * 8, 12 + (i % 2) * 4, 12 + i * 8, 40 + (i % 2) * 4, m, head=5, fletch=False, sw=2.4) for i in range(5)) + path("M12 50 L52 50", stroke=m, sw=3))
    out["marksman-focus"] = disc(circle(32, 32, 16, stroke=m, sw=3) + circle(32, 32, 9, stroke=m, sw=3) + arrow(10, 54, 31, 33, m, head=6))
    # ── Sniper ──
    out["sniper-scope"] = disc(circle(32, 32, 17, fill="#dfe8f6", sw=3) + reticle(32, 32, 9, sn, sw=2))
    out["sniper-pierce"] = disc(circle(22, 32, 6, fill=sn, sw=2) + circle(34, 32, 6, fill=sn, sw=2) + circle(46, 32, 6, fill=sn, sw=2) + path("M9 32 L56 32", stroke=INK, sw=3) + bullet(52, 32, 0, GOLD, L=10, w=5))
    out["sniper-cluster"] = disc(star(32, 32, 11, PALE) + "".join(circle(round(32 + math.cos(a) * 17, 1), round(32 + math.sin(a) * 17, 1), 4.5, fill=sn, sw=2) for a in (0.6, 2.2, 3.8, 5.4)))
    out["sniper-smoke"] = disc(circle(24, 34, 8, fill="#c9ccd6", sw=2) + circle(34, 28, 9, fill="#c9ccd6", sw=2) + circle(42, 37, 7, fill="#c9ccd6", sw=2) + path("M48 18 C40 12 30 14 26 20", stroke=sn, sw=3) + path("M22 15 L26 21 L32 18", stroke=sn, sw=3))
    out["sniper-mine"] = disc(path("M18 40 A14 14 0 0 1 46 40 Z", fill=sn, sw=2.5) + path("M10 44 L54 44", sw=2) + path("M32 26 L32 20", sw=2.5) + star(32, 18, 5, GOLD, n=6))
    out["sniper-ult"] = disc(path("M10 40 L46 22", stroke=INK, sw=6) + path("M10 40 L46 22", stroke=PALE, sw=3) + star(48, 21, 10, sn) + reticle(20, 22, 6, sn, sw=1.8))
    out["sniper-killstreak"] = disc("".join(path(f"M{19 + i * 6.5} 20 L{19 + i * 6.5} 42", stroke=sn if i < 4 else INK, sw=3.4) for i in range(5)) + path("M15 38 L47 24", sw=3))
    # ── Hunter ──
    out["hunter-camo"] = disc(path("M14 32 Q32 16 50 32 Q32 48 14 32 Z", fill=h, sw=2.5) + circle(32, 32, 5, fill=INK, sw=0) + path("M16 48 L48 16", sw=3.2))
    out["hunter-snare"] = disc(f'<ellipse cx="32" cy="38" rx="16" ry="8" fill="none" stroke="{h}" stroke-width="4"/>' + f'<ellipse cx="32" cy="38" rx="16" ry="8" fill="none" stroke="{INK}" stroke-width="1.4"/>' + path("M44 32 C50 22 46 14 38 12", sw=3) + circle(45, 31, 3, fill=h, sw=1.6))
    out["hunter-spike"] = disc(path("M12 46 L52 46", sw=3) + "".join(path(f"M{x - 5} 46 L{x} {y} L{x + 5} 46 Z", fill=h, sw=2) for x, y in ((20, 26), (32, 16), (44, 26))))
    out["hunter-mark"] = disc(path("M32 12 L50 32 L32 52 L14 32 Z", fill="none", stroke=h, sw=3.4) + circle(32, 32, 6, fill="#ff6a5a", sw=2) + path("M32 12 L32 20 M32 44 L32 52 M14 32 L22 32 M42 32 L50 32", sw=2.2))
    out["hunter-harpoon"] = disc(harpoon(12, 40, 50, 22, h) + chain(8, 46, 22, 38, 2, INK))
    out["hunter-ult"] = disc(paw(32, 30, 11, h) + chain(12, 50, 52, 50, 5, INK))
    out["hunter-prey"] = disc(path("M32 13 L48 32 L32 51 L16 32 Z", fill="none", stroke="#ff6a5a", sw=2.6) + paw(32, 33, 9, h))
    # ── Gunslinger ──
    out["gunslinger-fan"] = disc(revolver(22, 34, g, 0.75) + "".join(path(f"M36 30 L{54} {30 + d}", stroke=GOLD, sw=2.6) for d in (-12, -4, 4, 12)))
    out["gunslinger-trick"] = disc(path("M10 44 L24 20 L38 42 L52 18", stroke=INK, sw=5) + path("M10 44 L24 20 L38 42 L52 18", stroke=GOLD, sw=2.4) + bullet(50, 21, -60, g, L=9, w=5))
    out["gunslinger-special"] = disc(star(36, 30, 14, FIRE, n=7) + bullet(24, 40, -35, g, L=18, w=8))
    out["gunslinger-roll"] = disc(path("M44 20 A14 14 0 1 0 47 36", stroke=g, sw=4) + path("M50 30 L47 37 L41 33", sw=3) + bullet(30, 32, 0, GOLD, L=10, w=5) + bullet(34, 40, 0, GOLD, L=10, w=5))
    out["gunslinger-quickdraw"] = disc(revolver(28, 36, g, 0.85) + path("M44 10 L36 26 L44 26 L38 42", stroke=INK, sw=5) + path("M44 10 L36 26 L44 26 L38 42", stroke=GOLD, sw=2.6))
    out["gunslinger-ult"] = disc(cylinder(32, 32, 16, [GOLD, GOLD, GOLD, "#ff6a5a", GOLD, GOLD]))
    out["gunslinger-lastround"] = disc(cylinder(28, 34, 13, [g, g, g, g, g, GOLD]) + star(47, 18, 8, GOLD, n=6))
    return out


def cosmetics():
    out = {}
    out["cosmetics/skin-marksman-fletcher"] = disc(bow(30, 32, "#e8dcc0") + arrow(16, 32, 50, 32, "#4fb6d8", head=7))
    out["cosmetics/skin-sniper-longshot"] = disc(rifle(32, 34, "#c99a4a", 0.95))
    out["cosmetics/skin-hunter-whalebone"] = disc(crossbow(32, 34, "#efe8da", 1.0))
    out["cosmetics/skin-gunslinger-pearl"] = disc(revolver(32, 30, "#f4eef8", 1.0))
    out["cosmetics/skin-gunslinger-starfire"] = disc(revolver(30, 32, "#ffb347", 1.0) + star(48, 16, 6, GOLD, n=6) + star(16, 46, 4, GOLD, n=6))
    for slug, ramp in (("aura-ranger-tide", ("#f2fffd", "#4fd6c4", "#0b3b3f")), ("aura-ranger-dusk", ("#f6f2ff", "#7c8cff", "#1d1d5a")), ("aura-ranger-aurora", ("#62e0b0", "#6f8dff", "#1b2f66"))):
        body = "".join(circle(round(32 + math.cos(a) * 14, 1), round(32 + math.sin(a) * 14, 1), 5.5 - i % 2, fill=ramp[i % 3], sw=1.8) for i, a in enumerate(x * math.tau / 7 for x in range(7)))
        out[f"cosmetics/{slug}"] = disc(body + circle(32, 32, 6, fill=ramp[0], sw=1.8))
    out["cosmetics/frame-ranger-fletching"] = disc(arrow(14, 50, 50, 14, RANGER, head=7) + arrow(14, 14, 50, 50, RANGER, head=7))
    return out


FRAME = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48"><rect x="3" y="3" width="90" height="42" rx="10" fill="none" stroke="{INK}" stroke-width="4"/>'
         f'<rect x="3" y="3" width="90" height="42" rx="10" fill="none" stroke="{RANGER}" stroke-width="2"/>'
         + "".join(path(f"M{x} 3 l-5 -0 M{x} 3 l4 6 M{x} 45 l4 -6", stroke=INK, sw=2) for x in (20, 48, 76)) + "</svg>")


def main():
    files = {**icons(), **cosmetics()}
    for name, svg in files.items():
        p = os.path.join(OUT, name + ".svg")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w").write(svg)
    fp = os.path.join(ROOT, "web", "public", "assets", "game", "frames", "ranger-fletching.svg")
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    open(fp, "w").write(FRAME)
    print("wrote", len(files) + 1, "svgs")
    tmp = tempfile.mkdtemp(prefix="ranger_icons_")
    tiles = []
    for name in files:
        big, small = os.path.join(tmp, name.replace("/", "_") + "_64.png"), os.path.join(tmp, name.replace("/", "_") + "_24.png")
        subprocess.run(["rsvg-convert", "-w", "96", "-h", "96", os.path.join(OUT, name + ".svg"), "-o", big], check=True)
        subprocess.run(["rsvg-convert", "-w", "24", "-h", "24", os.path.join(OUT, name + ".svg"), "-o", small], check=True)
        tile = os.path.join(tmp, name.replace("/", "_") + "_tile.png")
        subprocess.run(["magick", "-size", "150x132", "xc:#2a2f3a", big, "-geometry", "+6+6", "-composite", small, "-geometry", "+110+42", "-composite",
                        "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", "-pointsize", "10", "-annotate", "+6+122", name.split("/")[-1][:26], tile], check=True)
        tiles.append(tile)
    sheet = os.path.join(tmp, "sheet.png")
    subprocess.run(["magick", "montage", *tiles, "-tile", "8x", "-geometry", "+4+4", "-background", "#1b1f27", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", sheet], check=True)
    subprocess.run(["magick", sheet, "-quality", "90", SHEET], check=True)
    print("wrote", SHEET)


if __name__ == "__main__":
    main()
