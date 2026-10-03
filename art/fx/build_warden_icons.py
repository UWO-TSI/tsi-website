"""The Warden wave's icons (classes v2, design sheet §1.9 and the Warden sections): 4 class emblems, 20 key icons,
4 ult and 4 passive icons, flat on a cream disc with an ink outline, the subclass's colour ring and its motif, in the
style of the wave-0 demo emblem (web/public/assets/game/classes/demo.svg). Hand-drawn as SVG paths here, no downloads.

  python3 art/fx/build_warden_icons.py

Writes web/public/assets/game/classes/<name>.svg and specs/evidence/classes/K-warden-icons.webp (every icon at 96,
48 and 24 px over the cream HUD and a dark ground, to check they read small).
"""
import math, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "classes")
SHEET = os.path.join(ROOT, "specs", "evidence", "classes", "K-warden-icons.webp")
INK, CREAM, WARDEN = "#1d1a24", "#f6efdc", "#8fe39a"
COL = {"summoner": ("#3fd67a", "#0d1f17"), "shaman": ("#4fd6b8", "#0f3532"), "druid": ("#7fcc4f", "#1d3a12"), "priest": ("#d2dc66", "#3e4413")}


def disc(ring, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>'
            f'<circle cx="32" cy="32" r="23.5" fill="none" stroke="{ring}" stroke-width="3.5"/>{body}</svg>')


def P(d, fill, sw=2.5, extra=""):
    return f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'


def L(d, col, sw=3.5):
    return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"/>'


def C(x, y, r, fill, sw=2.2):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>'


def poly(pts):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"


def star(cx, cy, r1, r2, n, rot=0.0):
    return poly([(cx + math.cos(rot + i * math.pi / n) * (r1 if i % 2 == 0 else r2), cy + math.sin(rot + i * math.pi / n) * (r1 if i % 2 == 0 else r2)) for i in range(2 * n)])


# ---- motifs (in a 64 box; the ring's inside is about 12–52)
def wolf_head(x, y, s, fill, eye):
    pts = [(-9, -4), (-7, -13), (-3, -6), (3, -6), (7, -13), (9, -4), (8, 4), (3, 9), (0, 12), (-3, 9), (-8, 4)]
    head = P(poly([(x + px * s, y + py * s) for px, py in pts]), fill)
    eyes = "".join(f'<path d="M{x + ex * s:.1f} {y - 1 * s:.1f} l{2.6 * s * (1 if ex > 0 else -1):.1f} -1.2" stroke="{eye}" stroke-width="{2.2 * s:.1f}" stroke-linecap="round"/>' for ex in (-4.5, 4.5))
    return head + eyes


def totem(x, y, s, fill, eye):
    body = P(f"M{x - 7 * s} {y + 14 * s} L{x - 7 * s} {y - 10 * s} Q{x} {y - 17 * s} {x + 7 * s} {y - 10 * s} L{x + 7 * s} {y + 14 * s} Z", fill)
    face = (f'<path d="M{x - 4.5 * s} {y - 5 * s} h{3 * s} M{x + 1.5 * s} {y - 5 * s} h{3 * s}" stroke="{eye}" stroke-width="{2.4 * s}" stroke-linecap="round"/>'
            + L(f"M{x - 4 * s} {y + 3 * s} Q{x} {y + 6.5 * s} {x + 4 * s} {y + 3 * s}", INK, 2 * s)
            + L(f"M{x - 7 * s} {y + 8.5 * s} H{x + 7 * s}", INK, 1.8 * s))
    return body + face


def bolt(x, y, s, fill):
    return P(poly([(x + px * s, y + py * s) for px, py in [(1, -13), (-6, 1), (-1, 1), (-3, 13), (6, -2), (1, -2), (4, -13)]]), fill, 2)


