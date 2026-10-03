"""Hand-drawn SVG icons for the Vanguard wave of classes v2 (design sheet §1.9 "Class icons", §4 "Icons").

  python3 art/icons/build_vanguard_icons.py            # writes web/public/assets/game/classes/...
  python3 art/icons/build_vanguard_icons.py sheet      # and specs/evidence/classes/K-vanguard-icons.webp

Every icon is a flat emblem on a cream disc with an ink outline (readable at 24 px), the family's yellow ring for the
class icons and the subclass's own colour (its ramp's mid band) for its keys, ult and passive. Shapes are drawn here
as plain paths, no downloads and no generation. Also the family's shop cosmetic icons and its two nameplate frames.
"""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "web", "public", "assets", "game", "classes")
INK, CREAM, FAMILY, WHITE = "#1d1a24", "#f6efdc", "#f0c23c", "#fffdf3"
GOLD, AMBER, FLAME, RED, STEEL = "#f0c23c", "#e8a23a", "#f2913a", "#e0303c", "#c9ccd4"


def disc(ring, body, extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            f'<circle cx="32" cy="32" r="29" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>'
            f'<circle cx="32" cy="32" r="23" fill="none" stroke="{ring}" stroke-width="3.5"/>{body}{extra}</svg>')


def p(d, fill, sw=2.5, extra=""):
    return f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{extra}/>'


def line(d, color=INK, sw=3):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'


def circ(cx, cy, r, fill, sw=2.5):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>'


# ── shared motifs ──
SHIELD = "M32 14 L46 19 L45 33 Q43 43 32 50 Q21 43 19 33 L18 19 Z"
def shield(c=GOLD, dx=0, dy=0, s=1.0):
    t = f' transform="translate({32 + dx} {32 + dy}) scale({s}) translate(-32 -32)"'
    return p(SHIELD, c, extra=t) + line("M32 18 L32 46", INK, 2).replace("/>", t + "/>")
SWORD = "M30.5 9 L33.5 9 L34 40 L30 40 Z"
def sword(angle=0, c=STEEL):
    t = f' transform="rotate({angle} 32 32)"'
    return (p(SWORD, c, 2.2, t) + p("M25 40 L39 40 L39 43.5 L25 43.5 Z", GOLD, 2.2, t) + p("M30.6 43.5 L33.4 43.5 L33.4 52 L30.6 52 Z", "#8a5a2b", 2, t))
def hammer(angle=0, c="#8a8f99", head_y=16):
    t = f' transform="rotate({angle} 32 32)"'
    return (p("M30 22 L34 22 L34.5 53 L29.5 53 Z", "#8a5a2b", 2.2, t) + p(f"M19 {head_y} L45 {head_y} L45 {head_y + 13} L19 {head_y + 13} Z", c, 2.5, t)
            + p(f"M17 {head_y + 2} L19 {head_y + 2} L19 {head_y + 11} L17 {head_y + 11} Z", AMBER, 2, t) + p(f"M45 {head_y + 2} L47 {head_y + 2} L47 {head_y + 11} L45 {head_y + 11} Z", AMBER, 2, t))
FIST = ("M21 30 Q21 22 27 22 L39 22 Q44 22 44 27 L44 38 Q44 47 35 48 L28 48 Q21 47 21 40 Z")
THUMB = "M21 31 Q14 31 14 37 Q14 42 21 41 L30 41 Q33 41 33 38 Q33 35 30 35 L21 35 Z"
def fist(c=FLAME, dx=0, dy=0, s=1.0):
    t = f' transform="translate({32 + dx} {32 + dy}) scale({s}) translate(-32 -32)"'
    return (p(FIST, c, extra=t) + line("M27 22 L27 30 M33 22 L33 30 M39 22 L39 30", INK, 2).replace("/>", t + "/>")
            + line("M24 45 L43 42 M30 48 L42 46", WHITE, 2.4).replace("/>", t + "/>") + p(THUMB, c, 2.2, t))
