# board.py <out.jpg> <cols> <cell_w> <files...>: a contact sheet, labels from file names.
import sys
from PIL import Image, ImageDraw
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in files]
ch = int(cw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
board = Image.new("RGB", (cols * cw, rows * (ch + 18)), (24, 24, 28))
d = ImageDraw.Draw(board)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * cw, (i // cols) * (ch + 18)
    board.paste(im.resize((cw, ch)), (x, y + 18))
    d.text((x + 4, y + 3), f.split("/")[-1].replace(".jpg", "")[-40:], fill=(230, 230, 230))
board.save(out, quality=85)
