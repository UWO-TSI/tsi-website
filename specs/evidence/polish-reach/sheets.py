"""Reachability evidence sheets (WebP): the resident conversation strip, the wallet, the sign-in links, the companion's
tabs at iPhone size before | after, and the Residents editor.

    python3 specs/evidence/polish-reach/sheets.py <before_dir> <after_dir> <out_dir>

Every tile is checked before a sheet is written: a blank or nearly uniform capture (a page that never rendered) is
reported and that sheet is not made, so no sheet ships with an empty tile.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BEFORE, AFTER, OUT = (Path(a) for a in sys.argv[1:4])
OUT.mkdir(parents=True, exist_ok=True)
FONT = "web/public/fonts/nunito/Nunito-Variable.ttf"
INK, PAGE, MUTED = (58, 46, 34), (247, 241, 218), (120, 104, 84)


def font(size, weight=800):
    try:
        f = ImageFont.truetype(FONT, size)
        f.set_variation_by_axes([weight])
        return f
    except Exception:
        return ImageFont.load_default()


def blank(img):
    """Almost every pixel the frame's dominant colour: a page that never drew. A sparse page with some text is not."""
    g = img.convert("L").resize((480, 300))
    hist = g.histogram()
    mode = max(range(256), key=hist.__getitem__)
    near = sum(hist[max(0, mode - 12):min(256, mode + 13)])
    return 1 - near / (g.width * g.height) < 0.003