def tanto(angle=0, c=STEEL):
    t = f' transform="rotate({angle} 32 32)"'
    return (p("M30.5 10 Q34.5 14 33.5 36 L30.5 36 Z", c, 2.2, t) + p("M28 36 L36 36 L36 38.5 L28 38.5 Z", INK, 1.5, t)
            + p("M30.2 38.5 L33.8 38.5 L33.8 52 L30.2 52 Z", RED, 2, t))
def lotus(c=RED, cx=32, cy=36, s=1.0):
    t = f' transform="translate({cx} {cy}) scale({s}) translate(-32 -36)"'
    petals = "".join(p(d, c, 2.2, t) for d in ["M32 18 Q38 28 32 40 Q26 28 32 18 Z", "M32 40 Q22 34 18 24 Q28 26 32 40 Z", "M32 40 Q42 34 46 24 Q36 26 32 40 Z",
                                                  "M32 42 Q20 42 14 34 Q26 32 32 42 Z", "M32 42 Q44 42 50 34 Q38 32 32 42 Z"])
    return petals
def spark(cx, cy, r, c=WHITE):
    return p(f"M{cx} {cy - r} L{cx + r * 0.28} {cy - r * 0.28} L{cx + r} {cy} L{cx + r * 0.28} {cy + r * 0.28} L{cx} {cy + r} L{cx - r * 0.28} {cy + r * 0.28} L{cx - r} {cy} L{cx - r * 0.28} {cy - r * 0.28} Z", c, 1.8)
def speed(x0, y0, n=3, length=10, gap=5, c=INK):
    return "".join(line(f"M{x0} {y0 + i * gap} L{x0 - length + i * 2} {y0 + i * gap}", c, 2.6) for i in range(n))