def flame(x, y, s, fill, core):
    outer = P(f"M{x} {y - 13 * s} C{x + 9 * s} {y - 4 * s} {x + 9 * s} {y + 4 * s} {x + 5 * s} {y + 9 * s} C{x + 2 * s} {y + 12 * s} {x - 2 * s} {y + 12 * s} {x - 5 * s} {y + 9 * s} C{x - 9 * s} {y + 4 * s} {x - 6 * s} {y - 3 * s} {x} {y - 13 * s} Z", fill)
    inner = f'<path d="M{x} {y - 3 * s} C{x + 4 * s} {y + 2 * s} {x + 3 * s} {y + 7 * s} {x} {y + 8 * s} C{x - 3 * s} {y + 7 * s} {x - 4 * s} {y + 2 * s} {x} {y - 3 * s} Z" fill="{core}"/>'
    return outer + inner


def leaf(x, y, s, ang, fill):
    r = math.radians(ang)
    def T(px, py):
        return x + (px * math.cos(r) - py * math.sin(r)) * s, y + (px * math.sin(r) + py * math.cos(r)) * s
    a, b, c, d = T(0, 13), T(-8, 0), T(0, -13), T(8, 0)
    blade = P(f"M{a[0]:.1f} {a[1]:.1f} Q{b[0]:.1f} {b[1]:.1f} {c[0]:.1f} {c[1]:.1f} Q{d[0]:.1f} {d[1]:.1f} {a[0]:.1f} {a[1]:.1f} Z", fill)
    v0, v1 = T(0, 11), T(0, -9)
    return blade + L(f"M{v0[0]:.1f} {v0[1]:.1f} L{v1[0]:.1f} {v1[1]:.1f}", INK, 1.6 * s)