def tile(img, caption, w, h, tag=None, sub=None):
    """The image fitted in w x h under its caption (and a second, quieter line)."""
    head = 58 if sub else 36
    t = Image.new("RGB", (w, h + head), PAGE)
    im = img.convert("RGB").copy()
    im.thumbnail((w, h))
    t.paste(im, ((w - im.width) // 2, head))
    d = ImageDraw.Draw(t)
    d.text((8, 6), caption, font=font(19), fill=INK)
    if sub:
        d.text((8, 32), sub, font=font(15, 600), fill=MUTED)
    if tag:
        tw = d.textlength(tag, font=font(16))
        d.rounded_rectangle((w - tw - 26, 5, w - 6, 29), radius=12, fill=(255, 238, 160) if tag == "After" else (238, 233, 202))
        d.text((w - tw - 16, 7), tag, font=font(16), fill=INK)
    return t


def sheet(title, tiles, cols, file, note=None):
    """Tiles in a grid under a title; refuses to write a sheet with an empty tile."""
    problems = [cap for img, cap, *_ in tiles if img is None or blank(img)]
    if problems:
        print("NOT MADE", file, "empty or missing:", problems)
        return
    made = [tile(img, cap, *rest) for img, cap, *rest in tiles]
    tw, th = max(t.width for t in made), max(t.height for t in made)
    rows = (len(made) + cols - 1) // cols
    top = 70 if note else 50
    out = Image.new("RGB", (cols * tw + (cols + 1) * 12, top + rows * (th + 12) + 12), PAGE)
    d = ImageDraw.Draw(out)
    d.text((14, 10), title, font=font(26), fill=INK)
    if note:
        d.text((14, 42), note, font=font(16, 600), fill=MUTED)
    for i, t in enumerate(made):
        out.paste(t, (12 + (i % cols) * (tw + 12), top + (i // cols) * (th + 12)))
    out.save(OUT / file, "WEBP", quality=82, method=6)
    print("made", file, out.size)


def load(d, name):
    p = d / f"{name}.png"
    return Image.open(p) if p.exists() else None


# 1. A resident conversation, frame by frame.
TALK = [("talk-0-prompt", "Walk up: \"Talk to …\""), ("talk-1-turning", "E: they stop, a \"!\", they turn to you"), ("talk-2-typing", "The line types out in their voice"),
        ("talk-3-line-down", "Down: the chevron bobs"), ("talk-4-next-line", "E: the next line, its own face"), ("talk-5-goodbye", "After the last: a wave goodbye"),
        ("talk-6-after", "They walk on from where they stopped")]
sheet("Talking to a resident (1440 x 900, frames of one conversation)", [(load(AFTER, n), c, 700, 438) for n, c in TALK], 4, "01-resident-talk-strip.webp",
      note="Mayor Eliza at 2 pm. The box is the GUI sheet's Dialogue; the camera eases in and steps off your shoulder only as far as it needs.")

# 1b. The same conversation, close: the "!", the mouth while a line types, the line's face, the goodbye wave.
CLOSE = [("talk-1-turning", "E: a \"!\" as she turns"), ("talk-2-typing", "Typing: the Chat clip, her mouth"), ("talk-3-line-down", "Down: mouth closed"),
         ("talk-4-next-line", "\"[happy] The club monument…\""), ("talk-5-goodbye", "Goodbye: a wave and a smile")]
crop = lambda img: img.crop((430, 330, 890, 650)) if img else None
sheet("Talking to a resident, close (crops of the frames above)", [(crop(load(AFTER, n)), c, 460, 320) for n, c in CLOSE], 5, "01b-resident-talk-closeups.webp")

# 2. The wallet.
WALLET = [("wallet-1-gift-waiting", "K: TC, Gems, today's gift waiting, what you earned"), ("wallet-2-gift-opened", "Opened right there: the HUD counts it in"),
          ("wallet-3-spent", "Spent: each move said plainly, by day"), ("wallet-4-from-coins", "The HUD's coins open it too")]
sheet("The wallet sheet (K, or click the coins)", [(load(AFTER, n), c, 700, 438) for n, c in WALLET], 2, "02-wallet.webp",
      note="TC and Gems only: no money, no rate between them.")

# 3. Sign-in links (signed out on the island).
SIGNIN = [("signin-1-toast", "A toast: \"Sign in\" is the link"), ("signin-2-mailbox", "The mailbox: a Sign in button"), ("signin-3-wallet", "The wallet: the words link"),
          ("signin-4-entry", "Where it lands: /student?next=%2Flab%2Fisland…")]
sheet("Sign-in links, signed out (each goes to /student?next=<this page>)", [(load(AFTER, n), c, 700, 438) for n, c in SIGNIN], 2, "03-sign-in-links.webp")

# 4. The companion at iPhone size, before | after.
PAIRS = [("study", "Study"), ("club", "Club: bounties"), ("club-calendar", "Club: calendar"), ("me", "Me"), ("me-bag", "Me: Bag"),
         ("me-collection", "Me: Collection"), ("me-mailbox", "Me: Mailbox"), ("me-showcase", "Me: Your showcase"), ("signed-out", "Signed out")]
tiles = []
for n, cap in PAIRS:
    tiles.append((load(BEFORE, f"companion-{n}"), cap, 300, 650, "Before"))
    tiles.append((load(AFTER, f"companion-{n}"), cap, 300, 650, "After"))
sheet("The phone companion (390 x 844), before | after", tiles, 6, "04-companion-before-after.webp",
      note="Before: main at a84643f9. After: this branch (the coin chip, six Me tiles, the filters fading where they scroll, Sign in going to /student?next=%2Fstudent%2Fcompanion). The bounty cards' badges changed with today's portal fixes.")
NEW = [("me-journal", "Journal (quests)"), ("me-wallet", "The coins: Wallet"), ("me-settings", "Settings, phone's part"),
       ("chips-scrolled", "Filters at the end")]
sheet("The phone companion (390 x 844): what's new", [(load(AFTER, f"companion-{n}"), c, 300, 650, "After") for n, c in NEW], 4, "05-companion-new.webp")

# 5. The Residents editor.
sheet("Residents editor: conversations as authored data (T1/T2)", [(load(AFTER, "editor-conversations"), "A conversation per box; [happy] for the face; a bad expression is refused", 900, 640)], 1,
      "06-residents-editor.webp")