ICONS = {
    # ── class icons: the family's yellow ring, the subclass motif ──
    "guardian": disc(FAMILY, sword(-40) + shield(GOLD, 3, 3, 0.78)),
    "juggernaut": disc(FAMILY, hammer(-28)),
    "martial-artist": disc(FAMILY, fist(FLAME, 0, 1, 1.05) + line("M14 20 L20 24 M50 20 L44 24 M32 8 L32 13", INK, 2.6)),
    "assassin": disc(FAMILY, tanto(-35) + tanto(35) + lotus(RED, 32, 44, 0.55)),
    # ── Guardian ──
    "vanguard/block": disc(GOLD, shield(GOLD, -3, 2) + spark(46, 17, 8) + line("M50 28 L56 30 M47 9 L50 4", INK, 2.4)),
    "vanguard/challenge": disc(GOLD, shield(GOLD, -6, 0, 0.85) + line("M40 22 Q46 32 40 42 M45 18 Q53 32 45 46", INK, 3)),
    "vanguard/rush": disc(GOLD, shield(GOLD, 6, 0, 0.9) + speed(24, 22, 4, 12, 6)),
    "vanguard/dome": disc(GOLD, p("M12 44 Q12 16 32 16 Q52 16 52 44 Z", "#fff4c6", 2.5) + shield(GOLD, 0, 7, 0.55) + line("M10 44 L54 44", INK, 3)),
    "vanguard/throw": disc(GOLD, shield(GOLD, 0, 0, 0.7) + line("M14 28 Q14 12 32 12 M50 36 Q50 52 32 52", INK, 3) + p("M30 7 L36 12 L30 17 Z", INK, 1.5) + p("M34 47 L28 52 L34 57 Z", INK, 1.5)),
    "vanguard/unbreakable": disc(GOLD, line("M32 6 L32 12 M10 32 L16 32 M48 32 L54 32 M15 15 L19 19 M49 15 L45 19", INK, 2.8) + shield("#ffe9a0", 0, 2, 1.05) + spark(32, 33, 9, WHITE)),
    "vanguard/bulwark": disc(GOLD, shield(GOLD) + p("M28 26 L36 26 L36 30 L40 30 L40 36 L36 36 L36 40 L28 40 L28 36 L24 36 L24 30 L28 30 Z", WHITE, 2)),
    # ── Juggernaut ──
    "vanguard/charge": disc(AMBER, hammer(55, "#8a8f99", 14) + speed(22, 38, 3, 12, 6)),
    "vanguard/slam": disc(AMBER, hammer(0, "#8a8f99", 12) + line("M14 54 L22 46 L28 50 M50 54 L42 46 L36 50 M32 54 L32 50", INK, 2.6)),
    "vanguard/warcry": disc(AMBER, p("M22 22 Q32 14 42 22 L42 34 Q32 44 22 34 Z", AMBER) + p("M27 32 Q32 38 37 32 Z", INK, 1.5) + line("M14 20 Q10 30 14 40 M50 20 Q54 30 50 40 M9 16 Q4 30 9 44 M55 16 Q60 30 55 44", INK, 2.6)),
    "vanguard/drop": disc(AMBER, p("M27 10 L37 10 L37 30 L44 30 L32 44 L20 30 L27 30 Z", AMBER) + line("M12 52 L22 46 L28 51 L36 46 L42 51 L52 46", INK, 2.8)),
    "vanguard/titan": disc(AMBER, p("M24 52 L24 36 L18 30 L22 18 L28 22 L32 14 L36 22 L42 18 L46 30 L40 36 L40 52 Z", AMBER) + circ(32, 28, 4, WHITE, 2) + line("M8 54 L56 54", INK, 3)),
    "vanguard/unstoppable": disc(AMBER, p("M10 28 L36 28 L36 20 L52 32 L36 44 L36 36 L10 36 Z", AMBER) + line("M42 14 L42 24 M42 40 L42 50 M46 18 L46 22 M46 42 L46 46", INK, 2.6)),
    # ── Martial Artist ──
    "vanguard/teep": disc(FLAME, p("M14 20 L30 20 L30 34 L50 34 Q54 34 54 39 L54 42 L14 42 Z", FLAME) + line("M8 26 L4 26 M8 32 L3 32 M8 38 L4 38", INK, 2.6)),
    "vanguard/elbow": disc(FLAME, p("M14 46 L30 22 L48 34 L44 40 L31 32 L20 50 Z", FLAME) + line("M40 14 Q50 22 52 34", WHITE, 3.4) + line("M40 14 Q50 22 52 34", INK, 1.2)),
    "vanguard/clinch": disc(FLAME, circ(32, 20, 7, CREAM) + p("M14 30 Q14 14 25 16 L27 21 Q20 22 20 30 Z", FLAME, 2.2) + p("M50 30 Q50 14 39 16 L37 21 Q44 22 44 30 Z", FLAME, 2.2)
                                   + p("M24 56 L28 38 Q32 31 36 38 L40 56 Z", FLAME) + spark(32, 31, 5, WHITE)),
    "vanguard/roundhouse": disc(FLAME, line("M14 40 Q14 14 40 14", FLAME, 7) + line("M14 40 Q14 14 40 14", INK, 1.5) + p("M38 8 L50 14 L38 21 Z", INK, 1.5) + p("M26 30 L48 44 L44 50 L22 36 Z", FLAME)),
    "vanguard/flyingknee": disc(FLAME, p("M20 46 L32 26 L46 30 L42 36 L34 34 L26 50 Z", FLAME) + circ(32, 26, 4, WHITE, 2) + speed(18, 18, 3, 9, 6)),
    "vanguard/eightlimbs": disc(FLAME, "".join(p(f"M32 32 L{32 + 22 * c:.1f} {32 + 22 * s:.1f} L{32 + 8 * c2:.1f} {32 + 8 * s2:.1f} Z", FLAME if i % 2 else WHITE, 2)
                                            for i, (c, s, c2, s2) in enumerate([(__import__('math').cos(a), __import__('math').sin(a), __import__('math').cos(a + 0.39), __import__('math').sin(a + 0.39))
                                                                                for a in [k * 0.785398 for k in range(8)]])) + circ(32, 32, 5, FLAME, 2)),
    "vanguard/rhythm": disc(FLAME, "".join(p(f"M{x} {y} L{x + 7} {y} L{x + 7} 46 L{x} 46 Z", FLAME, 2.2) for x, y in [(16, 34), (28, 26), (40, 18)]) + line("M14 50 L50 50", INK, 2.6)),
    # ── Assassin: ink and red ──
    "vanguard/shadowstep": disc(RED, p("M20 46 Q16 32 24 22 Q30 30 28 46 Z", INK, 2) + p("M36 40 Q32 26 40 16 Q46 24 44 40 Z", RED, 2) + line("M12 52 Q32 46 52 52", INK, 2.6)),
    "vanguard/kunai": disc(RED, p("M32 8 L38 26 L34 30 L30 30 L26 26 Z", STEEL, 2.2) + p("M30 30 L34 30 L34 46 L30 46 Z", INK, 1.8) + circ(32, 51, 4.5, "none", 2.6) + line("M14 40 L22 34 M50 40 L42 34", RED, 2.6)),
    "vanguard/inklotus": disc(RED, lotus(RED, 32, 38, 0.95) + line("M10 30 Q32 8 54 30", INK, 2.6)),
    "vanguard/smoke": disc(RED, p("M14 42 Q8 34 16 30 Q16 20 26 22 Q30 12 40 18 Q50 16 50 28 Q58 32 52 42 Z", "#3a2e34", 2.5) + line("M22 34 Q30 30 38 34", "#8a7a80", 2.4)),
    "vanguard/execute": disc(RED, tanto(25) + line("M12 20 Q30 26 44 50", RED, 4) + line("M12 20 Q30 26 44 50", INK, 1.2)),
    "vanguard/deathlotus": disc(RED, lotus(INK, 32, 38, 1.0) + line("M10 50 L54 14", RED, 4.5) + line("M10 50 L54 14", WHITE, 1.2)),
    "vanguard/backstab": disc(RED, p("M18 16 Q30 18 30 32 L30 48 L18 48 Z", "#3a2e34", 2.2) + tanto(-60, STEEL) + p("M44 12 Q56 22 48 34 L52 34 L44 42 L40 32 L44 33 Q48 24 42 16 Z", RED, 2)),
    "vanguard/vault": disc(RED, circ(32, 44, 6, INK, 2) + line("M12 46 Q32 4 52 46", RED, 3.4) + p("M48 40 L53 48 L56 39 Z", RED, 1.6)),
}

