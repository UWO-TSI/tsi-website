"""The review sheets (shop phase 2): the headless shots in a labelled grid, one WebP.
  python3 sheet.py <raw-dir> <out.webp> [ground|merch|overlay|keychain|keychain2|keychain3|upstairs]"""
import sys
from PIL import Image, ImageDraw, ImageFont

raw, out = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "ground"
CELLS = [
    ("02-door-view", "From the door: the branded dark round the room, the mezzanine above"),
    ("01-plan-ground", "Ground floor from above (the mezzanine cut away)"),
    ("03-items-walk", "In-game items, the changing rooms behind the stair"),
    ("06-counter-close", "Glazed tile, timber top, the shopkeeper, herringbone oak"),
    ("07-tools-shelving", "Tools table; dyes and accessories on edge-lit shelving"),
    ("08-showroom", "Furniture dais: wallpapers behind, floorings in front"),
    ("09-clothes-stair", "Clothes rail and shoe table by the stair"),
    ("10-seasonal", "Front plinths by the window: today's specials"),
    ("05-changing-rooms", "Three changing rooms behind the stair"),
    ("11-item-tag", "Near an item: its name and a mini image"),
    ("12-shopkeeper", "E at the counter: the two answers"),
    ("16-merch-grid", "Club merch: David's grid of white cards"),
]
MERCH = [
    ("16-merch-grid", "The grid: still renders on white, kind · Tethos club, the Gem pill, the arrow, a tag"),
    ("17-merch-filter", "The filter pills: the Tethos mark on the active one"),
    ("18-merch-detail", "Opened: the model turning with the pixel finish, the redeem button"),
    ("19-merch-phone", "On a phone: one card across"),
]
OVERLAY = [
    ("20-overlay-grid", "The shop overlay: one grey panel, shelf icons down the left, white cards, coins and Gems top left"),
    ("21-overlay-detail-item", "An in-game item opened: the model large and turning (drag it), title, line, price, Buy; specs below"),
    ("22-overlay-detail-clothes", "Clothes open on their own part, turning"),
    ("23-overlay-merch", "Club merch: the same grid; the tags (staff pick, new drop)"),
    ("24-overlay-keychain", "The keychain opened: it hangs and turns; drag turns it, a tap on the keycap clicks"),
    ("26-overlay-phone", "On a phone: the shelves across the top, one card a row"),
    ("10-window-before", "The window before (ground floor approved; 'window needs a lil work')"),
    ("27-window-after", "The window after: a recessed white frame, mullion and transom, a deeper sill, softer drapes on a rod"),
    ("28-window-close", "The window after, close"),
]
KEYCHAIN = [
    ("photo-3095", "David's photo: hanging from its keyring"),
    ("turn-0", "The model from the front (1 unit = 10 cm; 2,410 triangles)"),
    ("photo-3096", "David's photo: the keycap's Tethos mark"),
    ("turn-45", "Three-quarter: the switch in the acrylic, the keycap"),
    ("photo-3098", "David's photo: the side, the switch through the acrylic"),
    ("turn-90", "From the side"),
    ("photo-3099", "David's photo: three-quarter, the pins"),
    ("turn-180", "From the back: the pins through the acrylic"),
    ("sprite", "The 2D sprite (its icon, a render of the model): for lite graphics or a failed viewer"),
    ("turn-270", "From the other side"),
    ("29-keychain-wall", "On its hook on the mezzanine's merch wall, display scale 1 (about 12x life size)"),
    ("31-keychain-drag", "Taken hold of: a real pointer drag pulls it aside and twists it"),
    ("32-keychain-swing", "Let go: it swings back (no walk is ordered by the drag)"),
    ("33-keychain-press", "Its keycap pressed, with the click (muted for the shot)"),
    ("24-overlay-keychain", "In the merch view: turning with the pixel finish"),
    ("25-overlay-keychain-dragged", "Dragged round in the merch view"),
    ("viewer-drag", "The standalone viewer: pulled about"),
    ("viewer-press", "The standalone viewer: the keycap pressed"),
]
KEYCHAIN2 = [
    ("photo-keyring", "David's photo (IMG_3096): the spring-gate keyring"),
    ("close-keyring", "The model: a pear-shaped ring, its gate bar on the inner side, the collar and its eye, the jump ring"),
    ("photo-clasp", "David's photo (IMG_3099): the lobster clasp on the block's loop"),
    ("close-clasp", "The model: the lobster body, its gate and trigger, the tail ring, the snake chain's end cap"),
    ("cap-on", "Keycap on"),
    ("cap-off-wide", "Keycap off: lifted straight off the stem, hovering beside the block"),
    ("photo-switch", "David's photo (IMG_3100): the switch, keycap off"),
    ("switch-close", "The bare switch: top housing and its four corner clips, the seam, the yellow cross stem"),
    ("switch-pressed", "Pressed with the keycap off: the stem goes in, with the same click"),
    ("switch-side", "From the side: the housing's two halves, the gold pins in the acrylic"),
    ("merch-cap-on", "The merch view with the button: Take keycap off"),
    ("merch-cap-off", "...and Put keycap on"),
    ("29-keychain-wall", "On the merch wall: the metal now polished silver, not white"),
    ("sprite", "The 2D sprite now keeps the acrylic block"),
]
KEYCHAIN3 = [
    ("p-3111", "The keyring clasp face on: the flat strap, the nose's bulbous tip, the base, its eye, the knuckle, the gate"),
    ("p-3112", "Edge on: the gate's wire loop across the clasp, wide at the nose; the base a thick bullet; the split ring"),
    ("p-3099", "From below left: the base's thickness, the eye's rounded edge"),
    ("p-3096", "Turned a little about the gate, so the loop shows its width (the photo the round-1 model was drawn from)"),
    ("p-side", "Side on, both sides: strap about 2:1, the base about 3.6 times the strap's thickness at the knuckle"),
    ("p-3113", "The lobster through the block's clear lug (a rectangular hole), the split ring, the end cap's flat tab"),
    ("p-lob", "The lobster: curved teardrop body, seam groove, trigger tab out and down by the tail, the hook"),
    ("p-3114", "The chain: smooth bullet caps with crimp collars and pierced tabs, a tight spiral, about 4.5 caps long"),
    ("p-3116", "The switch top, keycap off: the yellow stem and its cross, the milky housing, the LED window"),
    ("g-merch", "In the merch view: keycap on, and off"),
    ("29-keychain-wall", "On the merch wall, its clasp on the peg (display scale 1.4)"),
    ("33-keychain-press", "The keycap pressed on the wall"),
    ("v-viewer", "The standalone viewer, rebuilt"),
    ("sprite", "The 2D sprite (re-rendered), and the bare switch pressed in the viewer"),
]
UPSTAIRS = [(f"{side}-{n}", f"{'Before' if side == 'b' else 'After'}: {cap}") for n, cap in (
    ("u1-door", "from the door"), ("u2-top-of-stairs", "from the top of the stairs"), ("u3-merch-walk", "at the merch wall"),
    ("u4-merch-across", "across the mezzanine"), ("u5-counter", "the counter and the pegboard"), ("u6-plinths", "the featured drop"),
    ("u7-plan", "from above")) for side in ("b", "a")]