def icons():
    I = {}
    # ---- Summoner: shadow beasts in ink, eyes in the class green
    g, d = COL["summoner"]
    I["summoner"] = disc(g, wolf_head(32, 33, 1.45, INK, g) + C(32, 14, 0, INK))
    I["summoner-wolves"] = disc(g, wolf_head(25, 34, 1.0, INK, g) + wolf_head(39, 30, 1.0, d, g))
    owl = (P("M20 22 L26 16 L32 21 L38 16 L44 22 L46 36 Q44 47 32 50 Q20 47 18 36 Z", INK) + C(26, 30, 5.2, g, 1.8) + C(38, 30, 5.2, g, 1.8)
           + C(26, 30, 2, INK, 0) + C(38, 30, 2, INK, 0) + P("M32 34 L29.5 38 L32 41 L34.5 38 Z", "#f2c14e", 1.6))
    I["summoner-owl"] = disc(g, owl)
    toad = (P("M14 40 Q14 26 32 26 Q50 26 50 40 Q50 48 32 48 Q14 48 14 40 Z", INK) + C(23, 26, 5.5, INK) + C(41, 26, 5.5, INK)
            + C(23, 25.5, 2.4, g, 0) + C(41, 25.5, 2.4, g, 0) + L("M20 40 Q32 45 44 40", g, 2.4) + L("M32 43 Q34 50 40 52", "#e57a8a", 2.6))
    I["summoner-toad"] = disc(g, toad)
    serp = (L("M18 46 C14 36 28 36 30 30 C33 22 20 22 22 16 C24 11 34 12 38 16", INK, 7.5) + L("M18 46 C14 36 28 36 30 30 C33 22 20 22 22 16 C24 11 34 12 38 16", d, 4)
            + P("M36 12 L46 15 L40 22 Z", INK, 2) + C(41.5, 15.8, 1.3, g, 0) + L("M46 15 L51 13 M46 15 L50 18", "#e57a8a", 1.6))
    I["summoner-serpent"] = disc(g, serp)
    rabbit = lambda x, y, s, f: (P(f"M{x - 6 * s} {y + 10 * s} Q{x - 9 * s} {y} {x - 3 * s} {y - 3 * s} L{x - 5 * s} {y - 15 * s} Q{x - 2 * s} {y - 17 * s} {x} {y - 6 * s} L{x + 2 * s} {y - 16 * s} Q{x + 5 * s} {y - 15 * s} {x + 3 * s} {y - 3 * s} Q{x + 9 * s} {y} {x + 6 * s} {y + 10 * s} Z", f, 2)
                                 + C(x + 1.5 * s, y + 1 * s, 1.3 * s, g, 0))
    I["summoner-rabbits"] = disc(g, rabbit(25, 35, 1.0, INK) + rabbit(39, 32, 0.9, d) + L("M14 49 Q32 44 50 49", g, 2))
    garden = (P("M12 40 Q32 30 52 40 Q48 50 32 51 Q16 50 12 40 Z", INK) + wolf_head(24, 30, 0.6, INK, g) + C(40, 27, 4.5, INK) + C(38.5, 26.5, 1.4, g, 0) + C(41.5, 26.5, 1.4, g, 0)
              + L("M32 36 Q34 30 31 22", g, 2) + star(32, 18, 3, 1.4, 4))
    I["summoner-ult"] = disc(g, garden.replace(star(32, 18, 3, 1.4, 4), P(star(32, 17, 4, 1.6, 4), g, 1.4)))
    I["summoner-passive"] = disc(g, L("M18 32 a7 7 0 1 1 14 0 a7 7 0 1 1 -14 0", INK, 5) + L("M32 32 a7 7 0 1 1 14 0 a7 7 0 1 1 -14 0", d, 5) + L("M28 32 H36", g, 2.4))
    # ---- Shaman: carved totems, the spirits' elements
    g, d = COL["shaman"]
    I["shaman"] = disc(g, totem(32, 34, 1.15, "#b5835a", g) + bolt(46, 22, 0.55, "#ffe36e"))
    I["shaman-storm"] = disc(g, totem(27, 36, 0.95, "#b5835a", g) + bolt(42, 26, 0.75, "#ffe36e"))
    I["shaman-fire"] = disc(g, totem(27, 36, 0.95, "#b5835a", g) + flame(42, 28, 0.75, "#ff8a3d", "#ffe9a8"))
    I["shaman-earth"] = disc(g, totem(27, 36, 0.95, "#b5835a", g) + P("M36 44 L40 34 L46 33 L50 42 L46 47 Z", "#8d7a5e", 2) + L("M14 49 H50", INK, 2.2))
    tri = [(32, 15), (48, 44), (16, 44)]
    I["shaman-overcharge"] = disc(g, L(poly(tri), g, 3) + "".join(C(x, y, 4.2, "#b5835a") for x, y in tri) + P(star(32, 35, 8, 3.5, 6, 0.2), "#ffe36e", 1.8))
    I["shaman-hop"] = disc(g, totem(32, 42, 0.55, "#b5835a", g) + P("M32 12 L41 23 L35.5 23 L35.5 29 L28.5 29 L28.5 23 L23 23 Z", g, 2) + L("M22 33 Q32 29 42 33", INK, 1.8))
    bird = P("M32 21 L40 13 L42 22 L52 20 L44 30 L38 30 L35 40 L32 47 L29 40 L26 30 L20 30 L12 20 L22 22 L24 13 Z", d, 2.2)
    I["shaman-ult"] = disc(g, bird + C(32, 26, 2.2, "#ffe36e", 1.2) + bolt(32, 38, 0.38, "#ffe36e"))
    I["shaman-passive"] = disc(g, L(poly(tri), g, 2.4) + "".join(C(x, y, 3.6, "#b5835a") for x, y in tri) + L("M24 36 a8 8 0 0 1 16 0", d, 2.4) + L("M20 39 a12 12 0 0 1 24 0", d, 2.4))
    # ---- Druid: leaves, vines, the tree
    g, d = COL["druid"]
    I["druid"] = disc(g, L("M32 52 L32 16", "#7a5230", 4.5) + leaf(25, 22, 0.75, -40, g) + leaf(40, 28, 0.75, 45, g) + leaf(32, 14, 0.55, 0, "#b6e06a"))
    I["druid-snare"] = disc(g, L("M18 48 C10 30 34 30 28 20 C24 13 36 10 40 18", d, 5) + L("M18 48 C10 30 34 30 28 20 C24 13 36 10 40 18", g, 2.5) + L("M46 48 C52 36 36 34 42 26", d, 4) + leaf(43, 22, 0.35, 30, g))
    thorns = "".join(P(f"M{x - 4} 46 L{x} {30 - (i % 2) * 6} L{x + 4} 46 Z", d, 2) for i, x in enumerate((18, 26, 34, 42, 50)))
    I["druid-wall"] = disc(g, L("M13 46 H51", "#7a5230", 5) + thorns.replace(f"M{50 - 4} 46", "M46 46"))
    petals = "".join(P(f"M32 32 Q{32 + 12 * math.cos(a - 0.45):.1f} {32 + 12 * math.sin(a - 0.45):.1f} {32 + 15 * math.cos(a):.1f} {32 + 15 * math.sin(a):.1f} Q{32 + 12 * math.cos(a + 0.45):.1f} {32 + 12 * math.sin(a + 0.45):.1f} 32 32 Z", "#f6b6c6", 2) for a in (k * math.tau / 5 - math.pi / 2 for k in range(5)))
    I["druid-bloom"] = disc(g, petals + C(32, 32, 4.5, "#ffe36e") + L("M22 48 H42", g, 2.5))
    I["druid-swing"] = disc(g, L("M16 14 Q20 38 42 44", "#7a5230", 3.5) + C(16, 14, 3, g) + P("M40 37 L50 46 L38 49 Z", g, 2) + leaf(26, 30, 0.35, 70, g))
    tufts = "".join(L(f"M{x} 46 Q{x - 3} 36 {x - 6} 30 M{x} 46 Q{x + 1} 34 {x + 4} 27", g, 2.6) for x in (20, 32, 44))
    I["druid-wild"] = disc(g, L("M13 46 H51", "#7a5230", 3.5) + tufts + L("M18 51 Q32 47 46 51", d, 2))
    tree = (L("M32 50 L32 30 M32 38 L24 30 M32 36 L40 28", "#7a5230", 4.5) + P("M32 10 C46 10 52 22 46 30 C42 36 22 36 18 30 C12 22 18 10 32 10 Z", g, 2.4)
            + C(26, 22, 2.2, "#f6b6c6", 1.2) + C(38, 19, 2.2, "#f6b6c6", 1.2) + C(33, 28, 2.2, "#f6b6c6", 1.2))
    I["druid-ult"] = disc(g, tree)
    I["druid-passive"] = disc(g, L("M32 50 V34", "#7a5230", 3.5) + leaf(26, 30, 0.55, -50, g) + leaf(38, 30, 0.55, 50, g) + P("M41 14 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 Z", "#ffe36e", 1.6))
    # ---- Priest: its icons are the shapes you draw (cross, circle, line, triangle, chevron, wings)
    g, d = COL["priest"]
    sun = lambda x, y, r: P(star(x, y, r, r * 0.55, 8), "#ffe9a8", 1.8) + C(x, y, r * 0.45, g, 1.8)
    I["priest"] = disc(g, sun(32, 32, 15) + P("M32 24 L36 32 L32 40 L28 32 Z", "#fff6c8", 1.6))
    I["priest-mend"] = disc(g, P("M28 14 h8 v12 h12 v8 h-12 v16 h-8 v-16 h-12 v-8 h12 Z", g, 2.4))
    I["priest-shield"] = disc(g, L("M32 32 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0", INK, 6) + L("M32 32 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0", g, 3) + P("M32 22 L40 26 L39 35 Q37 41 32 43 Q27 41 25 35 L24 26 Z", "#fff6c8", 1.8))
    I["priest-beam"] = disc(g, C(16, 32, 4.5, g) + P("M19 28 L50 29 L50 35 L19 36 Z", "#fff6c8", 2) + L("M22 32 H48", g, 2))
    I["priest-sanctify"] = disc(g, L("M32 32 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0", d, 1.8) + P("M32 16 L46 41 L18 41 Z", g, 2.4) + C(32, 33, 3, "#fff6c8", 1.4))
    I["priest-step"] = disc(g, L("M24 18 L42 32 L24 46", INK, 8) + L("M24 18 L42 32 L24 46", g, 4.5) + L("M16 25 L26 32 L16 39", d, 2.5))
    def wing(k):  # one wing: up and out to its tip, then three feather tips back along its lower edge
        x = lambda v: 32 + v * k
        return P(f"M{x(2)} 30 C{x(9)} 19 {x(17)} 14 {x(23)} 15 C{x(22)} 21 {x(21)} 24 {x(19)} 27 L{x(21)} 29 L{x(16)} 31 L{x(17)} 34 L{x(12)} 35 L{x(12)} 38 L{x(2)} 36 Z", g, 2)
    I["priest-ult"] = disc(g, wing(1) + wing(-1) + L("M32 22 V52", "#fff6c8", 5) + L("M32 22 V52", INK, 1.6) + P(star(32, 17, 5, 2.2, 4), "#ffe9a8", 1.6))
    I["priest-passive"] = disc(g, L("M22 20 a10 4 0 1 0 20 0 a10 4 0 1 0 -20 0", "#ffe36e", 3) + P("M28 28 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 Z", g, 2))
    # ---- shop aura swatches (the seed's aura colours: motes in the ramp round a soft ring)
    for name, (core, mid, edge) in {"moss": ("#f4ffe6", "#9bd36a", "#23401a"), "tide": ("#effcff", "#5fc9d6", "#0f3540"),
                                    "ember": ("#fff4e0", "#f0a050", "#40200c"), "sunrise": ("#fffbe6", "#f2b75c", "#4a2a10")}.items():
        motes = "".join(C(32 + 13 * math.cos(a), 33 + 13 * math.sin(a), 3.2 + (k % 2), mid, 1.2) + C(32 + 13 * math.cos(a), 33 + 13 * math.sin(a), 1.2, core, 0)
                        for k, a in enumerate(i * math.tau / 7 - 1.2 for i in range(7)))
        I[f"aura-warden-{name}"] = disc(mid, L("M32 33 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0", edge, 2) + motes + C(32, 33, 4.5, core, 1.6))
    return I


def main():
    os.makedirs(OUT, exist_ok=True)
    made = icons()
    for name, svg in made.items():
        open(os.path.join(OUT, f"{name}.svg"), "w").write(svg)
    print("wrote", len(made), "icons to", OUT)
    tmp = tempfile.mkdtemp(prefix="warden_icons_")
    tiles = []
    for name in made:
        for px, bg in ((96, "#f6efdc"), (48, "#f6efdc"), (24, "#1b1f27")):
            raw, out = os.path.join(tmp, f"{name}-{px}-raw.png"), os.path.join(tmp, f"{name}-{px}.png")
            subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), "-o", raw, os.path.join(OUT, f"{name}.svg")], check=True)   # as a browser draws it
            subprocess.run(["magick", raw, "-gravity", "center", "-background", bg, "-extent", "104x104", out], check=True)
            tiles += ["-label", f"{name} {px}px", out]
    os.makedirs(os.path.dirname(SHEET), exist_ok=True)
    subprocess.run(["magick", "montage", *tiles, "-tile", "12x", "-geometry", "+4+4", "-background", "#e9e2cf", "-fill", "#1d1a24",
                    "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "10", "-quality", "85", SHEET], check=True)
    print("wrote", SHEET)


if __name__ == "__main__":
    main()
