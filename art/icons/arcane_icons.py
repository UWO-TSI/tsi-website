"""The Arcane wave's icons (classes v2): hand-placed SVG geometry written out as plain 64x64 SVGs. python3 art/icons/arcane_icons.py"""
import math, os, re, sys

WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(WT, "web", "public", "assets", "game", "classes")
INK, CREAM = "#1d1a24", "#f6efdc"
ARC, ELEM, ILLU, NECRO, TRANS = "#b48cff", "#c08cff", "#d79cff", "#9ee6a8", "#b48cff"
AMBER = "#ffb347"
FIRE, WATER, EARTH, WIND, STEAM, LAVA, FLOWER = "#ff8a3d", "#4fb8ff", "#c8955a", "#9ff0d8", "#cfd8e3", "#ff6a1a", "#8be08a"
DARK_EARTH, STORM, STONE, WISP, POLLEN = "#8a5a2b", "#3a2466", "#9aa6b8", "#7ff0ff", "#ffe27a"


def num(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def xf(d, sx=1.0, sy=None, dx=0.0, dy=0.0):
    """Scale then move an absolute path (M L C Q Z, numbers in x y pairs)."""
    sy = sx if sy is None else sy
    toks = re.findall(r"[MLCQZ]|-?\d*\.?\d+", d)
    out, k = [], 0
    for tk in toks:
        if tk in "MLCQZ":
            out.append(tk)
            k = 0
        else:
            v = float(tk)
            out.append(num(v * sx + dx) if k % 2 == 0 else num(v * sy + dy))
            k += 1
    return " ".join(out).replace(" Z", "Z")


def P(d, fill, w=2.5, extra=""):
    st = f' stroke="{INK}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"' if w else ""
    return f'<path d="{d}" fill="{fill}"{st}{extra}/>'


def C(cx, cy, r, fill, w=2.5, extra=""):
    st = f' stroke="{INK}" stroke-width="{w}"' if w else ""
    return f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" fill="{fill}"{st}{extra}/>'


def E(cx, cy, rx, ry, fill, w=2.5, rot=0, extra=""):
    st = f' stroke="{INK}" stroke-width="{w}"' if w else ""
    tr = f' transform="rotate({num(rot)} {num(cx)} {num(cy)})"' if rot else ""
    return f'<ellipse cx="{num(cx)}" cy="{num(cy)}" rx="{num(rx)}" ry="{num(ry)}" fill="{fill}"{st}{tr}{extra}/>'


def OS(d, colour, w=3.0, ink=None):
    """An outlined stroke: an ink line under a coloured one."""
    ink = w + 3.6 if ink is None else ink
    a = ' fill="none" stroke-linejoin="round" stroke-linecap="round"'
    return f'<path d="{d}"{a} stroke="{INK}" stroke-width="{num(ink)}"/><path d="{d}"{a} stroke="{colour}" stroke-width="{num(w)}"/>'


def L(d, w=2.0, colour=INK, extra=""):
    return f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'


def G(body, rot=0, cx=32, cy=32, tx=0, ty=0):
    t = []
    if tx or ty:
        t.append(f"translate({num(tx)} {num(ty)})")
    if rot:
        t.append(f"rotate({num(rot)} {num(cx)} {num(cy)})")
    return f'<g transform="{" ".join(t)}">{body}</g>' if t else body


def icon(ring, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>'
            f'<circle cx="32" cy="32" r="22" fill="none" stroke="{ring}" stroke-width="4"/>{body}</svg>')


def star4(cx, cy, r, fill, w=1.6, k=0.32):
    pts = []
    for i in range(8):
        a = -math.pi / 2 + i * math.pi / 4
        rr = r if i % 2 == 0 else r * k
        pts.append(f"{num(cx + rr * math.cos(a))} {num(cy + rr * math.sin(a))}")
    return P("M" + " L".join(pts) + "Z", fill, w)


# ---------------------------------------------------------------- shared pieces
SKULL = "M-11 1 C-11 -7.5 -6 -12 0 -12 C6 -12 11 -7.5 11 1 C11 4.5 9 6 7 6.5 L7 10 Q7 11.5 5.5 11.5 L-5.5 11.5 Q-7 11.5 -7 10 L-7 6.5 C-9 6 -11 4.5 -11 1Z"


def skull(cx, cy, s, eyes=INK, glint=None, w=2.5, crack=False):
    out = P(xf(SKULL, s, s, cx, cy), CREAM, w)
    for ex in (-5, 5):
        out += E(cx + ex * s, cy + 0.6 * s, 3.4 * s, 3.7 * s, eyes, 0)
        if glint:
            out += C(cx + ex * s + 0.9 * s, cy - 0.6 * s, 1.15 * s, glint, 0)
    out += P(xf("M0 3.8 L-1.9 7.3 L1.9 7.3Z", s, s, cx, cy), INK, 0)
    tw = max(1.2, 1.6 * s)
    out += L(xf("M-3 8.4 L-3 11.2 M0 8.4 L0 11.2 M3 8.4 L3 11.2", s, s, cx, cy), tw)
    if crack:
        out += L(xf("M2 -12 L0 -8 L3 -5.5 L1 -2.5", s, s, cx, cy), max(1.3, 1.8 * s))
    return out


def figure(cx, base, s, fill, w=2.4, dashed=False, arm=None):
    """A cloaked figure standing on (cx, base): a round head over a flared robe."""
    body = xf("M-3.6 -15 C-6.5 -12.5 -8 -6 -9 0 L9 0 C8 -6 6.5 -12.5 3.6 -15 C1.6 -16.3 -1.6 -16.3 -3.6 -15Z", s, s, cx, base)
    extra = ' stroke-dasharray="3 2.4"' if dashed else ""
    out = ""
    if arm:
        out += OS(arm, fill, 3.2 * s ** 0.5) if not dashed else L(arm, w, extra=extra)
    out += P(body, fill, w, extra)
    out += C(cx, base - 20.5 * s, 4.6 * s, fill, w, extra)
    return out


def bone_finger(pts, w=2.4):
    d = "M" + " L".join(f"{num(x)} {num(y)}" for x, y in pts)
    return OS(d, CREAM, w, w + 3.2)


def heart(cx, cy, s):
    return xf("M0 9 C-5 5.5 -10 2 -10 -3 C-10 -6.5 -7.5 -9 -4.6 -9 C-2.6 -9 -1 -8 0 -6 C1 -8 2.6 -9 4.6 -9 C7.5 -9 10 -6.5 10 -3 C10 2 5 5.5 0 9Z", s, s, cx, cy)


def card(cx, cy, w, h, rot, fill, sw=2.4, r=2.6):
    return (f'<rect x="{num(cx - w / 2)}" y="{num(cy - h / 2)}" width="{num(w)}" height="{num(h)}" rx="{num(r)}" fill="{fill}" stroke="{INK}" '
            f'stroke-width="{sw}" stroke-linejoin="round" transform="rotate({num(rot)} {num(cx)} {num(cy)})"/>')


def diamond(cx, cy, rx, ry, fill, w=1.6, rot=0):
    d = f"M{num(cx)} {num(cy - ry)} L{num(cx + rx)} {num(cy)} L{num(cx)} {num(cy + ry)} L{num(cx - rx)} {num(cy)}Z"
    return G(P(d, fill, w), rot, cx, cy) if rot else P(d, fill, w)


FIREBALL = "M40 21 C46.1 21 51 25.9 51 32 C51 38.1 46.1 43 40 43 C33 43 28 41.5 23 42.5 L14 39.5 C18 37.5 21 36.5 25 35.5 L11.5 31.5 C16 29.8 20 29 25 28.5 L15.5 24 C22 22 30 21 40 21Z"
FIRECORE = "M41 26 C44.3 26 47 28.7 47 32 C47 35.3 44.3 38 41 38 C36 38 32 35 28 32 C32 29 36 26 41 26Z"

ICONS = {}

# ---------------------------------------------------------------- class icons
ICONS["elementalist"] = icon(ELEM, G(
    P("M29.2 34 L34.8 34 L34 54.5 Q32 57 30 54.5Z", EARTH, 2.5)
    + P("M22.5 22.5 Q23.5 36.5 32 36.5 Q40.5 36.5 41.5 22.5 L37.8 24.4 Q37 32.6 32 32.6 Q27 32.6 26.2 24.4Z", EARTH, 2.4)
    + P("M32 5.5 L39.5 13.5 L39.5 25 L32 32 L24.5 25 L24.5 13.5Z", ARC, 0)
    + P("M32 5.5 L39.5 13.5 L39.5 25 L32 32Z", CREAM, 0)
    + P("M32 5.5 L39.5 13.5 L39.5 25 L32 32 L24.5 25 L24.5 13.5Z", "none", 2.6)
    + L("M32 6.5 L32 31", 1.7) + L("M24.5 13.5 L32 17 L39.5 13.5", 1.5), rot=38))

ICONS["illusionist"] = icon(ILLU,
    G(card(32, 30, 18, 26, 0, ARC) + f'<rect x="26" y="20" width="12" height="20" rx="1.5" fill="none" stroke="{CREAM}" stroke-width="1.5"/>', -26, 32, 50)
    + G(card(32, 30, 18, 26, 0, ARC) + f'<rect x="26" y="20" width="12" height="20" rx="1.5" fill="none" stroke="{CREAM}" stroke-width="1.5"/>', 26, 32, 50)
    + card(32, 28.5, 18, 26, 0, CREAM, 2.5)
    + P("M32 20.5 C29 24.5 25.5 26.5 25.5 29.5 C25.5 32 28.5 33.2 30.6 31.4 L29.4 35 L34.6 35 L33.4 31.4 C35.5 33.2 38.5 32 38.5 29.5 C38.5 26.5 35 24.5 32 20.5Z", INK, 0))

ICONS["necromancer"] = icon(NECRO,
    P("M9.5 42 Q20.5 38.5 32 43.5 Q43.5 38.5 54.5 42 L54 51.5 Q43.5 48.5 32 53.5 Q20.5 48.5 10 51.5Z", ARC, 2.5)
    + P("M12.5 39.5 Q21.5 36.5 32 41 Q42.5 36.5 51.5 39.5 L51.5 48.5 Q42.5 46 32 50.5 Q21.5 46 12.5 48.5Z", CREAM, 2.2)
    + L("M32 41 L32 50.5", 2.2) + L("M16 42.5 Q21 41 26 42.5 M38 42.5 Q43 41 48 42.5", 1.5)
    + skull(32, 24.5, 1.0, INK, NECRO))

ICONS["transmuter"] = icon(TRANS,
    P("M21 21.5 C22.5 31 22.5 42 21.5 53 C31 46.5 40 36.5 43 21.5Z", CREAM, 0)
    + P("M38.6 22.5 C36.8 33.5 30.5 44.5 22.5 51.6 C32 45.6 40.2 35.8 42.5 22.5Z", ARC, 0)
    + P("M21 21.5 C22.5 31 22.5 42 21.5 53 C31 46.5 40 36.5 43 21.5Z", "none", 2.6)
    + f'<rect x="19" y="14.5" width="26" height="8.5" rx="3" fill="{AMBER}" stroke="{INK}" stroke-width="2.5"/>'
    + C(32, 10.2, 3.3, "none", 2.5)
    + L("M25 18.8 L39 18.8", 1.6))

# ---------------------------------------------------------------- Elementalist kit
E_ = {}
E_["fireball"] = icon(ELEM, G(P(FIREBALL, FIRE, 2.5) + P(FIRECORE, CREAM, 1.8), rot=35))
E_["tidal-wave"] = icon(ELEM,
    P("M13 48 C14 37 19 24 30 18 C39 13 50 17 50 27 C50 33 45.5 35.5 42 33 C39.5 31 41 27.5 44 28 C40.5 25 34 28 33 35 C32.5 42 39 46.5 51 48Z", WATER, 2.5)
    + L("M20 33 C23 25 29 20.5 36 18.6", 2.6, CREAM)
    + C(47.5, 39, 2.2, WATER, 1.8) + C(52, 33.5, 1.6, WATER, 1.5))
E_["stone-javelin"] = icon(ELEM, G(
    L("M6.5 27.5 L12.5 27.5 M5.5 33 L13 33 M7 38.5 L12.5 38.5", 2.6)
    + P("M53 32 L44.5 25.5 L37.5 27 L31 23.5 L22 26 L15 28.5 L16.5 35 L23.5 38.5 L31.5 36.5 L38.5 39 L45 38Z", EARTH, 0)
    + P("M53 32 L45 38 L38.5 39 L31.5 36.5 L23.5 38.5 L16.5 35 L15 28.5 L24 32 L32 31 L40 32.5Z", DARK_EARTH, 0)
    + P("M53 32 L44.5 25.5 L37.5 27 L31 23.5 L22 26 L15 28.5 L16.5 35 L23.5 38.5 L31.5 36.5 L38.5 39 L45 38Z", "none", 2.6)
    + L("M24 32 L32 31 L40 32.5 L53 32", 1.5), rot=-35))
E_["gale-step"] = icon(ELEM,
    OS("M12 23 L35 23 C41 23 43 16 38.5 15 C35.5 14.3 34 17.5 36.5 18.5", WIND)
    + OS("M14 32 L45 32 M39.5 26 L46.5 32 L39.5 38", WIND)
    + OS("M12 41 L33 41 C39 41 41 48 36.5 49 C33.5 49.7 32 46.5 34.5 45.5", WIND))
E_["steam-veil"] = icon(ELEM,
    OS("M24 31 C21 27 27 24 24 19 C22.5 16.5 24 14 25.5 13", WATER, 3.4)
    + OS("M32 30 C29 26 35 23 32 18 C30.5 15.5 32 13 33.5 12", CREAM, 3.4)
    + OS("M40 31 C37 27 43 24 40 19 C38.5 16.5 40 14 41.5 13", FIRE, 3.4)
    + P("M15 48 C10 48 10 40.5 15.5 40 C15 34 22 31.5 26 34.5 C28 28.5 38 28 40 34 C44 31 51 34 49 40 C54 40.5 54 48 49 48Z", CREAM, 2.5)
    + L("M21 43 C24 41.5 27 41.5 30 43 M35 42 C38 40.5 41 40.5 44 42", 1.6))
E_["fire-tornado"] = icon(ELEM,
    OS("M31.5 42 C30 46 31.5 49.5 36 50.5", FIRE, 3.4)
    + E(32, 40, 6.2, 3.2, FIRE, 2.3) + E(32, 33, 9.4, 3.8, FIRE, 2.4) + E(32, 25.5, 12.8, 4.3, FIRE, 2.5)
    + P("M16 18.5 L18.5 12 L22 15.5 L25.5 9.5 L28.5 14 L32 8 L35.5 14 L38.5 9.5 L42 15.5 L45.5 12 L48 18.5 C48 21.5 41 23.5 32 23.5 C23 23.5 16 21.5 16 18.5Z", FIRE, 2.5)
    + OS("M20.5 26.5 Q32 31 43.5 26.5", WIND, 2.2) + OS("M24.5 34 Q32 37 39.5 34", WIND, 2.2) + OS("M21.5 18.8 Q32 22 42.5 18.8", WIND, 2.2))
E_["molten-pillars"] = icon(ELEM,
    E(32, 48.5, 18, 3.6, LAVA, 2.5)
    + P("M14.5 48 L15.5 34.5 L18.5 31.5 L21.5 33.5 L23 48Z", EARTH, 2.4)
    + P("M25 48 L26 21.5 L28.5 15.5 L31 18 L34 13.5 L37 19.5 L38.5 48Z", EARTH, 2.5)
    + P("M40.5 48 L41.5 28.5 L44.5 25 L47.5 28 L49 48Z", EARTH, 2.4)
    + P("M26 22.5 L28.5 15.5 L31 18 L34 13.5 L37 19.5 L37.3 25 C36.2 27 35.2 25 34.8 27.8 C34.3 30.5 32.6 30 32.6 27.2 C31.8 25.6 30.2 27.4 29.4 25.8 C28.6 28 27 27.4 26 25.2Z", LAVA, 2.0)
    + P("M15.3 36.5 L18.5 31.5 L21.5 33.5 L22 37.5 C21 39 20 37.5 19.2 39.2 C18.4 40.8 17 40 17 38.4 C16.2 37.4 15.6 38.4 15.3 36.5Z", LAVA, 1.8)
    + P("M41.3 31 L44.5 25 L47.5 28 L48 31.5 C47 33.5 46 31.8 45.3 33.8 C44.5 35.6 43 34.8 43 33 C42.2 32 41.6 33 41.3 31Z", LAVA, 1.8)
    + L("M30.5 33 L33 37 L31 41 M45 38 L43.5 42", 1.5))


def flower(cx, cy, r=3.2, d=3.3, rot=-90):
    outline, fill = "", ""
    for k in range(5):
        a = math.radians(rot + 72 * k)
        px, py = cx + d * math.cos(a), cy + d * math.sin(a)
        outline += C(px, py, r, INK, 0, f' stroke="{INK}" stroke-width="4"')
        fill += C(px, py, r, FLOWER, 0)
    return outline + fill + C(cx, cy, 1.9, CREAM, 1.3)


fl = ""
for k in range(5):
    a = math.radians(-90 + 72 * k + 36)
    fl += flower(32 + 14.6 * math.cos(a), 32 + 14.6 * math.sin(a), rot=-90 + 72 * k + 36)
E_["spring-grove"] = icon(ELEM,
    f'<circle cx="32" cy="32" r="14.6" fill="none" stroke="{INK}" stroke-width="5.4"/><circle cx="32" cy="32" r="14.6" fill="none" stroke="{FLOWER}" stroke-width="2"/>'
    + fl + P("M32 23.5 C35.2 28 37.5 30.8 37.5 34 C37.5 37.2 35 39.5 32 39.5 C29 39.5 26.5 37.2 26.5 34 C26.5 30.8 28.8 28 32 23.5Z", WATER, 2.4)
    + E(30, 34.5, 1.3, 2.2, CREAM, 0, -20))


def taper(pts, w0, w1):
    """A filled tapered stroke through hand-placed points (half-width w0 at the start to w1 at the end)."""
    n = len(pts)
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        ax, ay = pts[max(0, i - 1)]
        bx, by = pts[min(n - 1, i + 1)]
        tx, ty = bx - ax, by - ay
        l = math.hypot(tx, ty) or 1
        nx, ny = -ty / l, tx / l
        w = w0 + (w1 - w0) * i / (n - 1)
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    poly = left + right[::-1]
    return "M" + " L".join(f"{num(x)} {num(y)}" for x, y in poly) + "Z"


def bez_pts(p0, p1, p2, p3, n=12, last=True):
    out = []
    for i in range(n + (1 if last else 0)):
        k = i / n
        out.append(tuple((1 - k) ** 3 * a + 3 * (1 - k) ** 2 * k * b + 3 * (1 - k) * k * k * c + k ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


whip = bez_pts((13, 47), (20, 44), (24, 35), (30, 30), 10, False) + bez_pts((30, 30), (36, 25), (46, 25), (48, 18), 10, False) + bez_pts((48, 18), (49.5, 13), (43.5, 10.5), (40.5, 14), 8, False) + bez_pts((40.5, 14), (38.5, 16.5), (40, 19.5), (43, 19), 6)
E_["riptide"] = icon(ELEM,
    OS("M10 33.5 L18.5 33.5 M13.5 26 L21 26", WIND, 2.8)
    + P(taper(whip, 4.4, 1.3), WATER, 2.4)
    + C(23.5, 48.5, 2.2, WATER, 1.6) + C(52.5, 27.5, 1.9, WATER, 1.5))
E_["rampart"] = icon(ELEM,
    P("M12.5 47 L52 47 L52 25.5 L46.5 24.5Z", EARTH, 2.5)
    + L("M22.4 40.5 L52 40.5 M33.6 33.5 L52 33.5 M44.5 27 L52 27 M30 47 L30 40.5 M42 47 L42 40.5 M38 40.5 L38 33.5 M47.5 33.5 L47.5 27", 1.8)
    + OS("M11.5 36 C19 31 27 24 37.5 18", WIND, 2.8) + OS("M33 15 L39 16.5 L37.5 22.5", WIND, 2.8))
E_["cataclysm"] = icon(ELEM,
    f'<g transform="translate(36.5 41.5) rotate(42) scale(0.78) translate(-40 -32)">{P(FIREBALL, FIRE, 3.2)}{C(41.5, 32, 6.6, STORM, 2.9)}{L("M38.5 29.5 L41.5 31.5 L40.5 35", 2.2, CREAM)}</g>'
    + P("M14.5 27 C10 27 10 20 15 19.5 C15 14 21.5 11 25.5 14 C27.5 8.5 37.5 8.5 39.5 14 C43.5 11.5 50 14 49 19.5 C54 20 54 27 49.5 27Z", STORM, 2.5)
    + L("M17.5 17.5 C18.5 15 21.5 14 24 15.5 M29 12 C31.5 10 35 10 37 12.5", 1.8, ELEM))
pip = {"fire": FIRE, "water": WATER, "earth": EARTH, "wind": WIND}
att = f'<circle cx="32" cy="32" r="12.5" fill="none" stroke="{INK}" stroke-width="2"/>'
for k, (nm, colr) in enumerate(pip.items()):
    a = math.radians(-90 + 90 * k)
    px, py = 32 + 12.5 * math.cos(a), 32 + 12.5 * math.sin(a)
    ah = math.radians(-90 + 90 * k + 45)
    hx, hy = 32 + 12.5 * math.cos(ah), 32 + 12.5 * math.sin(ah)
    tx, ty = -math.sin(ah), math.cos(ah)
    att += P(f"M{num(hx - tx * 2.6 + math.cos(ah) * 2.6)} {num(hy - ty * 2.6 + math.sin(ah) * 2.6)} L{num(hx + tx * 1.6)} {num(hy + ty * 1.6)} L{num(hx - tx * 2.6 - math.cos(ah) * 2.6)} {num(hy - ty * 2.6 - math.sin(ah) * 2.6)}", "none", 2)
    att += C(px, py, 6.2, colr, 2.4)
att += star4(32, 32, 5.6, ELEM, 1.6, 0.36)
E_["attunement"] = icon(ELEM, att)
E_["air-step"] = icon(ELEM,
    P("M22.5 9 L34.5 9 L34.5 25.5 C37.5 26.5 43 27.5 46.5 29.5 C49.5 31 49.5 35.5 46.5 36.5 L22 36.5 C20.5 36.5 20 35.5 20 34Z", EARTH, 2.5)
    + P("M20 36.5 L47.2 36.5 L47.2 40 L20 40Z", INK, 0)
    + L("M22.5 14 L34.5 14", 2.0) + L("M27 25 L31 22.5 M27 29.5 L31 27", 1.6)
    + P("M22 50 C17.5 50 17 45 21 44.5 C21.5 41.5 25.5 41 27.5 43 C29 40.5 35 40.5 36.5 43 C38.5 41 42.5 41.5 43 44.5 C47 45 46.5 50 42 50Z", WIND, 2.4)
    + OS("M17.5 42 L12.5 39.5 M15.5 48 L10.5 49.5 M46.5 42 L51.5 39.5 M48.5 48 L53.5 49.5", WIND, 2.2))

# ---------------------------------------------------------------- Illusionist kit
I_ = {}
I_["mirror-clone"] = icon(ILLU,
    L("M32 12.5 L32 51.5", 1.8, extra=' stroke-dasharray="3 2.6"')
    + figure(21.5, 50, 1.05, ARC, arm="M24.5 30.5 L30 25.5")
    + figure(42.5, 50, 1.05, ILLU, arm="M39.5 30.5 L34 25.5")
    + star4(32, 18.5, 4.6, CREAM, 1.5))
I_["swap"] = icon(ILLU,
    figure(20.5, 48, 0.86, ARC) + figure(43.5, 48, 0.86, CREAM)
    + L("M17.5 22.5 Q31 9.5 44.5 19.5", 2.4) + P("M40.3 20.6 L45.6 20.4 L44.2 15.4", "none", 2.4)
    + L("M46.5 46 Q33 57 19.5 49.5", 2.4) + P("M23.6 48.3 L18.4 48.9 L20.1 53.7", "none", 2.4))
I_["mirror-ward"] = icon(ILLU,
    G(f'<rect x="21" y="39" width="6" height="11" rx="2" fill="{ARC}" stroke="{INK}" stroke-width="2.4"/>'
      + C(24, 52, 2.6, ARC, 2.2)
      + E(24, 26.5, 11.5, 13.5, ARC, 2.6) + E(24, 26.5, 7.6, 9.6, ILLU, 2)
      + P("M17.5 25 L24.5 17.5 L27 19.5 L20 27Z", CREAM, 0) + P("M20.5 31 L28.5 22.5 L29.8 24 L21.8 32.5Z", CREAM, 0)
      + diamond(24, 11.8, 2.2, 2.8, ARC, 1.8), -22, 24, 30)
    + OS("M53 41 L46.5 38 L47.5 35 L37 31.5", AMBER, 3) + OS("M37 31.5 L45.5 26.5 L44.5 23.5 L50 19.5", AMBER, 3)
    + P("M45.5 17.4 L52.8 17.8 L49.4 24.2Z", AMBER, 2))
I_["trick-card"] = icon(ILLU,
    C(13.5, 49, 2, INK, 0) + C(18.6, 45.6, 2, INK, 0) + C(23.7, 42.2, 2, INK, 0)
    + L("M23 33 L29 29 M27 39.5 L32 36", 2.2)
    + card(38.5, 25.5, 18, 25, 28, ARC, 2.6, 3) + f'<rect x="33" y="17.5" width="11" height="16" rx="1.5" fill="none" stroke="{CREAM}" stroke-width="1.6" transform="rotate(28 38.5 25.5)"/>'
    + diamond(38.5, 25.5, 3.6, 5.2, CREAM, 1.6, 28)
    + star4(52, 13.5, 4.6, ILLU, 1.5))
I_["vanish"] = icon(ILLU,
    '<defs><clipPath id="arcane-vanish-cut"><path d="M0 0 L31 0 L28.5 18 L31.5 25 L28 33 L31 41 L28.5 64 L0 64Z"/></clipPath></defs>'
    + f'<g clip-path="url(#arcane-vanish-cut)">{figure(25, 50, 1.1, ARC)}</g>'
    + f'<g opacity="0.9">{figure(25, 50, 1.1, "none", 1.6, dashed=True)}</g>'
    + card(37.5, 34, 7, 9.5, 18, CREAM, 1.8, 1.4) + card(44.5, 24.5, 7, 9.5, -16, ARC, 1.8, 1.4)
    + card(41.5, 44.5, 6, 8.5, 34, ARC, 1.8, 1.4) + card(48.5, 35, 5.5, 7.5, -30, CREAM, 1.7, 1.3)
    + card(38, 16, 5, 7, 12, CREAM, 1.6, 1.2))
I_["joker"] = icon(ILLU,
    card(32, 32, 27, 37, 0, CREAM, 2.5, 3)
    + P("M23 31.5 C22 27 19.5 25 16.5 26 C17.5 21 22.5 19.5 27 22.5 C27.5 18.5 29.5 15.5 32 13.5 C34.5 15.5 36.5 18.5 37 22.5 C41.5 19.5 46.5 21 47.5 26 C44.5 25 42 27 41 31.5Z", ARC, 2.1)
    + C(16.8, 27.5, 2.3, AMBER, 1.6) + C(32, 13.2, 2.3, AMBER, 1.6) + C(47.2, 27.5, 2.3, AMBER, 1.6)
    + f'<rect x="22.5" y="30.5" width="19" height="3.6" rx="1" fill="{AMBER}" stroke="{INK}" stroke-width="1.9"/>'
    + P("M25 38 Q32 46 39 38", "none", 2.2) + C(27.6, 36.5, 1.2, INK, 0) + C(36.4, 36.5, 1.2, INK, 0)
    + L("M40 46 L37.5 42.5 L39 39.5 M40 46 L43.8 43.6 M40 46 L38.8 49.8 M40 46 L44.6 47.6", 1.6)
    + P("M46.5 48 L51 46.5 L49.4 51.6Z", CREAM, 1.6) + P("M42 52 L45.5 51 L44 55Z", CREAM, 1.5))
I_["whos-real"] = icon(ILLU,
    figure(23.5, 50, 0.92, ARC) + figure(40.5, 50, 0.92, "none", 1.8, dashed=True)
    + OS("M28.5 15.5 C28.5 11 35.5 11 35.5 15.5 C35.5 18.8 32 19.3 32 22.5", ILLU, 2.6)
    + C(32, 26.8, 2, ILLU, 1.6))

# ---------------------------------------------------------------- Necromancer kit
N_ = {}
N_["raise-dead"] = icon(NECRO,
    bone_finger([(30.6, 46), (30, 36)], 2.4) + bone_finger([(34, 46), (34.6, 36)], 2.4)
    + P("M26.5 35.5 C26 31 28 28.5 32 28.5 C36 28.5 38.5 30.5 38.5 34.5 C38.5 37 35.5 38 32 38 C28.5 38 26.8 37.5 26.5 35.5Z", CREAM, 2.2)
    + bone_finger([(28.5, 29), (26.8, 23), (25.8, 18)]) + bone_finger([(32.2, 28.3), (32.4, 21.5), (32.4, 15.5)])
    + bone_finger([(35.6, 29), (37.3, 23), (38.4, 18)]) + bone_finger([(38, 31.5), (41.3, 27), (43, 23.3)])
    + bone_finger([(27, 33), (22.8, 30), (20.6, 26.2)])
    + P("M13.5 48.5 C18 43.5 25 41.5 32 41.5 C39 41.5 46 43.5 50.5 48.5Z", ARC, 2.5)
    + OS("M20 47 L23.5 44.5 L26 46.5 M41 46.5 L44.5 44 L47 46.2", NECRO, 1.8))
N_["command"] = icon(NECRO,
    bone_finger([(11.5, 45), (18.5, 38)], 2.3) + bone_finger([(14, 47.5), (21, 40.5)], 2.3)
    + P("M17 36.5 C16 31 19 27 24 27 C28 27 29.5 29.5 29.5 33 C29.5 37.5 26.5 40.5 22 40.5 C19.5 40.5 17.5 39 17 36.5Z", CREAM, 2.2)
    + bone_finger([(27.5, 30.5), (33, 30.5), (38.5, 30.5)])
    + bone_finger([(27.8, 34.5), (31.5, 35), (31, 38.5)]) + bone_finger([(26, 38), (29, 39.5), (28.5, 42.5)])
    + bone_finger([(21.5, 28), (24, 23.8), (28, 22.8)])
    + OS("M41.5 25 L47.5 31.5 L41.5 38", ARC, 3) + OS("M47.5 25 L53.5 31.5 L47.5 38", ARC, 3))
burst = []
for k in range(14):
    a = math.radians(-90 + k * 360 / 14)
    r = 21 if k % 2 == 0 else 11.5
    burst.append(f"{num(32 + r * math.cos(a))} {num(31 + r * math.sin(a))}")
N_["corpse-explosion"] = icon(NECRO,
    P("M" + " L".join(burst) + "Z", ARC, 2.2)
    + skull(32, 30, 0.78, INK, NECRO, 2.3, crack=True)
    + P("M14.5 15.5 L19.5 17 L16 20.5Z", CREAM, 1.6) + P("M48.5 14.5 L49 20 L44.5 18Z", CREAM, 1.6) + P("M50.5 45 L45.5 44 L48 49Z", CREAM, 1.6))
N_["dark-pact"] = icon(NECRO,
    P(heart(32, 33, 2.05), ARC, 2.5) + P(heart(32, 33, 1.62), "none", 0, f' stroke="{NECRO}" stroke-width="2"')
    + skull(32, 31, 0.68, INK, NECRO, 2.2))
N_["bone-surf"] = icon(NECRO,
    L("M7.5 27 L13.5 27 M8.5 33 L14.5 33", 2.4)
    + OS("M17.5 51 C16.5 48 18.5 45.5 21.5 44.5 M27.5 51.5 C27 48.5 29 46 32 45.3 M38 51 C38 48 40 45.8 43 45.2", CREAM, 2.2, 5.4)
    + OS("M15.5 42.5 L47 38.5", CREAM, 4.2, 7.8)
    + C(15, 40.3, 2.6, CREAM, 2) + C(15.6, 44.7, 2.6, CREAM, 2) + C(47.4, 36.3, 2.6, CREAM, 2) + C(48, 40.7, 2.6, CREAM, 2)
    + OS("M31.5 21.5 L29 30 M29 30 L23.5 33 L25.5 39 M29 30 L35 33 L36.5 38 M30.8 24 L23 21.5 M30.8 24 L39 27.5", ARC, 3.6, 7.2)
    + C(32.2, 16.8, 4, ARC, 2.4))
N_["army-of-the-dead"] = icon(NECRO,
    skull(20.5, 23, 0.56, INK, None, 2) + skull(32, 19.5, 0.58, INK, None, 2) + skull(43.5, 23, 0.56, INK, None, 2)
    + skull(25.5, 35.5, 0.7, INK, NECRO, 2.3) + skull(38.5, 35.5, 0.7, INK, NECRO, 2.3)
    + P("M12.5 45 Q32 40.5 51.5 45 L49.5 50 Q32 54.5 14.5 50Z", ARC, 2.5)
    + OS("M17 46.5 L21.5 48 L24.5 46 L28 48.5 M33 46 L36.5 48.5 L40 46.5 L43 48 L47 46.5", NECRO, 1.8))
N_["grave-tithe"] = icon(NECRO,
    P("M13.5 50 C18 44 25 42.5 32 42.5 C39 42.5 46 44 50.5 50Z", ARC, 2.5)
    + P("M21.5 46 L21.5 24 C21.5 16.5 26.5 12.5 32 12.5 C37.5 12.5 42.5 16.5 42.5 24 L42.5 46Z", STEAM, 2.5)
    + P(heart(32, 29.5, 0.82), NECRO, 2.2)
    + L("M37.5 16.5 L35.5 20 L37 22.5", 1.5))

# ---------------------------------------------------------------- Transmuter kit
T_ = {}
T_["fox"] = icon(TRANS,
    P("M32 22 L36 21.5 L43.5 12 L46.5 22 C48 24.5 49.5 27 52 33 C47.5 36.5 44 40 37 44 L32 47.5 L27 44 C20 40 16.5 36.5 12 33 C14.5 27 16 24.5 17.5 22 L20.5 12 L28 21.5Z", AMBER, 2.5)
    + P("M16.5 34.5 C21.5 37.5 27 38 32 36.5 C37 38 42.5 37.5 47.5 34.5 C44 39.5 39 43.2 32 47 C25 43.2 20 39.5 16.5 34.5Z", CREAM, 0)
    + P("M32 22 L36 21.5 L43.5 12 L46.5 22 C48 24.5 49.5 27 52 33 C47.5 36.5 44 40 37 44 L32 47.5 L27 44 C20 40 16.5 36.5 12 33 C14.5 27 16 24.5 17.5 22 L20.5 12 L28 21.5Z", "none", 2.5)
    + P("M38.5 20.5 L43 14.5 L44.5 21.2Z", INK, 0) + P("M25.5 20.5 L21 14.5 L19.5 21.2Z", INK, 0)
    + P("M23.5 28.5 Q26.5 25.8 29.5 28.8 Q26.5 30.4 23.5 28.5Z", INK, 1.2) + P("M40.5 28.5 Q37.5 25.8 34.5 28.8 Q37.5 30.4 40.5 28.5Z", INK, 1.2)
    + P("M29.5 42.5 L34.5 42.5 L32 45.5Z", INK, 1.2))
T_["crab"] = icon(TRANS,
    L("M21 41 L14.5 44.5 M22.5 44 L17 49 M43 41 L49.5 44.5 M41.5 44 L47 49", 2.4)
    + OS("M23 34 L19 27", FIRE, 3.2) + OS("M41 34 L45 27", FIRE, 3.2)
    + P("M19.5 28.5 C12 28 9.5 20.5 13 15 C14.8 18.8 17.4 20.4 20.2 19.8 C18.6 17 19.2 13.2 22 11.5 C25 14.5 25.5 21 23.5 25 C22.5 27.2 21.2 28.5 19.5 28.5Z", FIRE, 2.4)
    + P("M44.5 28.5 C52 28 54.5 20.5 51 15 C49.2 18.8 46.6 20.4 43.8 19.8 C45.4 17 44.8 13.2 42 11.5 C39 14.5 38.5 21 40.5 25 C41.5 27.2 42.8 28.5 44.5 28.5Z", FIRE, 2.4)
    + L("M28.5 31 L27.5 25.5 M35.5 31 L36.5 25.5", 2.2)
    + E(32, 38, 13, 8.5, FIRE, 2.5)
    + C(27.5, 24, 2.6, CREAM, 2) + C(36.5, 24, 2.6, CREAM, 2) + C(27.8, 24.3, 1.1, INK, 0) + C(36.8, 24.3, 1.1, INK, 0)
    + L("M27 39.5 Q32 42.5 37 39.5", 1.8))
T_["wisp"] = icon(TRANS,
    diamond(13.5, 30, 2.6, 3.6, WISP, 1.6) + diamond(50.5, 34, 2.6, 3.6, WISP, 1.6) + diamond(41.5, 13.5, 2, 2.8, WISP, 1.4)
    + P("M33.5 11 C36.5 17.5 43.5 23.5 43.5 33 C43.5 40 38.5 45.5 32 45.5 C25.5 45.5 20.5 40 20.5 33 C20.5 25.5 27 21.5 28 15.5 C30 18.5 31 20.5 33.5 11Z", WISP, 2.5)
    + P("M32 25.5 C34.8 28.6 37.5 31 37.5 34.8 C37.5 38 35 40.2 32 40.2 C29 40.2 26.5 38 26.5 34.8 C26.5 31 29.2 28.6 32 25.5Z", CREAM, 0)
    + E(29.6, 34.5, 1.5, 2.4, INK, 0) + E(34.4, 34.5, 1.5, 2.4, INK, 0))
T_["pollen"] = icon(TRANS,
    P("M27.5 28 C20 27 13 21 14 15 C15 11.5 20 11 23.5 14.5 C27 18 28.5 23 27.5 28Z", WISP, 2.3)
    + P("M36.5 28 C44 27 51 21 50 15 C49 11.5 44 11 40.5 14.5 C37 18 35.5 23 36.5 28Z", WISP, 2.3)
    + P("M27 31 C21 31.5 16 34.5 16 38.5 C16 41.5 20.5 42 24 39.5 C26.5 37.5 27.5 34 27 31Z", WISP, 2.1)
    + P("M37 31 C43 31.5 48 34.5 48 38.5 C48 41.5 43.5 42 40 39.5 C37.5 37.5 36.5 34 37 31Z", WISP, 2.1)
    + E(32, 39, 7, 9, POLLEN, 2.5) + L("M25.6 40.5 Q32 43 38.4 40.5 M26.6 45.5 Q32 47.5 37.4 45.5", 2.0)
    + C(32, 25.5, 6, POLLEN, 2.4) + C(29.7, 25, 1.1, INK, 0) + C(34.3, 25, 1.1, INK, 0)
    + L("M29.5 20.5 C28.5 17 27 15 25 14 M34.5 20.5 C35.5 17 37 15 39 14", 1.7)
    + C(13.5, 47, 1.9, POLLEN, 1.5) + C(50.5, 47, 2.1, POLLEN, 1.5) + C(44.5, 52.5, 1.5, POLLEN, 1.3))
T_["golem"] = icon(TRANS,
    P("M20 14 L44 14 L48.5 20 L48.5 40 L44 47.5 L20 47.5 L15.5 40 L15.5 20Z", STONE, 2.5)
    + L("M16.5 27 L47.5 27", 2.4)
    + f'<rect x="20.5" y="29" width="8" height="5" rx="1" fill="{AMBER}" stroke="{INK}" stroke-width="2"/><rect x="35.5" y="29" width="8" height="5" rx="1" fill="{AMBER}" stroke="{INK}" stroke-width="2"/>'
    + diamond(32, 20.5, 3.2, 4, AMBER, 1.7)
    + L("M23.5 40.5 L40.5 40.5 M27.5 40.5 L27.5 43.5 M32 40.5 L32 43.5 M36.5 40.5 L36.5 43.5", 2)
    + L("M21.5 14.5 L23.5 18.5 L21.5 22 M44 34 L46 37.5", 1.5))
T_["chimera"] = icon(TRANS,
    P("M32 15.5 L26.5 18 L18.5 8.5 L16.5 22 C13.5 26.5 12 31 12.5 36 C15 41 21 45.5 32 49.5Z", AMBER, 2.5)
    + P("M32 15.5 L39.5 15.5 C40 11.5 43.5 8.5 47.5 9.5 C45.5 11.5 45 13.5 47.5 15.5 L50.5 20.5 L51.5 37.5 L46.5 44.5 L32 49.5Z", STONE, 2.5)
    + P("M22.5 17.5 L19.5 12.5 L19 20Z", INK, 0)
    + P("M20.5 27.5 Q23.5 25 26.5 28 Q23.5 29.5 20.5 27.5Z", INK, 1.2)
    + f'<rect x="37" y="25.5" width="8" height="4.6" rx="1" fill="{AMBER}" stroke="{INK}" stroke-width="1.9"/>'
    + L("M42 39 L45 33.5 M48 25 L49.5 29", 1.4)
    + P("M19 36 Q32 43.5 45 36 Q32 53 19 36Z", INK, 1.6)
    + P("M23.5 38.5 L26.5 39.8 L25 44Z", CREAM, 1.2) + P("M40.5 38.5 L37.5 39.8 L39 44Z", CREAM, 1.2)
    + P("M30.2 41.4 L33.8 41.4 L32 45.2Z", CREAM, 1.1)
    + L("M32 16 L33.6 20.5 L30.4 25 L33.6 29.5 L30.4 34", 1.8) + L("M29.5 19 L34.5 22 M29.5 27.5 L34.5 30.5", 1.4))
T_["shed-skin"] = icon(TRANS,
    G(P("M32 12.5 C40 15 46 18 47 26 C48 37 41 45 32 51.5 C23 45 16 37 17 26 C18 18 24 15 32 12.5Z", "none", 1.6, ' stroke-dasharray="3 2.6"'), 0, tx=-4.5, ty=3.5)
    + P("M32 12.5 C40 15 46 18 47 26 C48 37 41 45 32 51.5 C23 45 16 37 17 26 C18 18 24 15 32 12.5Z", AMBER, 2.5)
    + L("M21.5 27 Q26.8 33.5 32 27 Q37.2 33.5 42.5 27 M25 37.5 Q28.5 42.5 32 37.5 Q35.5 42.5 39 37.5", 2)
    + star4(42.5, 17.5, 6.6, CREAM, 1.6, 0.3))

KITS = {"elementalist": E_, "illusionist": I_, "necromancer": N_, "transmuter": T_}


def write_all():
    files = []
    for name, svg in ICONS.items():
        p = os.path.join(OUT, f"{name}.svg")
        open(p, "w").write(svg + "\n")
        files.append(p)
    for kit, icons in KITS.items():
        os.makedirs(os.path.join(OUT, kit), exist_ok=True)
        for name, svg in icons.items():
            p = os.path.join(OUT, kit, f"{name}.svg")
            open(p, "w").write(svg + "\n")
            files.append(p)
    return files


if __name__ == "__main__":
    for f in write_all():
        print(os.path.relpath(f, WT))