TITLE = "Shop, phase 2: the furnished ground floor (headless, in-game)"
if mode == "merch":
    CELLS, TITLE = MERCH, "Shop, phase 2: the club merch screen, after David's reference"
if mode == "overlay":
    CELLS, TITLE = OVERLAY, "Shop: the overlay redo after David's three references, and the window pass"
if mode == "keychain":
    CELLS, TITLE = KEYCHAIN, "Shop: the TSI keycap keychain, from David's photos"
if mode == "upstairs":
    CELLS, TITLE = UPSTAIRS, "Shop upstairs: before (the layout's blocks) and after (furnished after ref 1)"
if mode == "keychain3":
    CELLS, TITLE = KEYCHAIN3, "The keycap keychain, round 2: each photo beside the model at its angle (5,913 triangles)"
if mode == "keychain2":
    CELLS, TITLE = KEYCHAIN2, "The keycap keychain: the clasp and keyring, keycap off and on, the bare switch (3,460 triangles)"
W, H, PAD, CAP = 720, 450, 14, 34
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17)
title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 26)
cols = 2 if mode in ("merch", "keychain", "keychain2", "keychain3", "upstairs") else 3
rows = (len(CELLS) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + PAD) + PAD, rows * (H + CAP + PAD) + PAD + 50), "#1d1f22")
d = ImageDraw.Draw(sheet)
d.text((PAD, 14), TITLE, font=title, fill="#f2efe8")
for i, (name, cap) in enumerate(CELLS):
    im = Image.open(f"{raw}/{name}.png").convert("RGB")
    # crop to the cell's 16:10, centred, then fit; a portrait shot (a phone) is fitted whole on the sheet's dark
    r = W / H
    iw, ih = im.size
    if iw < ih or (mode in ("keychain", "keychain2", "keychain3") and abs(iw / ih - r) > 0.05):
        k = min(H / ih, W / iw)
        fitted = im.resize((int(iw * k), int(ih * k)), Image.LANCZOS)
        im = Image.new("RGB", (W, H), "#1d1f22")
        im.paste(fitted, ((W - fitted.width) // 2, (H - fitted.height) // 2))
    elif iw / ih > r:
        nw = int(ih * r); im = im.crop(((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih))
    else:
        nh = int(iw / r); im = im.crop((0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh))
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    x = PAD + (i % cols) * (W + PAD)
    y = 50 + PAD + (i // cols) * (H + CAP + PAD)
    sheet.paste(im, (x, y))
    # the caption, cut to the cell's width (the full captions are in specs/interiors/shop.md)
    text = f"{i + 1}. {cap}"
    while d.textlength(text, font=font) > W - 4 and len(text) > 8:
        text = text[:-2].rstrip() + "…" if not text.endswith("…") else text[:-2].rstrip() + "…"
    d.text((x + 2, y + H + 8), text, font=font, fill="#e9e5dc")
sheet.save(out, "WEBP", quality=86)
print(out, sheet.size)