# The family's shop cosmetics (the seed migration's sprite_url) and its two nameplate frames (9-slice, 96 px, 18 px border).
SHOP = {
    "vg-skin-ivory-aegis": disc("#e9e2cc", sword(-32, "#f4efe2") + shield("#f4efe2", 2, 2, 0.95)),
    "vg-skin-obsidian-hammer": disc("#3a3440", hammer(-28, "#2a2630")),
    "vg-skin-temple-wraps": disc("#c8202c", fist("#c8202c", 0, 1, 1.05)),
    "vg-skin-moonlit-tanto": disc("#9fb6e8", tanto(-35, "#dfe8ff") + tanto(35, "#dfe8ff")),
    "vg-skin-lotus-fire": disc("#ff6a2a", tanto(-35, "#ffb38a") + tanto(35, "#ffb38a") + lotus("#ff6a2a", 32, 44, 0.55)),
    "vg-aura-sunforge": disc("#ffb347", circ(22, 36, 6, "#ffb347") + circ(38, 26, 7, "#fffbea") + circ(40, 42, 5, "#5a2a08")),
    "vg-aura-ink-ember": disc("#ff5a3c", circ(22, 36, 6, "#ff5a3c") + circ(38, 26, 7, "#fff1ee") + circ(40, 42, 5, "#120709")),
    "vg-aura-dawn-dusk": disc("#ffd36e", circ(22, 34, 7, "#ffd36e") + circ(40, 30, 7, "#8a6cff") + spark(32, 46, 6, "#fffaf0")),
    "vg-frame-hammered": disc("#8a8f99", p("M14 14 L50 14 L50 50 L14 50 Z M22 22 L22 42 L42 42 L42 22 Z", "#8a8f99", 2.4, ' fill-rule="evenodd"') + "".join(circ(x, y, 2.4, GOLD, 1.4) for x, y in [(18, 18), (46, 18), (18, 46), (46, 46)])),
    "vg-frame-brush": disc(RED, line("M14 16 Q30 12 50 16 Q54 32 50 48 Q32 52 14 48 Q10 32 14 16", INK, 5) + p("M42 40 L52 40 L52 50 L42 50 Z", RED, 1.6)),
}
FRAMES = {
    "vanguard-hammered": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M3 3 H93 V93 H3 Z M18 18 V78 H78 V18 Z" fill="#8a8f99" fill-rule="evenodd" stroke="#1d1a24" stroke-width="3"/>'
                          '<path d="M8 8 H88 V88 H8 Z" fill="none" stroke="#c9ccd4" stroke-width="2" stroke-dasharray="6 5"/>'
                          + "".join(f'<circle cx="{x}" cy="{y}" r="3.4" fill="#f0c23c" stroke="#1d1a24" stroke-width="1.5"/>' for x in (10, 48, 86) for y in (10, 86))
                          + "".join(f'<circle cx="{x}" cy="48" r="3.4" fill="#f0c23c" stroke="#1d1a24" stroke-width="1.5"/>' for x in (10, 86)) + '</svg>'),
    "vanguard-brush": ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M6 10 Q48 3 90 9 Q95 48 89 88 Q48 94 7 87 Q2 48 6 10 Z" fill="none" stroke="#1d1a24" stroke-width="9" stroke-linejoin="round"/>'
                       '<path d="M10 14 Q48 8 86 13" fill="none" stroke="#3a2e34" stroke-width="2" stroke-dasharray="14 4 3 6"/>'
                       '<rect x="70" y="70" width="18" height="18" rx="2" fill="#e0303c" stroke="#1d1a24" stroke-width="2"/><path d="M74 75 H84 M79 75 V85 M75 81 H83" stroke="#fff1ee" stroke-width="1.8"/></svg>'),
}


def main():
    written = []
    for name, svg in ICONS.items():
        path = os.path.join(OUT, f"{name}.svg")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w").write(svg + "\n")
        written.append(path)
    for name, svg in SHOP.items():
        path = os.path.join(OUT, "vanguard", "shop", f"{name}.svg")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w").write(svg + "\n")
        written.append(path)
    for name, svg in FRAMES.items():
        path = os.path.join(ROOT, "web", "public", "assets", "game", "frames", f"{name}.svg")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w").write(svg + "\n")
        written.append(path)
    print("wrote", len(written), "icons")
    if "sheet" in sys.argv:
        sheet(written)


def sheet(files):
    """K-vanguard-icons.webp: every icon at 96 px and at 24 px (the nameplate size), labelled."""
    tmp = tempfile.mkdtemp(prefix="vg_icons_")
    args = []
    for i, f in enumerate(files):
        big, small = os.path.join(tmp, f"{i}b.png"), os.path.join(tmp, f"{i}s.png")
        subprocess.run(["rsvg-convert", "-w", "96", "-h", "96", f, "-o", big], check=True)
        subprocess.run(["rsvg-convert", "-w", "24", "-h", "24", f, "-o", small], check=True)
        both = os.path.join(tmp, f"{i}.png")
        subprocess.run(["magick", big, "(", small, "-gravity", "center", "-background", "none", "-extent", "40x96", ")", "+append", both], check=True)
        args += ["-label", os.path.splitext(os.path.basename(f))[0].replace("vg-", ""), both]
    out = os.path.join(ROOT, "specs", "evidence", "classes", "K-vanguard-icons.webp")
    subprocess.run(["magick", "montage", *args, "-tile", "8x", "-geometry", "+6+6", "-background", "#efe6cf", "-fill", "#1d1a24",
                    "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "11", "-quality", "88", out], check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
